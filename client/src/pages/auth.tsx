import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, KeyRound, Lock, Mail, Phone, ShieldCheck, User as UserIcon } from 'lucide-react';
import { api, ApiError, DEMO, setCsrf } from '../lib/api';
import { maskPhone, passwordStrength } from '../lib/format';
import { useAuth, useToast } from '../context/app';
import { Button, cx, Field, Img, Input, PasswordInput } from '../components/ui';
import { Logo, ThemeToggle } from '../components/layout';

const HERO = 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=80';
const HERO_2 = 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1400&q=80';
const HERO_3 = 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80';

/* ============================ Onboarding ============================ */
const SLIDES = [
  { img: HERO, title: 'Espaços lindos, escolhas seguras', text: 'Encontre o imóvel ideal com curadoria da Walisson Imóveis e atendimento de verdade.' },
  { img: HERO_2, title: 'Visite quando quiser', text: 'Agende visitas em segundos, converse com o corretor e acompanhe tudo pelo app.' },
  { img: HERO_3, title: 'Negocie com transparência', text: 'Simule o financiamento, envie propostas e receba alertas de novos imóveis.' },
];

export function Onboarding() {
  const [i, setI] = useState(0);
  const nav = useNavigate();
  const finish = () => {
    try { localStorage.setItem('wi-onboarded', '1'); } catch { /* ignora */ }
    nav('/');
  };
  const s = SLIDES[i];
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-black text-white">
      {SLIDES.map((sl, idx) => (
        <Img key={sl.img} src={sl.img} alt="" className={cx('absolute inset-0 size-full transition-opacity duration-700', idx === i ? 'opacity-100' : 'opacity-0!')} />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-black/90" />
      <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 pb-10 pt-[max(24px,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur">
              <svg viewBox="0 0 64 64" className="size-6" aria-hidden><path d="M14 30 32 15l18 15" fill="none" stroke="#d8bb92" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /><path d="M19 27v20h26V27" fill="none" stroke="#d8bb92" strokeWidth="4" strokeLinejoin="round" /><path d="m24 33 3.5 10L32 34l4.5 9L40 33" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span className="leading-none"><span className="block text-[15px] font-semibold">Walisson</span><span className="block text-[10px] uppercase tracking-[0.28em] text-white/70">Imóveis</span></span>
          </div>
          <button onClick={finish} className="text-sm text-white/80 hover:text-white">Pular</button>
        </div>
        <div className="mt-auto">
          <h1 key={s.title} className="animate-fade-up text-[34px] font-semibold leading-[1.1] tracking-tight">{s.title}</h1>
          <p key={s.text} className="animate-fade-up mt-3 text-[15px] leading-relaxed text-white/80">{s.text}</p>
          <button
            onClick={() => (i < SLIDES.length - 1 ? setI(i + 1) : finish())}
            className="mt-8 flex h-16 w-full items-center justify-between rounded-full bg-[#d8bb92] pl-7 pr-2 text-[15px] font-semibold text-[#1a140e] transition active:scale-[.98]"
          >
            {i < SLIDES.length - 1 ? 'Continuar' : 'Começar'}
            <span className="grid size-12 place-items-center rounded-full bg-[#1a140e] text-[#f4eee6]"><ArrowRight className="size-5" /></span>
          </button>
          <div className="mt-6 flex justify-center gap-1.5" role="tablist" aria-label="Etapas">
            {SLIDES.map((_, idx) => (
              <button key={idx} onClick={() => setI(idx)} aria-label={`Etapa ${idx + 1}`} className={cx('h-1.5 rounded-full transition-all', idx === i ? 'w-6 bg-white' : 'w-1.5 bg-white/40')} />
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-white/75">
            Já tem conta? <Link to="/entrar" onClick={() => { try { localStorage.setItem('wi-onboarded', '1'); } catch { /* */ } }} className="font-semibold text-white underline-offset-4 hover:underline">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================ Shell ============================ */
function AuthShell({ title, subtitle, children, image = HERO_2 }: { title: string; subtitle?: ReactNode; children: ReactNode; image?: string }) {
  return (
    <div className="flex min-h-[100dvh] bg-bg">
      <div className="relative hidden w-[46%] overflow-hidden lg:block">
        <Img src={image} alt="" className="absolute inset-0 size-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />
        <div className="absolute inset-x-10 bottom-10 text-white">
          <p className="text-[32px] font-semibold leading-tight tracking-tight">Seu próximo lar começa aqui.</p>
          <p className="mt-3 max-w-md text-white/75">Mais de 20 imóveis selecionados, corretores credenciados e negociação 100% segura.</p>
          <div className="mt-6 flex items-center gap-2 text-sm text-white/80"><ShieldCheck className="size-4 text-[#86c08a]" /> Dados protegidos conforme a LGPD</div>
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="relative h-56 overflow-hidden rounded-b-[40px] lg:hidden">
          <Img src={image} alt="" className="absolute inset-0 size-full" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/70" />
        </div>
        <div className="mx-auto -mt-14 flex w-full max-w-md flex-1 flex-col px-5 pb-10 lg:mt-0 lg:justify-center">
          <div className="relative rounded-[32px] border border-line bg-bg-elev p-6 shadow-soft lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            <div className="mb-6 flex items-center justify-between"><Logo /><ThemeToggle /></div>
            <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div role="alert" className="mb-4 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{msg}</div>;
}

/* ============================ Login + 2FA ============================ */
export function Login() {
  const { user, setSession, ready, demo } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const from = (loc.state as { from?: string } | null)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [code, setCode] = useState('');
  const [mfa, setMfa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  if (ready && user && !mfa) return <Navigate to={from ?? (user.role === 'cliente' ? '/' : '/crm')} replace />;

  const done = (u: any, csrf: string) => {
    setSession(u, csrf);
    toast(`Bem-vindo(a), ${u.name.split(' ')[0]}!`);
    nav(from ?? (u.role === 'cliente' ? '/' : '/crm'), { replace: true });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null); setFields({}); setLoading(true);
    try {
      if (!mfa) {
        const r = await api('/auth/login', { body: { email, password, remember } });
        if (r.mfaRequired) { setCsrf(r.csrfToken); setMfa(true); return; }
        done(r.user, r.csrfToken);
      } else {
        const r = await api('/auth/mfa', { body: { code: code.trim(), remember } });
        done(r.user, r.csrfToken);
      }
    } catch (e) {
      const ae = e as ApiError;
      setErr(ae.message); setFields(ae.fields ?? {});
      if (mfa && ae.status === 401) { setMfa(false); setCode(''); }
    } finally {
      setLoading(false);
    }
  };

  if (mfa)
    return (
      <AuthShell title="Verificação em duas etapas" subtitle="Digite o código de 6 dígitos do seu aplicativo autenticador ou um código de recuperação.">
        <form onSubmit={submit} className="space-y-4">
          <FormError msg={err} />
          <Field label="Código de verificação" error={fields.code}>
            <Input autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" maxLength={12} className="text-center text-2xl tracking-[0.5em]" icon={<KeyRound className="size-4" />} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={loading}>Verificar e entrar</Button>
          <button type="button" onClick={() => { setMfa(false); setErr(null); }} className="w-full text-center text-sm text-muted hover:text-text">Voltar</button>
        </form>
      </AuthShell>
    );

  return (
    <AuthShell title="Bem-vindo de volta" subtitle="Entre para ver favoritos, visitas e mensagens.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError msg={err} />
        <Field label="E-mail" error={fields.email}>
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" icon={<Mail className="size-4" />} invalid={!!fields.email} />
        </Field>
        <Field label="Senha" error={fields.password}>
          <PasswordInput autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" invalid={!!fields.password} />
        </Field>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-muted">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-[var(--accent)]" /> Manter conectado
          </label>
          <Link to="/esqueci-senha" className="font-medium text-accent hover:underline">Esqueci a senha</Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Entrar</Button>
        <p className="text-center text-sm text-muted">Não tem conta? <Link to="/cadastro" state={loc.state} className="font-semibold text-text hover:text-accent">Criar conta</Link></p>
        {demo && <DemoAccounts onPick={(e) => { setEmail(e); setPassword('Demo@2026'); }} />}
      </form>
    </AuthShell>
  );
}

function DemoAccounts({ onPick }: { onPick: (email: string) => void }) {
  const accounts = [
    { label: 'Cliente', email: 'cliente@walissonimoveis.com.br' },
    { label: 'Corretor', email: 'mariana@walissonimoveis.com.br' },
    { label: 'Admin', email: 'admin@walissonimoveis.com.br' },
  ];
  return (
    <div className="rounded-2xl border border-dashed border-line-strong p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Contas de demonstração</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {accounts.map((a) => (
          <button key={a.email} type="button" onClick={() => onPick(a.email)} className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted hover:text-text">{a.label}</button>
        ))}
      </div>
    </div>
  );
}

/* ============================ Cadastro ============================ */
export function PasswordMeter({ value }: { value: string }) {
  const s = passwordStrength(value);
  const checks = [
    { ok: value.length >= 8, t: '8+ caracteres' },
    { ok: /[A-Z]/.test(value) && /[a-z]/.test(value), t: 'Maiúscula e minúscula' },
    { ok: /\d/.test(value), t: 'Um número' },
    { ok: /[^A-Za-z0-9]/.test(value), t: 'Símbolo (recomendado)' },
  ];
  if (!value) return null;
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cx('h-1 flex-1 rounded-full', i < s.level ? (s.level <= 1 ? 'bg-danger' : s.level === 2 ? 'bg-warning' : 'bg-success') : 'bg-surface-3')} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        <span className="font-semibold text-muted">{s.label}</span>
        {checks.map((c) => <span key={c.t} className={c.ok ? 'text-success' : 'text-faint'}>{c.ok ? '✓' : '○'} {c.t}</span>)}
      </div>
    </div>
  );
}

export function Register() {
  const { user, setSession } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', confirm: '', acceptTerms: false, marketing: false });
  const [err, setErr] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : k === 'phone' ? maskPhone(e.target.value) : e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null); setFields({});
    if (f.password !== f.confirm) return setFields({ confirm: 'As senhas não conferem' });
    setLoading(true);
    try {
      const r = await api('/auth/register', { body: { name: f.name, email: f.email, phone: f.phone, password: f.password, acceptTerms: f.acceptTerms, marketing: f.marketing } });
      setSession(r.user, r.csrfToken);
      toast('Conta criada com sucesso!');
      nav((loc.state as any)?.from ?? '/', { replace: true });
    } catch (e) {
      const ae = e as ApiError;
      setErr(ae.message); setFields(ae.fields ?? {});
    } finally { setLoading(false); }
  };

  return (
    <AuthShell title="Criar sua conta" subtitle="Leva menos de um minuto." image={HERO_3}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError msg={err} />
        <Field label="Nome completo" error={fields.name}><Input autoComplete="name" value={f.name} onChange={set('name')} placeholder="Seu nome" icon={<UserIcon className="size-4" />} invalid={!!fields.name} /></Field>
        <Field label="E-mail" error={fields.email}><Input type="email" autoComplete="email" value={f.email} onChange={set('email')} placeholder="voce@email.com" icon={<Mail className="size-4" />} invalid={!!fields.email} /></Field>
        <Field label="Celular (opcional)" error={fields.phone}><Input type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} placeholder="(00) 00000-0000" icon={<Phone className="size-4" />} /></Field>
        <Field label="Senha" error={fields.password}>
          <PasswordInput autoComplete="new-password" value={f.password} onChange={set('password')} placeholder="Crie uma senha forte" invalid={!!fields.password} />
          <PasswordMeter value={f.password} />
        </Field>
        <Field label="Confirmar senha" error={fields.confirm}><PasswordInput autoComplete="new-password" value={f.confirm} onChange={set('confirm')} placeholder="Repita a senha" invalid={!!fields.confirm} /></Field>
        <label className="flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" checked={f.acceptTerms} onChange={set('acceptTerms')} className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" />
          <span>Li e aceito os <Link to="/termos" target={DEMO ? undefined : '_blank'} className="text-accent underline-offset-2 hover:underline">Termos de Uso e a Política de Privacidade</Link>.</span>
        </label>
        {fields.acceptTerms && <p className="-mt-2 text-xs text-danger">{fields.acceptTerms}</p>}
        <label className="flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" checked={f.marketing} onChange={set('marketing')} className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" />
          Quero receber novidades e oportunidades por e-mail (opcional).
        </label>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Criar conta</Button>
        <p className="text-center text-sm text-muted">Já tem conta? <Link to="/entrar" className="font-semibold text-text hover:text-accent">Entrar</Link></p>
      </form>
    </AuthShell>
  );
}

/* ============================ Recuperação de senha ============================ */
export function Forgot() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<{ message: string; devResetUrl?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    try { setSent(await api('/auth/forgot', { body: { email } })); } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };
  return (
    <AuthShell title="Recuperar senha" subtitle="Enviaremos um link seguro, válido por 30 minutos.">
      {sent ? (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-2xl border border-success/30 bg-success-soft p-4 text-sm text-success"><CheckCircle2 className="size-5 shrink-0" />{sent.message}</div>
          {sent.devResetUrl && (
            <div className="rounded-2xl border border-dashed border-line-strong p-4 text-xs text-muted">
              <b className="text-text">Modo desenvolvimento:</b> como não há servidor de e-mail configurado, use este link:
              <a href={sent.devResetUrl.replace(/^https?:\/\/[^/]+/, '')} className="mt-2 block break-all text-accent underline">Redefinir senha agora</a>
            </div>
          )}
          <Link to="/entrar" className="block text-center text-sm font-semibold text-muted hover:text-text">Voltar ao login</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <FormError msg={err} />
          <Field label="E-mail cadastrado"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" icon={<Mail className="size-4" />} /></Field>
          <Button type="submit" size="lg" className="w-full" loading={loading}>Enviar link</Button>
          <Link to="/entrar" className="block text-center text-sm text-muted hover:text-text">Lembrei a senha</Link>
        </form>
      )}
    </AuthShell>
  );
}

export function Reset() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const nav = useNavigate();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    // remove o token da barra de endereço/histórico assim que lido
    if (token) window.history.replaceState(null, '', '/redefinir-senha');
  }, [token]);
  const [tk] = useState(token);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null); setFields({});
    if (pw !== confirm) return setFields({ confirm: 'As senhas não conferem' });
    setLoading(true);
    try {
      await api('/auth/reset', { body: { token: tk, password: pw } });
      toast('Senha redefinida! Faça login com a nova senha.');
      nav('/entrar', { replace: true });
    } catch (e) {
      const ae = e as ApiError; setErr(ae.message); setFields(ae.fields ?? {});
    } finally { setLoading(false); }
  };
  if (!tk) return <AuthShell title="Link inválido" subtitle="Solicite um novo link de redefinição."><Link to="/esqueci-senha" className="font-semibold text-accent">Solicitar novo link</Link></AuthShell>;
  return (
    <AuthShell title="Criar nova senha" subtitle="Por segurança, todas as sessões serão encerradas.">
      <form onSubmit={submit} className="space-y-4">
        <FormError msg={err} />
        <Field label="Nova senha" error={fields.password}><PasswordInput autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} icon={<Lock className="size-4" />} /><PasswordMeter value={pw} /></Field>
        <Field label="Confirmar senha" error={fields.confirm}><PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Salvar nova senha</Button>
      </form>
    </AuthShell>
  );
}
