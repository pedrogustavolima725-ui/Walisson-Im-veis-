import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bath, BedDouble, Car, GitCompareArrows, Heart, MapPin, Maximize2, ShieldCheck } from 'lucide-react';
import type * as Leaflet from 'leaflet';
import { api } from '../lib/api';
import { brl, priceSuffix, PURPOSE_LABEL, STATUS_LABEL, TYPE_LABEL } from '../lib/format';
import { useAuth, useCompare, useToast } from '../context/app';
import { Badge, cx, Img, statusTone } from './ui';

export interface PropertySummary {
  id: number;
  code: string;
  title: string;
  purpose: string;
  type: string;
  status: string;
  price: number;
  condo_fee?: number;
  bedrooms: number;
  suites?: number;
  bathrooms: number;
  parking: number;
  area: number;
  land_area?: number;
  neighborhood: string;
  city: string;
  state: string;
  lat?: number | null;
  lng?: number | null;
  featured: number;
  cover: string | null;
  favorite: boolean;
  views?: number;
}

export function useFavorite(id: number, initial: boolean) {
  const [fav, setFav] = useState(initial);
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  useEffect(() => setFav(initial), [initial]);
  const toggle = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!user) {
      toast('Entre na sua conta para salvar favoritos.', 'info');
      return nav('/entrar', { state: { from: location.pathname } });
    }
    setFav((f) => !f);
    try {
      const r = await api<{ favorite: boolean }>(`/properties/${id}/favorite`, { method: 'POST' });
      setFav(r.favorite);
      toast(r.favorite ? 'Adicionado aos favoritos' : 'Removido dos favoritos', 'info');
    } catch (err: any) {
      setFav((f) => !f);
      toast(err.message, 'error');
    }
  };
  return [fav, toggle] as const;
}

export function FavButton({ id, initial, className, plain }: { id: number; initial: boolean; className?: string; plain?: boolean }) {
  const [fav, toggle] = useFavorite(id, initial);
  return (
    <button
      onClick={toggle}
      aria-label={fav ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
      aria-pressed={fav}
      className={cx('grid size-10 place-items-center rounded-full border transition active:scale-90', plain ? 'glass border-line' : 'border-white/10 bg-black/35 backdrop-blur-md', className)}
    >
      <Heart className={cx('size-[18px] transition', fav ? 'fill-[#e6826f] text-[#e6826f]' : plain ? 'text-text' : 'text-white')} />
    </button>
  );
}

export function Specs({ p, compact }: { p: Pick<PropertySummary, 'bedrooms' | 'bathrooms' | 'parking' | 'area' | 'land_area' | 'type'>; compact?: boolean }) {
  const items = [
    p.bedrooms > 0 && { icon: BedDouble, v: `${p.bedrooms}${compact ? '' : p.bedrooms > 1 ? ' quartos' : ' quarto'}` },
    p.bathrooms > 0 && { icon: Bath, v: `${p.bathrooms}${compact ? '' : p.bathrooms > 1 ? ' banheiros' : ' banheiro'}` },
    p.parking > 0 && { icon: Car, v: `${p.parking}${compact ? '' : p.parking > 1 ? ' vagas' : ' vaga'}` },
    (p.area || p.land_area) && { icon: Maximize2, v: `${p.area || p.land_area} m²` },
  ].filter(Boolean) as { icon: typeof BedDouble; v: string }[];
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] text-current/80">
      {items.map(({ icon: I, v }) => (
        <span key={v} className="inline-flex items-center gap-1.5"><I className="size-3.5 opacity-70" />{v}</span>
      ))}
    </div>
  );
}

/** Cartão com foto e informações sobrepostas (estilo vitrine). */
export function PropertyCard({ p, className, tall }: { p: PropertySummary; className?: string; tall?: boolean }) {
  const cmp = useCompare();
  return (
    <Link
      to={`/imovel/${p.id}`}
      className={cx('group relative block overflow-hidden rounded-[26px] border border-line bg-surface-2 text-white shadow-soft', tall ? 'aspect-[4/5]' : 'aspect-[4/3.6]', className)}
    >
      <Img src={p.cover} alt={p.title} className="absolute inset-0 size-full transition duration-700 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/10" />
      <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {p.featured ? <span className="rounded-full border border-white/10 bg-black/35 px-2.5 backdrop-blur-md py-1 text-[11px] font-semibold text-white">Destaque</span> : null}
          <span className="rounded-full border border-white/10 bg-black/35 px-2.5 backdrop-blur-md py-1 text-[11px] font-semibold text-white">{PURPOSE_LABEL[p.purpose]}</span>
          {p.status !== 'disponivel' && <Badge tone={statusTone(p.status)}>{STATUS_LABEL[p.status]}</Badge>}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); cmp.toggle(p.id); }}
            aria-label={cmp.has(p.id) ? 'Remover da comparação' : 'Comparar'}
            aria-pressed={cmp.has(p.id)}
            className={cx('grid size-10 place-items-center rounded-full border border-white/10 backdrop-blur-md transition active:scale-90', cmp.has(p.id) ? 'bg-[#d8bb92] text-[#1a140e]' : 'bg-black/35 text-white')}
          >
            <GitCompareArrows className="size-[17px]" />
          </button>
          <FavButton id={p.id} initial={p.favorite} />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[16px] font-semibold leading-snug">{p.title}</h3>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-white/75"><MapPin className="size-3.5" />{p.neighborhood ? `${p.neighborhood}, ` : ''}{p.city} - {p.state}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[17px] font-semibold tabular-nums">{brl(p.price, true)}</div>
            {priceSuffix(p.purpose) && <div className="text-[11px] text-white/70">{priceSuffix(p.purpose)}</div>}
          </div>
        </div>
        <div className="mt-3 border-t border-white/15 pt-3 text-white/90"><Specs p={p} /></div>
      </div>
    </Link>
  );
}

/** Linha compacta (listas, mapa, favoritos). */
export function PropertyRow({ p, right }: { p: PropertySummary; right?: React.ReactNode }) {
  return (
    <Link to={`/imovel/${p.id}`} className="flex gap-3 rounded-3xl border border-line bg-surface p-2.5 transition hover:border-line-strong">
      <Img src={p.cover} alt={p.title} className="h-24 w-28 shrink-0 rounded-2xl sm:w-32" />
      <div className="flex min-w-0 flex-1 flex-col justify-between py-1 pr-1">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-accent">
            {TYPE_LABEL[p.type]} · {PURPOSE_LABEL[p.purpose]}
          </div>
          <h3 className="mt-0.5 line-clamp-1 text-[15px] font-semibold">{p.title}</h3>
          <p className="line-clamp-1 text-[12px] text-muted">{p.neighborhood}, {p.city}</p>
        </div>
        <div className="flex items-end justify-between gap-2">
          <span className="font-semibold tabular-nums">{brl(p.price)}<span className="text-xs font-normal text-muted">{priceSuffix(p.purpose)}</span></span>
          {right ?? <span className="text-muted"><Specs p={p} compact /></span>}
        </div>
      </div>
    </Link>
  );
}

export function TrustBadge() {
  return (
    <div className="flex items-center gap-2 text-[12px] text-muted">
      <ShieldCheck className="size-4 text-success" /> Anúncio verificado pela Walisson Imóveis
    </div>
  );
}

/* ---------------- Mapa (Leaflet + OpenStreetMap) ---------------- */
export function MapView({ points, className, zoom = 12, onSelect }: { points: { id: number; lat: number; lng: number; label: string; title?: string }[]; className?: string; zoom?: number; onSelect?: (id: number) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const [L, setL] = useState<typeof Leaflet | null>(null);

  useEffect(() => {
    let alive = true;
    import('leaflet').then((mod) => alive && setL((mod as any).default ?? mod));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!L || !el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false }).setView([-15.8, -47.9], 4);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(map.current);
    L.control.zoom({ position: 'bottomright' }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, [L]);

  useEffect(() => {
    if (!L || !map.current || !layer.current) return;
    layer.current.clearLayers();
    const valid = points.filter((p) => p.lat && p.lng);
    valid.forEach((p) => {
      const icon = L.divIcon({ className: '', html: `<span class="wi-pin">${p.label.replace(/[<>&"]/g, '')}</span>`, iconSize: [0, 0] });
      const m = L.marker([p.lat, p.lng], { icon, title: p.title }).addTo(layer.current!);
      if (onSelect) m.on('click', () => onSelect(p.id));
    });
    if (valid.length === 1) map.current.setView([valid[0].lat, valid[0].lng], zoom);
    else if (valid.length > 1) map.current.fitBounds(L.latLngBounds(valid.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 13 });
  }, [L, points, zoom, onSelect]);

  return <div ref={el} className={cx('overflow-hidden rounded-3xl border border-line', className)} />;
}

/* ---------------- Simulador de financiamento (SAC x Price) ---------------- */
export function simulate(price: number, downPct: number, years: number, ratePct: number) {
  const principal = price * (1 - downPct / 100);
  const n = years * 12;
  const i = Math.pow(1 + ratePct / 100, 1 / 12) - 1; // taxa anual efetiva → mensal
  const price_ = i === 0 ? principal / n : (principal * i) / (1 - Math.pow(1 + i, -n));
  const sacFirst = principal / n + principal * i;
  const sacLast = principal / n + (principal / n) * i;
  const sacTotal = (principal / n) * n + i * principal * ((n + 1) / 2);
  return { principal, down: price - principal, priceInstallment: price_, priceTotal: price_ * n, sacFirst, sacLast, sacTotal, minIncome: sacFirst / 0.3 };
}
