import { salvarParticipacao, ArmazenamentoNaoConfigurado } from '../../../lib/participacoes.ts';

export const runtime = 'nodejs';
export const maxDuration = 60;

const uncertainMessage = 'Não foi possível confirmar o envio. Sua resposta pode ter sido recebida; evite reenviar antes de confirmar com a equipe da pesquisa.';

function json(body: object, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function validOrigin(request: Request) {
  // O navegador conhece a origem pública; request.url pode usar o host interno
  // do Next.js após um proxy ou o encerramento de HTTPS.
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site' || fetchSite === 'same-site') return false;
  if (fetchSite === 'same-origin') return true;

  const origin = request.headers.get('origin');
  if (!origin) return true; // Clientes de servidor não enviam Origin.
  try {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) return false;
    return parsed.origin === new URL(request.url).origin ||
      parsed.host === request.headers.get('host');
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!validOrigin(request)) {
    return json({ ok: false, message: 'Origem da requisição inválida.' }, 403);
  }

  let data: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 20000) return json({ ok: false, message: 'O formulário excedeu o tamanho permitido.' }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    data = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, message: 'Dados do formulário inválidos.' }, 400);
  }

  const text = (key: string, max: number) => {
    const value = data[key];
    return typeof value === 'string' && value.trim().length <= max ? value.trim() : '';
  };
  const name = text('name', 150);
  const crmv = text('crmv', 40);
  const email = text('email', 200);
  const phone = text('phone', 30).replace(/\D/g, '');
  const area = text('area', 150);
  const otherArea = text('otherArea', 150);
  const cities = data.cities;
  if (typeof data.improvements !== 'string' || !data.improvements.trim() ||
      data.improvements.length > 2000) {
    return json({ ok: false, message: 'Informe sua sugestão para o CRMV em até 2.000 caracteres.' }, 400);
  }
  const improvements = text('improvements', 2000);
  if (!name || name.split(/\s+/).length < 2 || !crmv ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.length !== 11 ||
      !area || (area === 'Outra' && !otherArea) ||
      !Array.isArray(cities) || !cities.length || cities.length > 100 ||
      cities.some(city => typeof city !== 'string' || !city.trim() || city.trim().length > 100)) {
    return json({ ok: false, message: 'Confira os campos obrigatórios, o e-mail, o celular com DDD e as cidades.' }, 400);
  }

  try {
    await salvarParticipacao({ name, crmv, email, phone, area, otherArea, cities: (cities as string[]).map(city => city.trim()), improvements });
    return json({ ok: true, message: 'Participação registrada com sucesso.' });
  } catch (error) {
    // Não repetir automaticamente: uma interrupção pode ocorrer após a gravação.
    // Registra o diagnóstico no servidor sem incluir os dados pessoais do formulário.
    const code = (error as NodeJS.ErrnoException)?.code || 'UNKNOWN';
    console.error('[participacoes] Falha no Blob privado', { code, type: error instanceof Error ? error.name : 'Unknown' });
    if (error instanceof ArmazenamentoNaoConfigurado) {
      return json({ ok: false, message: 'O armazenamento dos cadastros ainda não foi configurado pela equipe.' }, 503);
    }
    return json({ ok: false, message: uncertainMessage }, 502);
  }
}
