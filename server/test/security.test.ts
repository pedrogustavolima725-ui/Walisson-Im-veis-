// Testes de integração da API focados em segurança e regras de negócio.
// Rodam com banco em memória: npm test
process.env.NODE_TEST = '1';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const { seed } = await import('../src/seed.ts');
const { createApp } = await import('../src/app.ts');
const { totpCode, base32Decode } = await import('../src/lib/crypto.ts');

let server: Server;
let base = '';

class Client {
  cookie = '';
  csrf = '';
  async req(path: string, opts: { method?: string; body?: unknown; csrf?: boolean; raw?: FormData; headers?: Record<string, string> } = {}) {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (this.cookie) headers.cookie = this.cookie;
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    if (opts.csrf !== false && this.csrf) headers['x-csrf-token'] = this.csrf;
    const res = await fetch(base + '/api' + path, { method: opts.method ?? (opts.body !== undefined || opts.raw ? 'POST' : 'GET'), headers, body: opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined) });
    const set = res.headers.getSetCookie();
    for (const c of set) {
      const [pair] = c.split(';');
      const [name, value] = pair.split('=');
      if (name === 'wi_session') this.cookie = value ? `wi_session=${value}` : '';
    }
    const text = await res.text();
    let json: any = text;
    try { json = JSON.parse(text); } catch { /* csv */ }
    if (json?.csrfToken) this.csrf = json.csrfToken;
    return { status: res.status, body: json };
  }
  login(email: string, password = 'Demo@2026') { return this.req('/auth/login', { body: { email, password } }); }
}

before(async () => {
  await seed();
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

test('cadastro rejeita senha fraca e exige aceite dos termos', async () => {
  const c = new Client();
  let r = await c.req('/auth/register', { body: { name: 'Teste Fraco', email: 'fraco@x.com', password: '12345678', acceptTerms: true } });
  assert.equal(r.status, 400);
  assert.match(r.body.fields.password, /maiúscula/);
  r = await c.req('/auth/register', { body: { name: 'Teste', email: 'termos@x.com', password: 'SenhaForte123', acceptTerms: false } });
  assert.equal(r.status, 400);
  r = await c.req('/auth/register', { body: { name: 'Teste Forte', email: 'novo.usuario@x.com', password: 'SenhaForte123', acceptTerms: true } });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.role, 'cliente');
  assert.equal(r.body.user.password_hash, undefined, 'hash nunca deve ser exposto');
});

test('cadastro não permite escolher papel (escalada de privilégio)', async () => {
  const c = new Client();
  const r = await c.req('/auth/register', { body: { name: 'Hacker', email: 'h@x.com', password: 'SenhaForte123', acceptTerms: true, role: 'admin' } });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.role, 'cliente');
});

test('login com mensagem genérica e bloqueio após 5 falhas', async () => {
  const c = new Client();
  const unknown = await c.login('naoexiste@x.com', 'Errada123');
  assert.equal(unknown.status, 401);
  for (let i = 0; i < 4; i++) {
    const r = await c.login('lucas.pereira@email.com', 'Errada123');
    assert.equal(r.status, 401);
    assert.equal(r.body.error, unknown.body.error, 'mesma mensagem para e-mail inexistente e senha errada');
  }
  await c.login('lucas.pereira@email.com', 'Errada123');
  const locked = await c.login('lucas.pereira@email.com');
  assert.equal(locked.status, 423, 'mesmo com a senha correta, a conta fica bloqueada');
});

test('alterações exigem token CSRF', async () => {
  const c = new Client();
  await c.login('cliente@walissonimoveis.com.br');
  const no = await c.req('/properties/1/favorite', { method: 'POST', csrf: false });
  assert.equal(no.status, 403);
  const forged = await c.req('/properties/1/favorite', { method: 'POST', csrf: false, headers: { 'x-csrf-token': 'forjado' } });
  assert.equal(forged.status, 403);
  const ok = await c.req('/properties/1/favorite', { method: 'POST' });
  assert.equal(ok.status, 200);
});

test('controle de acesso por papel e por carteira', async () => {
  const cliente = new Client();
  await cliente.login('cliente@walissonimoveis.com.br');
  assert.equal((await cliente.req('/crm/dashboard')).status, 403);
  assert.equal((await cliente.req('/crm/users')).status, 403);

  const anon = new Client();
  assert.equal((await anon.req('/me/favorites')).status, 401);

  const mariana = new Client();
  await mariana.login('mariana@walissonimoveis.com.br');
  const leads = await mariana.req('/crm/leads');
  assert.ok(leads.body.length > 0);
  assert.ok(leads.body.every((l: any) => l.agent_id === 2), 'corretor só vê os próprios leads');
  const rafael = new Client();
  await rafael.login('rafael@walissonimoveis.com.br');
  const other = await rafael.req(`/crm/leads/${leads.body[0].id}`);
  assert.equal(other.status, 403, 'corretor não acessa lead de outro corretor');
  assert.equal((await mariana.req('/crm/users')).status, 403, 'corretor não gerencia usuários');
});

test('endereço exato do imóvel não é exposto ao público', async () => {
  const anon = new Client();
  const r = await anon.req('/properties/1');
  assert.equal(r.status, 200);
  assert.equal(r.body.address, undefined);
  const admin = new Client();
  await admin.login('admin@walissonimoveis.com.br');
  assert.ok((await admin.req('/properties/1')).body.address);
});

test('2FA (TOTP) obrigatório no login após ativação', async () => {
  const c = new Client();
  await c.req('/auth/register', { body: { name: 'Dois Fatores', email: '2fa@x.com', password: 'SenhaForte123', acceptTerms: true } });
  const setup = await c.req('/auth/2fa/setup', { body: {} });
  const secret: string = setup.body.secret;
  assert.ok(base32Decode(secret).length === 20);
  const code = () => totpCode(secret, Math.floor(Date.now() / 30000));
  const en = await c.req('/auth/2fa/enable', { body: { code: code() } });
  assert.equal(en.status, 200);
  assert.equal(en.body.recoveryCodes.length, 8);
  await c.req('/auth/logout', { method: 'POST' });

  const c2 = new Client();
  const step1 = await c2.login('2fa@x.com', 'SenhaForte123');
  assert.equal(step1.body.mfaRequired, true);
  assert.equal((await c2.req('/me/favorites')).status, 401, 'sessão pendente de 2FA não dá acesso');
  assert.equal((await c2.req('/auth/mfa', { body: { code: '000000' } })).status, 400);
  const ok = await c2.req('/auth/mfa', { body: { code: en.body.recoveryCodes[0] } });
  assert.equal(ok.status, 200, 'código de recuperação funciona');
  assert.equal((await c2.req('/me/favorites')).status, 200);
});

test('recuperação de senha: resposta idêntica e token de uso único', async () => {
  const c = new Client();
  const a = await c.req('/auth/forgot', { body: { email: 'carlos.mendes@email.com' } });
  const b = await c.req('/auth/forgot', { body: { email: 'ninguem@x.com' } });
  assert.equal(a.body.message, b.body.message);
  const token = new URL(a.body.devResetUrl).searchParams.get('token')!;
  assert.equal((await c.req('/auth/reset', { body: { token, password: 'NovaSenha2026' } })).status, 200);
  assert.equal((await c.req('/auth/reset', { body: { token, password: 'OutraSenha2026' } })).status, 400);
  assert.equal((await c.login('carlos.mendes@email.com', 'NovaSenha2026')).status, 200);
});

test('upload recusa arquivos que não são imagem (ex.: SVG/HTML disfarçado)', async () => {
  const c = new Client();
  await c.login('mariana@walissonimoveis.com.br');
  const fd = new FormData();
  fd.append('files', new Blob(['<svg onload=alert(1)>'], { type: 'image/png' }), 'foto.png');
  const r = await c.req('/properties/upload', { raw: fd });
  assert.equal(r.status, 400);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  const fd2 = new FormData();
  fd2.append('files', new Blob([png], { type: 'image/png' }), 'ok.png');
  const r2 = await c.req('/properties/upload', { raw: fd2 });
  assert.equal(r2.status, 201);
  assert.match(r2.body.urls[0], /^\/uploads\/[\w-]+\.png$/);
});

test('exportação CSV neutraliza injeção de fórmulas', async () => {
  const c = new Client();
  await c.login('admin@walissonimoveis.com.br');
  await c.req('/crm/leads', { body: { name: '=HYPERLINK("http://mal.com")', source: 'site' } });
  const r = await c.req('/crm/reports/leads.csv');
  assert.equal(r.status, 200);
  assert.ok(r.body.includes(`"'=HYPERLINK`), 'célula iniciada com = recebe apóstrofo');
});

test('fluxo de negócio: visita gera lead e proposta aceita fecha o negócio', async () => {
  const cli = new Client();
  await cli.req('/auth/register', { body: { name: 'Comprador Teste', email: 'comprador@x.com', password: 'SenhaForte123', acceptTerms: true } });
  const when = new Date(Date.now() + 3 * 86400_000);
  when.setHours(10, 0, 0, 0);
  const v = await cli.req('/me/visits', { body: { propertyId: 7, scheduledAt: +when } });
  assert.equal(v.status, 201);
  const clash = await cli.req('/me/visits', { body: { propertyId: 7, scheduledAt: +when } });
  assert.equal(clash.status, 400, 'não permite dois agendamentos no mesmo horário');
  const p = await cli.req('/me/my-proposals', { body: { propertyId: 7, value: 950000, payment: 'financiamento' } });
  assert.equal(p.status, 201);

  const admin = new Client();
  await admin.login('admin@walissonimoveis.com.br');
  const lead = (await admin.req('/crm/leads?q=Comprador')).body[0];
  assert.equal(lead.stage, 'proposta');
  assert.equal((await admin.req(`/crm/proposals/${p.body.id}`, { method: 'PATCH', body: { status: 'aceita' } })).status, 200);
  assert.equal((await admin.req(`/crm/leads/${lead.id}`)).body.stage, 'ganho');
  assert.equal((await admin.req('/properties/7')).body.status, 'vendido');
});

test('LGPD: exportação e exclusão de conta', async () => {
  const c = new Client();
  await c.req('/auth/register', { body: { name: 'Titular LGPD', email: 'lgpd@x.com', password: 'SenhaForte123', acceptTerms: true } });
  const exp = await c.req('/me/account/export');
  assert.equal(exp.body.profile.email, 'lgpd@x.com');
  assert.equal((await c.req('/me/account/delete', { body: { password: 'SenhaForte123', confirm: 'EXCLUIR' } })).status, 200);
  assert.equal((await new Client().login('lgpd@x.com', 'SenhaForte123')).status, 401);
});
