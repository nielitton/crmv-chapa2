import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST } from '../app/api/participacoes/route.ts';

test('API valida os dados e confirma somente gravações aceitas pelo Apps Script', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.GOOGLE_SHEETS_URL;
  const originalToken = process.env.GOOGLE_SHEETS_TOKEN;
  process.env.GOOGLE_SHEETS_URL = 'https://example.com/apps-script';
  process.env.GOOGLE_SHEETS_TOKEN = 'server-only-test-token';
  const payload = { name: 'Maria Silva', crmv: 'CRMV-CE 00123', email: 'maria@example.com', phone: '(85) 99999-9999', area: 'Outra', otherArea: 'Consultoria', cities: ['Fortaleza - CE'] };
  const request = (body = payload, origin = 'https://pesquisa.example') => new Request('https://pesquisa.example/api/participacoes', {
    method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  let calls = 0;
  try {
    globalThis.fetch = async (_url, options) => {
      calls++;
      const body = JSON.parse(options.body);
      assert.equal(body.token, 'server-only-test-token');
      assert.equal(body.phone, '85999999999');
      assert.equal(body.crmv, 'CRMV-CE 00123');
      assert.equal(body.otherArea, 'Consultoria');
      return Response.json({ ok: true });
    };
    assert.equal((await POST(request(payload, 'https://another.example'))).status, 403);
    assert.equal((await POST(request({ ...payload, cities: [] }))).status, 400);
    assert.equal((await POST(request({ ...payload, otherArea: '' }))).status, 400);
    assert.equal((await POST(request({ ...payload, email: 'invalid' }))).status, 400);
    assert.equal((await POST(request({ ...payload, phone: '123' }))).status, 400);
    assert.equal(calls, 0);
    const success = await POST(request({ ...payload, token: 'client-cannot-override' }));
    assert.equal(success.status, 200);
    assert.equal((await success.json()).ok, true);
    assert.equal(calls, 1);
    // Domínio HTTPS público encaminhado para um Next.js HTTP interno.
    const proxied = (headers) => new Request('http://localhost:3000/api/participacoes', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
    });
    assert.equal((await POST(proxied({ origin: 'https://pesquisa.example', 'sec-fetch-site': 'same-origin' }))).status, 200);
    assert.equal((await POST(proxied({ origin: 'https://pesquisa.example', host: 'pesquisa.example' }))).status, 200);
    assert.equal((await POST(proxied({ origin: 'http://192.168.1.10:3000', host: '192.168.1.10:3000' }))).status, 200);
    const acceptedCalls = calls;
    assert.equal((await POST(proxied({ origin: 'https://attacker.example', host: 'pesquisa.example' }))).status, 403);
    assert.equal((await POST(proxied({ origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' }))).status, 403);
    assert.equal((await POST(proxied({ origin: 'null' }))).status, 403);
    assert.equal(calls, acceptedCalls);
    globalThis.fetch = async () => Response.json({ ok: false, code: 'UNAUTHORIZED', message: 'private details' });
    const unauthorized = await POST(request());
    assert.equal(unauthorized.status, 503);
    assert.ok(!(await unauthorized.text()).includes('private details'));
    globalThis.fetch = async () => new Response('<html>Login required</html>');
    assert.equal((await POST(request())).status, 502);
    globalThis.fetch = async () => { throw new Error('timeout'); };
    const timeout = await POST(request());
    assert.equal(timeout.status, 502);
    assert.equal((await timeout.json()).ok, false);
    delete process.env.GOOGLE_SHEETS_TOKEN;
    assert.equal((await POST(request())).status, 503);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.GOOGLE_SHEETS_URL;
    else process.env.GOOGLE_SHEETS_URL = originalUrl;
    if (originalToken === undefined) delete process.env.GOOGLE_SHEETS_TOKEN;
    else process.env.GOOGLE_SHEETS_TOKEN = originalToken;
  }
});
