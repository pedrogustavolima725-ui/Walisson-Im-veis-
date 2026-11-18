import { all, run, now } from '../db.ts';
import { notify } from './events.ts';

const HOUR = 3_600_000;

/** Lead novo: lembrete automático de primeiro contato em 1 hora (some quando o corretor registra o contato). */
export async function scheduleFirstContact(leadId: number) {
  await run(
    'UPDATE leads SET next_followup_at = ?, followup_note = ?, followup_notified_at = NULL WHERE id = ? AND next_followup_at IS NULL',
    now() + HOUR, 'Fazer o primeiro contato', leadId,
  );
}

/** Avisa o corretor (sino, push e e-mail) dos follow-ups que venceram e ainda não foram avisados. */
export async function sendDueFollowups() {
  const due = await all<{ id: number; name: string; agent_id: number; followup_note: string | null }>(
    `SELECT id, name, agent_id, followup_note FROM leads
     WHERE next_followup_at IS NOT NULL AND next_followup_at <= ? AND followup_notified_at IS NULL
       AND agent_id IS NOT NULL AND stage NOT IN ('ganho','perdido') LIMIT 200`,
    now(),
  );
  for (const l of due) {
    await run('UPDATE leads SET followup_notified_at = ? WHERE id = ?', now(), l.id);
    await notify(l.agent_id, {
      type: 'followup',
      title: `Hora do follow-up: ${l.name}`,
      body: l.followup_note || 'Entre em contato com o cliente.',
      link: `/crm/leads/${l.id}`,
    });
  }
  return due.length;
}

export function startFollowupReminders() {
  if (process.env.NODE_TEST) return;
  const tick = () => sendDueFollowups().catch((e) => console.error('[follow-up]', (e as Error).message));
  setTimeout(tick, 15_000).unref();
  setInterval(tick, 60_000).unref();
}
