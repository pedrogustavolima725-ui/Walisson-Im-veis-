import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bell, BellRing, CalendarDays, CalendarX2, Check, Clock, FileSignature, GitCompareArrows, Heart, ImagePlus, Loader2, MapPin, Megaphone,
  MessageCircle, Phone, Search, Star, Trash2, UsersRound, X,
} from 'lucide-react';
import { api, qs, uploadImages } from '../lib/api';
import { useApi } from '../lib/hooks';
import {
  brl, dateShort, PAYMENT_LABEL, priceSuffix, PROPOSAL_LABEL, PURPOSE_LABEL, relative, STATUS_LABEL, time, TYPE_LABEL, VISIT_LABEL, weekday, whatsappLink,
} from '../lib/format';
import { useAuth, useCompare, useCounts, useToast } from '../context/app';
import { Avatar, Badge, Button, Card, cx, Empty, ErrorBox, Field, Img, Input, Modal, MoneyInput, PageHeader, PageLoader, Select, Skeleton, statusTone, Tabs, Textarea, Toggle } from '../components/ui';
import { Page } from '../components/layout';
import { PropertyCard, PropertyRow, simulate, type PropertySummary } from '../components/property';
import { Range } from './property';

/* ============================ Favoritos ============================ */
export function Favorites() {
  const { data, loading, error, reload } = useApi<PropertySummary[]>('/me/favorites');
  return (
    <Page wide>
      <PageHeader title="Favoritos" subtitle="Imóveis que você salvou. Avisamos se o preço baixar." />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[4/3.6] rounded-[26px]" />)}</div>
      ) : data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.map((p) => <PropertyCard key={p.id} p={p} />)}</div>
      ) : (
        <Empty icon={<Heart />} title="Nenhum favorito ainda" text="Toque no coração dos imóveis que você gostar para encontrá-los aqui." action={<Link to="/buscar"><Button>Explorar imóveis</Button></Link>} />
      )}
    </Page>
  );
}

/* ============================ Visitas ============================ */
type Visit = {
  id: number; scheduled_at: number; status: string; notes: string | null; feedback: string | null; rating: number | null;
  property_id: number; property_title: string; property_code: string; neighborhood: string; city: string; cover: string | null;
  agent_name: string | null; agent_phone: string | null;
};
export function Visits() {
  const { data, loading, reload } = useApi<Visit[]>('/me/visits');
  const toast = useToast();
  const [tab, setTab] = useState<'proximas' | 'anteriores'>('proximas');
  const [feedback, setFeedback] = useState<Visit | null>(null);
  const now = Date.now();
  const list = useMemo(() => {
    const all = data ?? [];
    return tab === 'proximas'
      ? all.filter((v) => v.scheduled_at >= now && ['agendada', 'confirmada'].includes(v.status))
      : all.filter((v) => v.scheduled_at < now || ['realizada', 'cancelada'].includes(v.status)).reverse();
  }, [data, tab, now]);
  const cancel = async (v: Visit) => {
    if (!confirm('Cancelar esta visita?')) return;
    try { await api(`/me/visits/${v.id}`, { method: 'PATCH', body: { status: 'cancelada' } }); toast('Visita cancelada.', 'info'); reload(); } catch (e: any) { toast(e.message, 'error'); }
  };
  return (
    <Page>
      <PageHeader title="Minhas visitas" subtitle="Acompanhe agendamentos e avalie as visitas realizadas." />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'proximas', label: 'Próximas' }, { value: 'anteriores', label: 'Histórico' }]} className="mb-5 w-fit" />
      {loading ? <PageLoader /> : !list.length ? (
        <Empty icon={<CalendarDays />} title={tab === 'proximas' ? 'Nenhuma visita agendada' : 'Sem histórico de visitas'} text="Encontre um imóvel e agende uma visita gratuita em poucos toques." action={<Link to="/buscar"><Button>Buscar imóveis</Button></Link>} />
      ) : (
        <div className="space-y-3">
          {list.map((v) => (
            <Card key={v.id} className="p-3">
              <div className="flex gap-3">
                <Link to={`/imovel/${v.property_id}`}><Img src={v.cover} alt={v.property_title} className="h-28 w-28 shrink-0 rounded-2xl sm:w-36" /></Link>
                <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/imovel/${v.property_id}`} className="line-clamp-1 font-semibold hover:text-accent">{v.property_title}</Link>
                      <Badge tone={statusTone(v.status)}>{VISIT_LABEL[v.status]}</Badge>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted"><MapPin className="size-3.5" />{v.neighborhood}, {v.city}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span className="flex items-center gap-1.5"><CalendarDays className="size-4 text-accent" />{weekday(v.scheduled_at)}, {dateShort(v.scheduled_at)}</span>
                    <span className="flex items-center gap-1.5"><Clock className="size-4 text-accent" />{time(v.scheduled_at)}</span>
                  </div>
                  {v.agent_name && <p className="mt-1 text-xs text-muted">Corretor(a): {v.agent_name}</p>}
                </div>
              </div>
              {tab === 'proximas' ? (
                <div className="mt-3 flex gap-2 border-t border-line pt-3">
                  {v.agent_phone && <a href={whatsappLink(v.agent_phone, `Olá! Sobre a visita ao imóvel ${v.property_code}...`)} target="_blank" rel="noopener noreferrer" className="flex-1"><Button variant="secondary" size="sm" className="w-full" icon={<Phone className="size-4" />}>Falar com corretor</Button></a>}
                  <Button variant="danger" size="sm" onClick={() => cancel(v)} icon={<CalendarX2 className="size-4" />}>Cancelar</Button>
                </div>
              ) : v.status === 'realizada' && (
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-sm">
                  {v.feedback ? (
                    <span className="flex items-center gap-1 text-muted">{Array.from({ length: v.rating ?? 0 }).map((_, i) => <Star key={i} className="size-4 fill-warning text-warning" />)} <span className="ml-2 line-clamp-1">“{v.feedback}”</span></span>
                  ) : (
                    <><span className="text-muted">Como foi a visita?</span><Button size="sm" variant="secondary" onClick={() => setFeedback(v)} icon={<Star className="size-4" />}>Avaliar</Button></>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <FeedbackModal visit={feedback} onClose={() => setFeedback(null)} onDone={() => { setFeedback(null); reload(); }} />
    </Page>
  );
}

function FeedbackModal({ visit, onClose, onDone }: { visit: Visit | null; onClose: () => void; onDone: () => void }) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const toast = useToast();
  const send = async () => {
    try { await api(`/me/visits/${visit!.id}`, { method: 'PATCH', body: { rating, feedback: text || 'Sem comentários.' } }); toast('Obrigado pela avaliação!'); onDone(); } catch (e: any) { toast(e.message, 'error'); }
  };
  return (
    <Modal open={!!visit} onClose={onClose} title="Avaliar visita">
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} aria-label={`${n} estrelas`}><Star className={cx('size-9', n <= rating ? 'fill-warning text-warning' : 'text-faint')} /></button>
        ))}
      </div>
      <Textarea className="mt-4" value={text} onChange={(e) => setText(e.target.value)} placeholder="O que achou do imóvel e do atendimento?" maxLength={1000} />
      <Button className="mt-4 w-full" onClick={send}>Enviar avaliação</Button>
    </Modal>
  );
}

/* ============================ Propostas ============================ */
type MyProposal = { id: number; value: number; payment: string; status: string; notes: string | null; valid_until: number | null; created_at: number; property_id: number; property_title: string; price: number; cover: string | null; agent_name: string | null };
export function Proposals() {
  const { data, loading } = useApi<MyProposal[]>('/me/my-proposals');
  return (
    <Page>
      <PageHeader title="Minhas propostas" subtitle="Acompanhe o andamento das suas negociações." />
      {loading ? <PageLoader /> : !data?.length ? (
        <Empty icon={<FileSignature />} title="Nenhuma proposta enviada" text="Encontrou o imóvel ideal? Envie uma proposta direto pela página dele." action={<Link to="/buscar"><Button>Buscar imóveis</Button></Link>} />
      ) : (
        <div className="space-y-3">
          {data.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex gap-3">
                <Img src={p.cover} alt="" className="size-20 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/imovel/${p.property_id}`} className="line-clamp-1 font-semibold hover:text-accent">{p.property_title}</Link>
                    <Badge tone={statusTone(p.status)}>{PROPOSAL_LABEL[p.status]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">Anunciado: {brl(p.price)}</p>
                  <p className="text-lg font-semibold tabular-nums">Sua oferta: {brl(p.value)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-muted">
                <span>{PAYMENT_LABEL[p.payment]}</span>
                <span>Enviada {relative(p.created_at)}</span>
                {p.valid_until && <span>Válida até {dateShort(p.valid_until)}</span>}
                {p.agent_name && <span>Corretor(a): {p.agent_name}</span>}
              </div>
              {p.notes && <p className="mt-2 rounded-2xl bg-surface-2 p-3 text-sm text-muted">{p.notes}</p>}
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}

/* ============================ Notificações ============================ */
type Notif = { id: number; type: string; title: string; body: string | null; link: string | null; read_at: number | null; created_at: number };
const NOTIF_ICON: Record<string, typeof Bell> = { visita: CalendarDays, mensagem: MessageCircle, proposta: FileSignature, preco: Heart, alerta: BellRing, lead: UsersRound, captacao: Megaphone };
export function Notifications() {
  const { data, loading, reload } = useApi<{ items: Notif[] }>('/me/notifications');
  const counts = useCounts();
  const { isStaff } = useAuth();
  const nav = useNavigate();
  const readAll = async () => { await api('/me/notifications/read', { body: {} }); reload(); counts.reload(); };
  const open = async (n: Notif) => {
    if (!n.read_at) { await api('/me/notifications/read', { body: { id: n.id } }).catch(() => {}); counts.reload(); }
    if (n.link) nav(isStaff && n.link.startsWith('/mensagens') ? `/crm${n.link}` : n.link);
    else reload();
  };
  return (
    <Page>
      <PageHeader title="Notificações" actions={<Button variant="ghost" size="sm" onClick={readAll} icon={<Check className="size-4" />}>Marcar todas como lidas</Button>} />
      {loading ? <PageLoader /> : !data?.items.length ? (
        <Empty icon={<Bell />} title="Tudo em dia" text="Você será avisado sobre visitas, mensagens, propostas e novos imóveis." />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {data.items.map((n) => {
            const I = NOTIF_ICON[n.type] ?? Bell;
            return (
              <button key={n.id} onClick={() => open(n)} className={cx('flex w-full items-start gap-3 p-4 text-left transition hover:bg-surface-2', !n.read_at && 'bg-accent-soft/40')}>
                <span className={cx('grid size-10 shrink-0 place-items-center rounded-2xl', n.type === 'seguranca' ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent')}><I className="size-[18px]" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><span className="font-semibold">{n.title}</span>{!n.read_at && <span className="size-2 rounded-full bg-accent" />}</span>
                  {n.body && <span className="mt-0.5 block text-sm text-muted">{n.body}</span>}
                  <span className="mt-1 block text-xs text-faint">{relative(n.created_at)}</span>
                </span>
              </button>
            );
          })}
        </Card>
      )}
    </Page>
  );
}

/* ============================ Alertas (buscas salvas) ============================ */
type Saved = { id: number; name: string; filters: Record<string, string>; alert: number; created_at: number };
export function Alerts() {
  const { data, loading, reload } = useApi<Saved[]>('/me/saved-searches');
  const toast = useToast();
  const describe = (f: Record<string, string>) =>
    [f.purpose && PURPOSE_LABEL[f.purpose], f.type && f.type.split(',').map((t) => TYPE_LABEL[t]).join(', '), f.city, f.bedrooms && `${f.bedrooms}+ quartos`, f.maxPrice && `até ${brl(Number(f.maxPrice), true)}`, f.q && `"${f.q}"`].filter(Boolean).join(' · ') || 'Todos os imóveis';
  return (
    <Page>
      <PageHeader title="Alertas de busca" subtitle="Receba notificações quando surgir um imóvel com o seu perfil." actions={<Link to="/buscar"><Button size="sm" icon={<Search className="size-4" />}>Nova busca</Button></Link>} />
      {loading ? <PageLoader /> : !data?.length ? (
        <Empty icon={<BellRing />} title="Nenhum alerta criado" text='Faça uma busca e toque em "Criar alerta" para ser avisado de novidades.' />
      ) : (
        <div className="space-y-3">
          {data.map((s) => (
            <Card key={s.id} className="flex items-center gap-4 p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent"><BellRing className="size-5" /></span>
              <Link to={`/buscar${qs(s.filters)}`} className="min-w-0 flex-1">
                <p className="font-semibold">{s.name}</p>
                <p className="truncate text-sm text-muted">{describe(s.filters)}</p>
              </Link>
              <Toggle checked={!!s.alert} onChange={async (v) => { await api(`/me/saved-searches/${s.id}`, { method: 'PATCH', body: { alert: v } }); reload(); }} />
              <button aria-label="Excluir alerta" onClick={async () => { await api(`/me/saved-searches/${s.id}`, { method: 'DELETE' }); toast('Alerta removido.', 'info'); reload(); }} className="grid size-9 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}

/* ============================ Comparar ============================ */
export function Compare() {
  const { ids, toggle, clear } = useCompare();
  const { data, loading } = useApi<{ items: (PropertySummary & { iptu: number; accepts_pets: number; furnished: number; suites: number })[] }>(ids.length ? `/properties?ids=${ids.join(',')}&limit=10` : null, [ids.join(',')]);
  const items = ids.map((id) => data?.items.find((p) => p.id === id)).filter(Boolean) as NonNullable<typeof data>['items'];
  const rows: [string, (p: (typeof items)[number]) => React.ReactNode][] = [
    ['Preço', (p) => <b>{brl(p.price)}{priceSuffix(p.purpose)}</b>],
    ['Preço/m²', (p) => (p.area ? brl(Math.round(p.price / p.area)) : '—')],
    ['Finalidade', (p) => PURPOSE_LABEL[p.purpose]],
    ['Tipo', (p) => TYPE_LABEL[p.type]],
    ['Localização', (p) => `${p.neighborhood}, ${p.city}`],
    ['Área', (p) => (p.area ? `${p.area} m²` : '—')],
    ['Quartos', (p) => `${p.bedrooms}${p.suites ? ` (${p.suites} suítes)` : ''}`],
    ['Banheiros', (p) => p.bathrooms],
    ['Vagas', (p) => p.parking],
    ['Condomínio', (p) => (p.condo_fee ? brl(p.condo_fee) : '—')],
    ['IPTU', (p) => (p.iptu ? brl(p.iptu) : '—')],
    ['Aceita pets', (p) => (p.accepts_pets ? 'Sim' : 'Não')],
    ['Mobiliado', (p) => (p.furnished ? 'Sim' : 'Não')],
    ['Status', (p) => STATUS_LABEL[p.status]],
  ];
  return (
    <Page wide>
      <PageHeader title="Comparar imóveis" subtitle="Compare até 3 imóveis lado a lado." actions={ids.length > 0 && <Button variant="ghost" size="sm" onClick={clear}>Limpar</Button>} />
      {!ids.length ? (
        <Empty icon={<GitCompareArrows />} title="Nenhum imóvel selecionado" text="Toque no ícone de comparar nos cards dos imóveis para adicioná-los aqui." action={<Link to="/buscar"><Button>Buscar imóveis</Button></Link>} />
      ) : loading ? <PageLoader /> : (
        <div className="overflow-x-auto rounded-3xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr>
                <th className="w-36 p-4" />
                {items.map((p) => (
                  <th key={p.id} className="p-4 text-left align-top font-normal">
                    <div className="relative">
                      <Img src={p.cover} alt={p.title} className="aspect-[4/3] w-full rounded-2xl" />
                      <button onClick={() => toggle(p.id)} aria-label="Remover" className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/50 text-white"><X className="size-4" /></button>
                    </div>
                    <Link to={`/imovel/${p.id}`} className="mt-3 line-clamp-2 block font-semibold hover:text-accent">{p.title}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(([label, fn]) => (
                <tr key={label}>
                  <td className="p-4 text-muted">{label}</td>
                  {items.map((p) => <td key={p.id} className="p-4">{fn(p)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}

/* ============================ Simulador ============================ */
export function Simulator() {
  const [params] = useSearchParams();
  const [price, setPrice] = useState(Number(params.get('valor')) || 800000);
  const [down, setDown] = useState(20);
  const [years, setYears] = useState(30);
  const [rate, setRate] = useState(11.5);
  const [income, setIncome] = useState(15000);
  const s = simulate(price, down, years, rate);
  const maxInstallment = income * 0.3;
  const ok = s.sacFirst <= maxInstallment;
  return (
    <Page>
      <PageHeader title="Simulador de financiamento" subtitle="Compare os sistemas SAC e Price e descubra quanto cabe no seu bolso." />
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Card className="space-y-6 p-5 md:p-6">
          <Field label="Valor do imóvel (R$)"><Input type="number" min={50000} step={10000} value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} className="text-lg font-semibold" /></Field>
          <Range label="Entrada" value={down} min={5} max={90} step={5} onChange={setDown} display={`${down}% · ${brl(price * down / 100)}`} />
          <Range label="Prazo" value={years} min={5} max={35} step={1} onChange={setYears} display={`${years} anos (${years * 12} meses)`} />
          <Range label="Taxa de juros anual" value={rate} min={6} max={16} step={0.1} onChange={setRate} display={`${rate.toFixed(1).replace('.', ',')}% a.a.`} />
          <Field label="Renda familiar bruta mensal (R$)"><Input type="number" min={0} step={500} value={income} onChange={(e) => setIncome(Number(e.target.value) || 0)} /></Field>
        </Card>
        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-sm text-muted">Valor financiado</p>
            <p className="text-3xl font-semibold tabular-nums">{brl(Math.round(s.principal))}</p>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl bg-surface-2 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">SAC</p>
                <p className="mt-1 text-sm text-muted">1ª parcela <b className="text-text tabular-nums">{brl(Math.round(s.sacFirst))}</b> → última <b className="text-text tabular-nums">{brl(Math.round(s.sacLast))}</b></p>
                <p className="mt-1 text-xs text-faint">Total pago: {brl(Math.round(s.sacTotal))}</p>
              </div>
              <div className="rounded-2xl bg-surface-2 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-info">Price</p>
                <p className="mt-1 text-sm text-muted">Parcela fixa <b className="text-text tabular-nums">{brl(Math.round(s.priceInstallment))}</b></p>
                <p className="mt-1 text-xs text-faint">Total pago: {brl(Math.round(s.priceTotal))}</p>
              </div>
            </div>
          </Card>
          <Card className={cx('p-5', ok ? 'border-success/30' : 'border-warning/30')}>
            <p className={cx('font-semibold', ok ? 'text-success' : 'text-warning')}>{ok ? 'Cabe no seu orçamento ✓' : 'Atenção ao comprometimento de renda'}</p>
            <p className="mt-1 text-sm text-muted">Bancos costumam limitar a parcela a 30% da renda ({brl(Math.round(maxInstallment))}). Renda sugerida: <b className="text-text">{brl(Math.round(s.minIncome))}</b>.</p>
            <Link to={`/buscar?purpose=venda&financing=1&maxPrice=${Math.round(price)}`}><Button variant="secondary" className="mt-4 w-full">Ver imóveis até {brl(price, true)}</Button></Link>
          </Card>
          <p className="text-xs text-faint">Simulação ilustrativa, não considera seguros (MIP/DFI), taxas administrativas ou TR. Valores sujeitos à análise de crédito da instituição financeira.</p>
        </div>
      </div>
    </Page>
  );
}

/* ============================ Corretores ============================ */
type Agent = { id: number; name: string; avatar: string | null; bio: string | null; phone: string | null; listings: number; rating: number | null };
export function Agents() {
  const { data, loading } = useApi<Agent[]>('/agents');
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const chat = async (a: Agent) => {
    if (!user) return nav('/entrar', { state: { from: '/corretores' } });
    try {
      const r = await api<{ id: number }>('/me/conversations', { body: { agentId: a.id, message: `Olá, ${a.name.split(' ')[0]}! Gostaria de ajuda para encontrar um imóvel.` } });
      nav(`/mensagens/${r.id}`);
    } catch (e: any) { toast(e.message, 'error'); }
  };
  return (
    <Page>
      <PageHeader title="Nossos corretores" subtitle="Profissionais credenciados no CRECI, prontos para te ajudar." />
      {loading ? <PageLoader /> : !data?.length ? (
        <Empty icon={<UsersRound />} title="Equipe em formação" text="Em breve você poderá conversar com nossos corretores por aqui." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((a) => (
            <Card key={a.id} className="flex flex-col items-center p-6 text-center">
              <Avatar name={a.name} src={a.avatar} size={80} />
              <h3 className="mt-3 text-lg font-semibold">{a.name}</h3>
              <p className="text-xs text-muted">Corretor(a)</p>
              <div className="mt-2 flex items-center gap-3 text-sm">
                {a.rating && <span className="flex items-center gap-1"><Star className="size-4 fill-warning text-warning" />{a.rating.toFixed(1)}</span>}
                <span className="text-muted">{a.listings} imóveis</span>
              </div>
              {a.bio && <p className="mt-3 text-sm text-muted">{a.bio}</p>}
              <div className="mt-5 flex w-full gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => chat(a)} icon={<MessageCircle className="size-4" />}>Conversar</Button>
                {a.phone && <a href={whatsappLink(a.phone, 'Olá! Vim pelo app da Walisson Imóveis.')} target="_blank" rel="noopener noreferrer" className="flex-1"><Button className="w-full" icon={<Phone className="size-4" />}>WhatsApp</Button></a>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}

/* ============================ Anunciar imóvel ============================ */
export function Announce() {
  const toast = useToast();
  const mine = useApi<PropertySummary[]>('/properties/mine/submissions');
  const [f, setF] = useState({ title: '', purpose: 'venda', type: 'casa', price: '', bedrooms: '2', bathrooms: '1', parking: '1', area: '', neighborhood: '', city: '', state: '', address: '', description: '' });
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try { const urls = await uploadImages(files); setImages((cur) => [...cur, ...urls].slice(0, 12)); } catch (e: any) { toast(e.message, 'error'); } finally { setUploading(false); }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setFields({});
    try {
      await api('/properties/submit', { body: { ...f, price: Number(f.price), bedrooms: Number(f.bedrooms), bathrooms: Number(f.bathrooms), parking: Number(f.parking), area: Number(f.area) || 0, images } });
      toast('Imóvel enviado! Nossa equipe fará a avaliação e entrará em contato.');
      setF({ ...f, title: '', price: '', area: '', description: '', address: '' });
      setImages([]);
      mine.reload();
    } catch (e: any) { setFields(e.fields ?? {}); toast(e.message, 'error'); } finally { setLoading(false); }
  };
  return (
    <Page>
      <PageHeader title="Anunciar meu imóvel" subtitle="Venda ou alugue com a Walisson Imóveis. Avaliação gratuita e fotos profissionais." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="p-5 md:p-6">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Título do anúncio" error={fields.title}><Input value={f.title} onChange={set('title')} placeholder="Ex.: Casa com quintal perto do centro" maxLength={140} /></Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Finalidade"><Select value={f.purpose} onChange={set('purpose')}>{Object.entries(PURPOSE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
              <Field label="Tipo"><Select value={f.type} onChange={set('type')}>{Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
              <Field label="Valor pretendido" error={fields.price}><MoneyInput value={f.price} onChange={(v) => setF({ ...f, price: v })} invalid={!!fields.price} placeholder="0" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Quartos"><Input type="number" min={0} value={f.bedrooms} onChange={set('bedrooms')} /></Field>
              <Field label="Banheiros"><Input type="number" min={0} value={f.bathrooms} onChange={set('bathrooms')} /></Field>
              <Field label="Vagas"><Input type="number" min={0} value={f.parking} onChange={set('parking')} /></Field>
              <Field label="Área (m²)"><Input inputMode="numeric" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value.replace(/\D/g, '').slice(0, 7) })} /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_90px]">
              <Field label="Bairro"><Input value={f.neighborhood} onChange={set('neighborhood')} /></Field>
              <Field label="Cidade" error={fields.city}><Input value={f.city} onChange={set('city')} /></Field>
              <Field label="UF"><Input value={f.state} onChange={set('state')} maxLength={2} className="uppercase" /></Field>
            </div>
            <Field label="Endereço (visível apenas para a equipe)"><Input value={f.address} onChange={set('address')} /></Field>
            <Field label="Descrição"><Textarea value={f.description} onChange={set('description')} maxLength={5000} placeholder="Conte os diferenciais do imóvel..." /></Field>
            <div>
              <p className="mb-2 text-[13px] font-medium text-muted">Fotos (JPG, PNG ou WEBP · até 8 MB cada)</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {images.map((u) => (
                  <div key={u} className="relative aspect-square overflow-hidden rounded-2xl">
                    <Img src={u} alt="" className="size-full" />
                    <button type="button" onClick={() => setImages(images.filter((x) => x !== u))} aria-label="Remover foto" className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white"><X className="size-3.5" /></button>
                  </div>
                ))}
                <label className="grid aspect-square cursor-pointer place-items-center rounded-2xl border border-dashed border-line-strong text-muted hover:text-text">
                  {uploading ? <Loader2 className="size-6 animate-spin" /> : <span className="flex flex-col items-center gap-1 text-xs"><ImagePlus className="size-6" />Adicionar</span>}
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} />
                </label>
              </div>
            </div>
            <Button type="submit" size="lg" className="w-full" loading={loading || uploading} disabled={uploading}>{uploading ? 'Enviando fotos…' : 'Enviar para avaliação'}</Button>
          </form>
        </Card>
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold">Como funciona</h3>
            <ol className="mt-3 space-y-3 text-sm text-muted">
              {['Você envia os dados e fotos do imóvel.', 'Um corretor entra em contato e agenda a avaliação.', 'Fazemos fotos profissionais e publicamos o anúncio.', 'Você acompanha visitas e propostas pelo app.'].map((t, i) => (
                <li key={t} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">{i + 1}</span>{t}</li>
              ))}
            </ol>
          </Card>
          {!!mine.data?.length && (
            <div>
              <h3 className="mb-3 font-semibold">Meus anúncios</h3>
              <div className="space-y-3">
                {mine.data.map((p) => <PropertyRow key={p.id} p={p} right={<Badge tone={statusTone(p.status)}>{STATUS_LABEL[p.status]}</Badge>} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

export function NotFound() {
  return (
    <Page>
      <div className="py-20">
        <Empty icon={<Search />} title="Página não encontrada" text="O endereço pode ter mudado ou o imóvel não está mais disponível." action={<Link to="/"><Button>Voltar ao início</Button></Link>} />
      </div>
    </Page>
  );
}

