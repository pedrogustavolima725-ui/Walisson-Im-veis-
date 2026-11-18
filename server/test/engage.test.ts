// Follow-ups e disparos em massa
process.env.NODE_TEST = '1';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const { ready, get, all, run, now } = await import('../src/db.ts');
const { createApp } = await import('../src/app.ts');
const { hashPassword } = await import('../src/lib/crypto.ts');
const { sendDueFollowups } = await import('../src/lib/followup.ts');

let server: Server;
let base = '';
type Sess = { cookie: string; csrf: string };
const mk = (): Sess => ({ cookie: '', csrf: '' });
const ana = mk();
const beto = mk();
const cli = mk();
const req = async (s: Sess, path: string, body?: unknown, method?: string) => {
  const r = await fetch(`${base}/api${path}`, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: { cookie: s.cookie, 'content-type': 'application/json', 'x-csrf-token': s.csrf },
    body: body ? JSON.stringify(body) : undefined,
  });
  const c = r.headers.getSetCookie().map((x) => x.split(';')[0]).find((x) => x.startsWith('wi_session=') && x.length > 12);
  if (c) s.cookie = c;
  const j: any = await r.json();
  if (j.csrfToken) s.csrf = j.csrfToken;
  return { status: r.status, body: j };
};
let anaId = 0;
let clientId = 0;

before(async () => {
  await ready;
  const t = now();
  const h = await hashPassword('SenhaForte2026');
  anaId = (await run("INSERT INTO users (name, email, password_hash, role, created_at, updated_at) VALUES ('Ana Corretora','ana@exemplo.com',?, 'corretor', ?, ?)", h, t, t)).id;
  await run("INSERT INTO users (name, email, password_hash, role, created_at, updated_at) VALUES ('Beto Corretor','beto@exemplo.com',?, 'corretor', ?, ?)", h, t, t);
  clientId = (await run("INSERT INTO users (name, email, phone, password_hash, role, created_at, updated_at) VALUES ('Carla Cliente','carla@exemplo.com','(11) 98888-7777',?, 'cliente', ?, ?)", h, t, t)).id;
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await req(ana, '/auth/login', { email: 'ana@exemplo.com', password: 'SenhaForte2026' });
  await req(beto, '/auth/login', { email: 'beto@exemplo.com', password: 'SenhaForte2026' });
  await req(cli, '/auth/login', { email: 'carla@exemplo.com', password: 'SenhaForte2026' });
});
after(() => server.close());

let leadId = 0;

test('lead novo ganha lembrete de primeiro contato e o contato registrado conclui o follow-up', async () => {
  const r = await req(ana, '/crm/leads', { name: 'João Pereira', phone: '(11) 97777-6666', source: 'whatsapp', temperature: 'quente' });
  assert.equal(r.status, 201);
  leadId = r.body.id;
  const lead = await get<any>('SELECT next_followup_at, followup_note FROM leads WHERE id = ?', leadId);
  assert.ok(lead.next_followup_at > now() + 50 * 60_000 && lead.next_followup_at < now() + 70 * 60_000);
  assert.equal(lead.followup_note, 'Fazer o primeiro contato');

  const a = await req(ana, `/crm/leads/${leadId}/activities`, { type: 'whatsapp', content: 'Mandei as fotos' });
  assert.equal(a.body.followupDone, true);
  assert.equal((await get<any>('SELECT next_followup_at FROM leads WHERE id = ?', leadId)).next_followup_at, null);
});

test('agendar follow-up, aparecer na lista certa e avisar o corretor uma única vez', async () => {
  const at = now() + 2 * 86_400_000;
  assert.equal((await req(ana, `/crm/leads/${leadId}/followup`, { at, note: 'Mandar proposta' }, 'PUT')).status, 200);
  let f = await req(ana, '/crm/followups');
  assert.equal(f.body.upcoming[0].id, leadId);
  assert.equal(f.body.upcoming[0].followup_note, 'Mandar proposta');

  // Outro corretor não mexe nem vê o lead
  assert.equal((await req(beto, `/crm/leads/${leadId}/followup`, { at, note: 'x' }, 'PUT')).status, 403);
  assert.equal((await req(beto, '/crm/followups')).body.upcoming.length, 0);
  // Data no passado é recusada
  assert.equal((await req(ana, `/crm/leads/${leadId}/followup`, { at: now() - 86_400_000 }, 'PUT')).status, 400);

  // Venceu: vai para "atrasados" e o corretor é avisado (sem repetir)
  await run('UPDATE leads SET next_followup_at = ? WHERE id = ?', now() - 60_000, leadId);
  f = await req(ana, '/crm/followups');
  assert.equal(f.body.overdue[0].id, leadId);
  assert.equal(await sendDueFollowups(), 1);
  assert.equal(await sendDueFollowups(), 0);
  const n = await all<any>("SELECT * FROM notifications WHERE user_id = ? AND type = 'followup'", anaId);
  assert.equal(n.length, 1);
  assert.match(n[0].title, /João Pereira/);
  assert.equal(n[0].link, `/crm/leads/${leadId}`);
  const d = await req(ana, '/crm/dashboard');
  assert.equal(d.body.kpis.followupsLate, 1);
  assert.equal(typeof d.body.kpis.pendingListings, 'number');

  // Concluir
  assert.equal((await req(ana, `/crm/leads/${leadId}/followup`, { at: null }, 'PUT')).status, 200);
  assert.equal((await req(ana, '/crm/followups')).body.overdue.length, 0);
});

test('disparo: filtros, opt-out, personalização, aviso no app e fila do WhatsApp', async () => {
  // Lead vinculado à cliente com conta no app, e um lead que pediu para não receber
  const linked = (await req(ana, '/crm/leads', { name: 'Carla Cliente', phone: '(11) 98888-7777', source: 'app', temperature: 'morno' })).body.id;
  await run('UPDATE leads SET user_id = ? WHERE id = ?', clientId, linked);
  const out = (await req(ana, '/crm/leads', { name: 'Zé Sem Disparo', phone: '(11) 96666-5555', source: 'site' })).body.id;
  assert.equal((await req(ana, `/crm/leads/${out}/opt-out`, { opt_out: true }, 'PUT')).status, 200);

  const audience = { audience: 'leads', filters: { stages: ['novo', 'contato'], temperatures: [] } };
  const p = await req(ana, '/crm/campaigns/preview', audience);
  assert.equal(p.body.total, 2); // João + Carla (Zé fica de fora)
  assert.equal(p.body.app, 1);
  // Corretor não dispara para toda a base de clientes
  assert.equal((await req(ana, '/crm/campaigns/preview', { audience: 'clientes' })).status, 403);
  // Beto não enxerga os leads da Ana
  assert.equal((await req(beto, '/crm/campaigns/preview', audience)).body.total, 0);

  const c = await req(ana, '/crm/campaigns', { ...audience, title: 'Novidade', message: 'Oi {nome}, aqui é {corretor}!', channels: ['whatsapp', 'app'] });
  assert.equal(c.status, 201);
  const detail = await req(ana, `/crm/campaigns/${c.body.id}`);
  const rs = detail.body.recipients as any[];
  assert.equal(rs.length, 2);
  const carla = rs.find((r) => r.name === 'Carla Cliente');
  assert.equal(carla.text, 'Oi Carla, aqui é Ana!');
  assert.equal(carla.app_status, 'enviado');
  assert.equal(rs.find((r) => r.name === 'João Pereira').app_status, 'sem_app');
  assert.ok(rs.every((r) => r.wa_status === 'pendente'));

  // A cliente recebe o aviso no sininho do app
  const notes = (await req(cli, '/me/notifications')).body;
  const list = Array.isArray(notes) ? notes : notes.items ?? notes.notifications;
  assert.ok(list.some((x: any) => x.title === 'Novidade' && x.body === 'Oi Carla, aqui é Ana!'));

  // Fila do WhatsApp: marcar como enviado registra no histórico do lead
  assert.equal((await req(ana, `/crm/campaigns/${c.body.id}/recipients/${carla.id}`, { wa_status: 'enviado' }, 'PATCH')).status, 200);
  const acts = await all<any>("SELECT content FROM lead_activities WHERE lead_id = ? AND type = 'whatsapp'", linked);
  assert.ok(acts.some((a) => a.content.includes('Novidade')));
  const lst = (await req(ana, '/crm/campaigns')).body;
  assert.equal(lst[0].wa_sent, 1);
  assert.equal(lst[0].wa_pending, 1);

  // Outro corretor não abre o disparo
  assert.equal((await req(beto, `/crm/campaigns/${c.body.id}`)).status, 403);
  // Cliente não acessa o CRM
  assert.equal((await req(cli, '/crm/campaigns')).status, 403);
});
