import ExcelJS from 'exceljs';
import { get, list, put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';

export type Participacao = {
  name: string; crmv: string; email: string; phone: string;
  area: string; otherArea: string; cities: string[]; improvements: string;
};

export type Registro = Participacao & { version: 1; id: string; createdAt: string };

export class ArmazenamentoNaoConfigurado extends Error {
  constructor() {
    super('Conecte um Blob privado ao projeto da Vercel.');
    this.name = 'ArmazenamentoNaoConfigurado';
  }
}

function prefixo() {
  if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new ArmazenamentoNaoConfigurado();
  }
  // Deploys de teste não entram na planilha de produção.
  const ambiente = process.env.VERCEL_ENV === 'production' ? 'production'
    : process.env.VERCEL_ENV === 'preview' ? 'preview' : 'development';
  return `cadastros/v1/${ambiente}/`;
}

export async function salvarParticipacao(data: Participacao) {
  const pasta = prefixo();
  const registro: Registro = { ...data, version: 1, id: randomUUID(), createdAt: new Date().toISOString() };
  // Cada envio cria um objeto imutável: não há disputa por um XLSX compartilhado.
  // O SDK usa OIDC + BLOB_STORE_ID na Vercel; token é opcional para execução local.
  await put(`${pasta}${registro.createdAt}-${registro.id}.json`, JSON.stringify(registro), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: false,
  });
}

function lerRegistro(value: unknown): Registro {
  if (!value || typeof value !== 'object') throw new Error('Registro inválido no Blob.');
  const row = value as Record<string, unknown>;
  const fields = ['id', 'createdAt', 'name', 'crmv', 'email', 'phone', 'area', 'otherArea', 'improvements'];
  if (row.version !== 1 || fields.some(field => typeof row[field] !== 'string') ||
      !Number.isFinite(Date.parse(row.createdAt as string)) || !Array.isArray(row.cities) ||
      row.cities.some(city => typeof city !== 'string')) {
    throw new Error('Registro inválido no Blob.');
  }
  return value as Registro;
}

export async function listarParticipacoes() {
  const pasta = prefixo();
  const registros: Registro[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: pasta, limit: 1000, ...(cursor ? { cursor } : {}) });
    // Limita as leituras simultâneas e percorre todas as páginas do armazenamento.
    for (let index = 0; index < page.blobs.length; index += 10) {
      const batch = await Promise.all(page.blobs.slice(index, index + 10).map(async blob => {
        const result = await get(blob.pathname, { access: 'private', useCache: false });
        if (!result || result.statusCode !== 200) throw new Error('Não foi possível ler um cadastro.');
        return lerRegistro(await new Response(result.stream).json());
      }));
      registros.push(...batch);
    }
    if (page.hasMore && (!page.cursor || page.cursor === cursor)) throw new Error('Paginação inválida do Blob.');
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  registros.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return registros;
}

export async function baixarPlanilha() {
  const registros = await listarParticipacoes();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Respostas', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.addRow(['Data e hora (Fortaleza)', 'Nome completo', 'Nº CRMV', 'E-mail',
    'Celular / WhatsApp', 'Área de atuação', 'Cidades de atuação', 'Sugestões para o CRMV']);
  sheet.columns.forEach((column, index) => { column.width = index >= 6 ? 60 : 28; });
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF087D82' } };
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'medium',
  });
  for (const data of registros) {
    const row = sheet.addRow([formatter.format(new Date(data.createdAt)), data.name, data.crmv,
      data.email, data.phone, data.area === 'Outra' ? data.otherArea : data.area,
      data.cities.join('; '), data.improvements]);
    // Telefones, zeros à esquerda e entradas começando com '=' continuam como texto.
    row.eachCell(cell => { cell.numFmt = '@'; cell.alignment = { vertical: 'top', wrapText: true }; });
  }
  sheet.autoFilter = { from: 'A1', to: `H${sheet.rowCount}` };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
