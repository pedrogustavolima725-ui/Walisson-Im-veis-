import { useState } from 'react';
import { KeyRound, Lock, LockOpen, MonitorSmartphone, Plus, ShieldAlert, ShieldCheck, UserCheck, UserX, Users } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { dateTime, deviceName, maskDocument, maskPhone, relative, ROLE_LABEL } from '../../lib/format';
import { useAuth, useToast } from '../../context/app';
import { Avatar, Badge, Button, Card, Chip, cx, Field, Input, Modal, PageHeader, PageLoader, PasswordInput, Select, Stat } from '../../components/ui';
import { PasswordMeter } from '../auth';

/* ============================ Equipe ============================ */
type U = { id: number; name: string; email: string; phone: string | null; role: string; document: string | null; avatar: string | null; active: number; totp_enabled: number; last_login_at: number | null; created_at: number; locked_until: number | null; open_leads: number; listings: number };

export function Team() {
  const { user } = useAuth();
  const toast = useToast();
  const [role, setRole] = useState('corretor');
  const [inactive, setInactive] = useState(false);
  const { data, loading, reload } = useApi<U[]>(`/crm/users${qs({ role, inactive: inactive ? '1' : '' })}`);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', email: '', phone: '', role: 'corretor', document: '', password: '' });
  const [fields, setFields] = useState<Record<string, string>>({});

  if (user?.role !== 'admin') return <p className="text-muted">Acesso restrito a administradores.</p>;

  const patch = async (u: U, body: Record<string, unknown>, msg: string) => {
    try { await api(`/crm/users/${u.id}`, { method: 'PATCH', body }); toast(msg); reload(true); } catch (e: any) { toast(e.message, 'error'); }
  };
  const create = async () => {
    setFields({});
    try { await api('/crm/users', { body: f }); toast('Usuário criado. Oriente-o a ativar o 2FA no primeiro acesso.'); setOpen(false); setF({ name: '', email: '', phone: '', role: 'corretor', document: '', password: '' }); reload(); } catch (e: any) { setFields(e.fields ?? {}); toast(e.message, 'error'); }
  };

  return (
    <div>
      <PageHeader title="Equipe e usuários" subtitle="Gerencie corretores, administradores e acessos." actions={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Novo usuário</Button>} />
      <div className="mb-5 flex flex-wrap gap-2">
        {['corretor', 'admin', 'cliente', ''].map((r) => <Chip key={r} active={role === r} onClick={() => setRole(r)} className="h-9">{r ? ROLE_LABEL[r] + (r === 'admin' ? 'es' : 's') : 'Todos'}</Chip>)}
        <Chip active={inactive} onClick={() => setInactive(!inactive)} className="h-9">Incluir inativos</Chip>
      </div>
      {loading && !data ? <PageLoader /> : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {data?.map((u) => {
            const locked = u.locked_until && u.locked_until > Date.now();
            return (
              <Card key={u.id} className={cx('p-4', !u.active && 'opacity-60')}>
                <div className="flex items-center gap-3">
                  <Avatar name={u.name} src={u.avatar} size={46} />
                  <div className="min-w-0 flex-1"><p className="truncate font-semibold">{u.name}</p><p className="truncate text-xs text-muted">{u.email}</p></div>
                  <Select value={u.role} disabled={u.id === user.id} onChange={(e) => confirm(`Alterar papel de ${u.name} para ${ROLE_LABEL[e.target.value]}? A sessão dele será encerrada.`) && patch(u, { role: e.target.value }, 'Papel atualizado.')} className="h-8 w-auto rounded-full py-0 text-xs" aria-label="Papel">
                    <option value="cliente">Cliente</option><option value="corretor">Corretor</option><option value="admin">Admin</option>
                  </Select>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {u.totp_enabled ? <Badge tone="success"><ShieldCheck className="size-3" />2FA</Badge> : <Badge tone="warning"><ShieldAlert className="size-3" />Sem 2FA</Badge>}
                  {!u.active && <Badge tone="danger">Inativo</Badge>}
                  {locked && <Badge tone="danger"><Lock className="size-3" />Bloqueado</Badge>}
                  {u.document && <Badge>{u.document.length === 11 ? 'CPF' : 'CNPJ'} {maskDocument(u.document)}</Badge>}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-surface-2 p-2"><p className="text-base font-semibold">{u.open_leads}</p><p className="text-muted">leads</p></div>
                  <div className="rounded-xl bg-surface-2 p-2"><p className="text-base font-semibold">{u.listings}</p><p className="text-muted">imóveis</p></div>
                  <div className="rounded-xl bg-surface-2 p-2"><p className="text-sm font-semibold">{u.last_login_at ? relative(u.last_login_at) : '—'}</p><p className="text-muted">acesso</p></div>
                </div>
                {u.id !== user.id && (
                  <div className="mt-3 flex gap-2 border-t border-line pt-3">
                    {locked && <Button size="sm" variant="secondary" icon={<LockOpen className="size-4" />} onClick={() => patch(u, { unlock: true }, 'Conta desbloqueada.')}>Desbloquear</Button>}
                    {u.active ? (
                      <Button size="sm" variant="danger" icon={<UserX className="size-4" />} onClick={() => confirm(`Desativar ${u.name}? Todas as sessões serão encerradas.`) && patch(u, { active: false }, 'Usuário desativado.')}>Desativar</Button>
                    ) : (
                      <Button size="sm" variant="secondary" icon={<UserCheck className="size-4" />} onClick={() => patch(u, { active: true }, 'Usuário reativado.')}>Reativar</Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Novo usuário da equipe">
        <div className="space-y-3">
          <Field label="Nome" error={fields.name}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="E-mail" error={fields.email}><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: maskPhone(e.target.value) })} /></Field>
            <Field label="CPF ou CNPJ" error={fields.document}><Input inputMode="numeric" value={f.document} onChange={(e) => setF({ ...f, document: maskDocument(e.target.value) })} /></Field>
          </div>
          <Field label="Papel"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="corretor">Corretor</option><option value="admin">Administrador</option></Select></Field>
          <Field label="Senha provisória" error={fields.password}><PasswordInput value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" /><PasswordMeter value={f.password} /></Field>
          <Button className="w-full" onClick={create}>Criar usuário</Button>
        </div>
      </Modal>
    </div>
  );
}

/* ============================ Central de segurança ============================ */
type Log = { id: number; action: string; ip: string | null; user_agent: string | null; meta: string; created_at: number; user_name: string | null; user_email: string | null };
type AuditResp = { items: Log[]; summary: { failed24h: number; locked24h: number; logins24h: number; mfaUsers: number; staffWithoutMfa: number; activeSessions: number } };

const FILTERS = [['', 'Tudo'], ['auth.', 'Autenticação'], ['auth.login_failed', 'Falhas de login'], ['user.', 'Usuários'], ['property.', 'Imóveis'], ['lead.', 'Leads'], ['proposal.', 'Propostas'], ['report.', 'Exportações'], ['account.', 'LGPD']] as const;

export function SecurityCenter() {
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading } = useApi<AuditResp>(`/crm/audit${qs({ action: filter, page })}`);
  const s = data?.summary;
  const bad = (a: string) => /failed|locked|blocked|disabled|delete/.test(a);
  return (
    <div>
      <PageHeader title="Central de segurança" subtitle="Trilha de auditoria e indicadores de proteção da conta." />
      {s && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Logins (24h)" value={s.logins24h} icon={<KeyRound className="size-[18px]" />} tone="success" />
          <Stat label="Falhas de login (24h)" value={s.failed24h} hint={`${s.locked24h} bloqueio(s) automáticos`} icon={<ShieldAlert className="size-[18px]" />} tone={s.failed24h > 10 ? 'danger' : 'warning'} />
          <Stat label="Sessões ativas" value={s.activeSessions} icon={<MonitorSmartphone className="size-[18px]" />} tone="info" />
          <Stat label="Contas com 2FA" value={s.mfaUsers} hint={s.staffWithoutMfa ? `${s.staffWithoutMfa} da equipe sem 2FA` : 'Toda a equipe protegida'} icon={<Users className="size-[18px]" />} tone={s.staffWithoutMfa ? 'warning' : 'success'} />
        </div>
      )}
      <Card className="mb-5 p-5">
        <h3 className="mb-3 font-semibold">Proteções ativas</h3>
        <div className="grid gap-2 text-sm text-muted sm:grid-cols-2 xl:grid-cols-3">
          {['Senhas com hash scrypt + salt individual', 'Bloqueio após 5 tentativas (15 min)', 'Rate limit por IP em login, cadastro e recuperação', 'Sessões HttpOnly, SameSite e rotação no login', 'Token anti-CSRF em toda alteração', '2FA (TOTP) com códigos de recuperação', 'Headers de segurança (CSP, HSTS, frame-ancestors)', 'Validação de uploads por assinatura binária', 'Controle de acesso por papel e por carteira', 'Exportação CSV protegida contra injeção de fórmula', 'Exportação e exclusão de dados (LGPD)', 'Auditoria de ações sensíveis'].map((t) => (
            <p key={t} className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />{t}</p>
          ))}
        </div>
      </Card>
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
        {FILTERS.map(([v, l]) => <Chip key={v} active={filter === v} onClick={() => { setFilter(v); setPage(1); }} className="h-9">{l}</Chip>)}
      </div>
      {loading && !data ? <PageLoader /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-muted"><tr className="border-b border-line"><th className="p-3 font-medium">Quando</th><th className="p-3 font-medium">Evento</th><th className="p-3 font-medium">Usuário</th><th className="p-3 font-medium">Origem</th><th className="p-3 font-medium">Detalhes</th></tr></thead>
            <tbody className="divide-y divide-line">
              {data?.items.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap p-3 text-muted">{dateTime(l.created_at)}</td>
                  <td className="p-3"><span className={cx('rounded-full px-2 py-1 font-mono text-[11px]', bad(l.action) ? 'bg-danger-soft text-danger' : 'bg-surface-2')}>{l.action}</span></td>
                  <td className="p-3">{l.user_name ?? <span className="text-faint">—</span>}<p className="text-xs text-faint">{l.user_email}</p></td>
                  <td className="p-3 text-xs text-muted">{l.ip}<p>{deviceName(l.user_agent ?? '')}</p></td>
                  <td className="max-w-[260px] truncate p-3 font-mono text-[11px] text-faint" title={l.meta}>{l.meta !== '{}' ? l.meta : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-line p-3">
            <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</Button>
            <span className="text-xs text-muted">Página {page}</span>
            <Button size="sm" variant="ghost" disabled={(data?.items.length ?? 0) < 50} onClick={() => setPage(page + 1)}>Próxima</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
