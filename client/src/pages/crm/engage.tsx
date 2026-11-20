import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlarmClock, Bell, Megaphone, Pencil, CheckCircle2, ChevronRight, Clock, Mail, MessageCircle, Phone, Plus, Send, SkipForward, Smartphone, Snowflake, Trash2, Undo2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi, useDebounced } from '../../lib/hooks';
import { dateTime, relative, SOURCE_LABEL, STAGE_LABEL, STAGES, whatsappLink } from '../../lib/format';
import { useAuth, useToast } from '../../context/app';
import { Avatar, Badge, Button, Card, Chip, cx, Empty, ErrorBox, Field, Input, Modal, PageHeader, PageLoader, Select, Stat, Tabs, Textarea, Toggle } from '../../components/ui';
import { TempBadge } from './leads';

/* ============================ Datas rápidas ============================ */
const at9 = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(9, 0, 0, 0); return +d; };
export function quickDates() {
  const t = Date.now();
  const six = new Date(); six.setHours(18, 0, 0, 0);
  return [
    { label: 'Em 1 hora', at: t + 3_600_000 },
    ...(+six - t > 2 * 3_600_000 ? [{ label: 'Hoje 18h', at: +six }] : []),
    { label: 'Amanhã 9h', at: at9(1) },
    { label: 'Em 3 dias', at: at9(3) },
    { label: 'Em 1 semana', at: at9(7) },
    { label: 'Em 1 mês', at: at9(30) },
  ];
}
const firstName = (n: string) => n.trim().split(/\s+/)[0];
const followupText = (lead: string, me: string) => `Olá, ${firstName(lead)}! Tudo bem? Aqui é ${firstName(me)} da Walisson Imóveis. Passando para saber se posso te ajudar com mais alguma informação sobre o imóvel. 😊`;

/* ============================ Cartão no detalhe do lead ============================ */
export function FollowupCard({ lead, onChange }: {
  lead: { id: number; name: string; phone: string | null; stage: string; next_followup_at?: number | null; followup_note?: string | null; opt_out?: number };
  onChange: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [custom, setCustom] = useState(false);
  const [when, setWhen] = useState('');
  const [note, setNote] = useState('');
  const closed = lead.stage === 'ganho' || lead.stage === 'perdido';
  const due = lead.next_followup_at ?? null;
  const late = due !== null && due < Date.now();

  const schedule = async (at: number | null) => {
    try {
      await api(`/crm/leads/${lead.id}/followup`, { method: 'PUT', body: { at, note: note.trim() || undefined } });
      toast(at ? `Follow-up marcado para ${dateTime(at)}.` : 'Follow-up concluído.');
      setCustom(false); setWhen(''); setNote('');
      onChange();
    } catch (e: any) { toast(e.message, 'error'); }
  };
  const viaWhatsapp = () => {
    api(`/crm/leads/${lead.id}/activities`, { body: { type: 'whatsapp', content: 'Follow-up enviado pelo WhatsApp' } }).then(onChange).catch(() => {});
  };

  return (
    <Card className={cx('p-5', late && !closed && 'border-danger/50')}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold"><AlarmClock className={cx('size-4', late ? 'text-danger' : 'text-accent')} />Follow-up</p>
        {due && <Badge tone={late ? 'danger' : 'accent'}>{late ? 'Atrasado' : relative(due)}</Badge>}
      </div>
      {closed ? (
        <p className="mt-2 text-sm text-muted">Negócio encerrado — sem follow-up.</p>
      ) : (
        <>
          {due ? (
            <div className="mt-3 rounded-2xl bg-surface-2 p-3">
              <p className={cx('text-sm font-semibold', late && 'text-danger')}>{dateTime(due)}</p>
              {lead.followup_note && <p className="mt-0.5 text-sm text-muted">{lead.followup_note}</p>}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a href={whatsappLink(lead.phone, followupText(lead.name, user!.name))} target="_blank" rel="noopener noreferrer" onClick={viaWhatsapp}
                  className={cx('inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-success text-[13px] font-semibold text-white', !lead.phone && 'pointer-events-none opacity-40')}>
                  <MessageCircle className="size-4" />WhatsApp
                </a>
                <Button size="sm" variant="secondary" icon={<CheckCircle2 className="size-4" />} onClick={() => schedule(null)}>Concluir</Button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">Nenhum próximo contato marcado. Escolha quando o app deve te lembrar:</p>
          )}
          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-faint">{due ? 'Remarcar para' : 'Lembrar em'}</p>
          <div className="flex flex-wrap gap-1.5">
            {quickDates().map((q) => (
              <button key={q.label} onClick={() => schedule(q.at)} className="h-8 rounded-full border border-line bg-surface-2 px-3 text-xs font-medium text-muted hover:border-accent hover:text-text">{q.label}</button>
            ))}
            <button onClick={() => setCustom((v) => !v)} className={cx('h-8 rounded-full border px-3 text-xs font-medium', custom ? 'border-accent text-accent' : 'border-line bg-surface-2 text-muted')}>Outra data</button>
          </div>
          {custom && (
            <div className="mt-2 flex gap-2">
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Data do follow-up" className="h-10 min-w-0 flex-1 rounded-2xl border border-line bg-surface-2 px-3 text-xs" />
              <Button size="sm" className="h-10" disabled={!when} onClick={() => schedule(+new Date(when))}>Salvar</Button>
            </div>
          )}
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Lembrete (opcional): ex. enviar fotos da área de lazer" className="mt-2 h-10 text-sm" />
        </>
      )}
      <div className="mt-4 border-t border-line pt-3">
        <Toggle checked={!lead.opt_out} onChange={async (v) => { await api(`/crm/leads/${lead.id}/opt-out`, { method: 'PUT', body: { opt_out: !v } }); onChange(); }}
          label={<span className="text-sm">Recebe disparos</span>} description={lead.opt_out ? 'O cliente pediu para não receber mensagens em massa.' : 'Desative se o cliente pedir para não receber.'} />
      </div>
    </Card>
  );
}

/* ============================ Página de follow-ups ============================ */
type FLead = { id: number; name: string; phone: string | null; email: string | null; stage: string; temperature: string; next_followup_at: number | null; followup_note: string | null; agent_name: string | null; property_title: string | null; last_contact: number | null };
type FData = { overdue: FLead[]; today: FLead[]; upcoming: FLead[]; cold: FLead[] };

export function Followups() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApi<FData>('/crm/followups');
  const [tab, setTab] = useState<keyof FData | null>(null);
  const [snooze, setSnooze] = useState<FLead | null>(null);
  const current = tab ?? (data ? (data.overdue.length ? 'overdue' : data.today.length ? 'today' : data.cold.length ? 'cold' : 'upcoming') : 'today');
  if (loading && !data) return <PageLoader />;
  if (error || !data) return <ErrorBox message={error ?? 'Erro'} onRetry={reload} />;

  const contacted = (l: FLead, type: 'whatsapp' | 'ligacao') => {
    api(`/crm/leads/${l.id}/activities`, { body: { type, content: type === 'whatsapp' ? 'Follow-up enviado pelo WhatsApp' : 'Ligação de follow-up' } })
      .then(() => { toast(`Contato com ${firstName(l.name)} registrado. Marque o próximo follow-up.`, 'info'); setSnooze(l); reload(true); })
      .catch((e) => toast(e.message, 'error'));
  };
  const list = data[current];
  const tabs: { value: keyof FData; label: string }[] = [
    { value: 'overdue', label: `Atrasados (${data.overdue.length})` },
    { value: 'today', label: `Hoje (${data.today.length})` },
    { value: 'upcoming', label: `Próximos (${data.upcoming.length})` },
    { value: 'cold', label: `Sem contato (${data.cold.length})` },
  ];
  const empty: Record<keyof FData, string> = {
    overdue: 'Nenhum follow-up atrasado. 👏',
    today: 'Nada marcado para hoje.',
    upcoming: 'Nenhum follow-up agendado para os próximos dias.',
    cold: 'Todos os leads ativos foram contatados nos últimos 7 dias.',
  };

  return (
    <div>
      <PageHeader title="Follow-ups" subtitle="Quem você precisa contatar — o app te avisa no celular na hora marcada." actions={<Link to="/crm/disparos"><Button size="sm" variant="outline" icon={<Send className="size-4" />}>Disparos</Button></Link>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Atrasados" value={data.overdue.length} tone="danger" icon={<AlarmClock className="size-4" />} />
        <Stat label="Para hoje" value={data.today.length} tone="accent" icon={<Clock className="size-4" />} />
        <Stat label="Agendados" value={data.upcoming.length} tone="info" icon={<Bell className="size-4" />} />
        <Stat label="Esfriando (7+ dias)" value={data.cold.length} tone="warning" icon={<Snowflake className="size-4" />} />
      </div>
      <Tabs value={current} onChange={setTab} items={tabs} className="mb-4" />
      {!list.length ? (
        <Empty icon={<CheckCircle2 />} title={empty[current]} text={current === 'cold' ? undefined : 'Marque follow-ups na página de cada lead.'} />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-line">
            {list.map((l) => {
              const late = l.next_followup_at !== null && l.next_followup_at < Date.now();
              return (
                <div key={l.id} className="p-3.5 sm:flex sm:items-center sm:gap-4">
                  <Link to={`/crm/leads/${l.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={l.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><span className="truncate font-semibold">{l.name}</span><TempBadge t={l.temperature} /></div>
                      <p className="truncate text-xs text-muted">
                        {l.next_followup_at ? <span className={cx(late && 'font-semibold text-danger')}>{dateTime(l.next_followup_at)}</span> : <span>{l.last_contact ? `Último contato ${relative(l.last_contact)}` : 'Nunca contatado'}</span>}
                        {l.followup_note ? ` · ${l.followup_note}` : ''}
                      </p>
                      <p className="truncate text-[11px] text-faint">{STAGE_LABEL[l.stage]}{l.property_title ? ` · ${l.property_title}` : ''}{user!.role === 'admin' && l.agent_name ? ` · ${l.agent_name}` : ''}</p>
                    </div>
                  </Link>
                  <div className="mt-3 flex gap-2 sm:mt-0 sm:shrink-0">
                    <a href={whatsappLink(l.phone, followupText(l.name, user!.name))} target="_blank" rel="noopener noreferrer" onClick={() => contacted(l, 'whatsapp')} aria-label={`WhatsApp para ${l.name}`}
                      className={cx('inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-success px-3 text-[13px] font-semibold text-white sm:flex-none', !l.phone && 'pointer-events-none opacity-40')}>
                      <MessageCircle className="size-4" />WhatsApp
                    </a>
                    <a href={l.phone ? `tel:${l.phone.replace(/\D/g, '')}` : undefined} onClick={() => l.phone && contacted(l, 'ligacao')} aria-label={`Ligar para ${l.name}`}
                      className={cx('grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-info', !l.phone && 'pointer-events-none opacity-40')}><Phone className="size-4" /></a>
                    <Button size="sm" variant="secondary" icon={<AlarmClock className="size-4" />} onClick={() => setSnooze(l)}>{l.next_followup_at ? 'Adiar' : 'Agendar'}</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      <SnoozeModal lead={snooze} onClose={() => setSnooze(null)} onDone={() => { setSnooze(null); reload(true); }} />
    </div>
  );
}

function SnoozeModal({ lead, onClose, onDone }: { lead: FLead | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [when, setWhen] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => { if (lead) { setWhen(''); setNote(lead.followup_note ?? ''); } }, [lead]);
  const save = async (at: number | null) => {
    if (!lead) return;
    try { await api(`/crm/leads/${lead.id}/followup`, { method: 'PUT', body: { at, note: note.trim() || undefined } }); toast(at ? `Próximo follow-up: ${dateTime(at)}` : 'Follow-up concluído.'); onDone(); } catch (e: any) { toast(e.message, 'error'); }
  };
  return (
    <Modal open={!!lead} onClose={onClose} title={lead ? `Próximo contato com ${firstName(lead.name)}` : ''}>
      <div className="grid grid-cols-2 gap-2">
        {quickDates().map((q) => <Button key={q.label} variant="secondary" size="sm" onClick={() => save(q.at)}>{q.label}</Button>)}
      </div>
      <div className="mt-3 flex gap-2">
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Outra data" className="h-10 min-w-0 flex-1 rounded-2xl border border-line bg-surface-2 px-3 text-sm" />
        <Button size="sm" className="h-10" disabled={!when} onClick={() => save(+new Date(when))}>Salvar</Button>
      </div>
      <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Lembrete (opcional)" className="mt-3 h-10 text-sm" />
      {lead?.next_followup_at && <Button variant="ghost" className="mt-3 w-full" icon={<CheckCircle2 className="size-4" />} onClick={() => save(null)}>Concluir sem remarcar</Button>}
    </Modal>
  );
}

/* ============================ Disparos ============================ */
type CampaignRow = { id: number; title: string; channels: string[]; audience: string; created_at: number; created_by_name: string | null; total: number; wa_sent: number; wa_pending: number; app_sent: number; email_sent: number };
const CHANNEL = {
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
  app: { label: 'Notificação no app', icon: Smartphone },
  email: { label: 'E-mail', icon: Mail },
} as const;

export function Campaigns() {
  const { data, loading, error, reload } = useApi<CampaignRow[]>('/crm/campaigns');
  const [broadcast, setBroadcast] = useState(false);
  if (loading && !data) return <PageLoader />;
  if (error || !data) return <ErrorBox message={error ?? 'Erro'} onRetry={reload} />;
  return (
    <div>
      <PageHeader title="Disparos" subtitle="Mande uma mensagem para vários leads de uma vez." actions={<Link to="/crm/disparos/novo"><Button size="sm" icon={<Plus className="size-4" />}>Novo disparo</Button></Link>} />
      <button type="button" onClick={() => setBroadcast(true)} className="mb-4 flex w-full items-center gap-3 rounded-3xl border border-accent/40 bg-accent-soft p-4 text-left transition active:scale-[.99]">
        <Megaphone className="size-5 shrink-0 text-accent" />
        <span className="min-w-0 flex-1"><span className="block font-semibold">Enviar para todos</span><span className="block text-[13px] text-muted">Notificação no celular de todo mundo que tem o app.</span></span>
        <ChevronRight className="size-5 shrink-0 text-faint" />
      </button>
      <BroadcastModal open={broadcast} onClose={() => setBroadcast(false)} />
      {!data.length ? (
        <Empty icon={<Send />} title="Nenhum disparo ainda" text="Avise seus leads sobre um imóvel novo, reative clientes frios ou mande uma novidade para todos." action={<Link to="/crm/disparos/novo"><Button icon={<Plus className="size-4" />}>Criar disparo</Button></Link>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-line">
            {data.map((c) => (
              <Link key={c.id} to={`/crm/disparos/${c.id}`} className="flex items-center gap-3 p-4 hover:bg-surface-2">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent"><Send className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.title}</p>
                  <p className="truncate text-xs text-muted">{c.total} contatos · {relative(c.created_at)}{c.created_by_name ? ` · ${c.created_by_name}` : ''}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {c.channels.includes('whatsapp') && <Badge tone={c.wa_pending ? 'warning' : 'success'}><MessageCircle className="size-3" />{c.wa_sent}/{c.wa_sent + c.wa_pending}</Badge>}
                    {c.channels.includes('app') && <Badge tone="info"><Smartphone className="size-3" />{c.app_sent}</Badge>}
                    {c.channels.includes('email') && <Badge tone="accent"><Mail className="size-3" />{c.email_sent}</Badge>}
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-faint" />
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

type Preview = { total: number; over_limit: boolean; phone: number; app: number; email: number; devices: number; sample: string[]; email_enabled: boolean };
export type Template = { id?: number; title: string; body: string; shared?: number; owner_id?: number; owner_name?: string | null };
export const BUILTIN_TEMPLATES: Template[] = [
  { title: 'Primeiro contato', body: 'Olá, {nome}! Aqui é {corretor}, da Walisson Imóveis. Vi seu interesse no imóvel {imovel} e estou à disposição para te ajudar. Posso te mandar mais fotos e informações?' },
  { title: 'Follow-up', body: 'Oi, {nome}! Tudo bem? Passando para saber se você conseguiu pensar sobre o imóvel {imovel}. Ficou alguma dúvida? Estou à disposição. — {corretor}' },
  { title: 'Convite para visita', body: '{nome}, que tal conhecer o imóvel {imovel} pessoalmente? Tenho horários disponíveis esta semana. Qual dia fica melhor para você?' },
  { title: 'Imóvel novo', body: 'Olá, {nome}! Aqui é {corretor} da Walisson Imóveis. Acabou de entrar um imóvel que tem tudo a ver com o que você procura: {imovel}. Quer que eu te mande mais fotos ou marque uma visita?' },
  { title: 'Reativar lead', body: 'Oi, {nome}! Tudo bem? Aqui é {corretor} da Walisson Imóveis. Você ainda está procurando imóvel? Separei algumas opções novas e posso te mandar agora mesmo.' },
  { title: 'Baixou o preço', body: 'Olá, {nome}! Boa notícia: o imóvel {imovel} teve redução de preço. Se ainda tiver interesse, me chama que eu te passo os detalhes. — {corretor}, Walisson Imóveis' },
  { title: 'Pedido de documentos', body: 'Olá, {nome}! Para darmos andamento, preciso dos seguintes documentos: RG, CPF, comprovante de renda e comprovante de residência. Pode me enviar por aqui mesmo? — {corretor}' },
  { title: 'Parabéns pela compra', body: '{nome}, parabéns pela conquista! 🎉 Foi um prazer te atender. Se precisar de qualquer coisa, conte comigo. — {corretor}, Walisson Imóveis' },
];
export const VARIABLES = [
  { key: '{nome}', label: 'Primeiro nome do cliente' },
  { key: '{nome_completo}', label: 'Nome completo' },
  { key: '{corretor}', label: 'Seu primeiro nome' },
  { key: '{imovel}', label: 'Título do imóvel' },
  { key: '{link}', label: 'Link do imóvel' },
];
/** Troca as variáveis pelos dados do cliente e limpa espaços que sobram (ex.: lead sem imóvel). */
export function renderMessage(tpl: string, v: { name: string; agent: string; property?: string | null; link?: string }) {
  return tpl
    .replaceAll('{nome_completo}', v.name.trim())
    .replaceAll('{nome}', firstName(v.name))
    .replaceAll('{corretor}', firstName(v.agent))
    .replaceAll('{imovel}', v.property ?? '')
    .replaceAll('{link}', v.link ?? location.origin)
    .replace(/[ \t]+([.,?!:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ');
}
export function useTemplates() {
  const r = useApi<{ items: Template[]; email_enabled: boolean }>('/crm/templates');
  return { ...r, all: [...(r.data?.items ?? []), ...BUILTIN_TEMPLATES], emailEnabled: !!r.data?.email_enabled };
}
function TemplateChips({ items, onPick }: { items: Template[]; onPick: (t: Template) => void }) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {items.map((t, i) => (
        <Chip key={`${t.id ?? 'b'}-${i}`} className="h-9" onClick={() => onPick(t)}>{t.id ? '★ ' : ''}{t.title}</Chip>
      ))}
    </div>
  );
}
function VariableButtons({ onInsert }: { onInsert: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
      Inserir:
      {VARIABLES.map((v) => <button key={v.key} type="button" title={v.label} onClick={() => onInsert(v.key)} className="rounded-full bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-text hover:bg-surface-3">{v.key}</button>)}
    </div>
  );
}
const appendVar = (m: string, v: string) => (m && !/\s$/.test(m) ? `${m} ${v}` : m + v);
function Bubble({ children }: { children: React.ReactNode }) {
  return <div className="max-w-sm whitespace-pre-wrap break-words rounded-2xl rounded-tl-md bg-[#dcf8c6] px-3.5 py-2.5 text-sm text-[#1c1814]">{children}</div>;
}
function SaveTemplateModal({ open, body, onClose, onSaved }: { open: boolean; body: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  useEffect(() => { if (open) setTitle(''); }, [open]);
  const save = async () => {
    try { await api('/crm/templates', { body: { title, body } }); toast('Modelo salvo em Mensagens prontas.'); onSaved(); } catch (e: any) { toast(e.message, 'error'); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Salvar como mensagem pronta">
      <Field label="Nome do modelo"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Ex.: Convite para o plantão de sábado" autoFocus /></Field>
      <Button className="mt-4 w-full" disabled={!title.trim()} onClick={save}>Salvar</Button>
    </Modal>
  );
}

/* ============================ Mensagem personalizada para um lead ============================ */
export function MessageComposer({ open, onClose, lead, onSent }: {
  open: boolean; onClose: () => void; onSent: () => void;
  lead: { id: number; name: string; phone: string | null; email: string | null; user_id: number | null; property: { id: number; title: string } | null };
}) {
  const { user } = useAuth();
  const toast = useToast();
  const tpl = useTemplates();
  const [text, setText] = useState('');
  const [subject, setSubject] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setText(''); setSubject(''); } }, [open]);
  const link = lead.property ? `${location.origin}/imovel/${lead.property.id}` : location.origin;
  const vars = { name: lead.name, agent: user!.name, property: lead.property?.title ?? null, link };
  const final = renderMessage(text, vars).trim();
  const usesProperty = /\{imovel\}|\{link\}/.test(text) && !lead.property;

  const send = async (channel: 'whatsapp' | 'app' | 'email') => {
    setBusy(channel);
    try {
      const r = await api<{ followupDone?: boolean }>(`/crm/leads/${lead.id}/message`, { body: { channel, text: final, ...(channel === 'email' && subject.trim() ? { subject: subject.trim() } : {}) } });
      toast(channel === 'whatsapp' ? 'Registrado no histórico.' : channel === 'app' ? 'Mensagem enviada no chat do app.' : 'E-mail enviado.');
      if (r.followupDone) toast('Follow-up concluído. Marque o próximo contato.', 'info');
      onSent();
    } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(null); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Mensagem para ${firstName(lead.name)}`} wide>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Mensagens prontas</p>
      <TemplateChips items={tpl.all} onPick={(t) => setText(t.body)} />
      <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} className="mt-3 min-h-32" placeholder="Escolha uma mensagem pronta acima ou escreva do seu jeito..." />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <VariableButtons onInsert={(v) => setText((m) => appendVar(m, v))} />
        {text.trim() && <button type="button" onClick={() => setSaving(true)} className="text-xs font-semibold text-accent">Salvar como modelo</button>}
      </div>
      {usesProperty && <p className="mt-2 text-xs text-warning">Este lead não tem imóvel de interesse — {'{imovel}'} e {'{link}'} ficam sem o imóvel.</p>}
      {final && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-faint">Como {firstName(lead.name)} vai ver</p>
          <Bubble>{final}</Bubble>
        </div>
      )}
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <a href={final && lead.phone ? whatsappLink(lead.phone, final) : undefined} target="_blank" rel="noopener noreferrer"
          onClick={() => final && lead.phone && send('whatsapp')}
          className={cx('inline-flex h-11 items-center justify-center gap-2 rounded-full bg-success text-sm font-semibold text-white', (!final || !lead.phone) && 'pointer-events-none opacity-40')}>
          <MessageCircle className="size-4" />WhatsApp
        </a>
        <Button variant="secondary" loading={busy === 'app'} disabled={!final || !lead.user_id} onClick={() => send('app')} icon={<Smartphone className="size-4" />}>Chat do app</Button>
        <Button variant="secondary" loading={busy === 'email'} disabled={!final || !lead.email || !tpl.emailEnabled} onClick={() => send('email')} icon={<Mail className="size-4" />}>E-mail</Button>
      </div>
      <p className="mt-2 text-[11px] text-faint">
        {!lead.phone && 'Sem telefone para WhatsApp. '}
        {!lead.user_id && 'Chat do app: só para quem tem conta no app. '}
        {!lead.email ? 'Sem e-mail cadastrado.' : !tpl.emailEnabled ? 'E-mail: falta ativar no servidor (chave do Brevo).' : ''}
      </p>
      {lead.email && tpl.emailEnabled && <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={100} placeholder="Assunto do e-mail (opcional)" className="mt-2 h-10 text-sm" />}
      <SaveTemplateModal open={saving} body={text} onClose={() => setSaving(false)} onSaved={() => { setSaving(false); tpl.reload(true); }} />
    </Modal>
  );
}

/* ============================ Enviar para todos (notificação no celular) ============================ */
type Audience = 'todos' | 'clientes' | 'equipe' | 'leads';
const AUDIENCE_HELP: Record<Audience, string> = {
  todos: 'Clientes do app e toda a equipe.',
  clientes: 'Todos os clientes com conta no app.',
  equipe: 'Corretores e administradores.',
  leads: 'Seus leads que têm conta no app.',
};
export function BroadcastModal({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Template | null }) {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const admin = user!.role === 'admin';
  const tpl = useTemplates();
  const [audience, setAudience] = useState<Audience>(admin ? 'todos' : 'leads');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sending, setSending] = useState(false);
  const [savingTpl, setSavingTpl] = useState(false);
  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? ''); setMessage(initial?.body ?? ''); setEmail(false);
  }, [open, initial]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setPreview(null);
    api<Preview>('/crm/campaigns/preview', { body: { audience, filters: { stages: [], temperatures: [] } } }).then((p) => alive && setPreview(p)).catch(() => alive && setPreview(null));
    return () => { alive = false; };
  }, [open, audience]);
  const reach = audience === 'leads' ? preview?.app ?? 0 : preview?.total ?? 0;
  const sampleName = preview?.sample[0] ?? 'Maria Silva';
  const rendered = renderMessage(message, { name: sampleName, agent: user!.name, link: location.origin });

  const send = async () => {
    setSending(true);
    try {
      const r = await api<{ id: number }>('/crm/campaigns', {
        body: { audience, filters: { stages: [], temperatures: [] }, title: title.trim(), message, channels: email ? ['app', 'email'] : ['app'] },
      });
      toast(`Enviado para ${reach} pessoa${reach === 1 ? '' : 's'}! ${preview?.devices ? `${preview.devices} celular${preview.devices === 1 ? '' : 'es'} recebe${preview.devices === 1 ? '' : 'm'} o push agora.` : ''}`);
      onClose();
      nav(`/crm/disparos/${r.id}`);
    } catch (e: any) { toast(e.message, 'error'); } finally { setSending(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Enviar para todos" wide>
      {admin ? (
        <Tabs value={audience} onChange={setAudience} className="w-fit" items={[{ value: 'todos', label: 'Todos' }, { value: 'clientes', label: 'Clientes' }, { value: 'equipe', label: 'Equipe' }, { value: 'leads', label: 'Leads' }]} />
      ) : null}
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3 text-sm">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Smartphone className="size-5" /></span>
        {!preview ? <span className="text-muted">Contando…</span> : (
          <span className="min-w-0">
            <b className="tabular-nums">{reach}</b> pessoa{reach === 1 ? '' : 's'} · <b className="tabular-nums">{preview.devices}</b> celular{preview.devices === 1 ? '' : 'es'} com o app recebe{preview.devices === 1 ? '' : 'm'} a notificação na hora
            <span className="block text-xs text-muted">{AUDIENCE_HELP[audience]} Todos também veem no sininho do app.</span>
          </span>
        )}
      </div>

      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-faint">Use uma mensagem pronta ou escreva uma nova</p>
      <TemplateChips items={tpl.all} onPick={(t) => { setTitle(t.title); setMessage(t.body); }} />
      <div className="mt-3 space-y-3">
        <Field label="Título da notificação"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Ex.: Plantão de vendas neste sábado" /></Field>
        <Field label="Mensagem"><Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1500} className="min-h-28" placeholder="Olá, {nome}! ..." /></Field>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <VariableButtons onInsert={(v) => setMessage((m) => appendVar(m, v))} />
          {message.trim() && <button type="button" onClick={() => setSavingTpl(true)} className="text-xs font-semibold text-accent">Salvar como modelo</button>}
        </div>
      </div>

      {title.trim() && message.trim() && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-faint">Como chega no celular</p>
          <div className="rounded-2xl border border-line bg-surface-2 p-3 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] text-faint"><span className="grid size-5 place-items-center rounded-md bg-primary text-[9px] font-bold text-primary-ink">W</span>Walisson Imóveis · agora</div>
            <p className="mt-1.5 text-sm font-semibold">{title}</p>
            <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted">{rendered}</p>
          </div>
        </div>
      )}

      {preview?.email_enabled && (
        <div className="mt-4"><Toggle checked={email} onChange={setEmail} label={<span className="text-sm">Enviar também por e-mail</span>} description="Clientes só recebem se autorizaram novidades por e-mail." /></div>
      )}
      <Button size="lg" className="mt-5 w-full" icon={<Send className="size-4" />} loading={sending}
        disabled={!title.trim() || !message.trim() || !reach || !!preview?.over_limit}
        onClick={() => { if (confirm(`Enviar "${title.trim()}" para ${reach} pessoa${reach === 1 ? '' : 's'}?`)) send(); }}>
        {reach ? `Enviar para ${reach} pessoa${reach === 1 ? '' : 's'}` : 'Ninguém para receber ainda'}
      </Button>
      <SaveTemplateModal open={savingTpl} body={message} onClose={() => setSavingTpl(false)} onSaved={() => { setSavingTpl(false); tpl.reload(true); }} />
    </Modal>
  );
}

/* ============================ Página: mensagens prontas ============================ */
export function MessageTemplates() {
  const { user } = useAuth();
  const toast = useToast();
  const tpl = useTemplates();
  const [editing, setEditing] = useState<Template | null>(null);
  const [broadcast, setBroadcast] = useState<Template | null | undefined>(undefined);
  if (tpl.loading && !tpl.data) return <PageLoader />;
  if (tpl.error) return <ErrorBox message={tpl.error} onRetry={tpl.reload} />;
  const mine = tpl.data?.items ?? [];
  const canEdit = (t: Template) => t.owner_id === user!.id || (user!.role === 'admin' && !!t.shared);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Mensagens prontas" subtitle="Modelos para WhatsApp, chat e disparos — o nome do cliente e o imóvel entram sozinhos."
        actions={<Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={() => setEditing({ title: '', body: '' })}>Nova</Button>} />
      <button type="button" onClick={() => setBroadcast(null)} className="mb-4 flex w-full items-center gap-3 rounded-3xl bg-primary p-4 text-left text-primary-ink transition active:scale-[.99]">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-black/10"><Megaphone className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Enviar para todos</span>
          <span className="block text-[13px] opacity-80">{user!.role === 'admin' ? 'Escreva ou escolha uma mensagem e ela chega como notificação no celular de todos.' : 'Mande uma notificação para todos os seus leads que têm o app.'}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 opacity-70" />
      </button>
      <Card className="mb-4 p-4 text-sm text-muted">
        <p className="mb-2 font-semibold text-text">Variáveis que você pode usar</p>
        <ul className="grid gap-1 sm:grid-cols-2">{VARIABLES.map((v) => <li key={v.key}><code className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px] text-text">{v.key}</code> {v.label}</li>)}</ul>
      </Card>
      <h3 className="mb-2 px-1 text-sm font-semibold">Suas mensagens{user!.role === 'admin' ? ' e as da equipe' : ' e as da equipe'}</h3>
      {!mine.length ? (
        <Card className="mb-6 p-6 text-center text-sm text-muted">Você ainda não criou nenhuma. Toque em <b>Nova</b> ou use um modelo abaixo como ponto de partida.</Card>
      ) : (
        <div className="mb-6 space-y-2">
          {mine.map((t) => (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{t.title} {!!t.shared && <Badge tone="info" className="ml-1">Equipe</Badge>}</p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted">{t.body}</p>
                  {t.owner_id !== user!.id && t.owner_name && <p className="mt-1 text-[11px] text-faint">por {t.owner_name}</p>}
                </div>
                {!canEdit(t) && <Button size="sm" variant="ghost" aria-label="Enviar para todos" icon={<Megaphone className="size-4" />} onClick={() => setBroadcast(t)} />}
                {canEdit(t) && (
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(t)}>Editar</Button>
                    <Button size="sm" variant="ghost" aria-label="Enviar para todos" icon={<Megaphone className="size-4" />} onClick={() => setBroadcast(t)} />
                    <Button size="sm" variant="ghost" aria-label="Excluir" icon={<Trash2 className="size-4" />} onClick={async () => { if (confirm(`Excluir "${t.title}"?`)) { await api(`/crm/templates/${t.id}`, { method: 'DELETE' }); toast('Modelo excluído.', 'info'); tpl.reload(true); } }} />
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <h3 className="mb-2 px-1 text-sm font-semibold">Modelos do app</h3>
      <div className="space-y-2">
        {BUILTIN_TEMPLATES.map((t) => (
          <Card key={t.title} className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0"><p className="font-semibold">{t.title}</p><p className="mt-1 line-clamp-2 text-sm text-muted">{t.body}</p></div>
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEditing({ title: t.title, body: t.body })}>Personalizar</Button>
              <Button size="sm" variant="ghost" aria-label="Enviar para todos" icon={<Megaphone className="size-4" />} onClick={() => setBroadcast(t)} />
            </div>
          </Card>
        ))}
      </div>
      <TemplateEditor tpl={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); tpl.reload(true); }} />
      <BroadcastModal open={broadcast !== undefined} initial={broadcast} onClose={() => setBroadcast(undefined)} />
    </div>
  );
}

function TemplateEditor({ tpl, onClose, onSaved }: { tpl: Template | null; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ title: '', body: '', shared: false });
  useEffect(() => { if (tpl) setF({ title: tpl.title, body: tpl.body, shared: !!tpl.shared }); }, [tpl]);
  const save = async () => {
    try {
      if (tpl?.id) await api(`/crm/templates/${tpl.id}`, { method: 'PUT', body: f });
      else await api('/crm/templates', { body: f });
      toast('Mensagem pronta salva.'); onSaved();
    } catch (e: any) { toast(e.message, 'error'); }
  };
  return (
    <Modal open={!!tpl} onClose={onClose} title={tpl?.id ? 'Editar mensagem pronta' : 'Nova mensagem pronta'} wide>
      <div className="space-y-3">
        <Field label="Nome"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={60} placeholder="Ex.: Plantão de sábado" /></Field>
        <Field label="Mensagem"><Textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={1500} className="min-h-36" /></Field>
        <VariableButtons onInsert={(v) => setF((x) => ({ ...x, body: appendVar(x.body, v) }))} />
        {f.body.trim() && <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-faint">Exemplo</p><Bubble>{renderMessage(f.body, { name: 'Maria Silva', agent: user!.name, property: 'Apartamento 3 quartos no Centro', link: `${location.origin}/imovel/1` })}</Bubble></div>}
        {user!.role === 'admin' && <Toggle checked={f.shared} onChange={(v) => setF({ ...f, shared: v })} label="Disponível para toda a equipe" description="Os corretores podem usar, mas só o administrador altera." />}
        <Button className="w-full" disabled={!f.title.trim() || !f.body.trim()} onClick={save}>Salvar</Button>
      </div>
    </Modal>
  );
}

export function CampaignNew() {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const admin = user!.role === 'admin';
  const [audience, setAudience] = useState<Audience>('leads');
  const [stages, setStages] = useState<string[]>(['novo', 'contato', 'visita', 'proposta', 'negociacao']);
  const [temps, setTemps] = useState<string[]>([]);
  const [source, setSource] = useState('');
  const [interest, setInterest] = useState('');
  const [agent, setAgent] = useState('');
  const [channels, setChannels] = useState<string[]>(['whatsapp', 'app']);
  const [propertyId, setPropertyId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const agents = useApi<{ id: number; name: string }[]>(admin ? '/crm/agents' : null);
  const tpl = useTemplates();
  const [savingTpl, setSavingTpl] = useState(false);
  const props = useApi<{ id: number; code: string; title: string; status: string }[]>('/properties/manage/list');

  const audienceBody = useMemo(() => ({
    audience,
    filters: { stages, temperatures: temps, ...(source ? { source } : {}), ...(interest ? { interest } : {}), ...(agent ? { agent: Number(agent) } : {}) },
  }), [audience, stages, temps, source, interest, agent]);
  const key = useDebounced(JSON.stringify(audienceBody), 300);
  useEffect(() => {
    let alive = true;
    api<Preview>('/crm/campaigns/preview', { body: JSON.parse(key) }).then((p) => alive && setPreview(p)).catch(() => alive && setPreview(null));
    return () => { alive = false; };
  }, [key]);

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const prop = props.data?.find((p) => String(p.id) === propertyId);
  const sampleName = preview?.sample[0] ?? 'Maria Silva';
  const sample = firstName(sampleName);
  const rendered = renderMessage(message, { name: sampleName, agent: user!.name, property: prop?.title ?? '[imóvel]', link: prop ? `${location.origin}/imovel/${prop.id}` : location.origin })
    + (prop && !message.includes('{link}') ? `\n\n${location.origin}/imovel/${prop.id}` : '');
  const insert = (v: string) => setMessage((m) => appendVar(m, v));
  const reach = preview ? Math.max(channels.includes('whatsapp') ? preview.phone : 0, channels.includes('app') ? preview.app : 0, channels.includes('email') ? preview.email : 0) : 0;

  const send = async () => {
    setSending(true);
    try {
      const r = await api<{ id: number }>('/crm/campaigns', { body: { ...audienceBody, title, message, channels, property_id: propertyId ? Number(propertyId) : null } });
      toast('Disparo criado!');
      nav(`/crm/disparos/${r.id}`, { replace: true });
    } catch (e: any) { toast(e.message, 'error'); setConfirming(false); } finally { setSending(false); }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back="/crm/disparos" title="Novo disparo" subtitle="Escolha quem recebe, por onde e o que dizer." />
      <div className="space-y-4">
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">1. Quem vai receber</h3>
          {admin && (
            <Tabs value={audience} onChange={setAudience} className="mb-4 w-fit" items={[{ value: 'leads', label: 'Leads do CRM' }, { value: 'clientes', label: 'Clientes do app' }, { value: 'equipe', label: 'Equipe' }, { value: 'todos', label: 'Todos' }]} />
          )}
          {audience === 'leads' ? (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Etapa do funil</p>
                <div className="flex flex-wrap gap-1.5">{STAGES.map((s) => <Chip key={s} active={stages.includes(s)} onClick={() => toggle(stages, setStages, s)} className="h-9">{STAGE_LABEL[s]}</Chip>)}</div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Temperatura <span className="font-normal normal-case tracking-normal">(nenhuma = todas)</span></p>
                <div className="flex flex-wrap gap-1.5">{[['quente', '🔥 Quente'], ['morno', '☀️ Morno'], ['frio', '❄️ Frio']].map(([k, l]) => <Chip key={k} active={temps.includes(k)} onClick={() => toggle(temps, setTemps, k)} className="h-9">{l}</Chip>)}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Origem"><Select value={source} onChange={(e) => setSource(e.target.value)}><option value="">Todas</option>{Object.entries(SOURCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
                <Field label="Interesse"><Select value={interest} onChange={(e) => setInterest(e.target.value)}><option value="">Todos</option><option value="compra">Compra</option><option value="aluguel">Aluguel</option><option value="venda">Vender imóvel</option><option value="temporada">Temporada</option></Select></Field>
                {admin && <Field label="Corretor"><Select value={agent} onChange={(e) => setAgent(e.target.value)}><option value="">Todos</option>{agents.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>}
              </div>
            </div>
          ) : (
            <p className="rounded-2xl bg-surface-2 p-3 text-sm text-muted">{AUDIENCE_HELP[audience]} A notificação chega no celular de quem tem o app. Por e-mail, clientes só recebem se autorizaram novidades (LGPD).</p>
          )}
          <div className="mt-4 rounded-2xl border border-line bg-surface-2 p-3 text-sm">
            {!preview ? <span className="text-muted">Calculando…</span> : (
              <>
                <p><b className="text-lg tabular-nums">{preview.total}</b> contatos{preview.over_limit && <span className="text-danger"> (limite de 1000 — use mais filtros)</span>}</p>
                <p className="mt-0.5 text-xs text-muted">{preview.phone} com WhatsApp · {preview.app} com o app · {preview.email} com e-mail{preview.sample.length ? ` · ${preview.sample.slice(0, 3).join(', ')}${preview.total > 3 ? '…' : ''}` : ''}</p>
                {audience === 'leads' && <p className="mt-1 text-[11px] text-faint">Leads marcados como “não recebe disparos” ficam de fora automaticamente.</p>}
              </>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 font-semibold">2. Por onde enviar</h3>
          <div className="space-y-2">
            {(Object.keys(CHANNEL) as (keyof typeof CHANNEL)[]).map((k) => {
              const C = CHANNEL[k];
              const on = channels.includes(k);
              const off = k === 'email' && preview && !preview.email_enabled;
              return (
                <button key={k} type="button" onClick={() => toggle(channels, setChannels, k)} aria-pressed={on}
                  className={cx('flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition', on ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2')}>
                  <C.icon className={cx('size-5 shrink-0', on ? 'text-accent' : 'text-muted')} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{C.label}</span>
                    <span className="block text-xs text-muted">
                      {k === 'whatsapp' && 'Fila rápida: o app abre cada conversa com a mensagem pronta, você só toca em enviar. Gratuito e sem risco de bloqueio do número.'}
                      {k === 'app' && 'Chega na hora no celular de quem tem conta no app (push + sininho).'}
                      {k === 'email' && (off ? 'E-mail ainda não está ativado no servidor (falta a chave do Brevo).' : 'Enviado automaticamente para quem tem e-mail.')}
                    </span>
                  </span>
                  <span className={cx('grid size-5 shrink-0 place-items-center rounded-full border', on ? 'border-accent bg-accent text-white' : 'border-line-strong')}>{on && <CheckCircle2 className="size-4" />}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 font-semibold">3. Mensagem</h3>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Mensagens prontas <Link to="/crm/modelos" className="font-normal normal-case tracking-normal text-accent">· gerenciar</Link></p>
          <div className="mb-3"><TemplateChips items={tpl.all} onPick={(t) => { setTitle(t.title); setMessage(t.body); }} /></div>
          <div className="space-y-3">
            <Field label="Título (aparece na notificação e no assunto do e-mail)"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Ex.: Imóvel novo no Jardim América" /></Field>
            <Field label="Imóvel (opcional — o link vai junto)">
              <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">Nenhum</option>{props.data?.filter((p) => p.status !== 'pendente').map((p) => <option key={p.id} value={p.id}>{p.code} · {p.title}</option>)}</Select>
            </Field>
            <Field label="Texto">
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1500} className="min-h-32" placeholder="Olá, {nome}! ..." />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <VariableButtons onInsert={insert} />
              {message.trim() && <button type="button" onClick={() => setSavingTpl(true)} className="text-xs font-semibold text-accent">Salvar como modelo</button>}
            </div>
            {message.trim() && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-faint">Como {sample} vai ver</p>
                <Bubble>{rendered}</Bubble>
                <p className="mt-1.5 text-[11px] text-faint">Cada contato recebe com o próprio nome. Na fila do WhatsApp você ainda pode ajustar a mensagem de cada pessoa antes de enviar.</p>
              </div>
            )}
          </div>
        </Card>

        <Button size="lg" className="w-full" icon={<Send className="size-4" />}
          disabled={!title.trim() || !message.trim() || !channels.length || !preview?.total || preview.over_limit}
          onClick={() => setConfirming(true)}>
          {preview?.total ? `Disparar para ${preview.total} contato${preview.total > 1 ? 's' : ''}` : 'Disparar'}
        </Button>
      </div>

      <SaveTemplateModal open={savingTpl} body={message} onClose={() => setSavingTpl(false)} onSaved={() => { setSavingTpl(false); tpl.reload(true); }} />
      <Modal open={confirming} onClose={() => setConfirming(false)} title="Confirmar disparo">
        <p className="text-sm text-muted">
          “{title}” para <b className="text-text">{preview?.total}</b> contatos ({reach} alcançáveis pelos canais escolhidos).
          {channels.includes('app') && ' A notificação no app sai na hora.'}
          {channels.includes('email') && preview?.email_enabled && ' Os e-mails saem em seguida.'}
          {channels.includes('whatsapp') && ' Depois, é só seguir a fila do WhatsApp.'}
        </p>
        <Button className="mt-5 w-full" loading={sending} onClick={send} icon={<Send className="size-4" />}>Confirmar e enviar</Button>
      </Modal>
    </div>
  );
}

type Recipient = { id: number; lead_id: number | null; user_id: number | null; name: string; phone: string | null; email: string | null; text: string; wa_status: string; app_status: string; email_status: string };
type CampaignFull = { id: number; title: string; message: string; channels: string[]; audience: string; created_at: number; created_by_name: string | null; property_title: string | null; recipients: Recipient[] };
const WA_LABEL: Record<string, string> = { pendente: 'Na fila', enviado: 'Enviado', pulado: 'Pulado', sem_telefone: 'Sem telefone', nao: '—' };
const EMAIL_LABEL: Record<string, string> = { pendente: 'Enviando', enviado: 'Enviado', falhou: 'Falhou', sem_email: 'Sem e-mail', recusou: 'Desativou e-mails', desativado: 'E-mail desativado', duplicado: 'Repetido', nao: '—' };

export function CampaignDetail() {
  const { id } = useParams();
  const toast = useToast();
  const nav = useNavigate();
  const { data, setData, loading, error, reload } = useApi<CampaignFull>(`/crm/campaigns/${id}`, [id]);
  const [filter, setFilter] = useState<'todos' | 'fila' | 'enviados'>('todos');
  const [editText, setEditText] = useState<{ id: number; text: string } | null>(null);
  if (loading && !data) return <PageLoader />;
  if (error || !data) return <ErrorBox message={error ?? 'Disparo não encontrado'} onRetry={reload} />;

  const rs = data.recipients;
  const wa = data.channels.includes('whatsapp');
  const queue = rs.filter((r) => r.wa_status === 'pendente');
  const waTotal = rs.filter((r) => ['pendente', 'enviado', 'pulado'].includes(r.wa_status)).length;
  const waSent = rs.filter((r) => r.wa_status === 'enviado').length;
  const next = queue[0];
  const setStatus = (r: Recipient, wa_status: string) => {
    setData((d) => d && { ...d, recipients: d.recipients.map((x) => (x.id === r.id ? { ...x, wa_status } : x)) });
    api(`/crm/campaigns/${data.id}/recipients/${r.id}`, { method: 'PATCH', body: { wa_status } }).catch((e) => { toast(e.message, 'error'); reload(true); });
  };
  const saveText = (r: Recipient, text: string) => {
    const t = text.trim();
    setEditText(null);
    if (!t || t === r.text) return;
    setData((d) => d && { ...d, recipients: d.recipients.map((x) => (x.id === r.id ? { ...x, text: t } : x)) });
    api(`/crm/campaigns/${data.id}/recipients/${r.id}`, { method: 'PATCH', body: { text: t } }).catch((e) => { toast(e.message, 'error'); reload(true); });
  };
  const shown = rs.filter((r) => filter === 'todos' || (filter === 'fila' ? r.wa_status === 'pendente' : r.wa_status === 'enviado' || r.app_status === 'enviado' || r.email_status === 'enviado'));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back="/crm/disparos" title={data.title} subtitle={`${rs.length} contatos · ${dateTime(data.created_at)}${data.created_by_name ? ` · ${data.created_by_name}` : ''}`}
        actions={<Button variant="ghost" size="sm" aria-label="Excluir disparo" icon={<Trash2 className="size-4" />} onClick={async () => { if (confirm('Excluir este disparo do histórico?')) { await api(`/crm/campaigns/${data.id}`, { method: 'DELETE' }); toast('Disparo excluído.', 'info'); nav('/crm/disparos'); } }} />} />

      <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
        {wa && <Stat label="WhatsApp" value={`${waSent}/${waTotal}`} tone="success" icon={<MessageCircle className="size-4" />} />}
        {data.channels.includes('app') && <Stat label="No app" value={rs.filter((r) => r.app_status === 'enviado').length} tone="info" icon={<Smartphone className="size-4" />} />}
        {data.channels.includes('email') && <Stat label="E-mail" value={rs.filter((r) => r.email_status === 'enviado').length} tone="accent" icon={<Mail className="size-4" />} />}
      </div>

      {wa && (
        <Card className="mb-4 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-semibold"><MessageCircle className="size-4 text-success" />Fila do WhatsApp</h3>
            <span className="text-xs text-muted">{queue.length} na fila</span>
          </div>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-success transition-all" style={{ width: `${waTotal ? ((waTotal - queue.length) / waTotal) * 100 : 0}%` }} /></div>
          {next ? (
            <div>
              <div className="flex items-center gap-3">
                <Avatar name={next.name} size={44} />
                <div className="min-w-0"><p className="truncate font-semibold">{next.name}</p><p className="text-xs text-muted">{next.phone}</p></div>
              </div>
              {editText?.id === next.id ? (
                <div className="mt-3">
                  <Textarea value={editText.text} onChange={(e) => setEditText({ id: next.id, text: e.target.value })} maxLength={1500} className="min-h-32" autoFocus />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditText(null)}>Cancelar</Button>
                    <Button size="sm" onClick={() => saveText(next, editText.text)}>Salvar para {firstName(next.name)}</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <div className="max-h-48 overflow-y-auto"><Bubble>{next.text}</Bubble></div>
                  <button type="button" onClick={() => setEditText({ id: next.id, text: next.text })} className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-accent"><Pencil className="size-3" />Personalizar para {firstName(next.name)}</button>
                </div>
              )}
              <a href={whatsappLink(next.phone, editText?.id === next.id && editText.text.trim() ? editText.text.trim() : next.text)} target="_blank" rel="noopener noreferrer"
                onClick={() => { if (editText?.id === next.id) saveText(next, editText.text); setStatus(next, 'enviado'); }}
                className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-success text-[15px] font-semibold text-white active:scale-[.98]">
                <Send className="size-5" />Abrir no WhatsApp ({waTotal - queue.length + 1} de {waTotal})
              </a>
              <div className="mt-2 flex justify-center gap-2">
                <Button variant="ghost" size="sm" icon={<SkipForward className="size-4" />} onClick={() => setStatus(next, 'pulado')}>Pular</Button>
              </div>
              <p className="mt-2 text-center text-[11px] text-faint">Toque, envie no WhatsApp e volte para o app: o próximo contato já estará pronto.</p>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" />Fila concluída! {waSent} mensagens enviadas.</p>
          )}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
          <h3 className="px-1 font-semibold">Contatos</h3>
          <Tabs value={filter} onChange={setFilter} items={[{ value: 'todos', label: 'Todos' }, ...(wa ? [{ value: 'fila' as const, label: 'Na fila' }] : []), { value: 'enviados', label: 'Enviados' }]} />
        </div>
        <div className="divide-y divide-line">
          {shown.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                {r.lead_id ? <Link to={`/crm/leads/${r.lead_id}`} className="block truncate text-sm font-semibold hover:text-accent">{r.name}</Link> : <p className="truncate text-sm font-semibold">{r.name}</p>}
                <div className="mt-1 flex flex-wrap gap-1">
                  {wa && <Badge tone={r.wa_status === 'enviado' ? 'success' : r.wa_status === 'pendente' ? 'warning' : 'neutral'}><MessageCircle className="size-3" />{WA_LABEL[r.wa_status]}</Badge>}
                  {data.channels.includes('app') && <Badge tone={r.app_status === 'enviado' ? 'info' : 'neutral'}><Smartphone className="size-3" />{r.app_status === 'enviado' ? 'Enviado' : 'Sem app'}</Badge>}
                  {data.channels.includes('email') && <Badge tone={r.email_status === 'enviado' ? 'accent' : r.email_status === 'falhou' ? 'danger' : 'neutral'}><Mail className="size-3" />{EMAIL_LABEL[r.email_status] ?? r.email_status}</Badge>}
                </div>
              </div>
              {wa && r.phone && (r.wa_status === 'enviado' || r.wa_status === 'pulado' ? (
                <Button variant="ghost" size="sm" aria-label="Voltar para a fila" icon={<Undo2 className="size-4" />} onClick={() => setStatus(r, 'pendente')} />
              ) : (
                <a href={whatsappLink(r.phone, r.text)} target="_blank" rel="noopener noreferrer" onClick={() => setStatus(r, 'enviado')} aria-label={`WhatsApp para ${r.name}`}
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-success-soft text-success"><MessageCircle className="size-4" /></a>
              ))}
            </div>
          ))}
          {!shown.length && <p className="p-6 text-center text-sm text-muted">Nenhum contato aqui.</p>}
        </div>
      </Card>
    </div>
  );
}
