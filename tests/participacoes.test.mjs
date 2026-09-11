import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import ExcelJS from 'exceljs';

const blobs = new Map();
let failure;
let putCalls = 0;
let listCalls = 0;
mock.module('@vercel/blob', { namedExports: {
  put: async (pathname, body, options) => {
    putCalls++;
    assert.equal(options.access, 'private');
    assert.equal(options.allowOverwrite, false);
    assert.equal(options.addRandomSuffix, false);
    assert.equal(options.token, undefined); // OIDC fica a cargo do SDK.
    if (failure === 'put') throw new Error('Blob indisponível');
    assert.equal(blobs.has(pathname), false);
    blobs.set(pathname, body);
    return { pathname };
  },
  list: async ({ prefix, cursor }) => {
    listCalls++;
    const paths = [...blobs.keys()].filter(key => key.startsWith(prefix)).sort();
    const start = Number(cursor || 0);
    const end = start + 3; // Força paginação mesmo com poucos registros.
    return { blobs: paths.slice(start, end).map(pathname => ({ pathname })), hasMore: end < paths.length, cursor: String(end) };
  },
  get: async (pathname, options) => {
    assert.equal(options.access, 'private');
    assert.equal(options.useCache, false);
    if (failure === 'get') return null;
    return { statusCode: 200, stream: new Response(blobs.get(pathname)).body };
  },
} });
const { POST } = await import('../app/api/participacoes/route.ts');
const { GET } = await import('../app/api/participacoes/planilha/route.ts');
const payload = { name: 'Maria Silva', crmv: '00123', email: 'maria@example.com', phone: '(85) 99999-9999', area: 'Outra', otherArea: 'Consultoria', cities: ['Fortaleza - CE'], improvements: '=1+1' };
const request = (body = payload, origin = 'https://pesquisa.example') => new Request('https://pesquisa.example/api/participacoes', {
  method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const download = (password) => GET(new Request('https://pesquisa.example/api/participacoes/planilha', {
  headers: password === undefined ? {} : { authorization: 'Basic ' + Buffer.from('admin:' + password).toString('base64') },
}));
async function sheetFrom(bytes) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  return workbook.getWorksheet('Respostas');
}

test('Blob privado: concorrência, paginação, redeploy, Excel e autenticação', async () => {
  const keys = ['BLOB_STORE_ID', 'BLOB_READ_WRITE_TOKEN', 'PLANILHA_SENHA', 'VERCEL_ENV'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.BLOB_STORE_ID = 'store-test';
  delete process.env.BLOB_READ_WRITE_TOKEN;
  process.env.PLANILHA_SENHA = 'test-password';
  process.env.VERCEL_ENV = 'production';
  const logs = mock.method(console, 'error', () => {});
  try {
    assert.equal((await download()).status, 401);
    assert.equal((await download('wrong')).status, 401);
    assert.equal(listCalls, 0);
    const empty = await download('test-password');
    assert.equal(empty.status, 200);
    assert.equal((await sheetFrom(Buffer.from(await empty.arrayBuffer()))).rowCount, 1);
    assert.equal((await POST(request(payload, 'https://another.example'))).status, 403);
    for (const invalid of [{ cities: [] }, { otherArea: '' }, { email: 'invalid' }, { phone: '123' }, { name: 'Maria' }, { improvements: 'a'.repeat(2001) }, { improvements: '' }]) {
      assert.equal((await POST(request({ ...payload, ...invalid }))).status, 400);
    }
    assert.equal(putCalls, 0);
    const responses = await Promise.all(Array.from({ length: 8 }, (_, index) => POST(request({ ...payload, name: `Pessoa Teste ${index}` }))));
    for (const response of responses) {
      assert.equal(response.status, 200);
      assert.equal((await response.json()).ok, true);
    }
    assert.equal(blobs.size, 8);
    process.env.VERCEL_ENV = 'preview';
    assert.equal((await POST(request())).status, 200);
    assert.equal(blobs.size, 9);
    process.env.VERCEL_ENV = 'production';
    const result = await download('test-password');
    assert.equal(result.status, 200);
    assert.match(result.headers.get('content-disposition'), /cadastros.xlsx/);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    const sheet = await sheetFrom(Buffer.from(await result.arrayBuffer()));
    assert.equal(sheet.rowCount, 9); // Exclui o cadastro de preview.
    assert.ok(listCalls >= 4);
    const names = [];
    sheet.eachRow((row, number) => {
      if (number === 1) return;
      names.push(row.getCell(2).value);
      assert.equal(row.getCell(3).value, '00123');
      assert.equal(row.getCell(5).value, '85999999999');
      assert.equal(row.getCell(6).value, 'Consultoria');
      assert.equal(row.getCell(8).value, '=1+1');
      assert.equal(row.getCell(8).type, ExcelJS.ValueType.String);
    });
    assert.equal(new Set(names).size, 8);
    // Nova instância do módulo recupera os mesmos objetos, sem depender de arquivos locais.
    const fresh = await import('../lib/participacoes.ts?redeploy');
    assert.equal((await sheetFrom(await fresh.baixarPlanilha())).rowCount, 9);
    failure = 'get';
    assert.equal((await download('test-password')).status, 500); // Não entrega Excel incompleto.
    failure = 'put';
    const failed = await POST(request());
    assert.equal(failed.status, 502);
    assert.equal((await failed.json()).ok, false);
    assert.equal(blobs.size, 9);
    failure = undefined;
    delete process.env.BLOB_STORE_ID;
    assert.equal((await POST(request())).status, 503);
    assert.equal((await download('test-password')).status, 503);
    assert.equal(blobs.size, 9);
    delete process.env.PLANILHA_SENHA;
    assert.equal((await download()).status, 503);
  } finally {
    logs.mock.restore();
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});
