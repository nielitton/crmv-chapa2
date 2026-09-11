export const runtime = 'nodejs';

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
  const url = process.env.GOOGLE_SHEETS_URL;
  const token = process.env.GOOGLE_SHEETS_TOKEN;
  if (!url || !token) return json({ ok: false, message: 'O envio da pesquisa ainda não foi configurado.' }, 503);

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
  if (!name || name.split(/\s+/).length < 2 || !crmv ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.length !== 11 ||
      !area || (area === 'Outra' && !otherArea) ||
      !Array.isArray(cities) || !cities.length || cities.length > 100 ||
      cities.some(city => typeof city !== 'string' || !city.trim() || city.trim().length > 100)) {
    return json({ ok: false, message: 'Confira os campos obrigatórios, o e-mail, o celular com DDD e as cidades.' }, 400);
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({ name, crmv, email, phone, area, otherArea, cities, token }),
    });
    if (!response.ok) return json({ ok: false, message: uncertainMessage }, 502);
    const result = await response.json();
    if (result?.ok === true) return json({ ok: true, message: 'Participação registrada com sucesso.' });
    if (result?.code === 'VALIDATION_ERROR') {
      return json({ ok: false, message: typeof result.message === 'string' ? result.message : 'Confira os dados informados.' }, 400);
    }
    if (result?.code === 'BUSY') return json({ ok: false, message: 'Muitos envios simultâneos. Tente novamente em instantes.' }, 503);
    if (result?.code === 'NOT_CONFIGURED' || result?.code === 'UNAUTHORIZED') {
      return json({ ok: false, message: 'O serviço de envio precisa ser configurado pela equipe da pesquisa.' }, 503);
    }
    return json({ ok: false, message: uncertainMessage }, 502);
  } catch {
    // A falha pode ocorrer após a gravação. Não repetir o POST automaticamente.
    return json({ ok: false, message: uncertainMessage }, 502);
  }
}
