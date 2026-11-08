import { config } from '../config.ts';

/** Envio de e-mails transacionais pela API do Brevo. Sem BREVO_API_KEY, só registra no log. */
export const mailEnabled = () => !!(config.mail.brevoApiKey && config.mail.from);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Modelo de e-mail com a identidade visual do app. */
export function emailLayout(opts: { title: string; body?: string; button?: { label: string; url: string }; footer?: string }) {
  const btn = opts.button
    ? `<tr><td style="padding:8px 32px 28px"><a href="${esc(opts.button.url)}" style="display:inline-block;background:#2a2a1f;color:#f6f2ec;text-decoration:none;font-weight:600;font-size:15px;padding:14px 26px;border-radius:999px">${esc(opts.button.label)}</a></td></tr>`
    : '';
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#efebe5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1814">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efebe5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="background:#1a1612;padding:20px 32px;color:#f4eee6;font-size:16px;font-weight:600">Walisson <span style="color:#c9a77c">Imóveis</span></td></tr>
<tr><td style="padding:28px 32px 8px"><h1 style="margin:0 0 10px;font-size:21px;line-height:1.3">${esc(opts.title)}</h1>
${opts.body ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#4a433c">${esc(opts.body).replace(/\n/g, '<br>')}</p>` : ''}</td></tr>
${btn}
<tr><td style="padding:16px 32px 24px;border-top:1px solid #eee7dd;font-size:12px;color:#8a8076;line-height:1.5">${esc(opts.footer ?? 'Você recebeu este aviso porque tem uma conta na Walisson Imóveis. Para não receber e-mails, desative em Minha conta → Notificações.')}</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendMail(to: { email: string; name?: string }, subject: string, html: string, text: string) {
  if (!mailEnabled()) {
    console.log(`[e-mail desativado] para ${to.email}: ${subject}`);
    return false;
  }
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': config.mail.brevoApiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: config.mail.from, name: config.mail.fromName },
      to: [{ email: to.email, name: to.name }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });
  if (!r.ok) {
    console.error(`[e-mail] falha ${r.status} para ${to.email}: ${(await r.text()).slice(0, 300)}`);
    return false;
  }
  return true;
}
