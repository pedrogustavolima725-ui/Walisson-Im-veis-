import type { Request } from 'express';
import { all, get, run, now } from '../db.ts';
import { clientIp } from './auth.ts';

export async function audit(req: Request | null, action: string, meta: Record<string, unknown> = {}, userId?: number | null) {
  await run(
    'INSERT INTO audit_logs (user_id, action, ip, user_agent, meta, created_at) VALUES (?,?,?,?,?,?)',
    userId ?? req?.user?.id ?? null,
    action,
    req ? clientIp(req) : null,
    req ? (req.get('user-agent') ?? '').slice(0, 300) : null,
    JSON.stringify(meta),
    now(),
  );
}

export async function notify(userId: number | null | undefined, n: { type: string; title: string; body?: string; link?: string }) {
  if (!userId) return;
  await run(
    'INSERT INTO notifications (user_id, type, title, body, link, created_at) VALUES (?,?,?,?,?,?)',
    userId, n.type, n.title, n.body ?? null, n.link ?? null, now(),
  );
}

export async function notifyStaff(n: { type: string; title: string; body?: string; link?: string }) {
  for (const u of await all<{ id: number }>("SELECT id FROM users WHERE role = 'admin' AND active = 1")) await notify(u.id, n);
}

export async function leadActivity(leadId: number, userId: number | null, type: string, content: string) {
  await run('INSERT INTO lead_activities (lead_id, user_id, type, content, created_at) VALUES (?,?,?,?,?)', leadId, userId, type, content, now());
  await run('UPDATE leads SET updated_at = ? WHERE id = ?', now(), leadId);
}

/** Distribuição de leads em rodízio (round-robin) entre corretores ativos. */
export async function nextAgentId(): Promise<number | null> {
  const row = await get<{ id: number }>(
    `SELECT u.id FROM users u
     LEFT JOIN (SELECT agent_id, MAX(created_at) AS last FROM leads GROUP BY agent_id) l ON l.agent_id = u.id
     WHERE u.role = 'corretor' AND u.active = 1
     ORDER BY COALESCE(l.last, 0) ASC, u.id ASC LIMIT 1`,
  );
  return row?.id ?? (await get<{ id: number }>("SELECT id FROM users WHERE role='admin' AND active=1 ORDER BY id LIMIT 1"))?.id ?? null;
}

/** Cria (ou reaproveita) um lead para um cliente interessado em um imóvel. */
export async function upsertLeadForClient(opts: {
  userId?: number | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  propertyId?: number | null;
  source: string;
  interest?: string;
  message?: string | null;
  activity: string;
  actorId?: number | null;
}) {
  const t = now();
  let lead = opts.userId
    ? await get<{ id: number; agent_id: number | null; stage: string }>(
        "SELECT id, agent_id, stage FROM leads WHERE user_id = ? AND stage NOT IN ('ganho','perdido') ORDER BY updated_at DESC LIMIT 1",
        opts.userId,
      )
    : undefined;
  const property = opts.propertyId ? await get<{ agent_id: number | null; purpose: string; title: string; price: number }>('SELECT agent_id, purpose, title, price FROM properties WHERE id = ?', opts.propertyId) : undefined;
  if (!lead) {
    const agentId = property?.agent_id ?? await nextAgentId();
    const interest = opts.interest ?? (property?.purpose === 'venda' ? 'compra' : 'aluguel');
    const r = await run(
      `INSERT INTO leads (name, email, phone, source, stage, temperature, interest, budget, message, property_id, agent_id, user_id, created_at, updated_at)
       VALUES (?,?,?,?, 'novo', 'morno', ?, ?, ?, ?, ?, ?, ?, ?)`,
      opts.name, opts.email ?? null, opts.phone ?? null, opts.source, interest, property?.price ?? null, opts.message ?? null,
      opts.propertyId ?? null, agentId, opts.userId ?? null, t, t,
    );
    lead = { id: r.id, agent_id: agentId, stage: 'novo' };
    await leadActivity(lead.id, null, 'sistema', `Lead criado via ${opts.source}`);
    await notify(agentId, { type: 'lead', title: 'Novo lead recebido', body: `${opts.name}${property ? ` — ${property.title}` : ''}`, link: `/crm/leads/${lead.id}` });
  } else if (opts.propertyId) {
    await run('UPDATE leads SET property_id = COALESCE(property_id, ?), updated_at = ? WHERE id = ?', opts.propertyId, t, lead.id);
  }
  await leadActivity(lead.id, opts.actorId ?? null, 'sistema', opts.activity);
  return lead;
}
