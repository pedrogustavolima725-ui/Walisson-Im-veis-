import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Bath, BedDouble, CalendarCheck, Car, Check, ChevronLeft, ChevronRight, Eye, FileSignature, GitCompareArrows, MapPin, Maximize2,
  MessageCircle, Phone, Share2, ShieldCheck, Sparkles, X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { brl, maskPhone, PAYMENT_LABEL, priceSuffix, PURPOSE_LABEL, STATUS_LABEL, time, TYPE_LABEL, weekday, whatsappLink } from '../lib/format';
import { useAuth, useCompare, useToast } from '../context/app';
import { Avatar, BackButton, Badge, Button, Card, cx, ErrorBox, Field, IconButton, Img, Input, Modal, PageLoader, Select, SectionTitle, statusTone, Textarea } from '../components/ui';
import { Page } from '../components/layout';
import { FavButton, MapView, PropertyCard, simulate, type PropertySummary } from '../components/property';

interface Detail extends PropertySummary {
  description: string;
  features: string[];
  images: { id: number; url: string }[];
  iptu: number;
  condo_fee: number;
  suites: number;
  land_area: number;
  accepts_financing: number;
  accepts_pets: number;
  furnished: number;
  agent: { id: number; name: string; email: string; phone: string | null; avatar: string | null; creci: string | null; bio: string | null } | null;
  similar: PropertySummary[];
}

export function PropertyPage() {
  const { id } = useParams();
  const { data: p, loading, error, reload } = useApi<Detail>(`/properties/${id}`, [id]);
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const cmp = useCompare();
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [modal, setModal] = useState<null | 'visit' | 'interest' | 'proposal' | 'chat'>(null);

  useEffect(() => { setIdx(0); }, [id]);

  if (loading && !p) return <PageLoader />;
  if (error || !p) return <Page><ErrorBox message={error ?? 'Imóvel não encontrado.'} onRetry={reload} /></Page>;

  const images = p.images.length ? p.images : [{ id: 0, url: '' }];
  const requireLogin = (m: typeof modal) => {
    if (!user) {
      toast('Entre ou crie sua conta para continuar.', 'info');
      return nav('/entrar', { state: { from: `/imovel/${p.id}` } });
    }
    setModal(m);
  };
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: p.title, text: `${p.title} — ${brl(p.price)}`, url });
      else { await navigator.clipboard.writeText(url); toast('Link copiado!', 'info'); }
    } catch { /* cancelado */ }
  };
  const total = p.price + (p.purpose === 'aluguel' ? p.condo_fee + p.iptu : 0);
  const available = p.status === 'disponivel' || p.status === 'reservado';

  return (
    <div className="pb-28 lg:pb-0">
      {/* Galeria */}
      <div className="mx-auto max-w-[1400px] lg:px-10 lg:pt-8">
        <div className="relative lg:grid lg:grid-cols-4 lg:grid-rows-2 lg:gap-3">
          <button onClick={() => setLightbox(true)} className="relative block aspect-[4/3.4] w-full overflow-hidden sm:aspect-[16/9] lg:col-span-2 lg:row-span-2 lg:aspect-auto lg:h-[520px] lg:rounded-[32px]" aria-label="Abrir galeria">
            <Img src={images[idx].url} alt={p.title} className="absolute inset-0 size-full" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent lg:hidden" />
          </button>
          {images.slice(1, 5).map((im, i) => (
            <button key={im.id} onClick={() => { setIdx(i + 1); setLightbox(true); }} className="relative hidden overflow-hidden rounded-[24px] lg:block">
              <Img src={im.url} alt={`${p.title} — foto ${i + 2}`} className="absolute inset-0 size-full transition duration-500 hover:scale-105" />
              {i === 3 && images.length > 5 && <span className="absolute inset-0 grid place-items-center bg-black/50 text-sm font-semibold text-white">+{images.length - 5} fotos</span>}
            </button>
          ))}
          <div className="absolute inset-x-4 top-[max(16px,env(safe-area-inset-top))] flex items-center justify-between lg:inset-x-4 lg:top-4">
            <BackButton />
            <div className="flex gap-2">
              <IconButton label="Comparar" onClick={() => cmp.toggle(p.id)} className={cx(cmp.has(p.id) && 'bg-primary! text-primary-ink!')}><GitCompareArrows className="size-[18px]" /></IconButton>
              <IconButton label="Compartilhar" onClick={share}><Share2 className="size-[18px]" /></IconButton>
              <FavButton id={p.id} initial={p.favorite} plain className="size-11" />
            </div>
          </div>
          <div className="absolute bottom-10 right-4 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur lg:hidden">{idx + 1}/{images.length}</div>
          {images.length > 1 && (
            <div className="absolute bottom-10 left-4 flex gap-2 lg:hidden">
              <button onClick={() => setIdx((idx - 1 + images.length) % images.length)} aria-label="Foto anterior" className="grid size-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur"><ChevronLeft className="size-4" /></button>
              <button onClick={() => setIdx((idx + 1) % images.length)} aria-label="Próxima foto" className="grid size-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur"><ChevronRight className="size-4" /></button>
            </div>
          )}
        </div>
      </div>

      <Page wide className="relative -mt-6 rounded-t-[32px] bg-bg pt-6 lg:mt-0 lg:rounded-none lg:bg-transparent">
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{PURPOSE_LABEL[p.purpose]}</Badge>
              <Badge>{TYPE_LABEL[p.type]}</Badge>
              {p.status !== 'disponivel' && <Badge tone={statusTone(p.status)}>{STATUS_LABEL[p.status]}</Badge>}
              <span className="text-xs text-faint">Cód. {p.code}</span>
              <span className="ml-auto flex items-center gap-1 text-xs text-faint"><Eye className="size-3.5" />{p.views} visualizações</span>
            </div>
            <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-tight md:text-[34px]">{p.title}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted"><MapPin className="size-4" />{p.neighborhood}, {p.city} - {p.state}</p>

            <div className="mt-6 grid grid-cols-4 gap-2 sm:gap-3">
              {[
                { icon: BedDouble, v: p.bedrooms, l: p.suites ? `${p.suites} suíte${p.suites > 1 ? 's' : ''}` : 'Quartos' },
                { icon: Bath, v: p.bathrooms, l: 'Banheiros' },
                { icon: Maximize2, v: p.area || p.land_area, l: 'm²' },
                { icon: Car, v: p.parking, l: 'Vagas' },
              ].map(({ icon: I, v, l }) => (
                <div key={l} className="flex flex-col items-center gap-1.5 rounded-3xl border border-line bg-surface py-4">
                  <I className="size-5 text-accent" />
                  <span className="text-[15px] font-semibold tabular-nums">{v}</span>
                  <span className="text-[11px] text-muted">{l}</span>
                </div>
              ))}
            </div>

            {/* Preço (mobile) */}
            <Card className="mt-6 flex items-center justify-between gap-4 p-5 lg:hidden">
              <div>
                <p className="text-xs text-muted">{p.purpose === 'venda' ? 'Valor de venda' : p.purpose === 'aluguel' ? 'Aluguel' : 'Diária'}</p>
                <p className="text-2xl font-semibold tabular-nums">{brl(p.price)}<span className="text-sm font-normal text-muted">{priceSuffix(p.purpose)}</span></p>
              </div>
              {available && <Button onClick={() => requireLogin('visit')}>Agendar visita</Button>}
            </Card>

            <section className="mt-8">
              <SectionTitle title="Sobre o imóvel" />
              <p className={cx('whitespace-pre-line text-[15px] leading-relaxed text-muted', !expanded && 'line-clamp-4')}>{p.description || 'Descrição em breve.'}</p>
              {p.description.length > 220 && <button onClick={() => setExpanded((e) => !e)} className="mt-2 text-sm font-semibold text-accent">{expanded ? 'Ver menos' : 'Ler mais'}</button>}
            </section>

            {p.features.length > 0 && (
              <section className="mt-8">
                <SectionTitle title="Diferenciais" />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {p.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5 text-sm"><Check className="size-4 shrink-0 text-success" />{f}</div>
                  ))}
                  {!!p.accepts_pets && <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5 text-sm"><Check className="size-4 text-success" />Aceita pets</div>}
                  {!!p.furnished && <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5 text-sm"><Check className="size-4 text-success" />Mobiliado</div>}
                </div>
              </section>
            )}

            <section className="mt-8">
              <SectionTitle title="Custos" />
              <Card className="divide-y divide-line">
                {[
                  [p.purpose === 'venda' ? 'Valor do imóvel' : p.purpose === 'aluguel' ? 'Aluguel' : 'Diária', p.price],
                  ['Condomínio', p.condo_fee],
                  ['IPTU (mensal)', p.iptu],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between px-5 py-3.5 text-sm"><span className="text-muted">{l}</span><span className="font-medium tabular-nums">{(v as number) ? brl(v as number) : 'Isento / não informado'}</span></div>
                ))}
                {p.purpose === 'aluguel' && <div className="flex justify-between px-5 py-3.5 text-sm font-semibold"><span>Total mensal</span><span className="tabular-nums text-accent">{brl(total)}</span></div>}
              </Card>
            </section>

            {p.purpose === 'venda' && !!p.accepts_financing && <InlineSimulator price={p.price} />}

            {p.lat && p.lng && (
              <section className="mt-8">
                <SectionTitle title="Localização" />
                <MapView points={[{ id: p.id, lat: p.lat, lng: p.lng, label: p.neighborhood || p.city }]} zoom={14} className="h-64 md:h-80" />
                <p className="mt-2 text-xs text-faint">Localização aproximada. O endereço exato é informado pelo corretor no agendamento da visita.</p>
              </section>
            )}
          </div>

          {/* Coluna lateral */}
          <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
            <Card className="hidden p-6 lg:block">
              <p className="text-sm text-muted">{p.purpose === 'venda' ? 'Valor de venda' : p.purpose === 'aluguel' ? 'Aluguel mensal' : 'Diária'}</p>
              <p className="mt-1 text-[32px] font-semibold tracking-tight tabular-nums">{brl(p.price)}</p>
              {p.purpose === 'aluguel' && <p className="text-sm text-muted">Total com taxas: {brl(total)}/mês</p>}
              {available ? (
                <div className="mt-5 space-y-2">
                  <Button size="lg" className="w-full" icon={<CalendarCheck className="size-5" />} onClick={() => requireLogin('visit')}>Agendar visita</Button>
                  <Button size="lg" variant="outline" className="w-full" icon={<FileSignature className="size-5" />} onClick={() => requireLogin('proposal')}>Fazer proposta</Button>
                  {!user && <Button size="lg" variant="ghost" className="w-full" onClick={() => setModal('interest')}>Quero mais informações</Button>}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-surface-2 p-3 text-sm text-muted">Este imóvel não está mais disponível. Veja opções semelhantes abaixo.</p>
              )}
              <div className="mt-5 flex items-center gap-2 text-xs text-muted"><ShieldCheck className="size-4 text-success" />Negociação intermediada e documentação verificada</div>
            </Card>

            {p.agent && (
              <Card className="p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">Corretor responsável</p>
                <div className="flex items-center gap-3">
                  <Avatar name={p.agent.name} src={p.agent.avatar} size={52} />
                  <div className="min-w-0">
                    <p className="font-semibold">{p.agent.name}</p>
                    <p className="text-xs text-muted">{p.agent.creci}</p>
                  </div>
                </div>
                {p.agent.bio && <p className="mt-3 text-sm text-muted">{p.agent.bio}</p>}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button onClick={() => requireLogin('chat')} className="flex flex-col items-center gap-1 rounded-2xl bg-surface-2 py-3 text-xs font-medium hover:bg-surface-3"><MessageCircle className="size-5 text-accent" />Chat</button>
                  <a href={whatsappLink(p.agent.phone, `Olá! Tenho interesse no imóvel ${p.code} — ${p.title}`)} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 rounded-2xl bg-surface-2 py-3 text-xs font-medium hover:bg-surface-3">
                    <svg viewBox="0 0 24 24" className="size-5 fill-success" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7a11.4 11.4 0 0 1-4.4-3.9 5 5 0 0 1-1-2.7c0-1.3.7-1.9 1-2.2.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.4.6-.4.4c-.1.1-.2.3-.1.5.2.3.8 1.3 1.7 2.1 1.1 1 2 1.3 2.3 1.4.3.2.5.1.6 0l.9-1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.1.1.7-.1 1.4Z" /></svg>
                    WhatsApp
                  </a>
                  <a href={p.agent.phone ? `tel:${p.agent.phone.replace(/\D/g, '')}` : undefined} className="flex flex-col items-center gap-1 rounded-2xl bg-surface-2 py-3 text-xs font-medium hover:bg-surface-3"><Phone className="size-5 text-info" />Ligar</a>
                </div>
              </Card>
            )}
          </aside>
        </div>

        {p.similar.length > 0 && (
          <section className="mt-12">
            <SectionTitle title="Imóveis semelhantes" />
            <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:px-0">
              {p.similar.slice(0, 6).map((s) => <PropertyCard key={s.id} p={s} className="w-[80vw] shrink-0 sm:w-[340px] lg:w-auto" />)}
            </div>
          </section>
        )}
      </Page>

      {/* Barra fixa mobile */}
      {available && (
        <div className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 lg:hidden">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <Button variant="secondary" className="shrink-0" onClick={() => requireLogin('proposal')} aria-label="Fazer proposta"><FileSignature className="size-5" /></Button>
            <Button variant="secondary" className="shrink-0" onClick={() => (user ? setModal('chat') : setModal('interest'))} aria-label="Falar com corretor"><MessageCircle className="size-5" /></Button>
            <Button size="lg" className="flex-1" onClick={() => requireLogin('visit')}>Agendar visita</Button>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Galeria de fotos">
          <div className="flex items-center justify-between p-4 text-white">
            <span className="text-sm">{idx + 1} / {images.length}</span>
            <button onClick={() => setLightbox(false)} aria-label="Fechar galeria" className="grid size-10 place-items-center rounded-full bg-white/10"><X className="size-5" /></button>
          </div>
          <div className="relative flex-1">
            <Img src={images[idx].url} alt={p.title} className="absolute inset-0 size-full object-contain!" />
            <button onClick={() => setIdx((idx - 1 + images.length) % images.length)} aria-label="Anterior" className="absolute left-3 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white"><ChevronLeft /></button>
            <button onClick={() => setIdx((idx + 1) % images.length)} aria-label="Próxima" className="absolute right-3 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white"><ChevronRight /></button>
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto p-4">
            {images.map((im, i) => (
              <button key={im.id} onClick={() => setIdx(i)} className={cx('h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2', i === idx ? 'border-[#d8bb92]' : 'border-transparent opacity-60')}>
                <Img src={im.url} alt="" className="size-full" />
              </button>
            ))}
          </div>
        </div>
      )}

      <ScheduleVisit open={modal === 'visit'} onClose={() => setModal(null)} property={p} />
      <InterestForm open={modal === 'interest'} onClose={() => setModal(null)} property={p} />
      <ProposalForm open={modal === 'proposal'} onClose={() => setModal(null)} property={p} />
      <StartChat open={modal === 'chat'} onClose={() => setModal(null)} property={p} />
    </div>
  );
}

/* ---------------- Simulador embutido ---------------- */
function InlineSimulator({ price }: { price: number }) {
  const [down, setDown] = useState(20);
  const [years, setYears] = useState(30);
  const [rate, setRate] = useState(11.5);
  const s = simulate(price, down, years, rate);
  return (
    <section className="mt-8">
      <SectionTitle title="Simule o financiamento" action="Simulador completo" to={`/simulador?valor=${price}`} />
      <Card className="p-5">
        <div className="grid gap-5 sm:grid-cols-3">
          <Range label="Entrada" value={down} min={10} max={80} step={5} onChange={setDown} display={`${down}% · ${brl(price * down / 100, true)}`} />
          <Range label="Prazo" value={years} min={5} max={35} step={1} onChange={setYears} display={`${years} anos`} />
          <Range label="Juros a.a." value={rate} min={7} max={16} step={0.25} onChange={setRate} display={`${rate.toFixed(2).replace('.', ',')}%`} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface-2 p-4"><p className="text-xs text-muted">1ª parcela (SAC)</p><p className="mt-1 text-xl font-semibold tabular-nums">{brl(Math.round(s.sacFirst))}</p></div>
          <div className="rounded-2xl bg-surface-2 p-4"><p className="text-xs text-muted">Parcela fixa (Price)</p><p className="mt-1 text-xl font-semibold tabular-nums">{brl(Math.round(s.priceInstallment))}</p></div>
        </div>
        <p className="mt-3 text-xs text-faint">Renda familiar sugerida: {brl(Math.round(s.minIncome))}. Simulação ilustrativa, sujeita à análise de crédito.</p>
      </Card>
    </section>
  );
}

export function Range({ label, value, min, max, step, onChange, display }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; display: string }) {
  return (
    <label className="block">
      <div className="mb-2 flex justify-between text-sm"><span className="text-muted">{label}</span><span className="font-semibold tabular-nums">{display}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
    </label>
  );
}

/* ---------------- Agendamento de visita ---------------- */
const HOURS = [9, 10, 11, 14, 15, 16, 17];
function ScheduleVisit({ open, onClose, property }: { open: boolean; onClose: () => void; property: Detail }) {
  const toast = useToast();
  const nav = useNavigate();
  const [day, setDay] = useState(0);
  const [hour, setHour] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [taken, setTaken] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const days = useMemo(() => {
    const out: Date[] = [];
    const d = new Date(); d.setHours(0, 0, 0, 0);
    for (let i = 1; out.length < 10; i++) {
      const x = new Date(d); x.setDate(d.getDate() + i);
      if (x.getDay() !== 0) out.push(x); // sem domingos
    }
    return out;
  }, []);
  useEffect(() => {
    if (!open) return;
    setHour(null);
    api<{ taken: number[] }>(`/me/visits/slots/${property.id}`).then((r) => setTaken(r.taken)).catch(() => {});
  }, [open, property.id]);
  const slot = (h: number) => { const d = new Date(days[day]); d.setHours(h, 0, 0, 0); return +d; };
  const confirm = async () => {
    if (hour === null) return;
    setLoading(true);
    try {
      await api('/me/visits', { body: { propertyId: property.id, scheduledAt: slot(hour), notes: notes || undefined } });
      toast('Visita solicitada! O corretor vai confirmar em breve.');
      onClose();
      nav('/visitas');
    } catch (e: any) { toast(e.message, 'error'); } finally { setLoading(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Agendar visita">
      <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-2.5">
        <Img src={property.images[0]?.url} alt="" className="size-14 shrink-0 rounded-xl" />
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{property.title}</p><p className="text-xs text-muted">{property.neighborhood}, {property.city}</p></div>
      </div>
      <p className="mb-2 mt-5 text-sm font-semibold">Escolha o dia</p>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
        {days.map((d, i) => (
          <button key={+d} onClick={() => { setDay(i); setHour(null); }} className={cx('flex h-[72px] w-16 shrink-0 flex-col items-center justify-center rounded-2xl border text-xs transition', i === day ? 'border-transparent bg-primary text-primary-ink' : 'border-line bg-surface-2 text-muted')}>
            <span className="capitalize">{weekday(+d)}</span>
            <span className="text-lg font-semibold">{d.getDate()}</span>
            <span className="capitalize">{d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
          </button>
        ))}
      </div>
      <p className="mb-2 mt-5 text-sm font-semibold">Horário</p>
      <div className="grid grid-cols-4 gap-2">
        {HOURS.map((h) => {
          const busy = taken.includes(slot(h));
          return (
            <button key={h} disabled={busy} onClick={() => setHour(h)} className={cx('h-11 rounded-2xl border text-sm font-medium transition disabled:cursor-not-allowed disabled:line-through disabled:opacity-40', hour === h ? 'border-transparent bg-primary text-primary-ink' : 'border-line bg-surface-2')}>
              {time(slot(h))}
            </button>
          );
        })}
      </div>
      <Field label="Observações (opcional)" className="mt-5"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Ex.: vou com minha família, prefiro que o corretor me ligue antes." className="min-h-20" /></Field>
      <div className="mt-5 flex items-center justify-between gap-4 border-t border-line pt-4">
        <div className="text-sm"><p className="text-muted">Visita gratuita</p><p className="font-semibold">{hour !== null ? `${weekday(slot(hour))}, ${days[day].getDate()} às ${hour}h` : 'Selecione um horário'}</p></div>
        <Button disabled={hour === null} loading={loading} onClick={confirm} icon={<CalendarCheck className="size-4" />}>Confirmar</Button>
      </div>
    </Modal>
  );
}

/* ---------------- Interesse (visitante sem conta) ---------------- */
function InterestForm({ open, onClose, property }: { open: boolean; onClose: () => void; property: Detail }) {
  const { user } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ name: '', email: '', phone: '', message: `Olá! Tenho interesse no imóvel ${property.code}. Gostaria de mais informações.`, website: '' });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const send = async () => {
    setLoading(true); setFields({});
    try {
      await api(`/properties/${property.id}/interest`, { body: user ? { message: f.message } : f });
      toast('Recebemos seu contato! Um corretor falará com você em breve.');
      onClose();
    } catch (e: any) { setFields(e.fields ?? {}); toast(e.message, 'error'); } finally { setLoading(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Fale com um corretor">
      <div className="space-y-3">
        {!user && (
          <>
            <Field label="Nome" error={fields.name}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="E-mail" error={fields.email}><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></Field>
              <Field label="Telefone" error={fields.phone}><Input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: maskPhone(e.target.value) })} autoComplete="tel" /></Field>
            </div>
            {/* honeypot anti-spam: invisível para humanos */}
            <input tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} name="website" />
          </>
        )}
        <Field label="Mensagem" error={fields.message}><Textarea value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} maxLength={1000} /></Field>
        <p className="text-xs text-faint">Ao enviar, você concorda em ser contatado sobre este imóvel conforme nossa <Link to="/termos" className="underline">Política de Privacidade</Link>.</p>
        <Button className="w-full" loading={loading} onClick={send}>Enviar</Button>
      </div>
    </Modal>
  );
}

/* ---------------- Proposta ---------------- */
function ProposalForm({ open, onClose, property }: { open: boolean; onClose: () => void; property: Detail }) {
  const toast = useToast();
  const nav = useNavigate();
  const [value, setValue] = useState(String(Math.round(property.price * (property.purpose === 'venda' ? 0.95 : 1))));
  const [payment, setPayment] = useState(property.purpose === 'venda' ? 'financiamento' : 'a_vista');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const v = Number(value) || 0;
  const diff = v && property.price ? ((v - property.price) / property.price) * 100 : 0;
  const send = async () => {
    setLoading(true);
    try {
      await api('/me/my-proposals', { body: { propertyId: property.id, value: v, payment, notes: notes || undefined } });
      toast('Proposta enviada! Acompanhe a resposta em "Propostas".');
      onClose();
      nav('/propostas');
    } catch (e: any) { toast(e.message, 'error'); } finally { setLoading(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Fazer proposta">
      <p className="text-sm text-muted">Valor anunciado: <b className="text-text">{brl(property.price)}{priceSuffix(property.purpose)}</b></p>
      <div className="mt-4 space-y-4">
        <Field label="Sua oferta (R$)" hint={diff ? `${diff > 0 ? '+' : ''}${diff.toFixed(1).replace('.', ',')}% em relação ao anunciado` : undefined}>
          <Input type="number" inputMode="numeric" min={1} value={value} onChange={(e) => setValue(e.target.value)} className="text-lg font-semibold" />
        </Field>
        {property.purpose === 'venda' && (
          <Field label="Forma de pagamento">
            <Select value={payment} onChange={(e) => setPayment(e.target.value)}>
              {Object.entries(PAYMENT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Condições / observações"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="Ex.: entrada de 30%, prazo para mudança..." className="min-h-20" /></Field>
        <div className="flex items-start gap-2 rounded-2xl bg-surface-2 p-3 text-xs text-muted"><Sparkles className="mt-0.5 size-4 shrink-0 text-accent" />Sua proposta é enviada ao corretor e ao proprietário. Ela não é vinculante até a assinatura do contrato.</div>
        <Button className="w-full" size="lg" loading={loading} disabled={!v} onClick={send}>Enviar proposta</Button>
      </div>
    </Modal>
  );
}

/* ---------------- Chat ---------------- */
function StartChat({ open, onClose, property }: { open: boolean; onClose: () => void; property: Detail }) {
  const nav = useNavigate();
  const toast = useToast();
  const [msg, setMsg] = useState(`Olá! Tenho interesse no imóvel ${property.code} — ${property.title}.`);
  const [loading, setLoading] = useState(false);
  const send = async () => {
    setLoading(true);
    try {
      const r = await api<{ id: number }>('/me/conversations', { body: { propertyId: property.id, message: msg } });
      nav(`/mensagens/${r.id}`);
    } catch (e: any) { toast(e.message, 'error'); } finally { setLoading(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={`Conversar com ${property.agent?.name.split(' ')[0] ?? 'o corretor'}`}>
      <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={2000} />
      <Button className="mt-4 w-full" loading={loading} onClick={send} icon={<MessageCircle className="size-4" />}>Enviar mensagem</Button>
    </Modal>
  );
}
