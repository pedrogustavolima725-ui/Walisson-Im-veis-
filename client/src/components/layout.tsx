import { useState, type ReactNode } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Building2, CalendarDays, ClipboardList, FileSignature, GitCompareArrows, Heart, Home, LayoutDashboard, LogOut, Menu,
  MessageCircle, Moon, Search, ShieldCheck, Sun, User, Users, UsersRound, X, Calculator, Megaphone, BellRing, ArrowLeftRight,
} from 'lucide-react';
import { useAuth, useCompare, useCounts, useTheme, type Role } from '../context/app';
import { Avatar, cx, PageLoader } from './ui';

export function Logo({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <Link to="/" className={cx('flex items-center gap-2.5', className)} aria-label="Walisson Imóveis — início">
      <span className="grid size-10 place-items-center rounded-2xl border border-line-strong bg-surface-2">
        <svg viewBox="0 0 64 64" className="size-6" aria-hidden>
          <path d="M14 30 32 15l18 15" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19 27v20h26V27" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinejoin="round" />
          <path d="m24 33 3.5 10L32 34l4.5 9L40 33" fill="none" stroke="var(--text)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block text-[15px] font-semibold tracking-tight">Walisson</span>
          <span className="block text-[10px] font-medium uppercase tracking-[0.28em] text-muted">Imóveis</span>
        </span>
      )}
    </Link>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} className={cx('grid size-10 place-items-center rounded-full border border-line bg-surface-2 text-muted hover:text-text', className)} aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}>
      {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}

function CountDot({ n }: { n: number }) {
  if (!n) return null;
  return <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{n > 9 ? '9+' : n}</span>;
}

export function NotificationBell() {
  const { unread } = useCounts();
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Link to="/notificacoes" className="relative grid size-10 place-items-center rounded-full border border-line bg-surface-2 text-muted hover:text-text" aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ''}`}>
      <Bell className="size-[18px]" />
      <CountDot n={unread} />
    </Link>
  );
}

type NavItem = { to: string; label: string; icon: typeof Home; end?: boolean; badge?: number; roles?: Role[] };

function SideNav({ items, footer, header }: { items: NavItem[]; footer?: ReactNode; header?: ReactNode }) {
  const { user } = useAuth();
  return (
    <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col border-r border-line bg-bg-elev px-4 py-6 lg:flex">
      <div className="px-2"><Logo /></div>
      {header}
      <nav className="mt-8 flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Navegação principal">
        {items.filter((i) => !i.roles || (user && i.roles.includes(user.role))).map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              cx('relative flex h-11 items-center gap-3 rounded-2xl px-3.5 text-[14px] font-medium transition',
                isActive ? 'bg-gradient-to-r from-accent-soft to-transparent text-text before:absolute before:left-0 before:h-5 before:w-[3px] before:rounded-full before:bg-accent' : 'text-muted hover:bg-surface-2 hover:text-text')
            }
          >
            <it.icon className="size-[18px]" />
            {it.label}
            {!!it.badge && <span className="ml-auto rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">{it.badge}</span>}
          </NavLink>
        ))}
      </nav>
      {footer}
    </aside>
  );
}

function UserFooter({ crm }: { crm?: boolean }) {
  const { user, logout, isStaff } = useAuth();
  const nav = useNavigate();
  if (!user)
    return (
      <div className="rounded-3xl border border-line bg-surface p-4">
        <p className="text-sm font-semibold">Sua conta Walisson</p>
        <p className="mt-1 text-xs text-muted">Salve favoritos, agende visitas e converse com corretores.</p>
        <Link to="/entrar" className="mt-3 flex h-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-ink">Entrar</Link>
      </div>
    );
  return (
    <div className="space-y-2">
      {isStaff && (
        <Link to={crm ? '/' : '/crm'} className="flex h-11 items-center gap-3 rounded-2xl border border-line px-3.5 text-[13px] font-medium text-muted hover:text-text">
          <ArrowLeftRight className="size-4" /> {crm ? 'Ver portal do cliente' : 'Abrir CRM'}
        </Link>
      )}
      <div className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-3">
        <Avatar name={user.name} src={user.avatar} size={38} />
        <Link to="/perfil" className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{user.name}</div>
          <div className="truncate text-xs text-muted">{user.email}</div>
        </Link>
        <button onClick={async () => { await logout(); nav('/'); }} aria-label="Sair" className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-danger">
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );
}

function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden" aria-label="Navegação">
      <div className="glass mx-auto flex max-w-md items-center justify-between rounded-[28px] border border-line-strong p-1.5 shadow-soft">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              cx('relative flex h-12 flex-1 items-center justify-center gap-2 rounded-[22px] text-[12px] font-semibold transition',
                isActive ? 'flex-[1.6] bg-primary text-primary-ink' : 'text-muted')
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative"><it.icon className="size-5" /><CountDot n={it.badge ?? 0} /></span>
                {isActive && <span className="animate-fade-up">{it.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function CompareBar() {
  const { ids, clear } = useCompare();
  const loc = useLocation();
  if (ids.length === 0 || loc.pathname === '/comparar' || loc.pathname.startsWith('/mensagens/')) return null;
  return (
    <div className="fixed inset-x-0 bottom-[92px] z-30 flex justify-center px-4 lg:bottom-6">
      <div className="glass animate-fade-up flex items-center gap-3 rounded-full border border-line-strong py-1.5 pl-4 pr-1.5 shadow-soft">
        <GitCompareArrows className="size-4 text-accent" />
        <span className="text-sm font-medium">{ids.length} {ids.length > 1 ? 'imóveis' : 'imóvel'} para comparar</span>
        <button onClick={clear} className="text-xs text-muted hover:text-text">Limpar</button>
        <Link to="/comparar" className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-ink">Comparar</Link>
      </div>
    </div>
  );
}

/* ============================ Portal do cliente ============================ */
export function AppLayout() {
  const { unreadMessages } = useCounts();
  const { user } = useAuth();
  const loc = useLocation();
  // Telas com barra de ação própria (imóvel, conversa) escondem o menu inferior no celular
  const ownBar = /^\/imovel\/|^\/mensagens\/\d+/.test(loc.pathname);
  const side: NavItem[] = [
    { to: '/', label: 'Início', icon: Home, end: true },
    { to: '/buscar', label: 'Buscar imóveis', icon: Search },
    { to: '/favoritos', label: 'Favoritos', icon: Heart },
    { to: '/visitas', label: 'Minhas visitas', icon: CalendarDays },
    { to: '/propostas', label: 'Propostas', icon: FileSignature },
    { to: '/mensagens', label: 'Mensagens', icon: MessageCircle, badge: unreadMessages },
    { to: '/alertas', label: 'Alertas de busca', icon: BellRing },
    { to: '/comparar', label: 'Comparar', icon: GitCompareArrows },
    { to: '/simulador', label: 'Simulador', icon: Calculator },
    { to: '/corretores', label: 'Corretores', icon: UsersRound },
    { to: '/anunciar', label: 'Anunciar imóvel', icon: Megaphone },
    { to: '/perfil', label: 'Minha conta', icon: User },
  ];
  const bottom: NavItem[] = [
    { to: '/', label: 'Início', icon: Home, end: true },
    { to: '/buscar', label: 'Buscar', icon: Search },
    { to: '/favoritos', label: 'Salvos', icon: Heart },
    { to: '/mensagens', label: 'Chat', icon: MessageCircle, badge: unreadMessages },
    { to: user ? '/perfil' : '/entrar', label: user ? 'Perfil' : 'Entrar', icon: User },
  ];
  return (
    <div className="ambient flex min-h-screen">
      <SideNav items={side} footer={<UserFooter />} />
      <main className={cx('relative z-10 min-w-0 flex-1 lg:pb-12', ownBar ? 'pb-6' : 'pb-32')}>
        <Outlet />
      </main>
      <CompareBar />
      {!ownBar && <BottomNav items={bottom} />}
    </div>
  );
}

/** Contêiner padrão de página do portal. */
export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cx('mx-auto w-full px-4 pt-5 sm:px-6 lg:px-10 lg:pt-8', wide ? 'max-w-[1400px]' : 'max-w-[1100px]', className)}>{children}</div>;
}

/* ============================ CRM ============================ */
export function CrmLayout() {
  const { user, ready } = useAuth();
  const { unreadMessages } = useCounts();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to="/entrar" state={{ from: loc.pathname }} replace />;
  if (user.role === 'cliente') return <Navigate to="/" replace />;

  const items: NavItem[] = [
    { to: '/crm', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/crm/leads', label: 'Leads & Funil', icon: Users },
    { to: '/crm/agenda', label: 'Agenda & Tarefas', icon: CalendarDays },
    { to: '/crm/imoveis', label: 'Imóveis', icon: Building2 },
    { to: '/crm/propostas', label: 'Propostas', icon: FileSignature },
    { to: '/crm/clientes', label: 'Clientes', icon: UsersRound },
    { to: '/crm/mensagens', label: 'Mensagens', icon: MessageCircle, badge: unreadMessages },
    { to: '/crm/equipe', label: 'Equipe', icon: ClipboardList, roles: ['admin'] },
    { to: '/crm/seguranca', label: 'Segurança', icon: ShieldCheck, roles: ['admin'] },
  ];
  const bottom: NavItem[] = [
    { to: '/crm', label: 'Painel', icon: LayoutDashboard, end: true },
    { to: '/crm/leads', label: 'Leads', icon: Users },
    { to: '/crm/agenda', label: 'Agenda', icon: CalendarDays },
    { to: '/crm/imoveis', label: 'Imóveis', icon: Building2 },
    { to: '/crm/mensagens', label: 'Chat', icon: MessageCircle, badge: unreadMessages },
  ];
  return (
    <div className="ambient flex min-h-screen">
      <SideNav
        items={items}
        header={<div className="mt-5 rounded-2xl border border-line bg-surface px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">CRM · {user.role === 'admin' ? 'Administrador' : 'Corretor'}</div>}
        footer={<UserFooter crm />}
      />
      <main className="relative z-10 min-w-0 flex-1 pb-32 lg:pb-12">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="grid size-10 place-items-center rounded-full border border-line bg-surface-2"><Menu className="size-5" /></button>
          <Logo compact />
          <NotificationBell />
        </div>
        <div className="mx-auto w-full max-w-[1500px] px-4 pt-5 sm:px-6 lg:px-10 lg:pt-8">
          <div className="mb-2 hidden items-center justify-end gap-2 lg:flex">
            <ThemeToggle />
            <NotificationBell />
          </div>
          <Outlet />
        </div>
      </main>
      <BottomNav items={bottom} />
      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="animate-fade-up absolute inset-y-0 left-0 flex w-[84%] max-w-xs flex-col bg-bg-elev p-4">
            <div className="mb-6 flex items-center justify-between"><Logo /><button onClick={() => setOpen(false)} aria-label="Fechar menu" className="grid size-9 place-items-center rounded-full bg-surface-2"><X className="size-4" /></button></div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
              {items.filter((i) => !i.roles || i.roles.includes(user.role)).map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end} onClick={() => setOpen(false)} className={({ isActive }) => cx('flex h-12 items-center gap-3 rounded-2xl px-3.5 text-[15px] font-medium', isActive ? 'bg-surface-2 text-text' : 'text-muted')}>
                  <it.icon className="size-5" /> {it.label}
                </NavLink>
              ))}
            </nav>
            <div className="mb-3 flex items-center justify-between rounded-2xl border border-line px-3 py-2 text-sm text-muted">Tema <ThemeToggle /></div>
            <UserFooter crm />
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ Guardas de rota ============================ */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to="/entrar" state={{ from: loc.pathname + loc.search }} replace />;
  return <>{children}</>;
}
