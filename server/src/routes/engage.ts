import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.ts';
import { all, get, run, now } from '../db.ts';
import { requireRole, type SessionUser } from '../lib/auth.ts';
import { audit, leadActivity } from '../lib/events.ts';
import { badRequest, forbidden, idParam, notFound, parse, zReqStr, zStr } from '../lib/http.ts';
import { emailLayout, mailEnabled, sendMail } from '../lib/mailer.ts';
import { sendPush } from '../lib/push.ts';

/** Follow-ups (próximo contato com cada lead) e disparos de mensagens em massa. */
export const engageRouter = Router();
engageRouter.use(requireRole('corretor', 'admin'));

const DAY = 86_400_000;
const BRT = 3 * 3_600_000; // Brasília (UTC−3, sem horário de verão)
const endOfToday = (t = now()) => Math.floor((t - BRT) / DAY) * DAY + DAY + BRT;
const CONTACT_TYPES = "('ligacao','whatsapp','email','reuniao','visita')";
const STAGES = ['novo', 'contato', 'visita', 'proposta', 'negociacao', 'ganho', 'perdido'] as const;

const scope = (u: SessionUser) => (u.role === 'admin' ? { sql: '1=1', params: [] as number[] } : { sql: 'l.agent_id = ?', params: [u.id] });
async function loadLead(id: number, u: SessionUser) {
  const lead = await get<any>('SELECT * FROM leads WHERE id = ?', id);
  if (!lead) throw notFound('Lead não encontrado.');
  if (u.role !== 'admin' && lead.agent_id !== u.id) throw forbidden('Este lead pertence a outro corretor.');
  return lead;
}
const fmt = (ms: number) => new Date(ms).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/* ============================ Follow-up ============================ */
engageRouter.get('/followups', async (req, res) => {
  const s = scope(req.user!);
  const t = now();
  const rows = await all<any>(
    `SELECT l.id, l.name, l.phone, l.email, l.stage, l.temperature, l.next_followup_at, l.followup_note, l.user_id,
       a.name AS agent_name, p.title AS property_title,
       (SELECT MAX(created_at) FROM lead_activities la WHERE la.lead_id = l.id AND la.type IN ${CONTACT_TYPES}) AS last_contact
     FROM leads l LEFT JOIN users a ON a.id = l.agent_id LEFT JOIN properties p ON p.id = l.property_id
     WHERE ${s.sql} AND l.stage NOT IN ('ganho','perdido')
     ORDER BY COALESCE(l.next_followup_at, 9e15), l.updated_at DESC LIMIT 1000`,
    ...s.params,
  );
  const eod = endOfToday(t);
  const scheduled = rows.filter((r) => r.next_followup_at);
  res.json({
    overdue: scheduled.filter((r) => r.next_followup_at < t),
    today: scheduled.filter((r) => r.next_followup_at >= t && r.next_followup_at < eod),
    upcoming: scheduled.filter((r) => r.next_followup_at >= eod).slice(0, 100),
    // Sem próximo contato marcado e sem falar com o cliente há 7 dias ou mais
    cold: rows.filter((r) => !r.next_followup_at && (!r.last_contact || r.last_contact < t - 7 * DAY)).slice(0, 100),
  });
});

engageRouter.put('/leads/:id/followup', async (req, res) => {
  const lead = await loadLead(idParam(req.params.id), req.user!);
  const b = parse(z.object({ at: z.number().int().nullable(), note: zStr(300).optional() }), req.body);
  if (b.at !== null && (b.at < now() - 10 * 60_000 || b.at > now() + 400 * DAY)) throw badRequest('Escolha uma data futura.', { at: 'Data inválida' });
  await run(
    'UPDATE leads SET next_followup_at = ?, followup_note = ?, followup_notified_at = NULL, updated_at = ? WHERE id = ?',
    b.at, b.at ? b.note || null : null, now(), lead.id,
  );
  await leadActivity(
    lead.id, req.user!.id, 'tarefa',
    b.at ? `Follow-up agendado para ${fmt(b.at)}${b.note ? ` — ${b.note}` : ''}` : 'Follow-up concluído',
  );
  res.json({ ok: true });
});

engageRouter.put('/leads/:id/opt-out', async (req, res) => {
  const lead = await loadLead(idParam(req.params.id), req.user!);
  const b = parse(z.object({ opt_out: z.boolean() }), req.body);
  await run('UPDATE leads SET opt_out = ? WHERE id = ?', b.opt_out ? 1 : 0, lead.id);
  await leadActivity(lead.id, req.user!.id, 'sistema', b.opt_out ? 'Cliente pediu para não receber disparos' : 'Cliente voltou a aceitar disparos');
  res.json({ ok: true });
});

/* ============================ Disparos ============================ */
const filtersSchema = z.object({
  stages: z.array(z.enum(STAGES)).max(7).default([]),
  temperatures: z.array(z.enum(['quente', 'morno', 'frio'])).max(3).default([]),
  source: zStr(30).optional(),
  interest: zStr(30).optional(),
  agent: z.number().int().positive().optional(),
});
const audienceSchema = z.object({ audience: z.enum(['leads', 'clientes']).default('leads'), filters: filtersSchema.default({ stages: [], temperatures: [] }) });
type Recipient = { lead_id: number | null; user_id: number | null; name: string; phone: string | null; email: string | null; notify_push: number | null; notify_email: number | null };
const MAX_RECIPIENTS = 1000;

async function findRecipients(u: SessionUser, a: z.infer<typeof audienceSchema>): Promise<Recipient[]> {
  if (a.audience === 'clientes') {
    if (u.role !== 'admin') throw forbidden('Apenas administradores podem disparar para todos os clientes do app.');
    // LGPD: ofertas só para quem autorizou no cadastro ou em Minha conta
    return all<Recipient>(
      `SELECT NULL AS lead_id, u.id AS user_id, u.name, u.phone, u.email, u.notify_push, u.notify_email FROM users u
       WHERE u.role = 'cliente' AND u.active = 1 AND u.marketing_opt_in = 1 AND u.email NOT LIKE '%@anon.invalid'
       ORDER BY u.id DESC LIMIT ${MAX_RECIPIENTS + 1}`,
    );
  }
  const s = scope(u);
  const where = [s.sql, 'l.opt_out = 0'];
  const params: (string | number)[] = [...s.params];
  const f = a.filters;
  if (f.stages.length) { where.push(`l.stage IN (${f.stages.map(() => '?').join(',')})`); params.push(...f.stages); }
  if (f.temperatures.length) { where.push(`l.temperature IN (${f.temperatures.map(() => '?').join(',')})`); params.push(...f.temperatures); }
  if (f.source) { where.push('l.source = ?'); params.push(f.source); }
  if (f.interest) { where.push('l.interest = ?'); params.push(f.interest); }
  if (f.agent && u.role === 'admin') { where.push('l.agent_id = ?'); params.push(f.agent); }
  return all<Recipient>(
    `SELECT l.id AS lead_id, l.user_id, l.name, l.phone, l.email, c.notify_push, c.notify_email
     FROM leads l LEFT JOIN users c ON c.id = l.user_id AND c.active = 1
     WHERE ${where.join(' AND ')} ORDER BY l.updated_at DESC LIMIT ${MAX_RECIPIENTS + 1}`,
    ...params,
  );
}

engageRouter.post('/campaigns/preview', async (req, res) => {
  const list = await findRecipients(req.user!, parse(audienceSchema, req.body));
  res.json({
    total: Math.min(list.length, MAX_RECIPIENTS),
    over_limit: list.length > MAX_RECIPIENTS,
    phone: list.filter((r) => r.phone).length,
    app: list.filter((r) => r.user_id).length,
    email: list.filter((r) => r.email).length,
    sample: list.slice(0, 6).map((r) => r.name),
    email_enabled: mailEnabled(),
  });
});

const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n;

engageRouter.post('/campaigns', async (req, res) => {
  const u = req.user!;
  const b = parse(
    audienceSchema.extend({
      title: zReqStr(80, 'Dê um título ao disparo'),
      message: zReqStr(1500, 'Escreva a mensagem'),
      channels: z.array(z.enum(['whatsapp', 'app', 'email'])).min(1, 'Escolha pelo menos um canal'),
      property_id: z.number().int().positive().nullable().optional(),
    }),
    req.body,
  );
  const list = await findRecipients(u, b);
  if (!list.length) throw badRequest('Nenhum contato corresponde aos filtros escolhidos.');
  if (list.length > MAX_RECIPIENTS) throw badRequest(`Máximo de ${MAX_RECIPIENTS} contatos por disparo. Use mais filtros.`);
  const prop = b.property_id ? await get<{ id: number; title: string }>("SELECT id, title FROM properties WHERE id = ? AND status != 'pendente'", b.property_id) : null;
  if (b.property_id && !prop) throw notFound('Imóvel não encontrado.');
  const link = prop ? `${config.appUrl}/imovel/${prop.id}` : config.appUrl;
  const render = (r: Recipient) => {
    let t = b.message
      .replaceAll('{nome}', firstName(r.name))
      .replaceAll('{corretor}', firstName(u.name))
      .replaceAll('{imovel}', prop?.title ?? '')
      .replaceAll('{link}', link);
    if (prop && !b.message.includes('{link}')) t += `\n\n${link}`;
    return t;
  };
  const ch = new Set(b.channels);
  const t = now();
  const { id } = await run(
    'INSERT INTO campaigns (title, message, channels, audience, filters, property_id, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)',
    b.title, b.message, JSON.stringify([...ch]), b.audience, JSON.stringify(b.filters), prop?.id ?? null, u.id, t,
  );
  const mailOn = mailEnabled();
  const rows = list.map((r) => ({
    r,
    text: render(r),
    wa: !ch.has('whatsapp') ? 'nao' : r.phone ? 'pendente' : 'sem_telefone',
    app: !ch.has('app') ? 'nao' : r.user_id ? 'enviado' : 'sem_app',
    email: !ch.has('email') ? 'nao' : !r.email ? 'sem_email' : r.user_id && r.notify_email === 0 ? 'recusou' : mailOn ? 'pendente' : 'desativado',
  }));
  // Inserção em blocos (rápida também no banco na nuvem)
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    await run(
      `INSERT INTO campaign_recipients (campaign_id, lead_id, user_id, name, phone, email, text, wa_status, app_status, email_status) VALUES ${chunk.map(() => '(?,?,?,?,?,?,?,?,?,?)').join(',')}`,
      ...chunk.flatMap((x) => [id, x.r.lead_id, x.r.user_id, x.r.name, x.r.phone, x.r.email, x.text, x.wa, x.app, x.email]),
    );
  }
  // Aviso no app (sino) para quem tem conta, em blocos
  const appRows = rows.filter((x) => x.app === 'enviado');
  const notifLink = prop ? `/imovel/${prop.id}` : '/';
  for (let i = 0; i < appRows.length; i += 50) {
    const chunk = appRows.slice(i, i + 50);
    await run(
      `INSERT INTO notifications (user_id, type, title, body, link, created_at) VALUES ${chunk.map(() => "(?, 'campanha', ?, ?, ?, ?)").join(',')}`,
      ...chunk.flatMap((x) => [x.r.user_id, b.title, x.text.slice(0, 500), notifLink, t]),
    );
  }
  if (b.audience === 'leads') {
    const leadIds = [...new Set(rows.map((x) => x.r.lead_id).filter(Boolean))] as number[];
    for (let i = 0; i < leadIds.length; i += 100) {
      const chunk = leadIds.slice(i, i + 100);
      await run(
        `INSERT INTO lead_activities (lead_id, user_id, type, content, created_at) VALUES ${chunk.map(() => "(?, ?, 'sistema', ?, ?)").join(',')}`,
        ...chunk.flatMap((lid) => [lid, u.id, `Incluído no disparo "${b.title}"`, t]),
      );
    }
  }
  await audit(req, 'campaign.create', { id, total: rows.length, channels: [...ch] });
  res.status(201).json({ id });

  // Push e e-mail em segundo plano (não seguram a resposta)
  void (async () => {
    for (const x of appRows) {
      if (x.r.notify_push === 0) continue;
      await sendPush(x.r.user_id!, { type: 'campanha', title: b.title, body: x.text.slice(0, 300), link: notifLink }).catch(() => 0);
    }
    const pending = await all<{ id: number; name: string; email: string; text: string }>(
      "SELECT id, name, email, text FROM campaign_recipients WHERE campaign_id = ? AND email_status = 'pendente' ORDER BY id", id,
    );
    const seen = new Set<string>();
    for (const x of pending) {
      const key = x.email.toLowerCase();
      if (seen.has(key)) { await run("UPDATE campaign_recipients SET email_status = 'duplicado' WHERE id = ?", x.id); continue; }
      seen.add(key);
      const html = emailLayout({
        title: b.title,
        body: x.text,
        button: { label: prop ? 'Ver imóvel' : 'Abrir o app', url: link },
        footer: 'Você recebeu esta mensagem porque entrou em contato com a Walisson Imóveis. Para não receber mais, responda este e-mail com a palavra SAIR.',
      });
      const ok = await sendMail({ email: x.email, name: x.name }, b.title, html, x.text).catch(() => false);
      await run('UPDATE campaign_recipients SET email_status = ? WHERE id = ?', ok ? 'enviado' : 'falhou', x.id);
      await new Promise((r) => setTimeout(r, 120));
    }
  })().catch((e) => console.error('[disparo]', (e as Error).message));
});

async function loadCampaign(id: number, u: SessionUser) {
  const c = await get<any>('SELECT c.*, u.name AS created_by_name, p.title AS property_title FROM campaigns c LEFT JOIN users u ON u.id = c.created_by LEFT JOIN properties p ON p.id = c.property_id WHERE c.id = ?', id);
  if (!c) throw notFound('Disparo não encontrado.');
  if (u.role !== 'admin' && c.created_by !== u.id) throw forbidden();
  return { ...c, channels: JSON.parse(c.channels) as string[] };
}

const STATS = `COUNT(*) AS total,
  SUM(r.wa_status = 'enviado') AS wa_sent, SUM(r.wa_status = 'pendente') AS wa_pending,
  SUM(r.app_status = 'enviado') AS app_sent, SUM(r.email_status = 'enviado') AS email_sent`;

engageRouter.get('/campaigns', async (req, res) => {
  const admin = req.user!.role === 'admin';
  const list = await all<any>(
    `SELECT c.id, c.title, c.channels, c.audience, c.created_at, u.name AS created_by_name, ${STATS}
     FROM campaigns c LEFT JOIN users u ON u.id = c.created_by LEFT JOIN campaign_recipients r ON r.campaign_id = c.id
     WHERE ${admin ? '1=1' : 'c.created_by = ?'} GROUP BY c.id ORDER BY c.id DESC LIMIT 200`,
    ...(admin ? [] : [req.user!.id]),
  );
  res.json(list.map((c) => ({ ...c, channels: JSON.parse(c.channels) })));
});

engageRouter.get('/campaigns/:id', async (req, res) => {
  const c = await loadCampaign(idParam(req.params.id), req.user!);
  const recipients = await all('SELECT * FROM campaign_recipients WHERE campaign_id = ? ORDER BY id', c.id);
  res.json({ ...c, recipients });
});

engageRouter.patch('/campaigns/:id/recipients/:rid', async (req, res) => {
  const c = await loadCampaign(idParam(req.params.id), req.user!);
  const r = await get<{ id: number; lead_id: number | null; wa_status: string }>('SELECT id, lead_id, wa_status FROM campaign_recipients WHERE id = ? AND campaign_id = ?', idParam(req.params.rid), c.id);
  if (!r) throw notFound();
  const b = parse(z.object({ wa_status: z.enum(['pendente', 'enviado', 'pulado']) }), req.body);
  if (r.wa_status === 'sem_telefone' || r.wa_status === 'nao') throw badRequest('Este contato não está na fila do WhatsApp.');
  await run('UPDATE campaign_recipients SET wa_status = ?, wa_at = ? WHERE id = ?', b.wa_status, b.wa_status === 'enviado' ? now() : null, r.id);
  if (b.wa_status === 'enviado' && r.wa_status !== 'enviado' && r.lead_id) {
    await leadActivity(r.lead_id, req.user!.id, 'whatsapp', `Mensagem do disparo "${c.title}" enviada pelo WhatsApp`);
  }
  res.json({ ok: true });
});

engageRouter.delete('/campaigns/:id', async (req, res) => {
  const c = await loadCampaign(idParam(req.params.id), req.user!);
  await run('DELETE FROM campaign_recipients WHERE campaign_id = ?', c.id);
  await run('DELETE FROM campaigns WHERE id = ?', c.id);
  await audit(req, 'campaign.delete', { id: c.id });
  res.json({ ok: true });
});
