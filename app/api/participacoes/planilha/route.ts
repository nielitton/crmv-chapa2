import { createHash, timingSafeEqual } from 'node:crypto';
import { baixarPlanilha } from '../../../../lib/participacoes.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

export async function GET(request: Request) {
  const password = process.env.PLANILHA_SENHA;
  if (!password) return new Response('Configure PLANILHA_SENHA no servidor para habilitar o download.', { status: 503, headers });
  const authorization = request.headers.get('authorization') || '';
  const credentials = /^Basic /i.test(authorization) ? Buffer.from(authorization.slice(6), 'base64').toString('utf8') : '';
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(digest(credentials), digest(`admin:${password}`))) {
    return new Response('Informe o usuário e a senha para baixar a planilha.', {
      status: 401,
      headers: { ...headers, 'WWW-Authenticate': 'Basic realm="Planilha de cadastros", charset="UTF-8"' },
    });
  }
  try {
    const bytes = await baixarPlanilha();
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...headers,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="cadastros.xlsx"',
      },
    });
  } catch {
    return new Response('Não foi possível baixar a planilha. Tente novamente.', { status: 500, headers });
  }
}
