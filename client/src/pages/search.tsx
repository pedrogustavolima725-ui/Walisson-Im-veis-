import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BellPlus, LayoutGrid, List, Map as MapIcon, Search as SearchIcon, SlidersHorizontal, X } from 'lucide-react';
import { api, qs } from '../lib/api';
import { useApi, useDebounced } from '../lib/hooks';
import { brl, TYPE_LABEL } from '../lib/format';
import { useAuth, useToast } from '../context/app';
import { Button, Chip, cx, Empty, ErrorBox, Field, Input, Modal, Select, Skeleton, Stepper, Toggle } from '../components/ui';
import { Page } from '../components/layout';
import { MapView, PropertyCard, PropertyRow, type PropertySummary } from '../components/property';

type Result = { items: PropertySummary[]; total: number; page: number; pages: number };
type Meta = { cities: { city: string; n: number }[] };

const FILTER_KEYS = ['q', 'purpose', 'type', 'city', 'neighborhood', 'minPrice', 'maxPrice', 'bedrooms', 'bathrooms', 'parking', 'minArea', 'maxArea', 'pets', 'furnished', 'financing', 'featured', 'sort'] as const;
type Filters = Partial<Record<(typeof FILTER_KEYS)[number], string>>;

const PRICE_PRESETS: Record<string, [number, number][]> = {
  venda: [[0, 500000], [500000, 1000000], [1000000, 2500000], [2500000, 0]],
  aluguel: [[0, 3000], [3000, 6000], [6000, 10000], [10000, 0]],
  temporada: [[0, 500], [500, 1500], [1500, 0]],
};

export function Search() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const filters: Filters = useMemo(() => {
    const f: Filters = {};
    FILTER_KEYS.forEach((k) => { const v = params.get(k); if (v) f[k] = v; });
    return f;
  }, [params]);
  const [view, setView] = useState<'grid' | 'list' | 'mapa'>(() => (params.get('view') === 'mapa' ? 'mapa' : 'grid'));
  const [sheet, setSheet] = useState(params.get('filtros') === '1');
  const [q, setQ] = useState(filters.q ?? '');
  const dq = useDebounced(q, 400);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PropertySummary[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);

  const update = useCallback((patch: Filters) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    next.delete('filtros');
    setParams(next, { replace: true });
  }, [params, setParams]);

  useEffect(() => { if ((filters.q ?? '') !== dq) update({ q: dq }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = qs({ ...filters, page, limit: view === 'mapa' ? 60 : 12 });
  const { data, loading, error, reload } = useApi<Result>(`/properties${query}`);
  const meta = useApi<Meta>('/properties/meta');

  useEffect(() => { setPage(1); }, [params, view]);
  useEffect(() => {
    if (!data) return;
    setItems((cur) => (data.page === 1 ? data.items : [...cur, ...data.items.filter((i) => !cur.some((c) => c.id === i.id))]));
  }, [data]);

  const activeCount = FILTER_KEYS.filter((k) => !['q', 'sort', 'purpose'].includes(k) && filters[k]).length;
  const types = (filters.type ?? '').split(',').filter(Boolean);
  const toggleType = (t: string) => update({ type: (types.includes(t) ? types.filter((x) => x !== t) : [...types, t]).join(',') });

  const points = useMemo(() => items.filter((p) => p.lat && p.lng).map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng!, label: brl(p.price, true), title: p.title })), [items]);
  const onPin = useCallback((id: number) => nav(`/imovel/${id}`), [nav]);

  return (
    <Page wide>
      <div className="flex items-center gap-2">
        <div className="flex h-12 flex-1 items-center gap-2 rounded-full border border-line bg-surface px-4">
          <SearchIcon className="size-[18px] text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cidade, bairro, código..." aria-label="Buscar" className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint" />
          {q && <button onClick={() => setQ('')} aria-label="Limpar busca"><X className="size-4 text-faint" /></button>}
        </div>
        <button onClick={() => setSheet(true)} className="relative grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-ink" aria-label="Filtros">
          <SlidersHorizontal className="size-[18px]" />
          {activeCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-danger text-[10px] font-bold text-white">{activeCount}</span>}
        </button>
      </div>

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {[['', 'Todos'], ['venda', 'Comprar'], ['aluguel', 'Alugar'], ['temporada', 'Temporada']].map(([v, l]) => (
          <Chip key={v} active={(filters.purpose ?? '') === v} onClick={() => update({ purpose: v, minPrice: '', maxPrice: '' })}>{l}</Chip>
        ))}
        <span className="mx-1 w-px shrink-0 bg-line" />
        {Object.entries(TYPE_LABEL).map(([v, l]) => (
          <Chip key={v} active={types.includes(v)} onClick={() => toggleType(v)}>{l}</Chip>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{filters.city ? `Imóveis em ${filters.city}` : filters.purpose === 'aluguel' ? 'Imóveis para alugar' : filters.purpose === 'venda' ? 'Imóveis à venda' : filters.purpose === 'temporada' ? 'Temporada' : 'Todos os imóveis'}</h1>
          <p className="text-sm text-muted">{loading && !data ? 'Buscando...' : `${data?.total ?? 0} resultado${data?.total === 1 ? '' : 's'}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filters.sort ?? 'recentes'} onChange={(e) => update({ sort: e.target.value })} className="h-10 w-auto rounded-full text-sm" aria-label="Ordenar">
            <option value="recentes">Mais recentes</option>
            <option value="menor_preco">Menor preço</option>
            <option value="maior_preco">Maior preço</option>
            <option value="maior_area">Maior área</option>
            <option value="populares">Mais vistos</option>
          </Select>
          <div className="flex rounded-full border border-line bg-surface p-1">
            {([['grid', LayoutGrid, 'Grade'], ['list', List, 'Lista'], ['mapa', MapIcon, 'Mapa']] as const).map(([v, I, l]) => (
              <button key={v} onClick={() => setView(v)} aria-label={l} aria-pressed={view === v} className={cx('grid size-8 place-items-center rounded-full', view === v ? 'bg-surface-3 text-text' : 'text-muted')}><I className="size-4" /></button>
            ))}
          </div>
          <Button variant="outline" size="sm" icon={<BellPlus className="size-4" />} onClick={() => (user ? setSaveOpen(true) : nav('/entrar', { state: { from: `/buscar?${params}` } }))}>
            <span className="hidden sm:inline">Criar alerta</span>
          </Button>
        </div>
      </div>

      {error && <div className="mt-4"><ErrorBox message={error} onRetry={reload} /></div>}

      <div className="mt-5">
        {loading && !items.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[4/3.6] rounded-[26px]" />)}</div>
        ) : !items.length ? (
          <Empty icon={<SearchIcon />} title="Nenhum imóvel encontrado" text="Tente ampliar os filtros ou crie um alerta para ser avisado quando surgir algo." action={<Button variant="secondary" onClick={() => setParams({})}>Limpar filtros</Button>} />
        ) : view === 'mapa' ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
            <MapView points={points} onSelect={onPin} className="h-[60vh] lg:h-[calc(100vh-260px)]" />
            <div className="space-y-3 lg:max-h-[calc(100vh-260px)] lg:overflow-y-auto lg:pr-1">
              {items.map((p) => <PropertyRow key={p.id} p={p} />)}
            </div>
          </div>
        ) : view === 'list' ? (
          <div className="grid gap-3 lg:grid-cols-2">{items.map((p) => <PropertyRow key={p.id} p={p} />)}</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((p) => <PropertyCard key={p.id} p={p} />)}</div>
        )}
        {data && view !== 'mapa' && data.page < data.pages && (
          <div className="mt-8 flex justify-center"><Button variant="secondary" loading={loading} onClick={() => setPage((p) => p + 1)}>Carregar mais</Button></div>
        )}
      </div>

      <FilterSheet open={sheet} onClose={() => setSheet(false)} filters={filters} cities={meta.data?.cities ?? []} onApply={(f) => { update(f); setSheet(false); }} total={data?.total} />
      <SaveSearch open={saveOpen} onClose={() => setSaveOpen(false)} filters={filters} onSaved={() => { setSaveOpen(false); toast('Alerta criado! Avisaremos quando surgir um imóvel compatível.'); }} />
    </Page>
  );
}

function FilterSheet({ open, onClose, filters, cities, onApply, total }: { open: boolean; onClose: () => void; filters: Filters; cities: { city: string; n: number }[]; onApply: (f: Filters) => void; total?: number }) {
  const [f, setF] = useState<Filters>(filters);
  useEffect(() => { if (open) setF(filters); }, [open, filters]);
  const set = (k: keyof Filters, v: string) => setF((cur) => ({ ...cur, [k]: v }));
  const presets = PRICE_PRESETS[f.purpose ?? 'venda'] ?? PRICE_PRESETS.venda;
  const n = (k: keyof Filters) => Number(f[k] ?? 0);
  return (
    <Modal open={open} onClose={onClose} title="Filtros" wide>
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-sm font-semibold">Finalidade</p>
          <div className="flex flex-wrap gap-2">
            {[['', 'Todas'], ['venda', 'Comprar'], ['aluguel', 'Alugar'], ['temporada', 'Temporada']].map(([v, l]) => (
              <Chip key={v} active={(f.purpose ?? '') === v} onClick={() => setF({ ...f, purpose: v, minPrice: '', maxPrice: '' })}>{l}</Chip>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cidade">
            <Select value={f.city ?? ''} onChange={(e) => set('city', e.target.value)}>
              <option value="">Todas as cidades</option>
              {cities.map((c) => <option key={c.city} value={c.city}>{c.city} ({c.n})</option>)}
            </Select>
          </Field>
          <Field label="Bairro"><Input value={f.neighborhood ?? ''} onChange={(e) => set('neighborhood', e.target.value)} placeholder="Ex.: Jardins" /></Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">Faixa de preço</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {presets.map(([a, b]) => {
              const active = String(a || '') === (f.minPrice ?? '') && String(b || '') === (f.maxPrice ?? '');
              return (
                <Chip key={`${a}-${b}`} active={active} onClick={() => setF({ ...f, minPrice: a ? String(a) : '', maxPrice: b ? String(b) : '' })}>
                  {!a ? `Até ${brl(b, true)}` : !b ? `Acima de ${brl(a, true)}` : `${brl(a, true)} – ${brl(b, true)}`}
                </Chip>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" inputMode="numeric" min={0} value={f.minPrice ?? ''} onChange={(e) => set('minPrice', e.target.value)} placeholder="Mínimo (R$)" aria-label="Preço mínimo" />
            <Input type="number" inputMode="numeric" min={0} value={f.maxPrice ?? ''} onChange={(e) => set('maxPrice', e.target.value)} placeholder="Máximo (R$)" aria-label="Preço máximo" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stepper label="Quartos" value={n('bedrooms')} onChange={(v) => set('bedrooms', v ? String(v) : '')} max={6} />
          <Stepper label="Banheiros" value={n('bathrooms')} onChange={(v) => set('bathrooms', v ? String(v) : '')} max={6} />
          <Stepper label="Vagas" value={n('parking')} onChange={(v) => set('parking', v ? String(v) : '')} max={6} />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">Área útil (m²)</p>
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" min={0} value={f.minArea ?? ''} onChange={(e) => set('minArea', e.target.value)} placeholder="Mínima" aria-label="Área mínima" />
            <Input type="number" min={0} value={f.maxArea ?? ''} onChange={(e) => set('maxArea', e.target.value)} placeholder="Máxima" aria-label="Área máxima" />
          </div>
        </div>
        <div className="space-y-4 rounded-3xl border border-line bg-surface p-4">
          <Toggle label="Aceita pets" checked={f.pets === '1'} onChange={(v) => set('pets', v ? '1' : '')} />
          <Toggle label="Mobiliado" checked={f.furnished === '1'} onChange={(v) => set('furnished', v ? '1' : '')} />
          <Toggle label="Aceita financiamento" checked={f.financing === '1'} onChange={(v) => set('financing', v ? '1' : '')} />
          <Toggle label="Somente destaques" checked={f.featured === '1'} onChange={(v) => set('featured', v ? '1' : '')} />
        </div>
        <div className="sticky bottom-0 -mx-5 flex gap-3 border-t border-line bg-bg-elev px-5 pt-4 sm:-mx-6 sm:px-6">
          <Button variant="ghost" onClick={() => setF({ q: f.q, sort: f.sort })}>Limpar</Button>
          <Button className="flex-1" onClick={() => onApply(Object.fromEntries(FILTER_KEYS.map((k) => [k, f[k] ?? ''])) as Filters)}>
            Ver resultados{total !== undefined ? '' : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SaveSearch({ open, onClose, filters, onSaved }: { open: boolean; onClose: () => void; filters: Filters; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) setName([filters.type && TYPE_LABEL[filters.type.split(',')[0]], filters.city, filters.purpose].filter(Boolean).join(' · ') || 'Minha busca');
  }, [open, filters]);
  const save = async () => {
    setLoading(true); setErr(null);
    try {
      const clean = Object.fromEntries(Object.entries(filters).filter(([k, v]) => v && k !== 'sort'));
      await api('/me/saved-searches', { body: { name, filters: clean, alert: true } });
      onSaved();
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Criar alerta de imóveis">
      <p className="mb-4 text-sm text-muted">Você será notificado sempre que um novo imóvel corresponder a esta busca.</p>
      {err && <p className="mb-3 text-sm text-danger">{err}</p>}
      <Field label="Nome do alerta"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
      <Button className="mt-5 w-full" loading={loading} onClick={save}>Salvar alerta</Button>
    </Modal>
  );
}
