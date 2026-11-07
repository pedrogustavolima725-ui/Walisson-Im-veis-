import { StrictMode, Suspense, lazy, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, createMemoryRouter, Navigate, Outlet, RouterProvider, ScrollRestoration } from 'react-router-dom';
import { DEMO } from './lib/api';
import './styles.css';
import { AuthProvider, CompareProvider, CountsProvider, ThemeProvider, ToastProvider } from './context/app';
import { AppLayout, CrmLayout, RequireAuth } from './components/layout';
import { PageLoader } from './components/ui';

// Carregamento sob demanda por página (code splitting)
function lz<M extends Record<string, unknown>>(loader: () => Promise<M>, name: keyof M) {
  const C = lazy(() => loader().then((m) => ({ default: m[name] as ComponentType })));
  return <Suspense fallback={<PageLoader />}><C /></Suspense>;
}
const auth = () => import('./pages/auth');
const client = () => import('./pages/client');
const account = () => import('./pages/account');
const crm = () => import('./pages/crm/dashboard');
const leads = () => import('./pages/crm/leads');
const crmProps = () => import('./pages/crm/properties');
const crmOps = () => import('./pages/crm/operations');
const crmAdmin = () => import('./pages/crm/admin');
const messages = () => import('./pages/messages');

const guard = (el: React.ReactNode) => <RequireAuth>{el}</RequireAuth>;

if (DEMO) {
  // O visualizador não exibe confirm(); na demonstração as confirmações seguem direto
  window.confirm = () => true;
  // Links de exportação (CSV) dependem do servidor real
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest?.('a[href^="/api/"]');
    if (a) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('wi-toast', { detail: 'Exportação disponível na versão instalada no servidor.' }));
    }
  }, true);
}

function DemoBar() {
  return (
    <div className="relative z-50 border-b border-line bg-accent-soft px-4 py-1.5 text-center text-[11px] font-medium text-accent">
      Demonstração · dados de exemplo · senha das contas de teste: Demo@2026 · alterações não são salvas
    </div>
  );
}

function Root() {
  return (
    <>
      {DEMO ? <DemoBar /> : <ScrollRestoration />}
      <Outlet />
    </>
  );
}

const router = (DEMO ? createMemoryRouter : createBrowserRouter)([
  {
    element: <Root />,
    children: [
      { path: '/boas-vindas', element: lz(auth, 'Onboarding') },
      { path: '/entrar', element: lz(auth, 'Login') },
      { path: '/cadastro', element: lz(auth, 'Register') },
      { path: '/esqueci-senha', element: lz(auth, 'Forgot') },
      { path: '/redefinir-senha', element: lz(auth, 'Reset') },
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: lz(() => import('./pages/home'), 'Home') },
          { path: '/buscar', element: lz(() => import('./pages/search'), 'Search') },
          { path: '/imovel/:id', element: lz(() => import('./pages/property'), 'PropertyPage') },
          { path: '/comparar', element: lz(client, 'Compare') },
          { path: '/simulador', element: lz(client, 'Simulator') },
          { path: '/corretores', element: lz(client, 'Agents') },
          { path: '/favoritos', element: guard(lz(client, 'Favorites')) },
          { path: '/visitas', element: guard(lz(client, 'Visits')) },
          { path: '/propostas', element: guard(lz(client, 'Proposals')) },
          { path: '/alertas', element: guard(lz(client, 'Alerts')) },
          { path: '/notificacoes', element: guard(lz(client, 'Notifications')) },
          { path: '/anunciar', element: guard(lz(client, 'Announce')) },
          { path: '/mensagens', element: guard(lz(messages, 'Messages')) },
          { path: '/mensagens/:id', element: guard(lz(messages, 'Messages')) },
          { path: '/perfil', element: guard(lz(account, 'Profile')) },
          { path: '/perfil/seguranca', element: guard(lz(account, 'Security')) },
          { path: '/perfil/privacidade', element: guard(lz(account, 'Privacy')) },
          { path: '/termos', element: lz(account, 'Terms') },
          { path: '*', element: lz(client, 'NotFound') },
        ],
      },
      {
        path: '/crm',
        element: <CrmLayout />,
        children: [
          { index: true, element: lz(crm, 'Dashboard') },
          { path: 'leads', element: lz(leads, 'Leads') },
          { path: 'leads/:id', element: lz(leads, 'LeadDetail') },
          { path: 'imoveis', element: lz(crmProps, 'CrmProperties') },
          { path: 'imoveis/novo', element: lz(crmProps, 'PropertyForm') },
          { path: 'imoveis/:id', element: lz(crmProps, 'PropertyForm') },
          { path: 'agenda', element: lz(crmOps, 'Agenda') },
          { path: 'propostas', element: lz(crmOps, 'CrmProposals') },
          { path: 'clientes', element: lz(crmOps, 'Clients') },
          { path: 'mensagens', element: lz(messages, 'Messages') },
          { path: 'mensagens/:id', element: lz(messages, 'Messages') },
          { path: 'equipe', element: lz(crmAdmin, 'Team') },
          { path: 'seguranca', element: lz(crmAdmin, 'SecurityCenter') },
          { path: '*', element: <Navigate to="/crm" replace /> },
        ],
      },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <CountsProvider>
            <CompareProvider>
              <RouterProvider router={router} />
            </CompareProvider>
          </CountsProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);
