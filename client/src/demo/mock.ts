// API simulada para a versão de demonstração: responde no próprio navegador
// com respostas reais gravadas da API (npm run build:demo). Alterações ficam
// só na memória da página e somem ao recarregar.
import raw from './data.json';
import { ApiError } from '../lib/api';

type Role = 'cliente' | 'corretor' | 'admin';
type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

// Desloca as datas gravadas para "agora", mantendo visitas futuras no futuro
const delta = Date.now() - (raw as Any).recordedAt;
function shift(v: Any): Any {
  if (Array.isArray(v)) return v.map(shift);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shift(x)]));
  if (typeof v === 'number' && v > 1.5e12 && v < 2.5e12) return v + delta;
  return v;
}
const data: Any = shift(raw);
const routes: Record<string, Record<string, Any>> = data.routes;
const users: Record<Role, Any> = data.users;
const emailRole: Record<string, Role> = Object.fromEntries(Object.entries(users).map(([r, u]: [string, Any]) => [u.email, r as Role]));

let role: Role | null = null;
let me: Any = null;
let seq = 100000;
const favs: Record<Role, Set<number>> = {
  cliente: new Set((routes.cliente['/me/favorites'] ?? []).map((p: Any) => p.id)),
  corretor: new Set(),
  admin: new Set(),
};

const props: Any[] = routes.anon['/properties'];
const propById = (id: number) => props.find((p) => p.id === id) ?? routes.anon[`/properties/${id}`];
const R = () => (role ? routes[role] : routes.anon);

function withFav(p: Any) {
  return { ...p, favorite: role ? favs[role].has(p.id) : false };
}

function searchProperties(q: URLSearchParams) {
  let list = props.slice();
  const n = (k: string) => (q.get(k) ? Number(q.get(k)) : undefined);
  const s = q.get('q')?.toLowerCase();
  if (s) list = list.filter((p) => [p.title, p.neighborhood, p.city, p.code].join(' ').toLowerCase().includes(s));
  if (q.get('purpose')) list = list.filter((p) => p.purpose === q.get('purpose'));
  const types = q.get('type')?.split(',').filter(Boolean);
  if (types?.length) list = list.filter((p) => types.includes(p.type));
  if (q.get('city')) list = list.filter((p) => p.city === q.get('city'));
  if (q.get('neighborhood')) list = list.filter((p) => p.neighborhood.toLowerCase().includes(q.get('neighborhood')!.toLowerCase()));
  const ge = (k: string, f: string) => { const v = n(k); if (v !== undefined) list = list.filter((p) => p[f] >= v); };
  const le = (k: string, f: string) => { const v = n(k); if (v !== undefined) list = list.filter((p) => p[f] <= v); };
  ge('minPrice', 'price'); le('maxPrice', 'price'); ge('bedrooms', 'bedrooms'); ge('bathrooms', 'bathrooms'); ge('parking', 'parking'); ge('minArea', 'area'); le('maxArea', 'area');
  if (q.get('pets')) list = list.filter((p) => p.accepts_pets);
  if (q.get('furnished')) list = list.filter((p) => p.furnished);
  if (q.get('financing')) list = list.filter((p) => p.accepts_financing);
  if (q.get('featured')) list = list.filter((p) => p.featured);
  if (q.get('ids')) { const ids = q.get('ids')!.split(',').map(Number); list = list.filter((p) => ids.includes(p.id)); }
  const sort = q.get('sort') ?? 'recentes';
  const cmp: Record<string, (a: Any, b: Any) => number> = {
    recentes: (a, b) => b.created_at - a.created_at, menor_preco: (a, b) => a.price - b.price, maior_preco: (a, b) => b.price - a.price,
    maior_area: (a, b) => b.area - a.area, populares: (a, b) => b.views - a.views,
  };
  list.sort((a, b) => b.featured - a.featured || cmp[sort](a, b));
  const limit = n('limit') ?? 12;
  const page = n('page') ?? 1;
  return { items: list.slice((page - 1) * limit, page * limit).map(withFav), total: list.length, page, pages: Math.max(1, Math.ceil(list.length / limit)) };
}

const SKIP = new Set(['page', 'limit', 'inactive', 'after']);
const ALIAS: Record<string, string> = { agent: 'agent_id' };
function filterList(v: Any, q: URLSearchParams): Any {
  if (v && !Array.isArray(v) && Array.isArray(v.items)) return { ...v, items: filterList(v.items, q) };
  if (!Array.isArray(v)) return v;
  let list = v;
  for (const [k0, val] of q.entries()) {
    if (!val || SKIP.has(k0)) continue;
    if (k0 === 'q') { const s = val.toLowerCase(); list = list.filter((x) => JSON.stringify(x).toLowerCase().includes(s)); continue; }
    if (k0 === 'mine') { list = list.filter((x) => x.agent_id === me?.id); continue; }
    if (k0 === 'action') { list = list.filter((x) => String(x.action).startsWith(val)); continue; }
    const k = ALIAS[k0] ?? k0;
    list = list.filter((x) => !(k in x) || String(x[k]) === val);
  }
  return list;
}

const ok = { ok: true };
const login = (r: Role, override?: Any) => {
  role = r;
  me = { ...users[r], ...override };
  return { user: me, csrfToken: 'demo' };
};

function handleGet(path: string, q: URLSearchParams): Any {
  if (path === '/auth/me') return { user: me, csrfToken: me ? 'demo' : null, mfaPending: false, demo: true };
  if (path === '/properties') return searchProperties(q);
  if (path === '/me/favorites') return props.filter((p) => role && favs[role].has(p.id)).map(withFav);
  if (/^\/properties\/\d+$/.test(path)) {
    const p = R()[path] ?? routes.anon[path] ?? routes.admin[path];
    if (!p) throw new ApiError(404, 'Imóvel não encontrado.');
    return { ...p, favorite: role ? favs[role].has(p.id) : false, similar: (p.similar ?? []).map(withFav) };
  }
  if (path.startsWith('/me/visits/slots/')) return { taken: [] };
  const conv = path.match(/^\/me\/conversations\/(\d+)$/);
  if (conv && q.get('after')) {
    const t = R()[path];
    return { ...t, messages: t.messages.filter((m: Any) => m.id > Number(q.get('after'))) };
  }
  const full = q.toString() ? `${path}?${q}` : path;
  const hit = R()[full] ?? R()[path] ?? routes.anon[path];
  if (hit !== undefined) return filterList(hit, q);
  if (!me && (path.startsWith('/me') || path.startsWith('/crm'))) throw new ApiError(401, 'Faça login para continuar.');
  throw new ApiError(404, 'Indisponível na demonstração.');
}

function handleMutation(method: string, path: string, body: Any): Any {
  const r = R();
  const now = Date.now();
  // Autenticação
  if (path === '/auth/login') {
    const rl = emailRole[String(body.email ?? '').toLowerCase()];
    if (!rl || body.password !== 'Demo@2026') throw new ApiError(401, 'E-mail ou senha incorretos. Na demonstração, use as contas de teste (senha Demo@2026).');
    return login(rl);
  }
  if (path === '/auth/register') {
    if (!body.acceptTerms) throw new ApiError(400, 'Verifique os campos destacados.', { acceptTerms: 'É necessário aceitar os termos e a política de privacidade' });
    return login('cliente', { name: body.name || 'Novo cliente', email: body.email, phone: body.phone || null });
  }
  if (path === '/auth/logout') { role = null; me = null; return ok; }
  if (path === '/auth/forgot') return { ok: true, message: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha. (Na demonstração nenhum e-mail é enviado.)' };
  if (path === '/auth/2fa/setup') return { secret: 'JBSWY3DPEHPK3PXPWALISSONDEMO2026', qr: data.qr };
  if (path === '/auth/2fa/enable') { me = { ...me, totp_enabled: 1 }; return { ok: true, recoveryCodes: ['7KQ2M-X4P9D', 'B8RT3-LW6ZN', 'C5HV1-QJ7YE', 'D2NF8-KU3SA', 'E9GW4-TM1RC', 'F6PX7-HB2VL', 'G3ZD5-NY8QK', 'H1JC9-RE4WU'] }; }
  if (path === '/auth/2fa/disable') { me = { ...me, totp_enabled: 0 }; return ok; }
  if (path === '/auth/sessions/revoke-others') return { ok: true, count: 0 };
  if (path === '/me/profile') { me = { ...me, ...body, phone: body.phone || null, marketing_opt_in: body.marketing ? 1 : 0 }; return { user: me }; }
  if (path === '/me/account/delete') { role = null; me = null; return ok; }

  // Favoritos
  const fav = path.match(/^\/properties\/(\d+)\/favorite$/);
  if (fav && role) {
    const id = Number(fav[1]);
    const set = favs[role];
    set.has(id) ? set.delete(id) : set.add(id);
    return { favorite: set.has(id) };
  }

  // Visitas
  if (path === '/me/visits' && method === 'POST') {
    const p = propById(body.propertyId);
    const v = {
      id: ++seq, scheduled_at: body.scheduledAt, status: 'agendada', notes: body.notes ?? null, feedback: null, rating: null, property_id: p.id,
      property_title: p.title, property_code: p.code, neighborhood: p.neighborhood, city: p.city, price: p.price, purpose: p.purpose, cover: p.cover,
      agent_id: null, agent_name: 'Corretor(a) responsável', agent_phone: null, client_id: me?.id, client_name: me?.name, client_phone: me?.phone,
    };
    (r['/me/visits'] ??= []).push(v);
    return { id: v.id };
  }
  const visit = path.match(/^\/me\/visits\/(\d+)$/);
  if (visit) {
    for (const k of ['cliente', 'corretor', 'admin'] as Role[]) {
      const v = (routes[k]['/me/visits'] ?? []).find((x: Any) => x.id === Number(visit[1]));
      if (v) Object.assign(v, body.status ? { status: body.status } : {}, body.scheduledAt ? { scheduled_at: body.scheduledAt } : {}, body.feedback ? { feedback: body.feedback, rating: body.rating } : {});
    }
    return ok;
  }

  // Propostas do cliente
  if (path === '/me/my-proposals') {
    const p = propById(body.propertyId);
    (r['/me/my-proposals'] ??= []).unshift({ id: ++seq, value: body.value, payment: body.payment, status: 'enviada', notes: body.notes ?? null, valid_until: now + 7 * 864e5, created_at: now, property_id: p.id, property_title: p.title, price: p.price, cover: p.cover, agent_name: null });
    return { id: seq };
  }

  // Conversas
  if (path === '/me/conversations') {
    const list = (r['/me/conversations'] ??= []);
    const p = body.propertyId ? propById(body.propertyId) : null;
    const existing = p && list.find((c: Any) => c.property_title === p.title);
    const id = existing?.id ?? ++seq;
    const msg = { id: ++seq, sender_id: me.id, body: body.message, read_at: null, created_at: now };
    if (existing) r[`/me/conversations/${id}`].messages.push(msg);
    else {
      const agent = routes.anon['/agents']?.[0];
      list.unshift({ id, property_title: p?.title ?? null, last_message_at: now, other_name: agent?.name ?? 'Corretor(a)', other_avatar: null, other_role: 'corretor', last_message: body.message, unread: 0 });
      r[`/me/conversations/${id}`] = {
        conversation: { id, client_id: me.id, agent_id: agent?.id ?? 0, property_id: p?.id ?? null, property_title: p?.title ?? null, price: p?.price ?? null, purpose: p?.purpose ?? null, cover: p?.cover ?? null, agent_name: agent?.name ?? 'Corretor(a)', agent_phone: agent?.phone ?? null, agent_avatar: null, creci: agent?.creci ?? null, client_name: me.name, client_phone: me.phone },
        messages: [msg],
      };
    }
    return { id };
  }
  const send = path.match(/^\/me\/conversations\/(\d+)\/messages$/);
  if (send) {
    const msg = { id: ++seq, sender_id: me.id, body: body.body, read_at: null, created_at: now };
    r[`/me/conversations/${send[1]}`]?.messages.push(msg);
    const c = (r['/me/conversations'] ?? []).find((x: Any) => x.id === Number(send[1]));
    if (c) Object.assign(c, { last_message: body.body, last_message_at: now });
    return msg;
  }

  // Notificações e alertas
  if (path === '/me/notifications/read') {
    const n = r['/me/notifications'];
    if (n) { n.items.forEach((x: Any) => { if (!body?.id || x.id === body.id) x.read_at = now; }); n.unread = n.items.filter((x: Any) => !x.read_at).length; }
    return ok;
  }
  if (path === '/me/saved-searches') { (r['/me/saved-searches'] ??= []).unshift({ id: ++seq, name: body.name, filters: body.filters, alert: 1, created_at: now }); return { id: seq }; }
  const saved = path.match(/^\/me\/saved-searches\/(\d+)$/);
  if (saved) {
    const list = r['/me/saved-searches'] ?? [];
    if (method === 'DELETE') r['/me/saved-searches'] = list.filter((s: Any) => s.id !== Number(saved[1]));
    else list.forEach((s: Any) => { if (s.id === Number(saved[1])) s.alert = body.alert ? 1 : 0; });
    return ok;
  }

  // CRM: leads
  const lead = path.match(/^\/crm\/leads\/(\d+)$/);
  if (lead && method === 'PATCH') {
    const id = Number(lead[1]);
    const changes = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
    (r['/crm/leads'] ?? []).forEach((l: Any) => { if (l.id === id) Object.assign(l, changes, { updated_at: now }); });
    const d = r[path];
    if (d) {
      if (changes.stage && changes.stage !== d.stage) d.activities.unshift({ id: ++seq, type: 'etapa', content: `Etapa alterada para ${changes.stage}`, created_at: now, user_name: me.name });
      Object.assign(d, changes, { updated_at: now });
    }
    return ok;
  }
  const act = path.match(/^\/crm\/leads\/(\d+)\/activities$/);
  if (act) { r[`/crm/leads/${act[1]}`]?.activities.unshift({ id: ++seq, type: body.type, content: body.content, created_at: now, user_name: me.name }); return ok; }
  if (path === '/crm/leads' && method === 'POST') {
    const id = ++seq;
    const l = { id, name: body.name, email: body.email || null, phone: body.phone || null, source: body.source, stage: 'novo', temperature: body.temperature, interest: body.interest, budget: body.budget, message: body.message ?? null, property_id: body.property_id, agent_id: me.id, user_id: null, lost_reason: null, created_at: now, updated_at: now, agent_name: me.name, property_title: null, open_tasks: 0 };
    (r['/crm/leads'] ??= []).unshift(l);
    r[`/crm/leads/${id}`] = { ...l, property: null, agent: { id: me.id, name: me.name, avatar: null }, activities: [{ id: ++seq, type: 'sistema', content: `Lead cadastrado manualmente por ${me.name}`, created_at: now, user_name: me.name }], tasks: [], visits: [], proposals: [], favorites: [], conversation: null };
    return { id };
  }

  // CRM: tarefas
  if (path === '/crm/tasks' && method === 'POST') {
    const t = { id: ++seq, title: body.title, due_at: body.due_at ?? null, done: 0, priority: body.priority ?? 'media', lead_id: body.lead_id ?? null, lead_name: null, assigned_name: me.name };
    (r['/crm/tasks'] ??= []).unshift(t);
    if (body.lead_id) r[`/crm/leads/${body.lead_id}`]?.tasks.push(t);
    return { id: t.id };
  }
  const task = path.match(/^\/crm\/tasks\/(\d+)$/);
  if (task) {
    const id = Number(task[1]);
    const apply = (list: Any[]) => list.forEach((t) => { if (t.id === id) t.done = body.done ? 1 : 0; });
    if (method === 'DELETE') r['/crm/tasks'] = (r['/crm/tasks'] ?? []).filter((t: Any) => t.id !== id);
    else { apply(r['/crm/tasks'] ?? []); Object.keys(r).filter((k) => k.startsWith('/crm/leads/')).forEach((k) => apply(r[k].tasks ?? [])); }
    const dash = r['/crm/dashboard'];
    if (dash) dash.tasks = dash.tasks.filter((t: Any) => t.id !== id || !body.done);
    return ok;
  }

  // CRM: propostas e usuários
  const prop = path.match(/^\/crm\/proposals\/(\d+)$/);
  if (prop) { (r['/crm/proposals'] ?? []).forEach((p: Any) => { if (p.id === Number(prop[1])) Object.assign(p, Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined)), { updated_at: now }); }); return ok; }
  const usr = path.match(/^\/crm\/users\/(\d+)$/);
  if (usr) {
    (r['/crm/users'] ?? []).forEach((u: Any) => {
      if (u.id !== Number(usr[1])) return;
      if (body.role) u.role = body.role;
      if (body.active !== undefined) u.active = body.active ? 1 : 0;
      if (body.unlock) u.locked_until = null;
    });
    return ok;
  }
  const manage = path.match(/^\/properties\/(\d+)$/);
  if (manage && method === 'PUT') {
    (r['/properties/manage/list'] ?? []).forEach((p: Any) => { if (p.id === Number(manage[1])) Object.assign(p, { title: body.title, status: body.status, price: body.price, featured: body.featured ? 1 : 0 }); });
    Object.assign(r[`/properties/manage/${manage[1]}`] ?? {}, body);
    return ok;
  }
  if (path === '/properties' || path === '/properties/submit') return { id: 1 };
  return { ok: true, id: ++seq };
}

export async function demoApi(fullPath: string, opts: { method?: string; body?: unknown }): Promise<Any> {
  await new Promise((res) => setTimeout(res, 120 + Math.random() * 180)); // latência realista
  const [path, query] = fullPath.split('?');
  const method = opts.method ?? (opts.body !== undefined ? 'POST' : 'GET');
  if (method === 'GET') return structuredClone(handleGet(path, new URLSearchParams(query)));
  if (opts.body instanceof FormData) {
    const files = opts.body.getAll('files') as File[];
    return { urls: files.map((f) => URL.createObjectURL(f)) };
  }
  return structuredClone(handleMutation(method, path, opts.body ?? {}));
}
