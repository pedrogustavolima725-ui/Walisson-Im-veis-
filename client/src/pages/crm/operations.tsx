import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock, FileSignature, MessageCircle, Phone, Plus, Search, Trash2, UsersRound, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi, useDebounced } from '../../lib/hooks';
import { brl, dateShort, dateTime, PAYMENT_LABEL, PROPOSAL_LABEL, relative, STAGE_LABEL, time, VISIT_LABEL, whatsappLink } from '../../lib/format';
import { useAuth, useToast } from '../../context/app';
import { Avatar, Badge, Button, Card, Chip, cx, Empty, Img, Input, Modal, PageHeader, PageLoader, Select, statusTone, Tabs, Textarea } from '../../components/ui';

/* ============================ Agenda ============================ */
type Visit = { id: number; scheduled_at: number; status: string; notes: string | null; feedback: string | null; property_id: number; property_title: string; neighborhood: string; city: string; cover: string | null; client_name: string | null; client_phone: string | null; agent_name: string | null };
type Task = { id: number; title: string; due_at: number | null; done: number; priority: string; lead_id: number | null; lead_name: string | null; assigned_name: string | null };

const startOfWeek = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

export function Agenda() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as 'visitas' | 'tarefas') ?? 'visitas';
  const visits = useApi<Visit[]>('/me/visits');
  const tasks = useApi<Task[]>('/crm/tasks');
  const toast = useToast();
  const { user } = useAuth();
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [selected, setSelected] = useState<Visit | null>(null);
  const [newTask, setNewTask] = useState({ title: '', due: '', priority: 'media' });
  const [taskFilter, setTaskFilter] = useState<'abertas' | 'concluidas'>('abertas');

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(week); d.setDate(d.getDate() + i); return d; }), [week]);
  const byDay = (d: Date) => (visits.data ?? []).filter((v) => new Date(v.scheduled_at).toDateString() === d.toDateString()).sort((a, b) => a.scheduled_at - b.scheduled_at);
  const pending = (visits.data ?? []).filter((v) => v.status === 'agendada' && v.scheduled_at > Date.now());

  const updateVisit = async (v: Visit, status: string) => {
    try { await api(`/me/visits/${v.id}`, { method: 'PATCH', body: { status } }); toast(`Visita ${VISIT_LABEL[status].toLowerCase()}.`); visits.reload(true); setSelected(null); } catch (e: any) { toast(e.message, 'error'); }
  };
  const addTask = async () => {
    if (!newTask.title.trim()) return;
    try { await api('/crm/tasks', { body: { title: newTask.title, priority: newTask.priority, due_at: newTask.due ? +new Date(newTask.due) : null } }); setNewTask({ title: '', due: '', priority: 'media' }); tasks.reload(true); } catch (e: any) { toast(e.message, 'error'); }
  };
  const taskList = (tasks.data ?? []).filter((t) => (taskFilter === 'abertas' ? !t.done : t.done));

  return (
    <div>
      <PageHeader title="Agenda & Tarefas" subtitle={`${pending.length} visita(s) aguardando sua confirmação`} />
      <Tabs value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} items={[{ value: 'visitas', label: 'Visitas' }, { value: 'tarefas', label: 'Tarefas' }]} className="mb-5 w-fit" />

      {tab === 'visitas' ? (
        visits.loading && !visits.data ? <PageLoader /> : (
          <>
            {pending.length > 0 && (
              <Card className="mb-5 p-4">
                <p className="mb-3 text-sm font-semibold">Aguardando confirmação</p>
                <div className="space-y-2">
                  {pending.map((v) => (
                    <div key={v.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2 p-2.5">
                      <Img src={v.cover} alt="" className="size-12 shrink-0 rounded-xl" />
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{v.client_name ?? 'Lead'} · {dateTime(v.scheduled_at)}</p><p className="truncate text-xs text-muted">{v.property_title}</p></div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="danger" onClick={() => updateVisit(v, 'cancelada')} aria-label="Recusar"><X className="size-4" /></Button>
                        <Button size="sm" onClick={() => updateVisit(v, 'confirmada')} icon={<Check className="size-4" />}>Confirmar</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold first-letter:uppercase">{week.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="sm" onClick={() => setWeek(startOfWeek(new Date()))}>Hoje</Button>
                <button onClick={() => setWeek(new Date(+week - 7 * 86400000))} aria-label="Semana anterior" className="grid size-9 place-items-center rounded-full bg-surface-2"><ChevronLeft className="size-4" /></button>
                <button onClick={() => setWeek(new Date(+week + 7 * 86400000))} aria-label="Próxima semana" className="grid size-9 place-items-center rounded-full bg-surface-2"><ChevronRight className="size-4" /></button>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-7">
              {days.map((d) => {
                const list = byDay(d);
                const today = d.toDateString() === new Date().toDateString();
                return (
                  <div key={+d} className={cx('min-h-28 rounded-3xl border p-2 md:min-h-64', today ? 'border-accent bg-accent-soft/40' : 'border-line bg-surface')}>
                    <div className="mb-2 flex items-center gap-2 px-1 md:block md:text-center">
                      <span className="text-xs capitalize text-muted">{d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
                      <span className={cx('text-lg font-semibold md:block', today && 'text-accent')}>{d.getDate()}</span>
                    </div>
                    <div className="space-y-1.5">
                      {list.map((v) => (
                        <button key={v.id} onClick={() => setSelected(v)} className={cx('w-full rounded-xl border-l-[3px] bg-surface-2 p-2 text-left text-xs transition hover:bg-surface-3', v.status === 'confirmada' ? 'border-success' : v.status === 'agendada' ? 'border-warning' : v.status === 'cancelada' ? 'border-danger opacity-50' : 'border-info')}>
                          <p className="font-semibold">{time(v.scheduled_at)}</p>
                          <p className="truncate text-muted">{v.client_name ?? 'Lead'}</p>
                          <p className="truncate text-faint">{v.property_title}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <Tabs value={taskFilter} onChange={setTaskFilter} items={[{ value: 'abertas', label: 'Abertas' }, { value: 'concluidas', label: 'Concluídas' }]} />
            </div>
            {!taskList.length ? <Empty icon={<CheckCircle2 />} title="Nada por aqui" /> : (
              <div className="divide-y divide-line">
                {taskList.map((t) => {
                  const late = !t.done && t.due_at && t.due_at < Date.now();
                  return (
                    <div key={t.id} className="flex items-center gap-3 py-3">
                      <button onClick={async () => { await api(`/crm/tasks/${t.id}`, { method: 'PATCH', body: { done: !t.done } }); tasks.reload(true); }} aria-label={t.done ? 'Reabrir' : 'Concluir'}>
                        {t.done ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5 text-faint hover:text-success" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={cx('text-sm font-medium', t.done && 'text-faint line-through')}>{t.title}</p>
                        <p className={cx('text-xs', late ? 'text-danger' : 'text-muted')}>
                          {t.due_at ? `${late ? 'Atrasada · ' : ''}${dateTime(t.due_at)}` : 'Sem prazo'}
                          {t.lead_name && <> · <Link to={`/crm/leads/${t.lead_id}`} className="hover:text-accent">{t.lead_name}</Link></>}
                          {user!.role === 'admin' && t.assigned_name && <> · {t.assigned_name}</>}
                        </p>
                      </div>
                      <Badge tone={t.priority === 'alta' ? 'danger' : t.priority === 'media' ? 'warning' : 'neutral'}>{t.priority}</Badge>
                      <button onClick={async () => { await api(`/crm/tasks/${t.id}`, { method: 'DELETE' }); tasks.reload(true); }} aria-label="Excluir" className="text-faint hover:text-danger"><Trash2 className="size-4" /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          <Card className="h-fit space-y-3 p-5">
            <h3 className="font-semibold">Nova tarefa</h3>
            <Input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Ex.: Ligar para proprietário" />
            <Input type="datetime-local" value={newTask.due} onChange={(e) => setNewTask({ ...newTask, due: e.target.value })} aria-label="Prazo" />
            <Select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} aria-label="Prioridade"><option value="baixa">Prioridade baixa</option><option value="media">Prioridade média</option><option value="alta">Prioridade alta</option></Select>
            <Button className="w-full" onClick={addTask} icon={<Plus className="size-4" />}>Adicionar</Button>
          </Card>
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Detalhes da visita">
        {selected && (
          <div className="space-y-4">
            <div className="flex gap-3"><Img src={selected.cover} alt="" className="size-20 shrink-0 rounded-2xl" /><div><p className="font-semibold">{selected.property_title}</p><p className="text-sm text-muted">{selected.neighborhood}, {selected.city}</p><Badge tone={statusTone(selected.status)} className="mt-2">{VISIT_LABEL[selected.status]}</Badge></div></div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-2xl bg-surface-2 p-3"><p className="text-xs text-muted">Data</p><p className="font-semibold">{dateShort(selected.scheduled_at)}</p></div>
              <div className="rounded-2xl bg-surface-2 p-3"><p className="text-xs text-muted">Horário</p><p className="flex items-center gap-1 font-semibold"><Clock className="size-4" />{time(selected.scheduled_at)}</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
              <Avatar name={selected.client_name ?? 'Lead'} size={40} />
              <div className="flex-1"><p className="font-semibold">{selected.client_name ?? 'Lead sem conta'}</p><p className="text-xs text-muted">{selected.client_phone}</p></div>
              {selected.client_phone && <a href={whatsappLink(selected.client_phone, `Olá! Confirmando nossa visita em ${dateTime(selected.scheduled_at)}.`)} target="_blank" rel="noopener noreferrer" className="grid size-10 place-items-center rounded-full bg-success-soft text-success" aria-label="WhatsApp"><Phone className="size-4" /></a>}
            </div>
            {selected.notes && <p className="rounded-2xl bg-surface-2 p-3 text-sm text-muted">“{selected.notes}”</p>}
            {selected.feedback && <p className="rounded-2xl bg-success-soft p-3 text-sm">Feedback: “{selected.feedback}”</p>}
            {['agendada', 'confirmada'].includes(selected.status) && (
              <div className="grid grid-cols-2 gap-2">
                {selected.status === 'agendada' && <Button onClick={() => updateVisit(selected, 'confirmada')}>Confirmar</Button>}
                {selected.status === 'confirmada' && <Button onClick={() => updateVisit(selected, 'realizada')}>Marcar realizada</Button>}
                <Button variant="danger" onClick={() => updateVisit(selected, 'cancelada')}>Cancelar</Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ============================ Propostas ============================ */
type Proposal = { id: number; value: number; payment: string; status: string; notes: string | null; valid_until: number | null; created_at: number; updated_at: number; property_id: number; property_title: string; property_code: string; asking_price: number; lead_id: number | null; lead_name: string | null; agent_name: string | null; cover: string | null };
export function CrmProposals() {
  const { data, loading, reload } = useApi<Proposal[]>('/crm/proposals');
  const toast = useToast();
  const [filter, setFilter] = useState('');
  const [counter, setCounter] = useState<Proposal | null>(null);
  const [cv, setCv] = useState({ value: '', notes: '' });
  const list = (data ?? []).filter((p) => !filter || p.status === filter);
  const totals = useMemo(() => {
    const d = data ?? [];
    return { open: d.filter((p) => ['enviada', 'contraproposta'].includes(p.status)).reduce((a, p) => a + p.value, 0), won: d.filter((p) => p.status === 'aceita').reduce((a, p) => a + p.value, 0) };
  }, [data]);
  const update = async (p: Proposal, body: Record<string, unknown>) => {
    if (body.status === 'aceita' && !confirm('Aceitar esta proposta? O imóvel será marcado como vendido/alugado, o lead como ganho e as demais propostas recusadas.')) return;
    try { await api(`/crm/proposals/${p.id}`, { method: 'PATCH', body }); toast('Proposta atualizada.'); reload(true); setCounter(null); } catch (e: any) { toast(e.message, 'error'); }
  };
  return (
    <div>
      <PageHeader title="Propostas" subtitle={`Em negociação: ${brl(totals.open, true)} · Fechado: ${brl(totals.won, true)}`} actions={<a href="/api/crm/reports/propostas.csv"><Button variant="outline" size="sm">Exportar CSV</Button></a>} />
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto">
        {['', 'enviada', 'contraproposta', 'aceita', 'recusada', 'rascunho'].map((s) => <Chip key={s} active={filter === s} onClick={() => setFilter(s)} className="h-9">{s ? PROPOSAL_LABEL[s] : 'Todas'}</Chip>)}
      </div>
      {loading && !data ? <PageLoader /> : !list.length ? <Empty icon={<FileSignature />} title="Nenhuma proposta" text="Propostas enviadas por clientes ou registradas nos leads aparecem aqui." /> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((p) => {
            const diff = ((p.value - p.asking_price) / p.asking_price) * 100;
            return (
              <Card key={p.id} className="p-4">
                <div className="flex gap-3">
                  <Img src={p.cover} alt="" className="size-16 shrink-0 rounded-2xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2"><p className="line-clamp-1 font-semibold">{p.property_title}</p><Badge tone={statusTone(p.status)}>{PROPOSAL_LABEL[p.status]}</Badge></div>
                    <p className="text-xs text-muted">{p.property_code} · {p.lead_id ? <Link to={`/crm/leads/${p.lead_id}`} className="hover:text-accent">{p.lead_name}</Link> : 'Negócio direto'} · {p.agent_name}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">{brl(p.value)} <span className={cx('text-xs font-medium', diff < 0 ? 'text-danger' : 'text-success')}>{diff >= 0 ? '+' : ''}{diff.toFixed(1).replace('.', ',')}%</span></p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 text-xs text-muted"><span>{PAYMENT_LABEL[p.payment]}</span><span>Anunciado {brl(p.asking_price, true)}</span><span>Atualizada {relative(p.updated_at)}</span>{p.valid_until && <span>Válida até {dateShort(p.valid_until)}</span>}</div>
                {p.notes && <p className="mt-2 rounded-2xl bg-surface-2 p-2.5 text-xs text-muted">{p.notes}</p>}
                {['enviada', 'contraproposta', 'rascunho'].includes(p.status) && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                    {p.status === 'rascunho' && <Button size="sm" variant="secondary" onClick={() => update(p, { status: 'enviada' })}>Enviar</Button>}
                    <Button size="sm" onClick={() => update(p, { status: 'aceita' })} icon={<Check className="size-4" />}>Aceitar</Button>
                    <Button size="sm" variant="secondary" onClick={() => { setCounter(p); setCv({ value: String(p.value), notes: '' }); }}>Contraproposta</Button>
                    <Button size="sm" variant="danger" onClick={() => update(p, { status: 'recusada' })}>Recusar</Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <Modal open={!!counter} onClose={() => setCounter(null)} title="Registrar contraproposta">
        <div className="space-y-3">
          <Input type="number" value={cv.value} onChange={(e) => setCv({ ...cv, value: e.target.value })} aria-label="Novo valor" />
          <Textarea value={cv.notes} onChange={(e) => setCv({ ...cv, notes: e.target.value })} placeholder="Condições da contraproposta" className="min-h-20" />
          <Button className="w-full" onClick={() => counter && update(counter, { status: 'contraproposta', value: Number(cv.value), notes: cv.notes || undefined })}>Salvar</Button>
        </div>
      </Modal>
    </div>
  );
}

/* ============================ Clientes ============================ */
type Client = { id: number; name: string; email: string; phone: string | null; created_at: number; last_login_at: number | null; marketing_opt_in: number; favorites: number; visits: number; lead_id: number | null; lead_stage: string | null };
export function Clients() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data, loading } = useApi<Client[]>(`/crm/clients?q=${encodeURIComponent(dq)}`);
  return (
    <div>
      <PageHeader title="Clientes" subtitle="Usuários cadastrados no app e seu engajamento." />
      <div className="relative mb-5 max-w-sm">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou e-mail" aria-label="Buscar clientes" className="h-10 w-full rounded-full border border-line bg-surface pl-10 pr-4 text-sm outline-none focus:border-accent" />
      </div>
      {loading && !data ? <PageLoader /> : !data?.length ? <Empty icon={<UsersRound />} title="Nenhum cliente encontrado" /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs text-muted"><tr className="border-b border-line"><th className="p-4 font-medium">Cliente</th><th className="p-4 font-medium">Contato</th><th className="p-4 font-medium">Engajamento</th><th className="p-4 font-medium">Funil</th><th className="p-4 font-medium">Último acesso</th><th className="p-4" /></tr></thead>
            <tbody className="divide-y divide-line">
              {data.map((c) => (
                <tr key={c.id} className="hover:bg-surface-2">
                  <td className="p-4"><div className="flex items-center gap-3"><Avatar name={c.name} size={36} /><div><p className="font-semibold">{c.name}</p><p className="text-xs text-muted">desde {dateShort(c.created_at)}</p></div></div></td>
                  <td className="p-4"><p>{c.email}</p><p className="text-xs text-muted">{c.phone ?? '—'}</p></td>
                  <td className="p-4 text-muted">{c.favorites} favoritos · {c.visits} visitas</td>
                  <td className="p-4">{c.lead_stage ? <Badge tone={statusTone(c.lead_stage)}>{STAGE_LABEL[c.lead_stage]}</Badge> : <span className="text-faint">—</span>}</td>
                  <td className="p-4 text-muted">{c.last_login_at ? relative(c.last_login_at) : 'Nunca'}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-1.5">
                      {c.phone && <a href={whatsappLink(c.phone, `Olá, ${c.name.split(' ')[0]}!`)} target="_blank" rel="noopener noreferrer" className="grid size-8 place-items-center rounded-full bg-surface-2 text-success" aria-label="WhatsApp"><MessageCircle className="size-4" /></a>}
                      {c.lead_id && <Link to={`/crm/leads/${c.lead_id}`} className="grid size-8 place-items-center rounded-full bg-surface-2 text-accent" aria-label="Abrir lead"><CalendarDays className="size-4" /></Link>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
