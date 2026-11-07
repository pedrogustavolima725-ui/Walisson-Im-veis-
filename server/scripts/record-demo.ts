// Grava as respostas reais da API (banco em memória + seed) para a versão de
// demonstração que roda 100% no navegador. Uso: npm run build:demo
process.env.NODE_TEST = '1';

import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

const { seed } = await import('../src/seed.ts');
const { createApp } = await import('../src/app.ts');

await seed();
const server = createApp().listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

class C {
  cookie = '';
  csrf = '';
  async get(p: string) {
    const r = await fetch(base + p, { headers: { cookie: this.cookie } });
    if (!r.ok) throw new Error(`${p} → ${r.status}`);
    return r.json();
  }
  async post(p: string, body: unknown) {
    const r = await fetch(base + p, { method: 'POST', headers: { cookie: this.cookie, 'content-type': 'application/json', 'x-csrf-token': this.csrf }, body: JSON.stringify(body) });
    const c = r.headers.getSetCookie().map((x) => x.split(';')[0]).find((x) => x.startsWith('wi_session=') && x.length > 12);
    if (c) this.cookie = c;
    const j = await r.json();
    if (j.csrfToken) this.csrf = j.csrfToken;
    return j;
  }
}

const out: Record<string, any> = { recordedAt: Date.now(), users: {}, routes: {} };
const anon = new C();
const pub: Record<string, unknown> = {};
pub['/properties/meta'] = await anon.get('/properties/meta');
pub['/agents'] = await anon.get('/agents');
const all = await anon.get('/properties?limit=60');
pub['/properties'] = all.items;
for (const p of all.items) pub[`/properties/${p.id}`] = await anon.get(`/properties/${p.id}`);
out.routes.anon = pub;

const roles = { cliente: 'cliente@walissonimoveis.com.br', corretor: 'mariana@walissonimoveis.com.br', admin: 'admin@walissonimoveis.com.br' };
for (const [role, email] of Object.entries(roles)) {
  const c = new C();
  const login = await c.post('/auth/login', { email, password: 'Demo@2026' });
  out.users[role] = login.user;
  const r: Record<string, unknown> = {};
  const rec = async (p: string) => { r[p] = await c.get(p); return r[p] as any; };
  await rec('/me/favorites');
  await rec('/me/visits');
  await rec('/me/notifications');
  await rec('/me/saved-searches');
  await rec('/auth/sessions');
  await rec('/auth/activity');
  const convs = await rec('/me/conversations');
  for (const cv of convs) await rec(`/me/conversations/${cv.id}`);
  if (role === 'cliente') {
    await rec('/me/my-proposals');
    await rec('/properties/mine/submissions');
    out.qr = (await c.post('/auth/2fa/setup', {})).qr;
  } else {
    await rec('/crm/dashboard');
    const leads = await rec('/crm/leads');
    for (const l of leads) await rec(`/crm/leads/${l.id}`);
    await rec('/crm/agents');
    await rec('/crm/tasks');
    await rec('/crm/proposals');
    await rec('/crm/clients');
    const props = await rec('/properties/manage/list');
    for (const p of props) await rec(`/properties/manage/${p.id}`);
    for (const p of props) if (p.status === 'pendente') r[`/properties/${p.id}`] = await c.get(`/properties/${p.id}`);
    if (role === 'admin') {
      r['/crm/users'] = await c.get('/crm/users?inactive=1');
      await rec('/crm/audit');
    }
  }
  out.routes[role] = r;
}
server.close();

const file = path.resolve(process.cwd(), 'client/src/demo/data.json');
fs.writeFileSync(file, JSON.stringify(out));
console.log(`Dados da demonstração gravados em ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
process.exit(0);
