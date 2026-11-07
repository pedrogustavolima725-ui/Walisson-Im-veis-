import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  CalendarPlus, CheckCircle2, Circle, Columns3, FileSignature, Flame, Heart, List, Mail, MessageCircle, Phone, PhoneCall, Plus, Search, Snowflake,
  StickyNote, Sun, Trash2, Users,
} from 'lucide-react';
import { api, qs } from '../../lib/api';
import { useApi, useDebounced } from '../../lib/hooks';
import { brl, dateShort, dateTime, maskPhone, PAYMENT_LABEL, PROPOSAL_LABEL, relative, SOURCE_LABEL, STAGE_LABEL, STAGES, VISIT_LABEL, whatsappLink } from '../../lib/format';
import { useAuth, useToast } from '../../context/app';
import { Avatar, Badge, Button, Card, cx, Empty, ErrorBox, Field, Img, Input, Modal, PageHeader, PageLoader, Select, statusTone, Textarea } from '../../components/ui';

export type Lead = {
  id: number; name: string; email: string | null; phone: string | null; source: string; stage: string; temperature: string; interest: string; budget: number | null;
  message: string | null; property_id: number | null; agent_id: number | null; user_id: number | null; lost_reason: string | null; created_at: number; updated_at: number;
  agent_name?: string | null; property_title?: string | null; property_code?: string | null; property_cover?: string | null; open_tasks?: number; last_activity?: number | null;
};
type Agent = { id: number; name: string; avatar: string | null; role: string };

const TEMP_ICON = { quente: Flame, morno: Sun, frio: Snowflake } as const;
export function TempBadge({ t }: { t: string }) {
  const I = TEMP_ICON[t as keyof typeof TEMP_ICON] ?? Sun;
  return <Badge tone={statusTone(t)}><I className="size-3" />{t}</Badge>;
}

/* ============================ Lista / Kanban ============================ */
export function Leads() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [view, setView] = useState<'kanban' | 'lista'>(() => (window.innerWidth < 768 ? 'lista' : 'kanban'));
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const filters = { q: dq, stage: params.get('stage') ?? '', temperature: params.get('temperature') ?? '', source: params.get('source') ?? '', agent: params.get('agent') ?? '' };
  const { data, setData, loading, error, reload } = useApi<Lead[]>(`/crm/leads${qs(filters)}`);
  const agents = useApi<Agent[]>('/crm/agents');
  const [creating, setCreating] = useState(params.get('novo') === '1');
  const [dragId, setDragId] = useState<number | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [lostFor, setLostFor] = useState<Lead | null>(null);

  const setFilter = (k: string, v: string) => { const n = new URLSearchParams(params); v ? n.set(k, v) : n.delete(k); n.delete('novo'); setParams(n, { replace: true }); };

  const move = async (lead: Lead, stage: string, lost_reason?: string) => {
    if (lead.stage === stage) return;
    if (stage === 'perdido' && !lost_reason && !lead.lost_reason) return setLostFor(lead);
    const prev = data;
    setData((d) => d?.map((l) => (l.id === lead.id ? { ...l, stage } : l)) ?? null);
    try {
      await api(`/crm/leads/${lead.id}`, { method: 'PATCH', body: { stage, ...(lost_reason ? { lost_reason } : {}) } });
      toast(`${lead.name} → ${STAGE_LABEL[stage]}`, 'info');
    } catch (e: any) { setData(prev); toast(e.message, 'error'); }
  };

  const byStage = useMemo(() => {
    const m: Record<string, Lead[]> = Object.fromEntries(STAGES.map((s) => [s, []]));
    data?.forEach((l) => m[l.stage]?.push(l));
    return m;
  }, [data]);

  return (
    <div>
      <PageHeader
        title="Leads & Funil"
        subtitle={`${data?.length ?? 0} leads${user!.role === 'corretor' ? ' na sua carteira' : ''}`}
        actions={
          <>
            <a href="/api/crm/reports/leads.csv" className="hidden sm:block"><Button variant="outline" size="sm">Exportar CSV</Button></a>
            <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Novo lead</Button>
          </>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome, e-mail, telefone" aria-label="Buscar leads" className="h-10 w-full rounded-full border border-line bg-surface pl-10 pr-4 text-sm outline-none focus:border-accent" />
        </div>
        <Select value={filters.temperature} onChange={(e) => setFilter('temperature', e.target.value)} className="h-10 w-auto rounded-full text-sm" aria-label="Temperatura">
          <option value="">Temperatura</option><option value="quente">Quente</option><option value="morno">Morno</option><option value="frio">Frio</option>
        </Select>
        <Select value={filters.source} onChange={(e) => setFilter('source', e.target.value)} className="h-10 w-auto rounded-full text-sm" aria-label="Origem">
          <option value="">Origem</option>{Object.entries(SOURCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        {view === 'lista' && (
          <Select value={filters.stage} onChange={(e) => setFilter('stage', e.target.value)} className="h-10 w-auto rounded-full text-sm" aria-label="Etapa">
            <option value="">Etapa</option>{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </Select>
        )}
        {user!.role === 'admin' && (
          <Select value={filters.agent} onChange={(e) => setFilter('agent', e.target.value)} className="h-10 w-auto rounded-full text-sm" aria-label="Corretor">
            <option value="">Todos os corretores</option>{agents.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        )}
        <div className="ml-auto flex rounded-full border border-line bg-surface p-1">
          <button onClick={() => setView('kanban')} aria-pressed={view === 'kanban'} className={cx('flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium', view === 'kanban' ? 'bg-surface-3' : 'text-muted')}><Columns3 className="size-4" />Funil</button>
          <button onClick={() => setView('lista')} aria-pressed={view === 'lista'} className={cx('flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium', view === 'lista' ? 'bg-surface-3' : 'text-muted')}><List className="size-4" />Lista</button>
        </div>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? <PageLoader /> : view === 'kanban' ? (
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          {STAGES.map((stage) => (
            <div
              key={stage}
              onDragOver={(e) => { e.preventDefault(); setOverStage(stage); }}
              onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
              onDrop={() => { const l = data?.find((x) => x.id === dragId); if (l) move(l, stage); setDragId(null); setOverStage(null); }}
              className={cx('flex w-[280px] shrink-0 flex-col rounded-3xl border bg-surface/60 p-2 transition', overStage === stage ? 'border-accent bg-accent-soft' : 'border-line')}
            >
              <div className="flex items-center justify-between px-2 py-2">
                <span className="flex items-center gap-2 text-sm font-semibold"><span className={cx('size-2 rounded-full', stage === 'ganho' ? 'bg-success' : stage === 'perdido' ? 'bg-danger' : 'bg-accent')} />{STAGE_LABEL[stage]}</span>
                <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-semibold text-muted">{byStage[stage].length}</span>
              </div>
              <div className="flex min-h-24 flex-1 flex-col gap-2">
                {byStage[stage].map((l) => (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={() => setDragId(l.id)}
                    onDragEnd={() => { setDragId(null); setOverStage(null); }}
                    onClick={() => nav(`/crm/leads/${l.id}`)}
                    className={cx('cursor-grab rounded-2xl border border-line bg-surface p-3 shadow-sm transition hover:border-line-strong active:cursor-grabbing', dragId === l.id && 'opacity-40')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-semibold">{l.name}</p>
                      <TempBadge t={l.temperature} />
                    </div>
                    {l.property_title && <p className="mt-1 line-clamp-1 text-xs text-muted">{l.property_code} · {l.property_title}</p>}
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-faint">
                      <span>{SOURCE_LABEL[l.source] ?? l.source}{l.budget ? ` · ${brl(l.budget, true)}` : ''}</span>
                      <span>{relative(l.updated_at)}</span>
                    </div>
                    {user!.role === 'admin' && l.agent_name && <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted"><Avatar name={l.agent_name} size={16} />{l.agent_name}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : !data?.length ? (
        <Empty icon={<Users />} title="Nenhum lead encontrado" text="Ajuste os filtros ou cadastre um novo lead." />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-line">
            {data.map((l) => (
              <div key={l.id} role="link" tabIndex={0} onClick={() => nav(`/crm/leads/${l.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/crm/leads/${l.id}`)} className="flex cursor-pointer items-center gap-3 p-3.5 hover:bg-surface-2 sm:gap-4">
                <Avatar name={l.name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="truncate font-semibold">{l.name}</span><TempBadge t={l.temperature} /></div>
                  <p className="truncate text-xs text-muted">{l.property_title ?? l.email ?? l.phone}</p>
                </div>
                <div className="hidden text-right text-xs text-muted md:block"><p>{SOURCE_LABEL[l.source]}</p><p>{l.agent_name}</p></div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Select value={l.stage} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => move(l, e.target.value)} className="h-8 w-auto rounded-full py-0 pl-3 text-xs" aria-label="Etapa">
                    {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                  </Select>
                  <span className="text-[11px] text-faint">{relative(l.updated_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <LeadForm open={creating} onClose={() => { setCreating(false); setFilter('novo', ''); }} agents={agents.data ?? []} onSaved={(id) => { setCreating(false); nav(`/crm/leads/${id}`); }} />
      <LostReason lead={lostFor} onClose={() => setLostFor(null)} onConfirm={(reason) => { if (lostFor) move(lostFor, 'perdido', reason); setLostFor(null); }} />
    </div>
  );
}

function LostReason({ lead, onClose, onConfirm }: { lead: Lead | null; onClose: () => void; onConfirm: (r: string) => void }) {
  const [r, setR] = useState('');
  const reasons = ['Comprou/alugou com outra imobiliária', 'Sem crédito aprovado', 'Desistiu da mudança', 'Preço acima do orçamento', 'Sem retorno do cliente'];
  return (
    <Modal open={!!lead} onClose={onClose} title="Motivo da perda">
      <div className="flex flex-wrap gap-2">{reasons.map((x) => <button key={x} onClick={() => setR(x)} className={cx('rounded-full border px-3 py-1.5 text-xs', r === x ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted')}>{x}</button>)}</div>
      <Input className="mt-3" value={r} onChange={(e) => setR(e.target.value)} placeholder="Ou descreva o motivo" maxLength={300} />
      <Button variant="danger" className="mt-4 w-full" disabled={!r.trim()} onClick={() => onConfirm(r.trim())}>Marcar como perdido</Button>
    </Modal>
  );
}

function LeadForm({ open, onClose, agents, onSaved }: { open: boolean; onClose: () => void; agents: Agent[]; onSaved: (id: number) => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const props = useApi<{ id: number; code: string; title: string }[]>(open ? '/properties/manage/list' : null, [open]);
  const [f, setF] = useState({ name: '', email: '', phone: '', source: 'whatsapp', interest: 'compra', temperature: 'morno', budget: '', property_id: '', agent_id: '', message: '' });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: k === 'phone' ? maskPhone(e.target.value) : e.target.value });
  const save = async () => {
    setLoading(true); setFields({});
    try {
      const r = await api<{ id: number }>('/crm/leads', { body: { ...f, budget: f.budget ? Number(f.budget) : null, property_id: f.property_id ? Number(f.property_id) : null, agent_id: f.agent_id ? Number(f.agent_id) : null } });
      toast('Lead cadastrado.'); onSaved(r.id);
    } catch (e: any) { setFields(e.fields ?? {}); toast(e.message, 'error'); } finally { setLoading(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Novo lead" wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome *" error={fields.name}><Input value={f.name} onChange={set('name')} /></Field>
        <Field label="Telefone" error={fields.phone}><Input value={f.phone} onChange={set('phone')} type="tel" /></Field>
        <Field label="E-mail" error={fields.email}><Input value={f.email} onChange={set('email')} type="email" /></Field>
        <Field label="Origem"><Select value={f.source} onChange={set('source')}>{Object.entries(SOURCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        <Field label="Interesse"><Select value={f.interest} onChange={set('interest')}><option value="compra">Compra</option><option value="aluguel">Aluguel</option><option value="venda">Vender imóvel</option><option value="temporada">Temporada</option></Select></Field>
        <Field label="Temperatura"><Select value={f.temperature} onChange={set('temperature')}><option value="quente">Quente</option><option value="morno">Morno</option><option value="frio">Frio</option></Select></Field>
        <Field label="Orçamento (R$)"><Input type="number" min={0} value={f.budget} onChange={set('budget')} /></Field>
        <Field label="Imóvel de interesse"><Select value={f.property_id} onChange={set('property_id')}><option value="">Nenhum</option>{props.data?.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.title}</option>)}</Select></Field>
        {user!.role === 'admin' && <Field label="Corretor responsável"><Select value={f.agent_id} onChange={set('agent_id')}><option value="">Eu mesmo</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>}
        <Field label="Observações" className="sm:col-span-2"><Textarea value={f.message} onChange={set('message')} maxLength={2000} className="min-h-20" /></Field>
      </div>
      <Button className="mt-5 w-full" loading={loading} onClick={save}>Cadastrar lead</Button>
    </Modal>
  );
}

/* ============================ Detalhe do lead ============================ */
type LeadDetailT = Lead & {
  property: { id: number; title: string; code: string; price: number; purpose: string; neighborhood: string; city: string; cover: string | null } | null;
  agent: { id: number; name: string; avatar: string | null } | null;
  activities: { id: number; type: string; content: string; created_at: number; user_name: string | null }[];
  tasks: { id: number; title: string; due_at: number | null; done: number; priority: string }[];
  visits: { id: number; scheduled_at: number; status: string; property_title: string; feedback: string | null; rating: number | null }[];
  proposals: { id: number; value: number; payment: string; status: string; property_title: string; created_at: number }[];
  favorites: { id: number; title: string; price: number }[];
  conversation: { id: number } | null;
};

const ACT_ICON: Record<string, typeof StickyNote> = { nota: StickyNote, ligacao: PhoneCall, email: Mail, whatsapp: MessageCircle, reuniao: Users, visita: CalendarPlus, proposta: FileSignature, tarefa: CheckCircle2 };

export function LeadDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const { data: l, loading, error, reload } = useApi<LeadDetailT>(`/crm/leads/${id}`, [id]);
  const agents = useApi<Agent[]>(user!.role === 'admin' ? '/crm/agents' : null);
  const [act, setAct] = useState({ type: 'nota', content: '' });
  const [task, setTask] = useState({ title: '', due: '' });
  const [modal, setModal] = useState<null | 'visit' | 'proposal' | 'lost'>(null);

  if (loading && !l) return <PageLoader />;
  if (error || !l) return <ErrorBox message={error ?? 'Lead não encontrado'} />;

  const patch = async (body: Record<string, unknown>) => {
    try { await api(`/crm/leads/${l.id}`, { method: 'PATCH', body }); reload(true); } catch (e: any) { toast(e.message, 'error'); }
  };
  const addActivity = async () => {
    if (!act.content.trim()) return;
    try { await api(`/crm/leads/${l.id}/activities`, { body: act }); setAct({ ...act, content: '' }); reload(true); } catch (e: any) { toast(e.message, 'error'); }
  };
  const addTask = async () => {
    if (!task.title.trim()) return;
    try { await api('/crm/tasks', { body: { title: task.title, lead_id: l.id, due_at: task.due ? +new Date(task.due) : null } }); setTask({ title: '', due: '' }); reload(true); } catch (e: any) { toast(e.message, 'error'); }
  };

  return (
    <div>
      <PageHeader back="/crm/leads" title={l.name} subtitle={`Lead #${l.id} · criado ${relative(l.created_at)} via ${SOURCE_LABEL[l.source] ?? l.source}`}
        actions={user!.role === 'admin' && <Button variant="danger" size="sm" icon={<Trash2 className="size-4" />} onClick={async () => { if (confirm('Excluir este lead permanentemente?')) { await api(`/crm/leads/${l.id}`, { method: 'DELETE' }); toast('Lead excluído.', 'info'); nav('/crm/leads'); } }}>Excluir</Button>}
      />

      {/* Etapas */}
      <div className="no-scrollbar mb-5 flex gap-1.5 overflow-x-auto">
        {STAGES.map((s, i) => {
          const cur = STAGES.indexOf(l.stage as (typeof STAGES)[number]);
          const active = s === l.stage;
          return (
            <button key={s} onClick={() => (s === 'perdido' ? setModal('lost') : patch({ stage: s }))}
              className={cx('h-10 shrink-0 rounded-full px-4 text-xs font-semibold transition', active ? (s === 'perdido' ? 'bg-danger text-white' : s === 'ganho' ? 'bg-success text-white' : 'bg-primary text-primary-ink') : i < cur && l.stage !== 'perdido' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted hover:text-text')}>
              {STAGE_LABEL[s]}
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3"><Avatar name={l.name} size={52} /><div className="min-w-0"><p className="font-semibold">{l.name}</p><p className="text-xs text-muted">{l.user_id ? 'Cliente cadastrado no app' : 'Contato externo'}</p></div></div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <a href={l.phone ? `tel:${l.phone.replace(/\D/g, '')}` : undefined} onClick={() => l.phone && api(`/crm/leads/${l.id}/activities`, { body: { type: 'ligacao', content: 'Ligação iniciada pelo CRM' } }).then(() => reload(true))} className={cx('flex flex-col items-center gap-1 rounded-2xl bg-surface-2 py-3 text-xs font-medium', !l.phone && 'pointer-events-none opacity-40')}><Phone className="size-5 text-info" />Ligar</a>
              <a href={whatsappLink(l.phone, `Olá, ${l.name.split(' ')[0]}! Aqui é ${user!.name.split(' ')[0]} da Walisson Imóveis.`)} target="_blank" rel="noopener noreferrer" className={cx('flex flex-col items-center gap-1 rounded-2xl bg-surface-2 py-3 text-xs font-medium', !l.phone && 'pointer-events-none opacity-40')}><MessageCircle className="size-5 text-success" />WhatsApp</a>
              {l.conversation ? <Link to={`/crm/mensagens/${l.conversation.id}`} className="flex flex-col items-center gap-1 rounded-2xl bg-surface-2 py-3 text-xs font-medium"><MessageCircle className="size-5 text-accent" />Chat</Link>
                : <a href={l.email ? `mailto:${l.email}` : undefined} className={cx('flex flex-col items-center gap-1 rounded-2xl bg-surface-2 py-3 text-xs font-medium', !l.email && 'pointer-events-none opacity-40')}><Mail className="size-5 text-accent" />E-mail</a>}
            </div>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted">E-mail</dt><dd className="truncate">{l.email ?? '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Telefone</dt><dd>{l.phone ?? '—'}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-muted">Temperatura</dt><dd>
                <Select value={l.temperature} onChange={(e) => patch({ temperature: e.target.value })} className="h-8 rounded-full py-0 text-xs"><option value="quente">🔥 Quente</option><option value="morno">☀️ Morno</option><option value="frio">❄️ Frio</option></Select>
              </dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Interesse</dt><dd className="capitalize">{l.interest}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Orçamento</dt><dd>{brl(l.budget)}</dd></div>
              {user!.role === 'admin' ? (
                <div className="flex items-center justify-between gap-3"><dt className="text-muted">Corretor</dt><dd>
                  <Select value={l.agent_id ?? ''} onChange={(e) => patch({ agent_id: Number(e.target.value) })} className="h-8 rounded-full py-0 text-xs">{agents.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
                </dd></div>
              ) : <div className="flex justify-between gap-3"><dt className="text-muted">Corretor</dt><dd>{l.agent?.name}</dd></div>}
              {l.lost_reason && <div className="rounded-2xl bg-danger-soft p-3 text-xs text-danger">Motivo da perda: {l.lost_reason}</div>}
            </dl>
            {l.message && <p className="mt-4 rounded-2xl bg-surface-2 p-3 text-sm text-muted">“{l.message}”</p>}
          </Card>

          {l.property && (
            <Card className="p-3">
              <p className="mb-2 px-2 pt-1 text-xs font-semibold uppercase tracking-wider text-faint">Imóvel de interesse</p>
              <Link to={`/imovel/${l.property.id}`} className="flex gap-3">
                <Img src={l.property.cover} alt="" className="size-20 shrink-0 rounded-2xl" />
                <div className="min-w-0 py-1"><p className="text-xs text-accent">{l.property.code}</p><p className="line-clamp-2 text-sm font-semibold">{l.property.title}</p><p className="text-sm text-muted">{brl(l.property.price)}</p></div>
              </Link>
            </Card>
          )}

          {l.favorites.length > 0 && (
            <Card className="p-5">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Heart className="size-4 text-danger" />Favoritos do cliente</p>
              <div className="space-y-2">{l.favorites.map((f) => <Link key={f.id} to={`/imovel/${f.id}`} className="flex justify-between gap-3 text-sm hover:text-accent"><span className="truncate">{f.title}</span><span className="shrink-0 text-muted">{brl(f.price, true)}</span></Link>)}</div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Tarefas */}
            <Card className="p-5">
              <h3 className="mb-3 font-semibold">Tarefas</h3>
              <div className="space-y-1">
                {l.tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5 py-1.5">
                    <button aria-label={t.done ? 'Reabrir' : 'Concluir'} onClick={async () => { await api(`/crm/tasks/${t.id}`, { method: 'PATCH', body: { done: !t.done } }); reload(true); }}>
                      {t.done ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5 text-faint hover:text-success" />}
                    </button>
                    <span className={cx('flex-1 text-sm', t.done && 'text-faint line-through')}>{t.title}</span>
                    {t.due_at && <span className={cx('text-xs', !t.done && t.due_at < Date.now() ? 'text-danger' : 'text-faint')}>{dateTime(t.due_at)}</span>}
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-2">
                <Input value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} placeholder="Nova tarefa..." className="h-10 text-sm" onKeyDown={(e) => e.key === 'Enter' && addTask()} />
                <div className="flex gap-2">
                  <input type="datetime-local" value={task.due} onChange={(e) => setTask({ ...task, due: e.target.value })} aria-label="Prazo" className="h-10 min-w-0 flex-1 rounded-2xl border border-line bg-surface-2 px-3 text-xs" />
                  <Button size="sm" className="h-10" onClick={addTask} icon={<Plus className="size-4" />}>Adicionar</Button>
                </div>
              </div>
            </Card>

            {/* Visitas & Propostas */}
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Visitas e propostas</h3>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => setModal('visit')} icon={<CalendarPlus className="size-4" />}>Visita</Button>
                  <Button size="sm" variant="secondary" onClick={() => setModal('proposal')} icon={<FileSignature className="size-4" />}>Proposta</Button>
                </div>
              </div>
              <div className="space-y-2">
                {l.visits.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-sm">
                    <span className="min-w-0"><span className="block truncate">{v.property_title}</span><span className="text-xs text-muted">{dateTime(v.scheduled_at)}</span></span>
                    <Badge tone={statusTone(v.status)}>{VISIT_LABEL[v.status]}</Badge>
                  </div>
                ))}
                {l.proposals.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-sm">
                    <span className="min-w-0"><span className="block font-semibold tabular-nums">{brl(p.value)}</span><span className="text-xs text-muted">{PAYMENT_LABEL[p.payment]} · {p.property_title}</span></span>
                    <Badge tone={statusTone(p.status)}>{PROPOSAL_LABEL[p.status]}</Badge>
                  </div>
                ))}
                {!l.visits.length && !l.proposals.length && <p className="py-4 text-center text-sm text-muted">Nenhuma visita ou proposta ainda.</p>}
              </div>
            </Card>
          </div>

          {/* Timeline */}
          <Card className="p-5">
            <h3 className="mb-3 font-semibold">Histórico de interações</h3>
            <div className="rounded-3xl border border-line bg-surface-2 p-3">
              <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
                {[['nota', 'Nota'], ['ligacao', 'Ligação'], ['whatsapp', 'WhatsApp'], ['email', 'E-mail'], ['reuniao', 'Reunião']].map(([k, lb]) => (
                  <button key={k} onClick={() => setAct({ ...act, type: k })} className={cx('h-8 shrink-0 rounded-full px-3 text-xs font-medium', act.type === k ? 'bg-primary text-primary-ink' : 'bg-surface text-muted')}>{lb}</button>
                ))}
              </div>
              <Textarea value={act.content} onChange={(e) => setAct({ ...act, content: e.target.value })} placeholder="Registre o que foi conversado..." className="min-h-20 border-0 bg-transparent focus:bg-transparent" maxLength={2000} />
              <div className="flex justify-end"><Button size="sm" onClick={addActivity} disabled={!act.content.trim()}>Registrar</Button></div>
            </div>
            <ol className="relative mt-5 space-y-4 before:absolute before:bottom-2 before:left-[17px] before:top-2 before:w-px before:bg-line">
              {l.activities.map((a) => {
                const I = ACT_ICON[a.type] ?? Circle;
                return (
                  <li key={a.id} className="relative flex gap-3">
                    <span className={cx('relative z-10 grid size-9 shrink-0 place-items-center rounded-full border border-line', a.type === 'etapa' ? 'bg-accent-soft text-accent' : 'bg-surface text-muted')}><I className="size-4" /></span>
                    <div className="min-w-0 flex-1 pt-1">
                      <p className="text-sm">{a.content}</p>
                      <p className="mt-0.5 text-xs text-faint">{a.user_name ?? 'Sistema'} · {dateShort(a.created_at)} {new Date(a.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>
      </div>

      <VisitModal open={modal === 'visit'} onClose={() => setModal(null)} lead={l} onDone={() => { setModal(null); reload(true); }} />
      <ProposalModal open={modal === 'proposal'} onClose={() => setModal(null)} lead={l} onDone={() => { setModal(null); reload(true); }} />
      <LostReason lead={modal === 'lost' ? l : null} onClose={() => setModal(null)} onConfirm={(r) => { patch({ stage: 'perdido', lost_reason: r }); setModal(null); }} />
    </div>
  );
}

function usePropertyOptions(open: boolean) {
  return useApi<{ id: number; code: string; title: string; price: number; status: string }[]>(open ? '/properties/manage/list' : null, [open]);
}

function VisitModal({ open, onClose, lead, onDone }: { open: boolean; onClose: () => void; lead: LeadDetailT; onDone: () => void }) {
  const props = usePropertyOptions(open);
  const toast = useToast();
  const [pid, setPid] = useState(String(lead.property_id ?? ''));
  const [when, setWhen] = useState('');
  const [notes, setNotes] = useState('');
  useEffect(() => { if (open) setPid(String(lead.property_id ?? '')); }, [open, lead.property_id]);
  const save = async () => {
    try { await api('/crm/visits', { body: { lead_id: lead.id, property_id: Number(pid), scheduled_at: +new Date(when), notes: notes || undefined } }); toast('Visita agendada.'); onDone(); } catch (e: any) { toast(e.message, 'error'); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Agendar visita">
      <div className="space-y-4">
        <Field label="Imóvel"><Select value={pid} onChange={(e) => setPid(e.target.value)}><option value="">Selecione</option>{props.data?.filter((p) => p.status === 'disponivel').map((p) => <option key={p.id} value={p.id}>{p.code} · {p.title}</option>)}</Select></Field>
        <Field label="Data e hora"><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
        <Field label="Observações"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-20" /></Field>
        <Button className="w-full" disabled={!pid || !when} onClick={save}>Agendar</Button>
      </div>
    </Modal>
  );
}

function ProposalModal({ open, onClose, lead, onDone }: { open: boolean; onClose: () => void; lead: LeadDetailT; onDone: () => void }) {
  const props = usePropertyOptions(open);
  const toast = useToast();
  const [f, setF] = useState({ property_id: String(lead.property_id ?? ''), value: '', payment: 'financiamento', valid_days: '7', notes: '' });
  useEffect(() => { if (open) setF((x) => ({ ...x, property_id: String(lead.property_id ?? ''), value: lead.property ? String(lead.property.price) : '' })); }, [open, lead.property_id, lead.property]);
  const save = async () => {
    try { await api('/crm/proposals', { body: { lead_id: lead.id, property_id: Number(f.property_id), value: Number(f.value), payment: f.payment, valid_days: Number(f.valid_days), notes: f.notes || undefined } }); toast('Proposta registrada.'); onDone(); } catch (e: any) { toast(e.message, 'error'); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Registrar proposta">
      <div className="space-y-4">
        <Field label="Imóvel"><Select value={f.property_id} onChange={(e) => setF({ ...f, property_id: e.target.value })}><option value="">Selecione</option>{props.data?.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.title}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor (R$)"><Input type="number" min={1} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></Field>
          <Field label="Validade (dias)"><Input type="number" min={1} max={90} value={f.valid_days} onChange={(e) => setF({ ...f, valid_days: e.target.value })} /></Field>
        </div>
        <Field label="Pagamento"><Select value={f.payment} onChange={(e) => setF({ ...f, payment: e.target.value })}>{Object.entries(PAYMENT_LABEL).map(([k, lb]) => <option key={k} value={k}>{lb}</option>)}</Select></Field>
        <Field label="Condições"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className="min-h-20" /></Field>
        <Button className="w-full" disabled={!f.property_id || !f.value} onClick={save}>Registrar proposta</Button>
      </div>
    </Modal>
  );
}
