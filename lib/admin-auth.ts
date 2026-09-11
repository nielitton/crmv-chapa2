import { createHash, timingSafeEqual } from 'node:crypto';

export const privateHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

export function verificarAcesso(request: Request, browserPrompt = false): Response | null {
  const password = process.env.PLANILHA_SENHA;
  if (!password) return new Response('O acesso administrativo ainda não foi configurado.', { status: 503, headers: privateHeaders });
  const authorization = request.headers.get('authorization') || '';
  const credentials = /^Basic /i.test(authorization) ? Buffer.from(authorization.slice(6), 'base64').toString('utf8') : '';
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(digest(credentials), digest(`admin:${password}`))) {
    return new Response('Senha incorreta. Tente novamente.', {
      status: 401,
      headers: { ...privateHeaders, ...(browserPrompt ? { 'WWW-Authenticate': 'Basic realm="Planilha de cadastros", charset="UTF-8"' } : {}) },
    });
  }
  return null;
}
