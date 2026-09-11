import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { POST } from '../app/api/participacoes/route.ts';
import { GET } from '../app/api/participacoes/planilha/route.ts';

const payload = { name: 'Maria Silva', crmv: '00123', email: 'maria@example.com', phone: '(85) 99999-9999', area: 'Outra', otherArea: 'Consultoria', cities: ['Fortaleza - CE'], improvements: '=1+1' };
const request = (body = payload, origin = 'https://pesquisa.example') => new Request('https://pesquisa.example/api/participacoes', {
  method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const download = (password) => GET(new Request('https://pesquisa.example/api/participacoes/planilha', {
  headers: password === undefined ? {} : { authorization: 'Basic ' + Buffer.from('admin:' + password).toString('base64') },
}));

test('cadastros locais: validação, concorrência, persistência, Excel e acesso privado', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'crmv-excel-'));
  const oldDir = process.env.PARTICIPACOES_DIR;
  const oldPassword = process.env.PLANILHA_SENHA;
  process.env.PARTICIPACOES_DIR = dir;
  process.env.PLANILHA_SENHA = 'test-password';
  try {
    assert.equal((await download()).status, 401);
    assert.equal((await download('wrong')).status, 401);
    const empty = await download('test-password');
    assert.equal(empty.status, 200);
    const emptyWorkbook = new ExcelJS.Workbook();
    await emptyWorkbook.xlsx.load(Buffer.from(await empty.arrayBuffer()));
    assert.equal(emptyWorkbook.getWorksheet('Respostas').rowCount, 1);
    assert.equal((await POST(request(payload, 'https://another.example'))).status, 403);
    for (const invalid of [{ cities: [] }, { otherArea: '' }, { email: 'invalid' }, { phone: '123' }, { name: 'Maria' }, { improvements: 'a'.repeat(2001) }, { improvements: '' }]) {
      assert.equal((await POST(request({ ...payload, ...invalid }))).status, 400);
    }
    const responses = await Promise.all(Array.from({ length: 8 }, (_, index) => POST(request({ ...payload, name: `Pessoa Teste ${index}` }))));
    for (const response of responses) {
      assert.equal(response.status, 200);
      assert.equal((await response.json()).ok, true);
    }
    // Uma nova requisição lê o arquivo existente e acrescenta a resposta.
    assert.equal((await POST(request())).status, 200);
    const result = await download('test-password');
    assert.equal(result.status, 200);
    assert.match(result.headers.get('content-disposition'), /cadastros.xlsx/);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await result.arrayBuffer()));
    const sheet = workbook.getWorksheet('Respostas');
    assert.equal(sheet.rowCount, 10);
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
    assert.equal(new Set(names).size, 9);
    // Não substitui silenciosamente um arquivo ilegível por uma planilha vazia.
    const filename = path.join(dir, 'cadastros.xlsx');
    await writeFile(filename, 'arquivo ilegível');
    assert.equal((await POST(request())).status, 502);
    assert.equal(await readFile(filename, 'utf8'), 'arquivo ilegível');
    assert.equal((await download('test-password')).status, 200); // download preserva os bytes originais
    delete process.env.PLANILHA_SENHA;
    assert.equal((await download()).status, 503);
  } finally {
    if (oldDir === undefined) delete process.env.PARTICIPACOES_DIR;
    else process.env.PARTICIPACOES_DIR = oldDir;
    if (oldPassword === undefined) delete process.env.PLANILHA_SENHA;
    else process.env.PLANILHA_SENHA = oldPassword;
    await rm(dir, { recursive: true, force: true });
  }
});
