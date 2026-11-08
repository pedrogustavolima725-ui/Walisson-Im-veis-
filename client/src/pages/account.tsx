import { useState } from 'react';
import { BellRing as BellIcon, Mail, Send, Smartphone as PhoneIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BellRing, CalendarDays, Camera, ChevronRight, Download, FileSignature, KeyRound, LayoutDashboard, Laptop, LogOut, Megaphone, Moon,
  ShieldAlert, ShieldCheck, Smartphone, Trash2, UserRound,
} from 'lucide-react';
import { api, uploadImages } from '../lib/api';
import { useApi } from '../lib/hooks';
import { dateShort, deviceName, maskPhone, relative, ROLE_LABEL } from '../lib/format';
import { useAuth, useTheme, useToast } from '../context/app';
import { Avatar, Badge, Button, Card, cx, Field, Input, Modal, PageHeader, PageLoader, PasswordInput, Textarea, Toggle } from '../components/ui';
import { Page } from '../components/layout';
import { PasswordMeter } from './auth';

/* ============================ Perfil ============================ */
export function Profile() {
  const { user, setSession, logout, isStaff } = useAuth();
  const { theme, set } = useTheme();
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({ name: user!.name, phone: user!.phone ?? '', bio: user!.bio ?? '', creci: user!.creci ?? '', marketing: !!user!.marketing_opt_in });
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  const save = async (patch: Partial<typeof f> & { avatar?: string } = {}) => {
    setSaving(true); setFields({});
    try {
      const r = await api('/me/profile', { method: 'PUT', body: { ...f, ...patch } });
      setSession(r.user, (await api('/auth/me')).csrfToken);
      toast('Perfil atualizado.');
    } catch (e: any) { setFields(e.fields ?? {}); toast(e.message, 'error'); } finally { setSaving(false); }
  };
  const onAvatar = async (files: FileList | null) => {
    if (!files?.[0]) return;
    try { const [url] = await uploadImages([files[0]]); await save({ avatar: url }); } catch (e: any) { toast(e.message, 'error'); }
  };

  const links = [
    { to: '/visitas', icon: CalendarDays, label: 'Minhas visitas' },
    { to: '/propostas', icon: FileSignature, label: 'Minhas propostas' },
    { to: '/alertas', icon: BellRing, label: 'Alertas de busca' },
    { to: '/anunciar', icon: Megaphone, label: 'Anunciar meu imóvel' },
    { to: '/perfil/seguranca', icon: ShieldCheck, label: 'Segurança da conta', badge: user!.totp_enabled ? undefined : 'Ative o 2FA' },
    { to: '/perfil/privacidade', icon: UserRound, label: 'Privacidade e dados (LGPD)' },
  ];

  return (
    <Page>
      <PageHeader title="Minha conta" />
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card className="flex flex-col items-center p-6 text-center">
            <label className="relative cursor-pointer">
              <Avatar name={user!.name} src={user!.avatar} size={96} />
              <span className="absolute bottom-0 right-0 grid size-8 place-items-center rounded-full bg-primary text-primary-ink"><Camera className="size-4" /></span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onAvatar(e.target.files)} aria-label="Alterar foto" />
            </label>
            <h2 className="mt-3 text-lg font-semibold">{user!.name}</h2>
            <p className="text-sm text-muted">{user!.email}</p>
            <div className="mt-2 flex gap-2"><Badge tone="accent">{ROLE_LABEL[user!.role]}</Badge>{user!.totp_enabled ? <Badge tone="success">2FA ativo</Badge> : <Badge tone="warning">Sem 2FA</Badge>}</div>
            <p className="mt-3 text-xs text-faint">Membro desde {dateShort(user!.created_at)}</p>
          </Card>
          {isStaff && <Link to="/crm"><Button className="w-full" icon={<LayoutDashboard className="size-4" />}>Abrir CRM</Button></Link>}
          <Card className="divide-y divide-line overflow-hidden">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2">
                <l.icon className="size-[18px] text-accent" /><span className="flex-1 text-sm font-medium">{l.label}</span>
                {l.badge && <Badge tone="warning">{l.badge}</Badge>}
                <ChevronRight className="size-4 text-faint" />
              </Link>
            ))}
            <div className="flex items-center gap-3 px-4 py-3"><Moon className="size-[18px] text-accent" /><span className="flex-1 text-sm font-medium">Tema escuro</span><Toggle checked={theme === 'dark'} onChange={(v) => set(v ? 'dark' : 'light')} /></div>
            <button onClick={async () => { await logout(); nav('/'); }} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-danger hover:bg-danger-soft"><LogOut className="size-[18px]" /><span className="text-sm font-medium">Sair da conta</span></button>
          </Card>
        </div>
        <div className="space-y-5">
        <NotificationSettings />
        <Card className="h-fit p-5 md:p-6">
          <h3 className="mb-4 font-semibold">Dados pessoais</h3>
          <div className="space-y-4">
            <Field label="Nome completo" error={fields.name}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></Field>
            <Field label="E-mail" hint="Para alterar o e-mail, fale com o suporte (verificação de identidade)."><Input value={user!.email} disabled /></Field>
            <Field label="Celular / WhatsApp" error={fields.phone}><Input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: maskPhone(e.target.value) })} autoComplete="tel" /></Field>
            {isStaff && (
              <>
                <Field label="CRECI"><Input value={f.creci} onChange={(e) => setF({ ...f, creci: e.target.value })} /></Field>
                <Field label="Apresentação (exibida aos clientes)"><Textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} maxLength={500} /></Field>
              </>
            )}
            <Toggle checked={f.marketing} onChange={(v) => setF({ ...f, marketing: v })} label="Receber novidades por e-mail" description="Você pode cancelar quando quiser." />
            <Button loading={saving} onClick={() => save()}>Salvar alterações</Button>
          </div>
        </Card>
        </div>
      </div>
    </Page>
  );
}

/* ============================ Notificações ============================ */
function NotificationSettings() {
  const toast = useToast();
  const { data, setData, loading } = useApi<{ email: boolean; push: boolean; devices: number; emailAvailable: boolean; pushAvailable: boolean }>('/me/notification-settings');
  const [sending, setSending] = useState(false);
  const inApp = !!(window as unknown as { WalissonApp?: unknown }).WalissonApp;
  const save = async (patch: { email?: boolean; push?: boolean }) => {
    if (!data) return;
    const next = { email: patch.email ?? data.email, push: patch.push ?? data.push };
    setData({ ...data, ...next });
    try { await api('/me/notification-settings', { method: 'PUT', body: next }); toast('Preferências salvas.'); }
    catch (e: any) { setData(data); toast(e.message, 'error'); }
  };
  const test = async () => {
    setSending(true);
    try { await api('/me/notifications/test', { body: {} }); toast('Notificação de teste enviada!'); }
    catch (e: any) { toast(e.message, 'error'); } finally { setSending(false); }
  };
  return (
    <Card className="p-5 md:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-accent-soft text-accent"><BellIcon className="size-5" /></span>
        <div><h3 className="font-semibold">Notificações</h3><p className="text-xs text-muted">Avisos de leads, visitas, mensagens e propostas.</p></div>
      </div>
      {loading || !data ? <PageLoader /> : (
        <div className="space-y-4">
          <Toggle checked={data.push} onChange={(v) => save({ push: v })}
            label={<span className="flex items-center gap-2"><PhoneIcon className="size-4 text-muted" />No celular (push)</span>}
            description={!data.pushAvailable ? 'Ainda não configurado no servidor.' : data.devices ? `${data.devices} celular(es) conectado(s).` : inApp ? 'Abrindo pelo app, este celular é conectado automaticamente.' : 'Instale o app Android para receber no celular.'} />
          <Toggle checked={data.email} onChange={(v) => save({ email: v })}
            label={<span className="flex items-center gap-2"><Mail className="size-4 text-muted" />Por e-mail</span>}
            description={data.emailAvailable ? 'Enviado para o e-mail da sua conta.' : 'Ainda não configurado no servidor.'} />
          <p className="text-xs text-faint">Os avisos sempre aparecem também no sino dentro do app.</p>
          <Button variant="secondary" size="sm" loading={sending} onClick={test} icon={<Send className="size-4" />}>Enviar notificação de teste</Button>
        </div>
      )}
    </Card>
  );
}

/* ============================ Segurança ============================ */
type Session = { id: number; ip: string; user_agent: string; created_at: number; last_seen_at: number; current: boolean };
const ACTION_LABEL: Record<string, string> = {
  'auth.login': 'Login realizado', 'auth.logout': 'Saída da conta', 'auth.login_failed': 'Tentativa de login falhou', 'auth.account_locked': 'Conta bloqueada temporariamente',
  'auth.password_changed': 'Senha alterada', 'auth.password_reset': 'Senha redefinida', 'auth.password_reset_requested': 'Redefinição de senha solicitada',
  'auth.2fa_enabled': '2FA ativado', 'auth.2fa_disabled': '2FA desativado', 'auth.mfa_challenge': 'Desafio 2FA enviado', 'auth.mfa_failed': 'Código 2FA inválido',
  'auth.session_revoked': 'Sessão encerrada', 'auth.sessions_revoked': 'Outras sessões encerradas', 'auth.register': 'Conta criada', 'auth.login_blocked': 'Login bloqueado',
  'auth.login_recovery_code': 'Login com código de recuperação',
};

export function Security() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const sessions = useApi<Session[]>('/auth/sessions');
  const activity = useApi<{ action: string; ip: string; user_agent: string; created_at: number }[]>('/auth/activity');
  const [pw, setPw] = useState({ current: '', password: '', confirm: '' });
  const [pwFields, setPwFields] = useState<Record<string, string>>({});
  const [pwLoading, setPwLoading] = useState(false);
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePw, setDisablePw] = useState('');

  const changePassword = async () => {
    setPwFields({});
    if (pw.password !== pw.confirm) return setPwFields({ confirm: 'As senhas não conferem' });
    setPwLoading(true);
    try {
      await api('/auth/password', { body: { current: pw.current, password: pw.password } });
      toast('Senha alterada. Outras sessões foram encerradas.');
      setPw({ current: '', password: '', confirm: '' });
      sessions.reload(); activity.reload();
    } catch (e: any) { setPwFields(e.fields ?? {}); toast(e.message, 'error'); } finally { setPwLoading(false); }
  };
  const startSetup = async () => { try { setSetup(await api('/auth/2fa/setup', { body: {} })); } catch (e: any) { toast(e.message, 'error'); } };
  const enable = async () => {
    try {
      const r = await api<{ recoveryCodes: string[] }>('/auth/2fa/enable', { body: { code } });
      setCodes(r.recoveryCodes); setSetup(null); setCode(''); refresh(); activity.reload();
    } catch (e: any) { toast(e.message, 'error'); }
  };
  const disable = async () => {
    try { await api('/auth/2fa/disable', { body: { password: disablePw } }); setDisableOpen(false); setDisablePw(''); toast('2FA desativado.', 'info'); refresh(); } catch (e: any) { toast(e.message, 'error'); }
  };

  return (
    <Page>
      <PageHeader title="Segurança da conta" subtitle="Proteja seu acesso e acompanhe a atividade da sua conta." back="/perfil" />
      <div className="grid gap-5 lg:grid-cols-2">
        {/* 2FA */}
        <Card className="p-5 md:p-6">
          <div className="flex items-start gap-3">
            <span className={cx('grid size-11 shrink-0 place-items-center rounded-2xl', user!.totp_enabled ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning')}><Smartphone className="size-5" /></span>
            <div className="flex-1">
              <h3 className="font-semibold">Verificação em duas etapas (2FA)</h3>
              <p className="mt-1 text-sm text-muted">Além da senha, pedimos um código do seu app autenticador (Google Authenticator, Authy, 1Password...).</p>
            </div>
          </div>
          {user!.totp_enabled ? (
            <div className="mt-5 flex items-center justify-between rounded-2xl bg-success-soft p-4">
              <span className="flex items-center gap-2 text-sm font-semibold text-success"><ShieldCheck className="size-5" />Ativo</span>
              <Button variant="ghost" size="sm" onClick={() => setDisableOpen(true)}>Desativar</Button>
            </div>
          ) : setup ? (
            <div className="mt-5 space-y-4">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
                <li>Abra o app autenticador e escaneie o QR Code.</li>
                <li>Digite o código de 6 dígitos gerado.</li>
              </ol>
              <div className="flex flex-col items-center gap-3 rounded-3xl bg-surface-2 p-4 sm:flex-row">
                <img src={setup.qr} alt="QR Code para configurar o 2FA" className="size-44 rounded-2xl" />
                <div className="min-w-0 text-center sm:text-left">
                  <p className="text-xs text-muted">Ou digite a chave manualmente:</p>
                  <code className="mt-1 block break-all rounded-xl bg-surface px-3 py-2 text-xs font-semibold tracking-wider">{setup.secret.match(/.{1,4}/g)?.join(' ')}</code>
                </div>
              </div>
              <div className="flex gap-2">
                <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" className="text-center text-lg tracking-[0.4em]" aria-label="Código 2FA" />
                <Button onClick={enable} disabled={code.length !== 6}>Ativar</Button>
              </div>
            </div>
          ) : (
            <Button className="mt-5" onClick={startSetup} icon={<ShieldCheck className="size-4" />}>Configurar 2FA</Button>
          )}
        </Card>

        {/* Senha */}
        <Card className="p-5 md:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent"><KeyRound className="size-5" /></span>
            <div><h3 className="font-semibold">Alterar senha</h3><p className="mt-1 text-sm text-muted">Use uma senha longa e exclusiva para a Walisson Imóveis.</p></div>
          </div>
          <div className="mt-5 space-y-3">
            <Field label="Senha atual" error={pwFields.current}><PasswordInput autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
            <Field label="Nova senha" error={pwFields.password}><PasswordInput autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /><PasswordMeter value={pw.password} /></Field>
            <Field label="Confirmar nova senha" error={pwFields.confirm}><PasswordInput autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
            <Button loading={pwLoading} onClick={changePassword} disabled={!pw.current || !pw.password}>Alterar senha</Button>
          </div>
        </Card>

        {/* Sessões */}
        <Card className="p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-semibold">Dispositivos conectados</h3>
            <Button size="sm" variant="ghost" onClick={async () => { const r = await api('/auth/sessions/revoke-others', { body: {} }); toast(`${r.count} sessão(ões) encerrada(s).`, 'info'); sessions.reload(); }}>Sair dos outros</Button>
          </div>
          {sessions.loading ? <PageLoader /> : (
            <div className="space-y-2">
              {sessions.data?.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
                  <Laptop className="size-5 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{deviceName(s.user_agent)} {s.current && <Badge tone="success" className="ml-1">Este dispositivo</Badge>}</p>
                    <p className="text-xs text-muted">IP {s.ip} · ativo {relative(s.last_seen_at)}</p>
                  </div>
                  {!s.current && <button onClick={async () => { await api(`/auth/sessions/${s.id}`, { method: 'DELETE' }); sessions.reload(); }} className="text-xs font-semibold text-danger">Encerrar</button>}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Atividade */}
        <Card className="p-5 md:p-6">
          <h3 className="mb-4 font-semibold">Atividade recente</h3>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {activity.data?.map((a, i) => {
              const bad = /failed|locked|blocked/.test(a.action);
              return (
                <div key={i} className="flex items-center gap-3 rounded-xl px-2 py-2">
                  {bad ? <ShieldAlert className="size-4 shrink-0 text-danger" /> : <ShieldCheck className="size-4 shrink-0 text-success" />}
                  <div className="min-w-0 flex-1"><p className="text-sm">{ACTION_LABEL[a.action] ?? a.action}</p><p className="truncate text-xs text-faint">{deviceName(a.user_agent ?? '')} · {a.ip}</p></div>
                  <span className="shrink-0 text-xs text-faint">{relative(a.created_at)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Modal open={!!codes} onClose={() => setCodes(null)} title="Guarde seus códigos de recuperação">
        <p className="text-sm text-muted">Use um destes códigos se perder acesso ao app autenticador. Cada código funciona uma única vez. <b className="text-text">Eles não serão exibidos novamente.</b></p>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-surface-2 p-4 font-mono text-sm">{codes?.map((c) => <span key={c}>{c}</span>)}</div>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => { navigator.clipboard.writeText(codes!.join('\n')); toast('Códigos copiados.', 'info'); }}>Copiar</Button>
          <Button className="flex-1" onClick={() => setCodes(null)}>Já guardei</Button>
        </div>
      </Modal>
      <Modal open={disableOpen} onClose={() => setDisableOpen(false)} title="Desativar 2FA">
        <p className="mb-4 text-sm text-muted">Sua conta ficará menos protegida. Confirme sua senha para continuar.</p>
        <PasswordInput value={disablePw} onChange={(e) => setDisablePw(e.target.value)} placeholder="Sua senha" autoComplete="current-password" />
        <Button variant="danger" className="mt-4 w-full" onClick={disable}>Desativar 2FA</Button>
      </Modal>
    </Page>
  );
}

/* ============================ Privacidade (LGPD) ============================ */
export function Privacy() {
  const { user, setSession } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const exportData = async () => {
    try {
      const data = await api('/me/account/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'meus-dados-walisson-imoveis.json';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Download iniciado.');
    } catch (e: any) { toast(e.message, 'error'); }
  };
  const del = async () => {
    setLoading(true);
    try {
      await api('/me/account/delete', { body: { password: pw, confirm: confirmText } });
      setSession(null, null);
      toast('Sua conta foi excluída. Sentiremos sua falta!', 'info');
      nav('/');
    } catch (e: any) { toast(e.message, 'error'); } finally { setLoading(false); }
  };
  return (
    <Page>
      <PageHeader title="Privacidade e dados" subtitle="Seus direitos como titular de dados, conforme a LGPD (Lei 13.709/2018)." back="/perfil" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5 md:p-6">
          <span className="grid size-11 place-items-center rounded-2xl bg-info-soft text-info"><Download className="size-5" /></span>
          <h3 className="mt-4 font-semibold">Baixar meus dados</h3>
          <p className="mt-1 text-sm text-muted">Receba uma cópia de todos os dados pessoais que temos sobre você: perfil, favoritos, visitas, propostas, mensagens e registros de segurança.</p>
          <Button variant="secondary" className="mt-5" onClick={exportData}>Exportar (JSON)</Button>
        </Card>
        <Card className="p-5 md:p-6">
          <span className="grid size-11 place-items-center rounded-2xl bg-danger-soft text-danger"><Trash2 className="size-5" /></span>
          <h3 className="mt-4 font-semibold">Excluir minha conta</h3>
          <p className="mt-1 text-sm text-muted">Seus dados pessoais serão removidos ou anonimizados. Registros exigidos por lei (ex.: contratos) são mantidos pelo prazo legal.</p>
          <Button variant="danger" className="mt-5" onClick={() => setOpen(true)} disabled={user?.role === 'admin'}>Excluir conta</Button>
        </Card>
        <Card className="p-5 md:col-span-2 md:p-6">
          <h3 className="font-semibold">Como tratamos seus dados</h3>
          <ul className="mt-3 grid gap-2 text-sm text-muted sm:grid-cols-2">
            {['Senhas armazenadas com hash scrypt — nem nossa equipe tem acesso.', 'Conexão protegida, cookies HttpOnly e proteção contra CSRF.', 'Endereço exato do imóvel só é compartilhado após agendamento.', 'Usamos seus dados apenas para atendimento imobiliário.', 'Você pode revogar o consentimento de marketing a qualquer momento.', 'Todos os acessos administrativos são auditados.'].map((t) => (
              <li key={t} className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />{t}</li>
            ))}
          </ul>
          <Link to="/termos" className="mt-4 inline-block text-sm font-semibold text-accent">Ler Termos de Uso e Política de Privacidade</Link>
        </Card>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Excluir conta permanentemente">
        <p className="text-sm text-muted">Esta ação não pode ser desfeita. Digite <b className="text-text">EXCLUIR</b> e sua senha para confirmar.</p>
        <div className="mt-4 space-y-3">
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="EXCLUIR" aria-label="Confirmação" />
          <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Sua senha" autoComplete="current-password" />
          <Button variant="danger" className="w-full" loading={loading} disabled={confirmText !== 'EXCLUIR' || !pw} onClick={del}>Excluir minha conta</Button>
        </div>
      </Modal>
    </Page>
  );
}

/* ============================ Termos ============================ */
export function Terms() {
  return (
    <Page>
      <PageHeader title="Termos de Uso e Política de Privacidade" back />
      <Card className="space-y-5 p-6 text-sm leading-relaxed text-muted md:p-8">
        <section><h2 className="mb-2 text-base font-semibold text-text">1. Sobre o serviço</h2><p>A Walisson Imóveis oferece este aplicativo para divulgação de imóveis, agendamento de visitas, comunicação com corretores e envio de propostas. As informações dos anúncios são fornecidas pelos proprietários e conferidas por nossa equipe.</p></section>
        <section><h2 className="mb-2 text-base font-semibold text-text">2. Dados coletados</h2><p>Coletamos nome, e-mail, telefone, preferências de busca, interações (favoritos, visitas, propostas e mensagens) e dados técnicos de acesso (IP, navegador) para segurança.</p></section>
        <section><h2 className="mb-2 text-base font-semibold text-text">3. Finalidade e base legal</h2><p>Os dados são usados para executar o atendimento imobiliário solicitado (execução de contrato e procedimentos preliminares), cumprir obrigações legais, prevenir fraudes (legítimo interesse) e, mediante consentimento, enviar comunicações de marketing.</p></section>
        <section><h2 className="mb-2 text-base font-semibold text-text">4. Compartilhamento</h2><p>Compartilhamos dados apenas com o corretor responsável, o proprietário do imóvel (quando necessário à negociação) e instituições financeiras mediante sua solicitação. Não vendemos dados pessoais.</p></section>
        <section><h2 className="mb-2 text-base font-semibold text-text">5. Seus direitos</h2><p>Você pode acessar, corrigir, exportar e excluir seus dados, além de revogar consentimentos, diretamente em “Minha conta → Privacidade e dados” ou pelo e-mail do encarregado (DPO): privacidade@walissonimoveis.com.br.</p></section>
        <section><h2 className="mb-2 text-base font-semibold text-text">6. Segurança</h2><p>Adotamos criptografia de senhas (scrypt), sessões seguras com cookies HttpOnly, proteção contra CSRF, limitação de tentativas de login, verificação em duas etapas opcional e trilha de auditoria de acessos.</p></section>
        <p className="text-xs text-faint">Documento modelo — revise com sua assessoria jurídica antes da publicação.</p>
      </Card>
    </Page>
  );
}
