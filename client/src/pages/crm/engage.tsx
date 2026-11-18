import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlarmClock, Bell, CheckCircle2, ChevronRight, Clock, Mail, MessageCircle, Phone, Plus, Send, SkipForward, Smartphone, Snowflake, Trash2, Undo2 } from 'lucide-react';
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
  if (loading && !data) return <PageLoader />;
  if (error || !data) return <ErrorBox message={error ?? 'Erro'} onRetry={reload} />;
  return (
    <div>
      <PageHeader title="Disparos" subtitle="Mande uma mensagem para vários leads de uma vez." actions={<Link to="/crm/disparos/novo"><Button size="sm" icon={<Plus className="size-4" />}>Novo disparo</Button></Link>} />
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

type Preview = { total: number; over_limit: boolean; phone: number; app: number; email: number; sample: string[]; email_enabled: boolean };
const TEMPLATES = [
  { label: 'Imóvel novo', title: 'Imóvel novo para você', text: 'Olá, {nome}! Aqui é {corretor} da Walisson Imóveis. Acabou de entrar um imóvel que tem tudo a ver com o que você procura: {imovel}. Quer que eu te mande mais fotos ou marque uma visita?' },
  { label: 'Reativar lead', title: 'Ainda procurando imóvel?', text: 'Oi, {nome}! Tudo bem? Aqui é {corretor} da Walisson Imóveis. Você ainda está procurando imóvel? Separei algumas opções novas e posso te mandar agora mesmo.' },
  { label: 'Baixou o preço', title: 'O preço baixou!', text: 'Olá, {nome}! Boa notícia: o imóvel {imovel} teve redução de preço. Se ainda tiver interesse, me chama que eu te passo os detalhes. — {corretor}, Walisson Imóveis' },
];

export function CampaignNew() {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const admin = user!.role === 'admin';
  const [audience, setAudience] = useState<'leads' | 'clientes'>('leads');
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
  const sample = (preview?.sample[0] ?? 'Maria Silva').split(' ')[0];
  const rendered = message
    .replaceAll('{nome}', sample).replaceAll('{corretor}', firstName(user!.name))
    .replaceAll('{imovel}', prop?.title ?? '[imóvel]').replaceAll('{link}', prop ? `${location.origin}/imovel/${prop.id}` : location.origin)
    + (prop && !message.includes('{link}') ? `\n\n${location.origin}/imovel/${prop.id}` : '');
  const insert = (v: string) => setMessage((m) => (m && !m.endsWith(' ') ? `${m} ${v}` : m + v));
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
            <Tabs value={audience} onChange={setAudience} className="mb-4 w-fit" items={[{ value: 'leads', label: 'Leads do CRM' }, { value: 'clientes', label: 'Clientes do app' }]} />
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
            <p className="rounded-2xl bg-surface-2 p-3 text-sm text-muted">Todos os clientes cadastrados no app que <b>autorizaram receber ofertas</b> (exigência da LGPD).</p>
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
          <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto">
            {TEMPLATES.map((t) => <Chip key={t.label} className="h-9" onClick={() => { setTitle(t.title); setMessage(t.text); }}>{t.label}</Chip>)}
          </div>
          <div className="space-y-3">
            <Field label="Título (aparece na notificação e no assunto do e-mail)"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Ex.: Imóvel novo no Jardim América" /></Field>
            <Field label="Imóvel (opcional — o link vai junto)">
              <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">Nenhum</option>{props.data?.filter((p) => p.status !== 'pendente').map((p) => <option key={p.id} value={p.id}>{p.code} · {p.title}</option>)}</Select>
            </Field>
            <Field label="Texto">
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1500} className="min-h-32" placeholder="Olá, {nome}! ..." />
            </Field>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
              Inserir:
              {['{nome}', '{corretor}', '{imovel}', '{link}'].map((v) => <button key={v} type="button" onClick={() => insert(v)} className="rounded-full bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-text hover:bg-surface-3">{v}</button>)}
            </div>
            {message.trim() && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-faint">Como {sample} vai ver</p>
                <div className="max-w-sm whitespace-pre-wrap break-words rounded-2xl rounded-tl-md bg-[#dcf8c6] px-3.5 py-2.5 text-sm text-[#1c1814]">{rendered}</div>
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
              <div className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl rounded-tl-md bg-[#dcf8c6] px-3.5 py-2.5 text-sm text-[#1c1814]">{next.text}</div>
              <a href={whatsappLink(next.phone, next.text)} target="_blank" rel="noopener noreferrer" onClick={() => setStatus(next, 'enviado')}
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
