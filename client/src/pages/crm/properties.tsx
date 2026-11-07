import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Building2, Eye, Heart, ImagePlus, Loader2, Plus, Search, Star, Trash2, Users, X } from 'lucide-react';
import { api, DEMO, qs, uploadImages } from '../../lib/api';
import { useApi, useDebounced } from '../../lib/hooks';
import { brl, priceSuffix, PURPOSE_LABEL, STATUS_LABEL, TYPE_LABEL } from '../../lib/format';
import { useAuth, useToast } from '../../context/app';
import { Badge, Button, Card, Chip, cx, Empty, ErrorBox, Field, Img, Input, PageHeader, PageLoader, Select, statusTone, Textarea, Toggle } from '../../components/ui';

type Row = {
  id: number; code: string; title: string; purpose: string; type: string; status: string; price: number; neighborhood: string; city: string; state: string;
  bedrooms: number; area: number; views: number; featured: number; cover: string | null; agent_name: string | null; owner_name: string | null; leads_count: number; favorites_count: number; agent_id: number | null;
};

export function CrmProperties() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const status = params.get('status') ?? '';
  const mine = params.get('mine') === '1';
  const { data, loading, error, reload } = useApi<Row[]>(`/properties/manage/list${qs({ q: dq, status, mine: mine ? '1' : '' })}`);
  const setP = (k: string, v: string) => { const n = new URLSearchParams(params); v ? n.set(k, v) : n.delete(k); setParams(n, { replace: true }); };
  return (
    <div>
      <PageHeader title="Imóveis" subtitle={`${data?.length ?? 0} imóveis na carteira`} actions={
        <>
          <a href="/api/crm/reports/imoveis.csv" className="hidden sm:block"><Button variant="outline" size="sm">Exportar CSV</Button></a>
          <Link to="/crm/imoveis/novo"><Button size="sm" icon={<Plus className="size-4" />}>Cadastrar</Button></Link>
        </>
      } />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Título, código, bairro..." aria-label="Buscar imóveis" className="h-10 w-full rounded-full border border-line bg-surface pl-10 pr-4 text-sm outline-none focus:border-accent" />
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {['', 'disponivel', 'pendente', 'reservado', 'vendido', 'alugado', 'inativo'].map((s) => (
            <Chip key={s} active={status === s} onClick={() => setP('status', s)} className="h-9">{s ? STATUS_LABEL[s] : 'Todos'}</Chip>
          ))}
        </div>
        {user!.role === 'admin' && <Chip active={mine} onClick={() => setP('mine', mine ? '' : '1')} className="h-9">Somente meus</Chip>}
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? <PageLoader /> : !data?.length ? (
        <Empty icon={<Building2 />} title="Nenhum imóvel" text="Cadastre o primeiro imóvel da carteira." action={<Link to="/crm/imoveis/novo"><Button>Cadastrar imóvel</Button></Link>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {data.map((p) => (
            <Link key={p.id} to={`/crm/imoveis/${p.id}`} className={cx('flex gap-3 rounded-3xl border bg-surface p-2.5 transition hover:border-line-strong', p.status === 'pendente' ? 'border-warning/40' : 'border-line')}>
              <div className="relative shrink-0">
                <Img src={p.cover} alt="" className="h-28 w-28 rounded-2xl" />
                {!!p.featured && <span className="absolute left-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/50"><Star className="size-3.5 fill-[#e7b964] text-[#e7b964]" /></span>}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-between py-1 pr-1">
                <div>
                  <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold text-accent">{p.code} · {TYPE_LABEL[p.type]}</span><Badge tone={statusTone(p.status)}>{STATUS_LABEL[p.status]}</Badge></div>
                  <p className="mt-0.5 line-clamp-1 font-semibold">{p.title}</p>
                  <p className="line-clamp-1 text-xs text-muted">{p.neighborhood}, {p.city} · {p.owner_name ? `Proprietário: ${p.owner_name}` : p.agent_name}</p>
                </div>
                <div className="flex items-end justify-between">
                  <span className="font-semibold tabular-nums">{brl(p.price, true)}<span className="text-xs font-normal text-muted">{priceSuffix(p.purpose)}</span></span>
                  <span className="flex gap-2.5 text-xs text-muted">
                    <span className="flex items-center gap-1" title="Visualizações"><Eye className="size-3.5" />{p.views}</span>
                    <span className="flex items-center gap-1" title="Favoritos"><Heart className="size-3.5" />{p.favorites_count}</span>
                    <span className="flex items-center gap-1" title="Leads"><Users className="size-3.5" />{p.leads_count}</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================ Formulário ============================ */
const EMPTY = {
  title: '', description: '', purpose: 'venda', type: 'apartamento', status: 'disponivel', price: '', condo_fee: '', iptu: '', bedrooms: '2', suites: '0', bathrooms: '1',
  parking: '1', area: '', land_area: '', address: '', neighborhood: '', city: '', state: '', zip: '', lat: '', lng: '', featured: false, accepts_financing: true,
  accepts_pets: false, furnished: false, agent_id: '' as string | number,
};
const FEATURE_SUGGESTIONS = ['Piscina', 'Churrasqueira', 'Academia', 'Varanda gourmet', 'Portaria 24h', 'Elevador', 'Ar-condicionado', 'Armários planejados', 'Energia solar', 'Jardim', 'Playground', 'Salão de festas', 'Home office', 'Closet', 'Vista mar', 'Próximo ao metrô'];

export function PropertyForm() {
  const { id } = useParams();
  const isNew = !id;
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const existing = useApi<any>(isNew ? null : `/properties/manage/${id}`, [id]);
  const agents = useApi<{ id: number; name: string }[]>(user!.role === 'admin' ? '/crm/agents' : null);
  const [f, setF] = useState({ ...EMPTY });
  const [features, setFeatures] = useState<string[]>([]);
  const [feat, setFeat] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    const d = existing.data;
    if (!d) return;
    const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
    setF({
      title: d.title, description: d.description, purpose: d.purpose, type: d.type, status: d.status, price: s(d.price), condo_fee: s(d.condo_fee), iptu: s(d.iptu),
      bedrooms: s(d.bedrooms), suites: s(d.suites), bathrooms: s(d.bathrooms), parking: s(d.parking), area: s(d.area), land_area: s(d.land_area), address: d.address,
      neighborhood: d.neighborhood, city: d.city, state: d.state, zip: d.zip, lat: s(d.lat), lng: s(d.lng), featured: d.featured, accepts_financing: d.accepts_financing,
      accepts_pets: d.accepts_pets, furnished: d.furnished, agent_id: d.agent_id ?? '',
    });
    setFeatures(d.features);
    setImages(d.images);
  }, [existing.data]);

  if (!isNew && existing.loading && !existing.data) return <PageLoader />;
  if (!isNew && existing.error) return <ErrorBox message={existing.error} />;
  const canEdit = isNew || user!.role === 'admin' || existing.data?.agent_id === user!.id;

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try { const urls = await uploadImages(files); setImages((cur) => [...cur, ...urls].slice(0, 30)); } catch (e: any) { toast(e.message, 'error'); } finally { setUploading(false); }
  };
  const moveImg = (i: number, d: -1 | 1) => setImages((cur) => { const n = [...cur]; const j = i + d; if (j < 0 || j >= n.length) return cur; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const addFeature = (v: string) => { const t = v.trim(); if (t && !features.includes(t)) setFeatures([...features, t]); setFeat(''); };

  const save = async () => {
    setSaving(true); setFields({});
    const num = (v: string) => (v === '' ? 0 : Number(v));
    const body = {
      ...f, price: Number(f.price), condo_fee: num(f.condo_fee), iptu: num(f.iptu), bedrooms: num(f.bedrooms), suites: num(f.suites), bathrooms: num(f.bathrooms),
      parking: num(f.parking), area: num(f.area), land_area: num(f.land_area), lat: f.lat ? Number(f.lat) : null, lng: f.lng ? Number(f.lng) : null,
      agent_id: f.agent_id ? Number(f.agent_id) : null, features, images,
    };
    try {
      if (isNew) { const r = await api<{ id: number }>('/properties', { body }); toast('Imóvel cadastrado!'); nav(`/crm/imoveis/${r.id}`, { replace: true }); }
      else { await api(`/properties/${id}`, { method: 'PUT', body }); toast(f.status === 'disponivel' && existing.data?.status === 'pendente' ? 'Imóvel aprovado e publicado!' : 'Alterações salvas.'); existing.reload(true); }
    } catch (e: any) { setFields(e.fields ?? {}); toast(e.message, 'error'); } finally { setSaving(false); }
  };
  const remove = async () => {
    if (!confirm('Excluir este imóvel permanentemente? Leads e visitas vinculados perderão a referência.')) return;
    await api(`/properties/${id}`, { method: 'DELETE' });
    toast('Imóvel excluído.', 'info'); nav('/crm/imoveis');
  };

  return (
    <div>
      <PageHeader back="/crm/imoveis" title={isNew ? 'Cadastrar imóvel' : existing.data?.title} subtitle={isNew ? 'Preencha os dados e publique na vitrine.' : `${existing.data?.code} · ${existing.data?.views} visualizações`}
        actions={!isNew && <Link to={`/imovel/${id}`} target={DEMO ? undefined : '_blank'}><Button variant="outline" size="sm" icon={<Eye className="size-4" />}>Ver anúncio</Button></Link>} />
      {existing.data?.status === 'pendente' && (
        <div className="mb-5 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm">Este imóvel foi enviado por um proprietário. Revise os dados, complete as informações e altere o status para <b>Disponível</b> para publicá-lo.</div>
      )}
      {!canEdit && <div className="mb-5 rounded-2xl border border-line bg-surface-2 p-4 text-sm text-muted">Somente leitura: apenas o corretor responsável ou um administrador pode editar.</div>}
      <fieldset disabled={!canEdit} className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Card className="space-y-4 p-5 md:p-6">
            <h3 className="font-semibold">Informações principais</h3>
            <Field label="Título *" error={fields.title}><Input value={f.title} onChange={set('title')} maxLength={140} /></Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Finalidade"><Select value={f.purpose} onChange={set('purpose')}>{Object.entries(PURPOSE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
              <Field label="Tipo"><Select value={f.type} onChange={set('type')}>{Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
              <Field label="Status"><Select value={f.status} onChange={set('status')}>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
            </div>
            <Field label="Descrição"><Textarea value={f.description} onChange={set('description')} maxLength={5000} className="min-h-36" /></Field>
          </Card>
          <Card className="space-y-4 p-5 md:p-6">
            <h3 className="font-semibold">Valores</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={`${f.purpose === 'venda' ? 'Preço de venda' : f.purpose === 'aluguel' ? 'Aluguel mensal' : 'Diária'} (R$) *`} error={fields.price}><Input type="number" min={0} value={f.price} onChange={set('price')} /></Field>
              <Field label="Condomínio (R$)"><Input type="number" min={0} value={f.condo_fee} onChange={set('condo_fee')} /></Field>
              <Field label="IPTU mensal (R$)"><Input type="number" min={0} value={f.iptu} onChange={set('iptu')} /></Field>
            </div>
          </Card>
          <Card className="space-y-4 p-5 md:p-6">
            <h3 className="font-semibold">Características</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Quartos"><Input type="number" min={0} value={f.bedrooms} onChange={set('bedrooms')} /></Field>
              <Field label="Suítes"><Input type="number" min={0} value={f.suites} onChange={set('suites')} /></Field>
              <Field label="Banheiros"><Input type="number" min={0} value={f.bathrooms} onChange={set('bathrooms')} /></Field>
              <Field label="Vagas"><Input type="number" min={0} value={f.parking} onChange={set('parking')} /></Field>
              <Field label="Área útil (m²)"><Input type="number" min={0} value={f.area} onChange={set('area')} /></Field>
              <Field label="Terreno (m²)"><Input type="number" min={0} value={f.land_area} onChange={set('land_area')} /></Field>
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium text-muted">Diferenciais</p>
              <div className="mb-2 flex flex-wrap gap-2">
                {features.map((x) => <span key={x} className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent">{x}<button type="button" onClick={() => setFeatures(features.filter((y) => y !== x))} aria-label={`Remover ${x}`}><X className="size-3" /></button></span>)}
              </div>
              <div className="flex gap-2"><Input value={feat} onChange={(e) => setFeat(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeature(feat); } }} placeholder="Adicionar diferencial" className="h-10 text-sm" /><Button type="button" size="sm" className="h-10" onClick={() => addFeature(feat)}>Adicionar</Button></div>
              <div className="mt-2 flex flex-wrap gap-1.5">{FEATURE_SUGGESTIONS.filter((x) => !features.includes(x)).slice(0, 10).map((x) => <button type="button" key={x} onClick={() => addFeature(x)} className="rounded-full border border-dashed border-line-strong px-2.5 py-1 text-[11px] text-muted hover:text-text">+ {x}</button>)}</div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Toggle checked={f.accepts_financing} onChange={(v) => setF({ ...f, accepts_financing: v })} label="Aceita financiamento" />
              <Toggle checked={f.accepts_pets} onChange={(v) => setF({ ...f, accepts_pets: v })} label="Aceita pets" />
              <Toggle checked={f.furnished} onChange={(v) => setF({ ...f, furnished: v })} label="Mobiliado" />
              <Toggle checked={f.featured} onChange={(v) => setF({ ...f, featured: v })} label="Destaque na vitrine" />
            </div>
          </Card>
          <Card className="space-y-4 p-5 md:p-6">
            <h3 className="font-semibold">Localização</h3>
            <Field label="Endereço (privado — só a equipe vê)"><Input value={f.address} onChange={set('address')} /></Field>
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_80px_120px]">
              <Field label="Bairro"><Input value={f.neighborhood} onChange={set('neighborhood')} /></Field>
              <Field label="Cidade *" error={fields.city}><Input value={f.city} onChange={set('city')} /></Field>
              <Field label="UF"><Input value={f.state} onChange={set('state')} maxLength={2} className="uppercase" /></Field>
              <Field label="CEP"><Input value={f.zip} onChange={set('zip')} maxLength={10} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Latitude" hint="Ex.: -23.5613"><Input type="number" step="any" value={f.lat} onChange={set('lat')} /></Field>
              <Field label="Longitude" hint="Ex.: -46.6565"><Input type="number" step="any" value={f.lng} onChange={set('lng')} /></Field>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="mb-1 font-semibold">Fotos</h3>
            <p className="mb-3 text-xs text-muted">A primeira foto é a capa. JPG, PNG ou WEBP até 8 MB.</p>
            <div className="grid grid-cols-2 gap-2">
              {images.map((u, i) => (
                <div key={u + i} className="group relative aspect-[4/3] overflow-hidden rounded-2xl">
                  <Img src={u} alt={`Foto ${i + 1}`} className="size-full" />
                  {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">Capa</span>}
                  <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
                    <span className="flex gap-1">
                      <button type="button" onClick={() => moveImg(i, -1)} aria-label="Mover para trás" className="grid size-7 place-items-center rounded-full bg-black/60 text-white"><ArrowUp className="size-3.5 -rotate-90" /></button>
                      <button type="button" onClick={() => moveImg(i, 1)} aria-label="Mover para frente" className="grid size-7 place-items-center rounded-full bg-black/60 text-white"><ArrowDown className="size-3.5 -rotate-90" /></button>
                    </span>
                    <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))} aria-label="Remover foto" className="grid size-7 place-items-center rounded-full bg-black/60 text-white"><Trash2 className="size-3.5" /></button>
                  </div>
                </div>
              ))}
              <label className="grid aspect-[4/3] cursor-pointer place-items-center rounded-2xl border border-dashed border-line-strong text-muted hover:text-text">
                {uploading ? <Loader2 className="size-6 animate-spin" /> : <span className="flex flex-col items-center gap-1 text-xs"><ImagePlus className="size-6" />Enviar fotos</span>}
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} />
              </label>
            </div>
          </Card>
          {user!.role === 'admin' && (
            <Card className="p-5">
              <Field label="Corretor responsável"><Select value={String(f.agent_id)} onChange={set('agent_id')}><option value="">Eu mesmo</option>{agents.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
            </Card>
          )}
          <div className="sticky top-4 space-y-2">
            <Button size="lg" className="w-full" loading={saving} onClick={save}>{isNew ? 'Cadastrar imóvel' : 'Salvar alterações'}</Button>
            {!isNew && user!.role === 'admin' && <Button variant="danger" className="w-full" onClick={remove} icon={<Trash2 className="size-4" />}>Excluir imóvel</Button>}
          </div>
        </div>
      </fieldset>
    </div>
  );
}
