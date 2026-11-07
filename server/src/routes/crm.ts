import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.ts';
import { all, get, run, now } from '../db.ts';
import { requireRole, type SessionUser } from '../lib/auth.ts';
import { hashPassword, passwordProblems } from '../lib/crypto.ts';
import { audit, leadActivity, notify } from '../lib/events.ts';
import { badRequest, forbidden, idParam, notFound, parse, zBool, zEmail, zPhone, zReqStr, zStr } from '../lib/http.ts';

export const crmRouter = Router();
crmRouter.use(requireRole('corretor', 'admin'));

export const STAGES = ['novo', 'contato', 'visita', 'proposta', 'negociacao', 'ganho', 'perdido'] as const;
const SOURCES = ['site', 'app', 'chat', 'whatsapp', 'instagram', 'facebook', 'indicacao', 'portal', 'captacao', 'telefone', 'placa'] as const;
const STAGE_LABEL: Record<string, string> = { novo: 'Novo', contato: 'Em contato', visita: 'Visita', proposta: 'Proposta', negociacao: 'Negociação', ganho: 'Ganho', perdido: 'Perdido' };

/** Corretor enxerga apenas os próprios leads; admin enxerga todos. */
function leadScope(u: SessionUser, alias = 'l') {
  return u.role === 'admin' ? { sql: '1=1', params: [] as number[] } : { sql: `${alias}.agent_id = ?`, params: [u.id] };
}
function loadLead(id: number, u: SessionUser) {
  const lead = get<any>('SELECT * FROM leads WHERE id = ?', id);
  if (!lead) throw notFound('Lead não encontrado.');
  if (u.role !== 'admin' && lead.agent_id !== u.id) throw forbidden('Este lead pertence a outro corretor.');
  return lead;
}

/* ====================== Dashboard ====================== */
crmRouter.get('/dashboard', (req, res) => {
  const u = req.user!;
  const s = leadScope(u);
  const ps = u.role === 'admin' ? { sql: '1=1', params: [] as number[] } : { sql: 'agent_id = ?', params: [u.id] };
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const prevMonthStart = new Date(monthStart); prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
  const t = now();

  const count = (sql: string, ...p: (string | number)[]) => get<{ n: number }>(sql, ...p)!.n;
  const leadsMonth = count(`SELECT COUNT(*) AS n FROM leads l WHERE ${s.sql} AND l.created_at >= ?`, ...s.params, +monthStart);
  const leadsPrev = count(`SELECT COUNT(*) AS n FROM leads l WHERE ${s.sql} AND l.created_at >= ? AND l.created_at < ?`, ...s.params, +prevMonthStart, +monthStart);
  const openLeads = count(`SELECT COUNT(*) AS n FROM leads l WHERE ${s.sql} AND l.stage NOT IN ('ganho','perdido')`, ...s.params);
  const won = count(`SELECT COUNT(*) AS n FROM leads l WHERE ${s.sql} AND l.stage = 'ganho'`, ...s.params);
  const lost = count(`SELECT COUNT(*) AS n FROM leads l WHERE ${s.sql} AND l.stage = 'perdido'`, ...s.params);
  const visitsUpcoming = count(`SELECT COUNT(*) AS n FROM visits WHERE ${ps.sql} AND status IN ('agendada','confirmada') AND scheduled_at > ?`, ...ps.params, t);
  const activeListings = count(`SELECT COUNT(*) AS n FROM properties WHERE ${ps.sql} AND status = 'disponivel'`, ...ps.params);
  const pendingListings = count("SELECT COUNT(*) AS n FROM properties WHERE status = 'pendente'");
  const vgv = get<{ v: number }>(`SELECT COALESCE(SUM(value),0) AS v FROM proposals WHERE ${ps.sql} AND status = 'aceita'`, ...ps.params)!.v;
  const vgvMonth = get<{ v: number }>(`SELECT COALESCE(SUM(value),0) AS v FROM proposals WHERE ${ps.sql} AND status = 'aceita' AND updated_at >= ?`, ...ps.params, +monthStart)!.v;
  const pipelineValue = get<{ v: number }>(`SELECT COALESCE(SUM(value),0) AS v FROM proposals WHERE ${ps.sql} AND status IN ('enviada','contraproposta')`, ...ps.params)!.v;

  const funnel = STAGES.map((stage) => ({
    stage, label: STAGE_LABEL[stage],
    count: count(`SELECT COUNT(*) AS n FROM leads l WHERE ${s.sql} AND l.stage = ?`, ...s.params, stage),
  }));
  const sources = all(`SELECT source, COUNT(*) AS n FROM leads l WHERE ${s.sql} GROUP BY source ORDER BY n DESC`, ...s.params);

  // Série dos últimos 12 meses: leads criados e negócios fechados (VGV)
  const months: { key: string; label: string; leads: number; vgv: number; visits: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const a = new Date(monthStart); a.setMonth(a.getMonth() - i);
    const b = new Date(a); b.setMonth(b.getMonth() + 1);
    months.push({
      key: `${a.getFullYear()}-${a.getMonth() + 1}`,
      label: a.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      leads: count(`SELECT COUNT(*) AS n FROM leads l WHERE ${s.sql} AND l.created_at >= ? AND l.created_at < ?`, ...s.params, +a, +b),
      vgv: get<{ v: number }>(`SELECT COALESCE(SUM(value),0) AS v FROM proposals WHERE ${ps.sql} AND status = 'aceita' AND updated_at >= ? AND updated_at < ?`, ...ps.params, +a, +b)!.v,
      visits: count(`SELECT COUNT(*) AS n FROM visits WHERE ${ps.sql} AND scheduled_at >= ? AND scheduled_at < ? AND status != 'cancelada'`, ...ps.params, +a, +b),
    });
  }

  const nextVisits = all(
    `SELECT v.id, v.scheduled_at, v.status, p.title AS property_title, p.neighborhood, c.name AS client_name, c.phone AS client_phone,
       (SELECT url FROM property_images WHERE property_id = p.id ORDER BY position LIMIT 1) AS cover
     FROM visits v JOIN properties p ON p.id = v.property_id LEFT JOIN users c ON c.id = v.client_id
     WHERE ${ps.sql.replace('agent_id', 'v.agent_id')} AND v.status IN ('agendada','confirmada') AND v.scheduled_at > ? ORDER BY v.scheduled_at LIMIT 5`,
    ...ps.params, t,
  );
  const tasks = all(
    `SELECT t.id, t.title, t.due_at, t.done, t.priority, t.lead_id, l.name AS lead_name FROM tasks t LEFT JOIN leads l ON l.id = t.lead_id
     WHERE t.done = 0 AND ${u.role === 'admin' ? '1=1' : 't.assigned_to = ?'} ORDER BY COALESCE(t.due_at, 9e15) LIMIT 6`,
    ...(u.role === 'admin' ? [] : [u.id]),
  );
  const hotLeads = all(
    `SELECT l.id, l.name, l.stage, l.temperature, l.budget, l.updated_at, p.title AS property_title FROM leads l LEFT JOIN properties p ON p.id = l.property_id
     WHERE ${s.sql} AND l.stage NOT IN ('ganho','perdido') AND l.temperature = 'quente' ORDER BY l.updated_at DESC LIMIT 5`,
    ...s.params,
  );
  const ranking = u.role === 'admin'
    ? all(
        `SELECT u.id, u.name, u.avatar,
          (SELECT COUNT(*) FROM leads l WHERE l.agent_id = u.id AND l.stage = 'ganho') AS won,
          (SELECT COALESCE(SUM(value),0) FROM proposals pr WHERE pr.agent_id = u.id AND pr.status = 'aceita') AS vgv,
          (SELECT COUNT(*) FROM leads l WHERE l.agent_id = u.id AND l.stage NOT IN ('ganho','perdido')) AS open
         FROM users u WHERE u.role IN ('corretor') AND u.active = 1 ORDER BY vgv DESC`,
      )
    : [];
  const topProperties = all(
    `SELECT p.id, p.title, p.views, p.price, p.purpose, (SELECT COUNT(*) FROM favorites f WHERE f.property_id = p.id) AS favorites,
       (SELECT COUNT(*) FROM leads l WHERE l.property_id = p.id) AS leads,
       (SELECT url FROM property_images WHERE property_id = p.id ORDER BY position LIMIT 1) AS cover
     FROM properties p WHERE ${ps.sql} AND status = 'disponivel' ORDER BY views DESC LIMIT 5`,
    ...ps.params,
  );

  res.json({
    kpis: {
      leadsMonth, leadsPrev, openLeads, visitsUpcoming, activeListings, pendingListings, vgv, vgvMonth, pipelineValue,
      conversion: won + lost ? Math.round((won / (won + lost)) * 1000) / 10 : 0,
      commission: Math.round(vgvMonth * config.commissionRate) / 100,
      commissionRate: config.commissionRate,
    },
    funnel, sources, months, nextVisits, tasks, hotLeads, ranking, topProperties,
  });
});

/* ====================== Leads ====================== */
const leadSchema = z.object({
  name: zReqStr(100, 'Informe o nome'),
  email: zEmail.optional().or(z.literal('')),
  phone: zPhone.optional().or(z.literal('')),
  source: z.enum(SOURCES).default('site'),
  stage: z.enum(STAGES).default('novo'),
  temperature: z.enum(['quente', 'morno', 'frio']).default('morno'),
  interest: z.enum(['compra', 'aluguel', 'venda', 'temporada']).default('compra'),
  budget: z.coerce.number().min(0).nullable().optional(),
  message: zStr(2000).optional(),
  property_id: z.coerce.number().int().positive().nullable().optional(),
  agent_id: z.coerce.number().int().positive().nullable().optional(),
});

crmRouter.get('/leads', (req, res) => {
  const f = parse(z.object({ q: zStr(100).optional(), stage: z.enum(STAGES).optional(), temperature: z.enum(['quente', 'morno', 'frio']).optional(), agent: z.coerce.number().int().optional(), source: zStr(30).optional() }), req.query);
  const s = leadScope(req.user!);
  const where = [s.sql];
  const params: (string | number)[] = [...s.params];
  if (f.q) { where.push('(l.name LIKE ? OR l.email LIKE ? OR l.phone LIKE ?)'); const l = `%${f.q}%`; params.push(l, l, l); }
  if (f.stage) { where.push('l.stage = ?'); params.push(f.stage); }
  if (f.temperature) { where.push('l.temperature = ?'); params.push(f.temperature); }
  if (f.source) { where.push('l.source = ?'); params.push(f.source); }
  if (f.agent && req.user!.role === 'admin') { where.push('l.agent_id = ?'); params.push(f.agent); }
  res.json(
    all(
      `SELECT l.*, a.name AS agent_name, p.title AS property_title, p.code AS property_code,
        (SELECT url FROM property_images WHERE property_id = p.id ORDER BY position LIMIT 1) AS property_cover,
        (SELECT COUNT(*) FROM tasks t WHERE t.lead_id = l.id AND t.done = 0) AS open_tasks,
        (SELECT MAX(created_at) FROM lead_activities la WHERE la.lead_id = l.id) AS last_activity
       FROM leads l LEFT JOIN users a ON a.id = l.agent_id LEFT JOIN properties p ON p.id = l.property_id
       WHERE ${where.join(' AND ')} ORDER BY l.updated_at DESC LIMIT 500`,
      ...params,
    ),
  );
});

crmRouter.get('/leads/:id', (req, res) => {
  const lead = loadLead(idParam(req.params.id), req.user!);
  const property = lead.property_id
    ? get('SELECT id, title, code, price, purpose, neighborhood, city, (SELECT url FROM property_images WHERE property_id = properties.id ORDER BY position LIMIT 1) AS cover FROM properties WHERE id = ?', lead.property_id)
    : null;
  const agent = lead.agent_id ? get('SELECT id, name, avatar FROM users WHERE id = ?', lead.agent_id) : null;
  const activities = all('SELECT la.*, u.name AS user_name FROM lead_activities la LEFT JOIN users u ON u.id = la.user_id WHERE la.lead_id = ? ORDER BY la.id DESC', lead.id);
  const tasks = all('SELECT * FROM tasks WHERE lead_id = ? ORDER BY done, COALESCE(due_at, 9e15)', lead.id);
  const visits = all('SELECT v.*, p.title AS property_title FROM visits v JOIN properties p ON p.id = v.property_id WHERE v.lead_id = ? ORDER BY scheduled_at DESC', lead.id);
  const proposals = all('SELECT pr.*, p.title AS property_title FROM proposals pr JOIN properties p ON p.id = pr.property_id WHERE pr.lead_id = ? ORDER BY pr.id DESC', lead.id);
  const favorites = lead.user_id
    ? all('SELECT p.id, p.title, p.price, p.purpose FROM favorites f JOIN properties p ON p.id = f.property_id WHERE f.user_id = ? ORDER BY f.created_at DESC LIMIT 10', lead.user_id)
    : [];
  const conversation = lead.user_id ? get('SELECT id FROM conversations WHERE client_id = ? ORDER BY last_message_at DESC LIMIT 1', lead.user_id) : null;
  res.json({ ...lead, property, agent, activities, tasks, visits, proposals, favorites, conversation });
});

crmRouter.post('/leads', (req, res) => {
  const b = parse(leadSchema, req.body);
  const t = now();
  const agentId = req.user!.role === 'admin' ? (b.agent_id ?? req.user!.id) : req.user!.id;
  const { id } = run(
    `INSERT INTO leads (name, email, phone, source, stage, temperature, interest, budget, message, property_id, agent_id, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    b.name, b.email || null, b.phone || null, b.source, b.stage, b.temperature, b.interest, b.budget ?? null, b.message ?? null, b.property_id ?? null, agentId, t, t,
  );
  leadActivity(id, req.user!.id, 'sistema', `Lead cadastrado manualmente por ${req.user!.name}`);
  if (agentId !== req.user!.id) notify(agentId, { type: 'lead', title: 'Lead atribuído a você', body: b.name, link: `/crm/leads/${id}` });
  audit(req, 'lead.create', { id });
  res.status(201).json({ id });
});

crmRouter.patch('/leads/:id', (req, res) => {
  const lead = loadLead(idParam(req.params.id), req.user!);
  const b = parse(leadSchema.partial().extend({ lost_reason: zStr(300).optional() }), req.body);
  if (b.agent_id !== undefined && req.user!.role !== 'admin') throw forbidden('Apenas administradores podem reatribuir leads.');
  if (b.stage === 'perdido' && !b.lost_reason && !lead.lost_reason) throw badRequest('Informe o motivo da perda.', { lost_reason: 'Informe o motivo' });
  const fields: string[] = [];
  const params: (string | number | null)[] = [];
  for (const [k, v] of Object.entries(b)) {
    if (v === undefined) continue;
    fields.push(`${k} = ?`);
    params.push(v === '' ? null : (v as string | number | null));
  }
  if (!fields.length) return res.json({ ok: true });
  run(`UPDATE leads SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`, ...params, now(), lead.id);
  if (b.stage && b.stage !== lead.stage) {
    leadActivity(lead.id, req.user!.id, 'etapa', `Etapa alterada: ${STAGE_LABEL[lead.stage]} → ${STAGE_LABEL[b.stage]}${b.stage === 'perdido' && b.lost_reason ? ` (motivo: ${b.lost_reason})` : ''}`);
  }
  if (b.temperature && b.temperature !== lead.temperature) leadActivity(lead.id, req.user!.id, 'sistema', `Temperatura: ${lead.temperature} → ${b.temperature}`);
  if (b.agent_id && b.agent_id !== lead.agent_id) {
    const ag = get<{ name: string }>('SELECT name FROM users WHERE id = ?', b.agent_id);
    leadActivity(lead.id, req.user!.id, 'sistema', `Lead reatribuído para ${ag?.name ?? '—'}`);
    notify(b.agent_id, { type: 'lead', title: 'Lead atribuído a você', body: lead.name, link: `/crm/leads/${lead.id}` });
  }
  audit(req, 'lead.update', { id: lead.id, ...(b.stage ? { stage: b.stage } : {}) });
  res.json({ ok: true });
});

crmRouter.delete('/leads/:id', requireRole('admin'), (req, res) => {
  const id = idParam(req.params.id);
  run('DELETE FROM leads WHERE id = ?', id);
  audit(req, 'lead.delete', { id });
  res.json({ ok: true });
});

crmRouter.post('/leads/:id/activities', (req, res) => {
  const lead = loadLead(idParam(req.params.id), req.user!);
  const b = parse(z.object({ type: z.enum(['nota', 'ligacao', 'email', 'whatsapp', 'reuniao']), content: zReqStr(2000, 'Escreva algo') }), req.body);
  leadActivity(lead.id, req.user!.id, b.type, b.content);
  if (lead.stage === 'novo' && b.type !== 'nota') {
    run("UPDATE leads SET stage = 'contato' WHERE id = ?", lead.id);
    leadActivity(lead.id, req.user!.id, 'etapa', 'Etapa alterada: Novo → Em contato');
  }
  res.status(201).json({ ok: true });
});

/* ====================== Tarefas ====================== */
crmRouter.get('/tasks', (req, res) => {
  const admin = req.user!.role === 'admin';
  res.json(
    all(
      `SELECT t.*, l.name AS lead_name, u.name AS assigned_name FROM tasks t LEFT JOIN leads l ON l.id = t.lead_id LEFT JOIN users u ON u.id = t.assigned_to
       WHERE ${admin ? '1=1' : 't.assigned_to = ?'} ORDER BY t.done, COALESCE(t.due_at, 9e15) LIMIT 300`,
      ...(admin ? [] : [req.user!.id]),
    ),
  );
});
crmRouter.post('/tasks', (req, res) => {
  const b = parse(z.object({ title: zReqStr(200, 'Descreva a tarefa'), due_at: z.number().int().nullable().optional(), priority: z.enum(['baixa', 'media', 'alta']).default('media'), lead_id: z.number().int().positive().nullable().optional(), assigned_to: z.number().int().positive().optional() }), req.body);
  if (b.lead_id) loadLead(b.lead_id, req.user!);
  const assigned = req.user!.role === 'admin' ? (b.assigned_to ?? req.user!.id) : req.user!.id;
  const { id } = run('INSERT INTO tasks (title, due_at, priority, lead_id, assigned_to, created_by, created_at) VALUES (?,?,?,?,?,?,?)', b.title, b.due_at ?? null, b.priority, b.lead_id ?? null, assigned, req.user!.id, now());
  if (b.lead_id) leadActivity(b.lead_id, req.user!.id, 'tarefa', `Tarefa criada: ${b.title}`);
  if (assigned !== req.user!.id) notify(assigned, { type: 'tarefa', title: 'Nova tarefa atribuída', body: b.title, link: '/crm/agenda' });
  res.status(201).json({ id });
});
crmRouter.patch('/tasks/:id', (req, res) => {
  const id = idParam(req.params.id);
  const tk = get<{ assigned_to: number; lead_id: number | null; title: string }>('SELECT * FROM tasks WHERE id = ?', id);
  if (!tk) throw notFound();
  if (req.user!.role !== 'admin' && tk.assigned_to !== req.user!.id) throw forbidden();
  const b = parse(z.object({ done: z.boolean() }), req.body);
  run('UPDATE tasks SET done = ? WHERE id = ?', b.done ? 1 : 0, id);
  if (b.done && tk.lead_id) leadActivity(tk.lead_id, req.user!.id, 'tarefa', `Tarefa concluída: ${tk.title}`);
  res.json({ ok: true });
});
crmRouter.delete('/tasks/:id', (req, res) => {
  const id = idParam(req.params.id);
  const tk = get<{ assigned_to: number }>('SELECT assigned_to FROM tasks WHERE id = ?', id);
  if (!tk) throw notFound();
  if (req.user!.role !== 'admin' && tk.assigned_to !== req.user!.id) throw forbidden();
  run('DELETE FROM tasks WHERE id = ?', id);
  res.json({ ok: true });
});

/* ====================== Visitas (CRM agenda — criação manual) ====================== */
crmRouter.post('/visits', (req, res) => {
  const b = parse(z.object({ lead_id: z.number().int().positive(), property_id: z.number().int().positive(), scheduled_at: z.number().int(), notes: zStr(500).optional() }), req.body);
  const lead = loadLead(b.lead_id, req.user!);
  const p = get<{ title: string }>('SELECT title FROM properties WHERE id = ?', b.property_id);
  if (!p) throw notFound('Imóvel não encontrado.');
  const { id } = run(
    "INSERT INTO visits (property_id, client_id, agent_id, lead_id, scheduled_at, status, notes, created_at) VALUES (?,?,?,?,?, 'confirmada', ?, ?)",
    b.property_id, lead.user_id ?? null, lead.agent_id ?? req.user!.id, lead.id, b.scheduled_at, b.notes ?? null, now(),
  );
  leadActivity(lead.id, req.user!.id, 'visita', `Visita agendada para ${new Date(b.scheduled_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} — ${p.title}`);
  if (['novo', 'contato'].includes(lead.stage)) run("UPDATE leads SET stage = 'visita' WHERE id = ?", lead.id);
  notify(lead.user_id, { type: 'visita', title: 'Visita agendada pelo corretor', body: p.title, link: '/visitas' });
  res.status(201).json({ id });
});

/* ====================== Propostas ====================== */
crmRouter.get('/proposals', (req, res) => {
  const admin = req.user!.role === 'admin';
  res.json(
    all(
      `SELECT pr.*, p.title AS property_title, p.code AS property_code, p.price AS asking_price, l.name AS lead_name, a.name AS agent_name,
         (SELECT url FROM property_images WHERE property_id = p.id ORDER BY position LIMIT 1) AS cover
       FROM proposals pr JOIN properties p ON p.id = pr.property_id LEFT JOIN leads l ON l.id = pr.lead_id LEFT JOIN users a ON a.id = pr.agent_id
       WHERE ${admin ? '1=1' : 'pr.agent_id = ?'} ORDER BY pr.updated_at DESC`,
      ...(admin ? [] : [req.user!.id]),
    ),
  );
});

crmRouter.post('/proposals', (req, res) => {
  const b = parse(z.object({ lead_id: z.number().int().positive(), property_id: z.number().int().positive(), value: z.number().positive('Informe o valor'), payment: z.enum(['a_vista', 'financiamento', 'permuta', 'consorcio']), notes: zStr(1000).optional(), valid_days: z.number().int().min(1).max(90).default(7), status: z.enum(['rascunho', 'enviada']).default('enviada') }), req.body);
  const lead = loadLead(b.lead_id, req.user!);
  const t = now();
  const { id } = run(
    'INSERT INTO proposals (lead_id, property_id, agent_id, client_id, value, payment, status, notes, valid_until, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    lead.id, b.property_id, lead.agent_id ?? req.user!.id, lead.user_id ?? null, b.value, b.payment, b.status, b.notes ?? null, t + b.valid_days * 86400_000, t, t,
  );
  leadActivity(lead.id, req.user!.id, 'proposta', `Proposta registrada: ${b.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${b.payment.replace('_', ' ')})`);
  if (['novo', 'contato', 'visita'].includes(lead.stage)) run("UPDATE leads SET stage = 'proposta' WHERE id = ?", lead.id);
  if (b.status === 'enviada') notify(lead.user_id, { type: 'proposta', title: 'Você recebeu uma proposta', link: '/propostas' });
  res.status(201).json({ id });
});

crmRouter.patch('/proposals/:id', (req, res) => {
  const id = idParam(req.params.id);
  const pr = get<any>('SELECT * FROM proposals WHERE id = ?', id);
  if (!pr) throw notFound();
  if (req.user!.role !== 'admin' && pr.agent_id !== req.user!.id) throw forbidden();
  const b = parse(z.object({ status: z.enum(['rascunho', 'enviada', 'contraproposta', 'aceita', 'recusada']).optional(), value: z.number().positive().optional(), notes: zStr(1000).optional() }), req.body);
  run('UPDATE proposals SET status = COALESCE(?, status), value = COALESCE(?, value), notes = COALESCE(?, notes), updated_at = ? WHERE id = ?', b.status ?? null, b.value ?? null, b.notes ?? null, now(), id);
  const prop = get<{ title: string; purpose: string }>('SELECT title, purpose FROM properties WHERE id = ?', pr.property_id)!;
  if (b.status && b.status !== pr.status) {
    if (pr.lead_id) leadActivity(pr.lead_id, req.user!.id, 'proposta', `Proposta ${b.status}${b.value ? ` — ${b.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}`);
    if (b.status === 'aceita') {
      run('UPDATE properties SET status = ?, updated_at = ? WHERE id = ?', prop.purpose === 'venda' ? 'vendido' : 'alugado', now(), pr.property_id);
      if (pr.lead_id) run("UPDATE leads SET stage = 'ganho', updated_at = ? WHERE id = ?", now(), pr.lead_id);
      run("UPDATE proposals SET status = 'recusada', updated_at = ? WHERE property_id = ? AND id != ? AND status IN ('enviada','contraproposta','rascunho')", now(), pr.property_id, id);
    }
    if (b.status === 'contraproposta' && pr.lead_id) run("UPDATE leads SET stage = 'negociacao' WHERE id = ?", pr.lead_id);
    notify(pr.client_id, { type: 'proposta', title: `Sua proposta foi atualizada: ${b.status}`, body: prop.title, link: '/propostas' });
  }
  audit(req, 'proposal.update', { id, status: b.status });
  res.json({ ok: true });
});

/* ====================== Clientes (contatos) ====================== */
crmRouter.get('/clients', (req, res) => {
  const q = parse(z.object({ q: zStr(100).optional() }), req.query).q;
  const like = `%${q ?? ''}%`;
  res.json(
    all(
      `SELECT u.id, u.name, u.email, u.phone, u.created_at, u.last_login_at, u.marketing_opt_in,
        (SELECT COUNT(*) FROM favorites f WHERE f.user_id = u.id) AS favorites,
        (SELECT COUNT(*) FROM visits v WHERE v.client_id = u.id) AS visits,
        (SELECT id FROM leads l WHERE l.user_id = u.id ORDER BY updated_at DESC LIMIT 1) AS lead_id,
        (SELECT stage FROM leads l WHERE l.user_id = u.id ORDER BY updated_at DESC LIMIT 1) AS lead_stage
       FROM users u WHERE u.role = 'cliente' AND u.active = 1 AND (u.name LIKE ? OR u.email LIKE ?) ORDER BY u.created_at DESC LIMIT 300`,
      like, like,
    ),
  );
});

/* ====================== Equipe (admin) ====================== */
crmRouter.get('/agents', (_req, res) => {
  res.json(all("SELECT id, name, avatar, role FROM users WHERE role IN ('corretor','admin') AND active = 1 ORDER BY name"));
});

crmRouter.get('/users', requireRole('admin'), (req, res) => {
  const f = parse(z.object({ role: z.enum(['cliente', 'corretor', 'admin']).optional(), q: zStr(100).optional(), inactive: zBool.optional() }), req.query);
  const where = [f.inactive ? '1=1' : 'u.active = 1'];
  const params: string[] = [];
  if (f.role) { where.push('u.role = ?'); params.push(f.role); }
  if (f.q) { where.push('(u.name LIKE ? OR u.email LIKE ?)'); params.push(`%${f.q}%`, `%${f.q}%`); }
  res.json(
    all(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.creci, u.avatar, u.active, u.totp_enabled, u.last_login_at, u.created_at, u.locked_until,
        (SELECT COUNT(*) FROM leads l WHERE l.agent_id = u.id AND l.stage NOT IN ('ganho','perdido')) AS open_leads,
        (SELECT COUNT(*) FROM properties p WHERE p.agent_id = u.id AND p.status = 'disponivel') AS listings
       FROM users u WHERE ${where.join(' AND ')} AND u.email NOT LIKE '%@anon.invalid' ORDER BY CASE u.role WHEN 'admin' THEN 0 WHEN 'corretor' THEN 1 ELSE 2 END, u.name`,
      ...params,
    ),
  );
});

crmRouter.post('/users', requireRole('admin'), async (req, res) => {
  const b = parse(z.object({ name: zReqStr(100), email: zEmail, phone: zPhone.optional().or(z.literal('')), role: z.enum(['corretor', 'admin']), creci: zStr(30).optional(), password: z.string().max(128) }), req.body);
  const issues = passwordProblems(b.password, b);
  if (issues.length) throw badRequest('Senha fraca.', { password: `A senha precisa de: ${issues.join(', ')}` });
  if (get('SELECT 1 FROM users WHERE email = ?', b.email)) throw badRequest('E-mail já cadastrado.', { email: 'E-mail já cadastrado' });
  const t = now();
  const { id } = run(
    'INSERT INTO users (name, email, phone, password_hash, role, creci, terms_accepted_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
    b.name, b.email, b.phone || null, await hashPassword(b.password), b.role, b.creci ?? null, t, t, t,
  );
  audit(req, 'user.create', { id, role: b.role });
  res.status(201).json({ id });
});

crmRouter.patch('/users/:id', requireRole('admin'), (req, res) => {
  const id = idParam(req.params.id);
  const b = parse(z.object({ role: z.enum(['cliente', 'corretor', 'admin']).optional(), active: z.boolean().optional(), unlock: z.boolean().optional() }), req.body);
  if (id === req.user!.id && (b.role || b.active === false)) throw badRequest('Você não pode alterar o próprio papel ou desativar a própria conta.');
  const target = get<{ role: string; active: number }>('SELECT role, active FROM users WHERE id = ?', id);
  if (!target) throw notFound();
  if (b.role) run('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', b.role, now(), id);
  if (b.active !== undefined) {
    run('UPDATE users SET active = ?, updated_at = ? WHERE id = ?', b.active ? 1 : 0, now(), id);
    if (!b.active) run('DELETE FROM sessions WHERE user_id = ?', id); // encerra acesso imediatamente
  }
  if (b.unlock) run('UPDATE users SET locked_until = NULL, failed_logins = 0 WHERE id = ?', id);
  if (b.role && b.role !== target.role) run('DELETE FROM sessions WHERE user_id = ?', id); // força novo login com novas permissões
  audit(req, 'user.update', { id, ...b, previousRole: target.role });
  res.json({ ok: true });
});

/* ====================== Auditoria (admin) ====================== */
crmRouter.get('/audit', requireRole('admin'), (req, res) => {
  const f = parse(z.object({ action: zStr(60).optional(), user: z.coerce.number().int().optional(), page: z.coerce.number().int().min(1).default(1) }), req.query);
  const where = ['1=1'];
  const params: (string | number)[] = [];
  if (f.action) { where.push('a.action LIKE ?'); params.push(`${f.action}%`); }
  if (f.user) { where.push('a.user_id = ?'); params.push(f.user); }
  const items = all(
    `SELECT a.*, u.name AS user_name, u.email AS user_email FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id WHERE ${where.join(' AND ')} ORDER BY a.id DESC LIMIT 50 OFFSET ?`,
    ...params, (f.page - 1) * 50,
  );
  const summary = {
    failed24h: get<{ n: number }>("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'auth.login_failed' AND created_at > ?", now() - 86400_000)!.n,
    locked24h: get<{ n: number }>("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'auth.account_locked' AND created_at > ?", now() - 86400_000)!.n,
    logins24h: get<{ n: number }>("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'auth.login' AND created_at > ?", now() - 86400_000)!.n,
    mfaUsers: get<{ n: number }>('SELECT COUNT(*) AS n FROM users WHERE totp_enabled = 1 AND active = 1')!.n,
    staffWithoutMfa: get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE totp_enabled = 0 AND active = 1 AND role IN ('corretor','admin')")!.n,
    activeSessions: get<{ n: number }>('SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ? AND mfa_pending = 0', now())!.n,
  };
  res.json({ items, summary });
});

/* ====================== Relatórios (CSV) ====================== */
function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita injeção de fórmulas no Excel (CSV injection)
    return `"${s.replace(/"/g, '""')}"`;
  };
  return '﻿' + [cols.join(';'), ...rows.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\n');
}

crmRouter.get('/reports/:kind.csv', (req, res) => {
  const kind = req.params.kind;
  const s = leadScope(req.user!);
  const fmt = (ms: number | null) => (ms ? new Date(ms).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '');
  let rows: Record<string, unknown>[] = [];
  if (kind === 'leads') {
    rows = all<any>(
      `SELECT l.id, l.name AS nome, l.email, l.phone AS telefone, l.source AS origem, l.stage AS etapa, l.temperature AS temperatura, l.interest AS interesse,
        l.budget AS orcamento, p.code AS imovel, a.name AS corretor, l.created_at AS criado_em
       FROM leads l LEFT JOIN properties p ON p.id = l.property_id LEFT JOIN users a ON a.id = l.agent_id WHERE ${s.sql} ORDER BY l.id DESC`,
      ...s.params,
    ).map((r) => ({ ...r, criado_em: fmt(r.criado_em) }));
  } else if (kind === 'imoveis') {
    rows = all<any>("SELECT p.code AS codigo, p.title AS titulo, p.purpose AS finalidade, p.type AS tipo, p.status, p.price AS valor, p.area, p.bedrooms AS quartos, p.neighborhood AS bairro, p.city AS cidade, p.views AS visualizacoes, a.name AS corretor FROM properties p LEFT JOIN users a ON a.id = p.agent_id ORDER BY p.id");
  } else if (kind === 'propostas') {
    rows = all<any>(
      `SELECT pr.id, p.code AS imovel, l.name AS cliente, pr.value AS valor, pr.payment AS pagamento, pr.status, a.name AS corretor, pr.created_at AS criada_em
       FROM proposals pr JOIN properties p ON p.id = pr.property_id LEFT JOIN leads l ON l.id = pr.lead_id LEFT JOIN users a ON a.id = pr.agent_id
       WHERE ${req.user!.role === 'admin' ? '1=1' : 'pr.agent_id = ?'} ORDER BY pr.id DESC`,
      ...(req.user!.role === 'admin' ? [] : [req.user!.id]),
    ).map((r) => ({ ...r, criada_em: fmt(r.criada_em) }));
  } else throw notFound();
  audit(req, 'report.export', { kind });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="walisson-${kind}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv(rows));
});
