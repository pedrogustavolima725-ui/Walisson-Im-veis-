import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Building, Building2, Calculator, Home as HomeIcon, KeyRound, Megaphone, Palmtree, Search, SlidersHorizontal, Sparkles, Store, Trees, UsersRound, Warehouse } from 'lucide-react';
import { useApi } from '../lib/hooks';
import { useAuth } from '../context/app';
import { Avatar, Chip, cx, Img, SectionTitle, Skeleton } from '../components/ui';
import { Logo, NotificationBell, Page, ThemeToggle } from '../components/layout';
import { PropertyCard, type PropertySummary } from '../components/property';

type List = { items: PropertySummary[]; total: number };
type Meta = { cities: { city: string; state: string; n: number; cover: string | null }[]; types: { type: string; n: number }[] };

const QUICK = [
  { label: 'Comprar', icon: HomeIcon, to: '/buscar?purpose=venda' },
  { label: 'Alugar', icon: KeyRound, to: '/buscar?purpose=aluguel' },
  { label: 'Temporada', icon: Palmtree, to: '/buscar?purpose=temporada' },
  { label: 'Corretores', icon: UsersRound, to: '/corretores' },
];

const TYPE_CHIPS = [
  { v: '', label: 'Todos', icon: Sparkles },
  { v: 'casa', label: 'Casas', icon: HomeIcon },
  { v: 'apartamento', label: 'Apartamentos', icon: Building2 },
  { v: 'cobertura', label: 'Coberturas', icon: Building },
  { v: 'studio', label: 'Studios', icon: Warehouse },
  { v: 'comercial', label: 'Comercial', icon: Store },
  { v: 'chacara', label: 'Chácaras', icon: Trees },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export function Home() {
  const { user, isStaff } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const featured = useApi<List>('/properties?featured=1&limit=8');
  const recent = useApi<List>(`/properties?limit=6&sort=recentes${type ? `&type=${type}` : ''}`);
  const meta = useApi<Meta>('/properties/meta');
  const [slide, setSlide] = useState(0);

  let onboarded = true;
  try { onboarded = !!localStorage.getItem('wi-onboarded'); } catch { /* ignora */ }

  useEffect(() => {
    const n = featured.data?.items.length ?? 0;
    if (n < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % n), 6000);
    return () => clearInterval(t);
  }, [featured.data]);

  if (!onboarded && !user) return <Navigate to="/boas-vindas" replace />;

  const search = (e: FormEvent) => {
    e.preventDefault();
    nav(`/buscar${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  };

  return (
    <Page wide>
      {/* Cabeçalho */}
      <header className="flex items-center justify-between gap-3">
        <div className="lg:hidden"><Logo compact /></div>
        <div className="hidden min-w-0 lg:block">
          <p className="text-sm text-muted">{greeting()}{user ? `, ${user.name.split(' ')[0]}` : ''} 👋</p>
        </div>
        <div className="flex items-center gap-2">
          {isStaff && <Link to="/crm" className="hidden h-10 items-center rounded-full border border-line bg-surface-2 px-4 text-[13px] font-semibold sm:flex">Abrir CRM</Link>}
          <ThemeToggle />
          <NotificationBell />
          {user ? (
            <Link to="/perfil" aria-label="Meu perfil"><Avatar name={user.name} src={user.avatar} size={40} /></Link>
          ) : (
            <Link to="/entrar" className="flex h-10 items-center rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-ink">Entrar</Link>
          )}
        </div>
      </header>

      <section className="mt-6">
        <p className="text-sm text-muted lg:hidden">{greeting()}{user ? `, ${user.name.split(' ')[0]}` : ''} 👋</p>
        <h1 className="mt-1 max-w-xl text-[32px] font-semibold leading-[1.1] tracking-tight md:text-[44px]">
          Encontre o lugar <span className="text-accent">perfeito</span> para viver
        </h1>
        <form onSubmit={search} className="mt-5 flex max-w-2xl items-center gap-2 rounded-full border border-line bg-surface p-1.5 pl-5 shadow-soft">
          <Search className="size-5 shrink-0 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busque por cidade, bairro ou código"
            aria-label="Buscar imóveis"
            className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
          />
          <Link to="/buscar?filtros=1" aria-label="Filtros avançados" className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-muted hover:text-text">
            <SlidersHorizontal className="size-[18px]" />
          </Link>
          <button className="hidden h-11 shrink-0 rounded-full bg-primary px-6 text-sm font-semibold text-primary-ink sm:block">Buscar</button>
        </form>
      </section>

      {/* Atalhos */}
      <section className="mt-6 grid grid-cols-4 gap-2.5 sm:max-w-2xl sm:gap-3">
        {QUICK.map((it, i) => (
          <Link
            key={it.label}
            to={it.to}
            className={cx(
              'flex flex-col items-center justify-center gap-2 rounded-3xl border py-4 text-[12px] font-semibold transition hover:-translate-y-0.5',
              i === 0 ? 'border-transparent bg-primary text-primary-ink' : 'border-line bg-surface text-text',
            )}
          >
            <it.icon className="size-5" />
            {it.label}
          </Link>
        ))}
      </section>

      {meta.data && meta.data.cities.length === 0 ? (
        <section className="mt-9 overflow-hidden rounded-[28px] border border-line bg-surface p-6 md:p-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent"><Sparkles className="size-6" /></span>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">Novos imóveis chegando em breve</h2>
          <p className="mt-1 max-w-lg text-sm text-muted">Nossa equipe está selecionando as melhores opções. Crie sua conta para receber um aviso assim que os primeiros imóveis forem publicados.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {!user && <Link to="/cadastro" className="flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-ink">Criar conta</Link>}
            <Link to="/anunciar" className="flex h-11 items-center rounded-full border border-line-strong px-5 text-sm font-semibold">Quero anunciar meu imóvel</Link>
          </div>
        </section>
      ) : (
        <>
      {/* Destaques */}
      <section className="mt-9">
        <SectionTitle title="Destaques da semana" action="Ver todos" to="/buscar?featured=1" />
        {featured.loading ? (
          <Skeleton className="aspect-[16/11] w-full rounded-[28px] md:aspect-[21/9]" />
        ) : featured.data?.items.length ? (
          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className="min-w-0">
             <div className="overflow-hidden rounded-[28px]">
              <div className="flex transition-transform duration-700" style={{ transform: `translateX(-${slide * 100}%)` }}>
                {featured.data.items.map((p) => (
                  <div key={p.id} className="w-full shrink-0">
                    <PropertyCard p={p} className="aspect-[4/4.2] sm:aspect-[16/10] lg:aspect-[16/10.5]" />
                  </div>
                ))}
              </div>
             </div>
              <div className="mt-3 flex justify-center gap-1.5">
                {featured.data.items.map((_, i) => (
                  <button key={i} onClick={() => setSlide(i)} aria-label={`Destaque ${i + 1}`} className={cx('h-1.5 rounded-full transition-all', i === slide ? 'w-5 bg-accent' : 'w-1.5 bg-surface-3')} />
                ))}
              </div>
            </div>
            <div className="hidden grid-rows-2 gap-4 lg:grid">
              {featured.data.items.slice(1, 3).map((p) => <PropertyCard key={p.id} p={p} className="aspect-auto h-full" />)}
            </div>
          </div>
        ) : null}
      </section>

      {/* Cidades */}
      <section className="mt-10">
        <SectionTitle title="Localizações populares" action="Ver mapa" to="/buscar?view=mapa" />
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-6 lg:px-0">
          {meta.loading
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-44 w-32 shrink-0 rounded-3xl lg:w-auto" />)
            : meta.data?.cities.slice(0, 6).map((c) => (
                <Link key={c.city} to={`/buscar?city=${encodeURIComponent(c.city)}`} className="group relative h-44 w-32 shrink-0 overflow-hidden rounded-3xl lg:w-auto">
                  <Img src={c.cover} alt={c.city} className="absolute inset-0 size-full transition duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute inset-x-3 bottom-3 text-white">
                    <div className="text-[14px] font-semibold leading-tight">{c.city}</div>
                    <div className="text-[11px] text-white/70">{c.n} {c.n > 1 ? 'imóveis' : 'imóvel'} · {c.state}</div>
                  </div>
                </Link>
              ))}
        </div>
      </section>

      {/* Recentes por tipo */}
      <section className="mt-10">
        <SectionTitle title="Novidades no portfólio" action="Ver todos" to={`/buscar${type ? `?type=${type}` : ''}`} />
        <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          {TYPE_CHIPS.map((t) => (
            <Chip key={t.v} active={type === t.v} onClick={() => setType(t.v)} icon={<t.icon className="size-4" />}>{t.label}</Chip>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {recent.loading
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="aspect-[4/3.6] rounded-[26px]" />)
            : recent.data?.items.map((p) => <PropertyCard key={p.id} p={p} />)}
        </div>
        {recent.data && recent.data.items.length === 0 && <p className="py-10 text-center text-sm text-muted">{type ? 'Nenhum imóvel deste tipo no momento.' : 'Nenhum imóvel publicado ainda.'}</p>}
      </section>

        </>
      )}

      {/* Ferramentas */}
      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <Link to="/simulador" className="group relative overflow-hidden rounded-[28px] border border-line bg-surface p-6">
          <div className="absolute -right-10 -top-10 size-40 rounded-full bg-accent-soft blur-2xl" />
          <span className="grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent"><Calculator className="size-5" /></span>
          <h3 className="mt-4 text-lg font-semibold">Simulador de financiamento</h3>
          <p className="mt-1 max-w-sm text-sm text-muted">Compare SAC e Price, veja a parcela ideal e a renda necessária em segundos.</p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent">Simular agora <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
        </Link>
        <Link to="/anunciar" className="group relative overflow-hidden rounded-[28px] bg-primary p-6 text-primary-ink">
          <span className="grid size-11 place-items-center rounded-2xl bg-black/10"><Megaphone className="size-5" /></span>
          <h3 className="mt-4 text-lg font-semibold">Quer vender ou alugar seu imóvel?</h3>
          <p className="mt-1 max-w-sm text-sm opacity-75">Cadastre em minutos. Nossa equipe avalia, fotografa e divulga para milhares de interessados.</p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">Anunciar imóvel <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
        </Link>
      </section>

      <footer className="mt-14 flex flex-col items-center gap-2 border-t border-line pt-8 text-center text-xs text-faint">
        <Logo />
        <p className="mt-2">© {new Date().getFullYear()} Walisson Imóveis · CRECI J-00000 · Todos os direitos reservados</p>
        <p><Link to="/termos" className="hover:text-text">Termos de uso e privacidade (LGPD)</Link></p>
      </footer>
    </Page>
  );
}
