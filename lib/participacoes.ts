import ExcelJS from 'exceljs';
import lockfile from 'proper-lockfile';
import { mkdir, readFile, open, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type Participacao = {
  name: string; crmv: string; email: string; phone: string;
  area: string; otherArea: string; cities: string[]; improvements: string;
};

export function diretorioDados() {
  return path.resolve(process.env.PARTICIPACOES_DIR || path.join(process.cwd(), 'data'));
}

const nomeArquivo = 'cadastros.xlsx';
const cabecalhos = ['Data e hora (Fortaleza)', 'Nome completo', 'Nº CRMV', 'E-mail',
  'Celular / WhatsApp', 'Área de atuação', 'Cidades de atuação', 'Sugestões para o CRMV'];

async function carregar() {
  const workbook = new ExcelJS.Workbook();
  let bytes;
  try {
    bytes = await readFile(path.join(diretorioDados(), nomeArquivo));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (bytes) {
    await workbook.xlsx.load(Uint8Array.from(bytes).buffer);
    if (!workbook.getWorksheet('Respostas')) throw new Error('Planilha sem a aba Respostas.');
  } else {
    const sheet = workbook.addWorksheet('Respostas', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.addRow(cabecalhos);
    sheet.columns.forEach((column, index) => { column.width = index >= 6 ? 60 : 28; });
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF087D82' } };
  }
  return workbook;
}

export async function salvarParticipacao(data: Participacao) {
  const directory = diretorioDados();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const release = await lockfile.lock(directory, {
    lockfilePath: path.join(directory, '.cadastros.lock'),
    stale: 60000,
    retries: { retries: 30, minTimeout: 100, maxTimeout: 500 },
  });
  const temporary = path.join(directory, `.cadastros-${randomUUID()}.tmp`);
  try {
    const workbook = await carregar();
    const sheet = workbook.getWorksheet('Respostas')!;
    const timestamp = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'medium',
    }).format(new Date());
    // Strings permanecem texto, inclusive telefones, registros e entradas com '='.
    const row = sheet.addRow([timestamp, data.name, data.crmv, data.email, data.phone,
      data.area === 'Outra' ? data.otherArea : data.area, data.cities.join('; '), data.improvements]);
    row.eachCell(cell => { cell.numFmt = '@'; cell.alignment = { vertical: 'top', wrapText: true }; });
    sheet.autoFilter = { from: 'A1', to: `H${sheet.rowCount}` };
    const buffer = await workbook.xlsx.writeBuffer();
    const file = await open(temporary, 'wx', 0o600);
    try {
      await file.writeFile(Buffer.from(buffer));
      await file.sync();
    } finally {
      await file.close();
    }
    // Troca atômica: downloads enxergam o arquivo completo, nunca uma escrita parcial.
    await rename(temporary, path.join(directory, nomeArquivo));
  } finally {
    await unlink(temporary).catch(() => {});
    await release();
  }
}

export async function baixarPlanilha() {
  try {
    return await readFile(path.join(diretorioDados(), nomeArquivo));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return Buffer.from(await (await carregar()).xlsx.writeBuffer());
  }
}
