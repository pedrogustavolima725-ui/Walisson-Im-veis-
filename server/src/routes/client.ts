import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, now, tx } from '../db.ts';
import { isStaff, requireAuth, USER_PUBLIC_COLS } from '../lib/auth.ts';
import { verifyPassword } from '../lib/crypto.ts';
import { audit, leadActivity, notify, upsertLeadForClient } from '../lib/events.ts';
import { badRequest, forbidden, idParam, notFound, parse, zPhone, zReqStr, zStr } from '../lib/http.ts';
import { withExtras } from './properties.ts';
import { mailEnabled } from '../lib/mailer.ts';
import { pushEnabled } from '../lib/push.ts';

/** Rotas da área do cliente (também usadas pelos corretores quando aplicável). */
export const clientRouter = Router();
clientRouter.use(requireAuth);

/* ---------------- Favoritos ---------------- */
clientRouter.get('/favorites', async (req, res) => {
  const rows = await all<{ id: number }>(
    `SELECT p.id, p.code, p.title, p.purpose, p.type, p.status, p.price, p.bedrooms, p.bathrooms, p.parking, p.area, p.neighborhood, p.city, p.state, p.featured
     FROM favorites f JOIN properties p ON p.id = f.property_id WHERE f.user_id = ? ORDER BY f.created_at DESC`,
    req.user!.id,
  );
  res.json(await withExtras(rows, req.user!.id));
});

/* ---------------- Visitas ---------------- */
const VISIT_COLS = `v.id, v.scheduled_at, v.status, v.notes, v.feedback, v.rating, v.created_at,
  p.id AS property_id, p.title AS property_title, p.code AS property_code, p.neighborhood, p.city, p.price, p.purpose,
  (SELECT url FROM property_images WHERE property_id = p.id ORDER BY position LIMIT 1) AS cover,
  a.id AS agent_id, a.name AS agent_name, a.phone AS agent_phone, c.id AS client_id, c.name AS client_name, c.phone AS client_phone`;

clientRouter.get('/visits', async (req, res) => {
  const staff = isStaff(req.user);
  const cond = req.user!.role === 'admin' ? '1=1' : staff ? 'v.agent_id = ?' : 'v.client_id = ?';
  const params = req.user!.role === 'admin' ? [] : [req.user!.id];
  res.json(
    await all(
      `SELECT ${VISIT_COLS} FROM visits v JOIN properties p ON p.id = v.property_id
       LEFT JOIN users a ON a.id = v.agent_id LEFT JOIN users c ON c.id = v.client_id
       WHERE ${cond} ORDER BY v.scheduled_at ASC`,
      ...params,
    ),
  );
});

clientRouter.get('/visits/slots/:propertyId', async (req, res) => {
  const propertyId = idParam(req.params.propertyId);
  const p = await get<{ agent_id: number | null }>('SELECT agent_id FROM properties WHERE id = ?', propertyId);
  if (!p) throw notFound();
  const from = now();
  const taken = (await all<{ scheduled_at: number }>(
    "SELECT scheduled_at FROM visits WHERE status IN ('agendada','confirmada') AND (agent_id = ? OR property_id = ?) AND scheduled_at > ?",
    p.agent_id ?? -1, propertyId, from,
  )).map((v) => v.scheduled_at);
  res.json({ taken });
});

clientRouter.post('/visits', async (req, res) => {
  const b = parse(
    z.object({
      propertyId: z.number().int().positive(),
      scheduledAt: z.number().int(),
      notes: zStr(500).optional(),
    }),
    req.body,
  );
  const p = await get<{ id: number; title: string; code: string; agent_id: number | null; status: string }>('SELECT id, title, code, agent_id, status FROM properties WHERE id = ?', b.propertyId);
  if (!p || !['disponivel', 'reservado'].includes(p.status)) throw notFound('Imóvel indisponível para visitas.');
  const d = new Date(b.scheduledAt);
  if (b.scheduledAt < now() + 60 * 60_000) throw badRequest('Escolha um horário com pelo menos 1 hora de antecedência.');
  if (b.scheduledAt > now() + 90 * 86400_000) throw badRequest('Agende com no máximo 90 dias de antecedência.');
  if (d.getMinutes() % 30 !== 0) throw badRequest('Horário inválido.');
  const clash = await get(
    "SELECT 1 FROM visits WHERE status IN ('agendada','confirmada') AND scheduled_at = ? AND (agent_id = ? OR property_id = ?)",
    b.scheduledAt, p.agent_id ?? -1, p.id,
  );
  if (clash) throw badRequest('Este horário acabou de ser reservado. Escolha outro.');
  const lead = await upsertLeadForClient({
    userId: req.user!.id, name: req.user!.name, email: req.user!.email, phone: req.user!.phone, propertyId: p.id, source: 'app',
    activity: `Agendou visita para ${d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} — ${p.code}`, actorId: req.user!.id,
  });
  const agentId = p.agent_id ?? lead.agent_id;
  const { id } = await run(
    'INSERT INTO visits (property_id, client_id, agent_id, lead_id, scheduled_at, status, notes, created_at) VALUES (?,?,?,?,?,?,?,?)',
    p.id, req.user!.id, agentId, lead.id, b.scheduledAt, 'agendada', b.notes ?? null, now(),
  );
  if (['novo', 'contato'].includes(lead.stage)) await run("UPDATE leads SET stage = 'visita', temperature = 'quente' WHERE id = ?", lead.id);
  await notify(agentId, { type: 'visita', title: 'Nova visita agendada', body: `${req.user!.name} — ${p.title}`, link: '/crm/agenda' });
  await notify(req.user!.id, { type: 'visita', title: 'Visita solicitada!', body: `${p.title}. O corretor confirmará em breve.`, link: '/visitas' });
  res.status(201).json({ id });
});

clientRouter.patch('/visits/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const v = await get<{ id: number; client_id: number; agent_id: number; lead_id: number | null; status: string; property_id: number; scheduled_at: number }>('SELECT * FROM visits WHERE id = ?', id);
  if (!v) throw notFound();
  const staff = isStaff(req.user);
  const own = v.client_id === req.user!.id || v.agent_id === req.user!.id || req.user!.role === 'admin';
  if (!own) throw forbidden();
  const b = parse(
    z.object({
      status: z.enum(['confirmada', 'realizada', 'cancelada']).optional(),
      scheduledAt: z.number().int().optional(),
      feedback: zStr(1000).optional(),
      rating: z.number().int().min(1).max(5).optional(),
    }),
    req.body,
  );
  if (!staff && b.status && b.status !== 'cancelada') throw forbidden('Apenas o corretor pode confirmar a visita.');
  if (b.scheduledAt && b.scheduledAt < now() + 60 * 60_000) throw badRequest('Escolha um horário futuro.');
  await run(
    'UPDATE visits SET status = COALESCE(?, status), scheduled_at = COALESCE(?, scheduled_at), feedback = COALESCE(?, feedback), rating = COALESCE(?, rating) WHERE id = ?',
    b.status ?? (b.scheduledAt ? 'agendada' : null), b.scheduledAt ?? null, b.feedback ?? null, b.rating ?? null, id,
  );
  const title = (await get<{ title: string }>('SELECT title FROM properties WHERE id = ?', v.property_id))?.title ?? '';
  const label = { confirmada: 'confirmada', realizada: 'marcada como realizada', cancelada: 'cancelada' } as const;
  const other = req.user!.id === v.client_id ? v.agent_id : v.client_id;
  if (b.status) {
    await notify(other, { type: 'visita', title: `Visita ${label[b.status]}`, body: title, link: other === v.client_id ? '/visitas' : '/crm/agenda' });
    if (v.lead_id) await leadActivity(v.lead_id, req.user!.id, 'visita', `Visita ${label[b.status]} — ${title}`);
  }
  if (b.scheduledAt) {
    await notify(other, { type: 'visita', title: 'Visita reagendada', body: `${title} — ${new Date(b.scheduledAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` });
  }
  if (b.feedback && v.lead_id) await leadActivity(v.lead_id, req.user!.id, 'visita', `Feedback da visita: "${b.feedback}"${b.rating ? ` (${b.rating}★)` : ''}`);
  res.json({ ok: true });
});

/* ---------------- Mensagens (chat cliente ↔ corretor) ---------------- */
async function canAccessConversation(convId: number, userId: number, role: string) {
  const c = await get<{ id: number; client_id: number; agent_id: number }>('SELECT * FROM conversations WHERE id = ?', convId);
  if (!c) throw notFound('Conversa não encontrada.');
  if (c.client_id !== userId && c.agent_id !== userId && role !== 'admin') throw forbidden();
  return c;
}

clientRouter.get('/conversations', async (req, res) => {
  const uid = req.user!.id;
  res.json(
    await all(
      `SELECT c.id, c.property_id, c.last_message_at, p.title AS property_title,
        CASE WHEN c.client_id = ? THEN a.id ELSE cl.id END AS other_id,
        CASE WHEN c.client_id = ? THEN a.name ELSE cl.name END AS other_name,
        CASE WHEN c.client_id = ? THEN a.avatar ELSE cl.avatar END AS other_avatar,
        CASE WHEN c.client_id = ? THEN 'corretor' ELSE 'cliente' END AS other_role,
        (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != ? AND m.read_at IS NULL) AS unread
       FROM conversations c JOIN users a ON a.id = c.agent_id JOIN users cl ON cl.id = c.client_id LEFT JOIN properties p ON p.id = c.property_id
       WHERE c.client_id = ? OR c.agent_id = ? ORDER BY c.last_message_at DESC`,
      uid, uid, uid, uid, uid, uid, uid,
    ),
  );
});

clientRouter.post('/conversations', async (req, res) => {
  const b = parse(z.object({ propertyId: z.number().int().positive().optional(), agentId: z.number().int().positive().optional(), message: zReqStr(2000, 'Escreva uma mensagem') }), req.body);
  let agentId = b.agentId;
  let property: { id: number; title: string; code: string; agent_id: number | null } | undefined;
  if (b.propertyId) {
    property = await get('SELECT id, title, code, agent_id FROM properties WHERE id = ?', b.propertyId);
    if (!property) throw notFound();
    agentId = agentId ?? property.agent_id ?? undefined;
  }
  if (!agentId) throw badRequest('Corretor não encontrado.');
  const agent = await get<{ id: number }>("SELECT id FROM users WHERE id = ? AND role IN ('corretor','admin') AND active = 1", agentId);
  if (!agent) throw badRequest('Corretor não encontrado.');
  if (agentId === req.user!.id) throw badRequest('Você não pode iniciar uma conversa consigo mesmo.');
  const t = now();
  let conv = await get<{ id: number }>('SELECT id FROM conversations WHERE client_id = ? AND agent_id = ? AND COALESCE(property_id, 0) = ?', req.user!.id, agentId, b.propertyId ?? 0);
  if (!conv) conv = { id: (await run('INSERT INTO conversations (client_id, agent_id, property_id, created_at, last_message_at) VALUES (?,?,?,?,?)', req.user!.id, agentId, b.propertyId ?? null, t, t)).id };
  await run('INSERT INTO messages (conversation_id, sender_id, body, created_at) VALUES (?,?,?,?)', conv.id, req.user!.id, b.message, t);
  await run('UPDATE conversations SET last_message_at = ? WHERE id = ?', t, conv.id);
  if (req.user!.role === 'cliente') {
    await upsertLeadForClient({
      userId: req.user!.id, name: req.user!.name, email: req.user!.email, phone: req.user!.phone, propertyId: b.propertyId, source: 'chat',
      activity: `Mensagem pelo chat${property ? ` sobre ${property.code}` : ''}: "${b.message.slice(0, 200)}"`, actorId: req.user!.id,
    });
  }
  await notify(agentId, { type: 'mensagem', title: `Nova mensagem de ${req.user!.name}`, body: b.message.slice(0, 120), link: `/mensagens/${conv.id}` });
  res.status(201).json({ id: conv.id });
});

clientRouter.get('/conversations/:id', async (req, res) => {
  const c = await canAccessConversation(idParam(req.params.id), req.user!.id, req.user!.role);
  const after = Number(req.query.after ?? 0) || 0;
  await run('UPDATE messages SET read_at = ? WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL', now(), c.id, req.user!.id);
  const messages = await all('SELECT id, sender_id, body, read_at, created_at FROM messages WHERE conversation_id = ? AND id > ? ORDER BY id ASC', c.id, after);
  const meta = await get(
    `SELECT c.id, c.client_id, c.agent_id, c.property_id, p.title AS property_title, p.price, p.purpose,
       (SELECT url FROM property_images WHERE property_id = p.id ORDER BY position LIMIT 1) AS cover,
       a.name AS agent_name, a.phone AS agent_phone, a.avatar AS agent_avatar, a.creci, cl.name AS client_name, cl.phone AS client_phone
     FROM conversations c JOIN users a ON a.id = c.agent_id JOIN users cl ON cl.id = c.client_id LEFT JOIN properties p ON p.id = c.property_id WHERE c.id = ?`,
    c.id,
  );
  res.json({ conversation: meta, messages });
});

clientRouter.post('/conversations/:id/messages', async (req, res) => {
  const c = await canAccessConversation(idParam(req.params.id), req.user!.id, req.user!.role);
  const { body } = parse(z.object({ body: zReqStr(2000, 'Escreva uma mensagem') }), req.body);
  const t = now();
  const { id } = await run('INSERT INTO messages (conversation_id, sender_id, body, created_at) VALUES (?,?,?,?)', c.id, req.user!.id, body, t);
  await run('UPDATE conversations SET last_message_at = ? WHERE id = ?', t, c.id);
  const to = req.user!.id === c.client_id ? c.agent_id : c.client_id;
  const recent = await get("SELECT 1 FROM notifications WHERE user_id = ? AND type = 'mensagem' AND link = ? AND read_at IS NULL AND created_at > ?", to, `/mensagens/${c.id}`, t - 10 * 60_000);
  if (!recent) await notify(to, { type: 'mensagem', title: `Nova mensagem de ${req.user!.name}`, body: body.slice(0, 120), link: `/mensagens/${c.id}` });
  res.status(201).json({ id, sender_id: req.user!.id, body, created_at: t, read_at: null });
});

/* ---------------- Notificações ---------------- */
clientRouter.get('/notifications', async (req, res) => {
  const items = await all('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 60', req.user!.id);
  const unread = (await get<{ n: number }>('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', req.user!.id))!.n;
  const unreadMessages = (await get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE (c.client_id = ? OR c.agent_id = ?) AND m.sender_id != ? AND m.read_at IS NULL',
    req.user!.id, req.user!.id, req.user!.id,
  ))!.n;
  res.json({ items, unread, unreadMessages });
});
clientRouter.post('/notifications/read', async (req, res) => {
  const { id } = parse(z.object({ id: z.number().int().positive().optional() }), req.body ?? {});
  if (id) await run('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?', now(), id, req.user!.id);
  else await run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', now(), req.user!.id);
  res.json({ ok: true });
});

/* ---------------- Notificações push: celulares do usuário ---------------- */
clientRouter.post('/push-tokens', async (req, res) => {
  const b = parse(z.object({ token: z.string().trim().min(20).max(4096), platform: z.enum(['android', 'ios', 'web']).default('android') }), req.body);
  const t = now();
  // Um token pertence a um único usuário (o último que entrou naquele celular)
  await run('DELETE FROM push_tokens WHERE token = ?', b.token);
  await run('INSERT INTO push_tokens (token, user_id, platform, created_at, last_seen_at) VALUES (?,?,?,?,?)', b.token, req.user!.id, b.platform, t, t);
  res.json({ ok: true });
});
clientRouter.post('/push-tokens/remove', async (req, res) => {
  const b = parse(z.object({ token: z.string().trim().min(20).max(4096) }), req.body);
  await run('DELETE FROM push_tokens WHERE token = ? AND user_id = ?', b.token, req.user!.id);
  res.json({ ok: true });
});
clientRouter.get('/notification-settings', async (req, res) => {
  const devices = (await get<{ n: number }>('SELECT COUNT(*) AS n FROM push_tokens WHERE user_id = ?', req.user!.id))!.n;
  res.json({ email: !!req.user!.notify_email, push: !!req.user!.notify_push, devices, emailAvailable: mailEnabled(), pushAvailable: pushEnabled() });
});
clientRouter.put('/notification-settings', async (req, res) => {
  const b = parse(z.object({ email: z.boolean(), push: z.boolean() }), req.body);
  await run('UPDATE users SET notify_email = ?, notify_push = ?, updated_at = ? WHERE id = ?', b.email ? 1 : 0, b.push ? 1 : 0, now(), req.user!.id);
  res.json({ ok: true });
});
const testLimiter = new Map<number, number>();
clientRouter.post('/notifications/test', async (req, res) => {
  const last = testLimiter.get(req.user!.id) ?? 0;
  if (Date.now() - last < 30_000) throw badRequest('Aguarde alguns segundos para enviar outro teste.');
  testLimiter.set(req.user!.id, Date.now());
  await notify(req.user!.id, { type: 'sistema', title: 'Notificação de teste', body: 'Se você recebeu este aviso, as notificações estão funcionando. 🎉', link: '/notificacoes' });
  res.json({ ok: true });
});

/* ---------------- Buscas salvas / alertas ---------------- */
clientRouter.get('/saved-searches', async (req, res) => {
  res.json((await all<{ filters: string }>('SELECT * FROM saved_searches WHERE user_id = ? ORDER BY id DESC', req.user!.id)).map((s) => ({ ...s, filters: JSON.parse(s.filters) })));
});
clientRouter.post('/saved-searches', async (req, res) => {
  const b = parse(z.object({ name: zReqStr(80, 'Dê um nome ao alerta'), filters: z.record(z.string(), z.union([z.string().max(100), z.number(), z.boolean()])), alert: z.boolean().default(true) }), req.body);
  const count = (await get<{ n: number }>('SELECT COUNT(*) AS n FROM saved_searches WHERE user_id = ?', req.user!.id))!.n;
  if (count >= 20) throw badRequest('Limite de 20 buscas salvas atingido.');
  const { id } = await run('INSERT INTO saved_searches (user_id, name, filters, alert, created_at) VALUES (?,?,?,?,?)', req.user!.id, b.name, JSON.stringify(b.filters), b.alert ? 1 : 0, now());
  res.status(201).json({ id });
});
clientRouter.patch('/saved-searches/:id', async (req, res) => {
  const { alert } = parse(z.object({ alert: z.boolean() }), req.body);
  await run('UPDATE saved_searches SET alert = ? WHERE id = ? AND user_id = ?', alert ? 1 : 0, idParam(req.params.id), req.user!.id);
  res.json({ ok: true });
});
clientRouter.delete('/saved-searches/:id', async (req, res) => {
  await run('DELETE FROM saved_searches WHERE id = ? AND user_id = ?', idParam(req.params.id), req.user!.id);
  res.json({ ok: true });
});

/* ---------------- Propostas do cliente ---------------- */
clientRouter.get('/my-proposals', async (req, res) => {
  res.json(
    await all(
      `SELECT pr.id, pr.value, pr.payment, pr.status, pr.notes, pr.valid_until, pr.created_at, p.id AS property_id, p.title AS property_title, p.price,
        (SELECT url FROM property_images WHERE property_id = p.id ORDER BY position LIMIT 1) AS cover, a.name AS agent_name
       FROM proposals pr JOIN properties p ON p.id = pr.property_id LEFT JOIN users a ON a.id = pr.agent_id
       WHERE pr.client_id = ? AND pr.status != 'rascunho' ORDER BY pr.created_at DESC`,
      req.user!.id,
    ),
  );
});

clientRouter.post('/my-proposals', async (req, res) => {
  const b = parse(z.object({ propertyId: z.number().int().positive(), value: z.number().positive('Informe o valor'), payment: z.enum(['a_vista', 'financiamento', 'permuta', 'consorcio']), notes: zStr(1000).optional() }), req.body);
  const p = await get<{ id: number; title: string; code: string; agent_id: number | null; status: string; purpose: string }>('SELECT id, title, code, agent_id, status, purpose FROM properties WHERE id = ?', b.propertyId);
  if (!p || p.status !== 'disponivel') throw notFound('Imóvel indisponível.');
  const lead = await upsertLeadForClient({
    userId: req.user!.id, name: req.user!.name, email: req.user!.email, phone: req.user!.phone, propertyId: p.id, source: 'app',
    activity: `Enviou proposta de ${b.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para ${p.code}`, actorId: req.user!.id,
  });
  const t = now();
  const agentId = p.agent_id ?? lead.agent_id;
  const { id } = await run(
    "INSERT INTO proposals (lead_id, property_id, agent_id, client_id, value, payment, status, notes, valid_until, created_at, updated_at) VALUES (?,?,?,?,?,?, 'enviada', ?,?,?,?)",
    lead.id, p.id, agentId, req.user!.id, b.value, b.payment, b.notes ?? null, t + 7 * 86400_000, t, t,
  );
  await run("UPDATE leads SET stage = 'proposta', temperature = 'quente' WHERE id = ? AND stage IN ('novo','contato','visita')", lead.id);
  await notify(agentId, { type: 'proposta', title: 'Nova proposta recebida', body: `${req.user!.name} — ${p.title}`, link: '/crm/propostas' });
  res.status(201).json({ id });
});

/* ---------------- Perfil e LGPD ---------------- */
clientRouter.put('/profile', async (req, res) => {
  const b = parse(
    z.object({
      name: zReqStr(100, 'Informe seu nome'),
      phone: zPhone.optional().or(z.literal('')),
      bio: zStr(500).optional(),
      creci: zStr(30).optional(),
      avatar: z.string().regex(/^\/uploads\/[\w.-]+$/).nullable().optional(),
      marketing: z.boolean().optional(),
    }),
    req.body,
  );
  await run(
    'UPDATE users SET name = ?, phone = ?, bio = COALESCE(?, bio), creci = COALESCE(?, creci), avatar = COALESCE(?, avatar), marketing_opt_in = COALESCE(?, marketing_opt_in), updated_at = ? WHERE id = ?',
    b.name, b.phone || null, b.bio ?? null, isStaff(req.user) ? (b.creci ?? null) : null, b.avatar ?? null, b.marketing === undefined ? null : b.marketing ? 1 : 0, now(), req.user!.id,
  );
  await audit(req, 'account.profile_updated');
  res.json({ user: await get(`SELECT ${USER_PUBLIC_COLS} FROM users u WHERE u.id = ?`, req.user!.id) });
});

/** LGPD art. 18 — portabilidade: exporta todos os dados pessoais do titular. */
clientRouter.get('/account/export', async (req, res) => {
  const uid = req.user!.id;
  const data = {
    exportedAt: new Date().toISOString(),
    profile: await get(`SELECT ${USER_PUBLIC_COLS}, u.terms_accepted_at, u.last_login_at FROM users u WHERE u.id = ?`, uid),
    favorites: await all('SELECT property_id, created_at FROM favorites WHERE user_id = ?', uid),
    visits: await all('SELECT property_id, scheduled_at, status, notes, feedback, rating FROM visits WHERE client_id = ?', uid),
    proposals: await all('SELECT property_id, value, payment, status, notes, created_at FROM proposals WHERE client_id = ?', uid),
    savedSearches: await all('SELECT name, filters, alert, created_at FROM saved_searches WHERE user_id = ?', uid),
    messages: await all('SELECT m.body, m.created_at, m.conversation_id FROM messages m WHERE m.sender_id = ?', uid),
    leads: await all('SELECT name, email, phone, source, interest, message, created_at FROM leads WHERE user_id = ?', uid),
    securityLog: await all('SELECT action, ip, created_at FROM audit_logs WHERE user_id = ? ORDER BY id DESC LIMIT 200', uid),
  };
  await audit(req, 'account.data_exported');
  res.setHeader('Content-Disposition', 'attachment; filename="meus-dados-walisson-imoveis.json"');
  res.json(data);
});

/** LGPD — eliminação: anonimiza a conta e remove dados pessoais. */
clientRouter.post('/account/delete', async (req, res) => {
  const { password, confirm } = parse(z.object({ password: z.string().min(1).max(128), confirm: z.literal('EXCLUIR', { message: 'Digite EXCLUIR para confirmar' }) }), req.body);
  if (req.user!.role === 'admin') throw badRequest('Administradores não podem excluir a própria conta por aqui.');
  const u = (await get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', req.user!.id))!;
  if (!(await verifyPassword(password, u.password_hash))) throw badRequest('Senha incorreta.', { password: 'Senha incorreta' });
  const uid = req.user!.id;
  void confirm;
  await tx(async () => {
    await run('DELETE FROM sessions WHERE user_id = ?', uid);
    await run('DELETE FROM favorites WHERE user_id = ?', uid);
    await run('DELETE FROM push_tokens WHERE user_id = ?', uid);
    await run('DELETE FROM saved_searches WHERE user_id = ?', uid);
    await run('DELETE FROM notifications WHERE user_id = ?', uid);
    await run("UPDATE leads SET name = 'Titular removido (LGPD)', email = NULL, phone = NULL, message = NULL, user_id = NULL WHERE user_id = ?", uid);
    await run(
      "UPDATE users SET name = 'Usuário removido', email = ?, phone = NULL, avatar = NULL, bio = NULL, password_hash = 'deleted', totp_secret = NULL, totp_enabled = 0, recovery_codes = NULL, active = 0, updated_at = ? WHERE id = ?",
      `removido-${uid}-${Date.now()}@anon.invalid`, now(), uid,
    );
  });
  await audit(req, 'account.deleted', {}, uid);
  res.clearCookie(req.app.get('sessionCookie'), { path: '/' });
  res.json({ ok: true });
});

/* Lista pública de corretores */
export const agentsRouter = Router();
agentsRouter.get('/', async (_req, res) => {
  res.json(
    await all(
      `SELECT u.id, u.name, u.avatar, u.creci, u.bio, u.phone,
        (SELECT COUNT(*) FROM properties p WHERE p.agent_id = u.id AND p.status = 'disponivel') AS listings,
        (SELECT ROUND(AVG(rating),1) FROM visits v WHERE v.agent_id = u.id AND rating IS NOT NULL) AS rating
       FROM users u WHERE u.role IN ('corretor') AND u.active = 1 ORDER BY listings DESC`,
    ),
  );
});
