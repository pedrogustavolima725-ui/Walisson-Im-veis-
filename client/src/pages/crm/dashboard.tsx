import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Building2, CalendarDays, CheckCircle2, Circle, Download, Eye, Flame, Heart, Plus, Target, TrendingUp, Users, Wallet } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { brl, cap, dateTime, relative, SOURCE_LABEL, STAGE_LABEL } from '../../lib/format';
import { useAuth, useToast } from '../../context/app';
import { Avatar, Badge, Button, Card, cx, ErrorBox, Img, PageLoader, statusTone, Tabs } from '../../components/ui';
import { AreaChart, HBars, Spark } from '../../components/charts';

type Dash = {
  kpis: { leadsMonth: number; leadsPrev: number; openLeads: number; visitsUpcoming: number; activeListings: number; pendingListings: number; vgv: number; vgvMonth: number; pipelineValue: number; conversion: number; commission: number; commissionRate: number };
  funnel: { stage: string; label: string; count: number }[];
  sources: { source: string; n: number }[];
  months: { label: string; leads: number; vgv: number; visits: number }[];
  nextVisits: { id: number; scheduled_at: number; status: string; property_title: string; neighborhood: string; client_name: string | null; cover: string | null }[];
  tasks: { id: number; title: string; due_at: number | null; priority: string; lead_id: number | null; lead_name: string | null }[];
  hotLeads: { id: number; name: string; stage: string; budget: number | null; updated_at: number; property_title: string | null }[];
  ranking: { id: number; name: string; avatar: string | null; won: number; vgv: number; open: number }[];
  topProperties: { id: number; title: string; views: number; price: number; favorites: number; leads: number; cover: string | null }[];
};

export function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useApi<Dash>('/crm/dashboard');
  const [metric, setMetric] = useState<'vgv' | 'leads' | 'visits'>('vgv');
  if (loading && !data) return <PageLoader />;
  if (error || !data) return <ErrorBox message={error ?? 'Erro'} onRetry={reload} />;
  const k = data.kpis;
  const delta = k.leadsPrev ? Math.round(((k.leadsMonth - k.leadsPrev) / k.leadsPrev) * 100) : null;
  const done = async (id: number) => { await api(`/crm/tasks/${id}`, { method: 'PATCH', body: { done: true } }); toast('Tarefa concluída.'); reload(true); };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{cap(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
          <h1 className="text-[28px] font-semibold tracking-tight md:text-[32px]">Olá, <span className="text-accent">{user!.name.split(' ')[0]}</span></h1>
          <p className="text-sm text-muted">{user!.role === 'admin' ? 'Visão geral da imobiliária' : 'Sua carteira e desempenho'}</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/crm/reports/leads.csv"><Button variant="outline" size="sm" icon={<Download className="size-4" />}>Exportar leads</Button></a>
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => nav('/crm/leads?novo=1')}>Novo lead</Button>
        </div>
      </header>

      {k.pendingListings > 0 && (
        <Link to="/crm/imoveis?status=pendente" className="flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm">
          <AlertTriangle className="size-5 shrink-0 text-warning" />
          <span className="flex-1"><b>{k.pendingListings} imóvel(is)</b> enviado(s) por proprietários aguardando avaliação.</span>
          <span className="font-semibold text-warning">Revisar →</span>
        </Link>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4 md:p-5">
          <div className="flex items-center justify-between"><span className="text-[13px] text-muted">Leads no mês</span><span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent"><Users className="size-[18px]" /></span></div>
          <div className="mt-3 flex items-end justify-between">
            <span className="text-[28px] font-semibold tabular-nums">{k.leadsMonth}</span>
            <Spark values={data.months.map((m) => m.leads)} />
          </div>
          {delta !== null && (
            <p className={cx('mt-1 flex items-center gap-1 text-xs', delta >= 0 ? 'text-success' : 'text-danger')}>
              {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}{Math.abs(delta)}% vs. mês anterior
            </p>
          )}
        </Card>
        <Card className="p-4 md:p-5">
          <div className="flex items-center justify-between"><span className="text-[13px] text-muted">VGV do mês</span><span className="grid size-9 place-items-center rounded-xl bg-success-soft text-success"><Wallet className="size-[18px]" /></span></div>
          <div className="mt-3 text-[28px] font-semibold tabular-nums">{brl(k.vgvMonth, true)}</div>
          <p className="mt-1 text-xs text-muted">Comissão est. ({k.commissionRate}%): <b className="text-text">{brl(k.commission, true)}</b></p>
        </Card>
        <Card className="p-4 md:p-5">
          <div className="flex items-center justify-between"><span className="text-[13px] text-muted">Visitas agendadas</span><span className="grid size-9 place-items-center rounded-xl bg-info-soft text-info"><CalendarDays className="size-[18px]" /></span></div>
          <div className="mt-3 text-[28px] font-semibold tabular-nums">{k.visitsUpcoming}</div>
          <p className="mt-1 text-xs text-muted">{k.openLeads} leads em aberto</p>
        </Card>
        <Card className="p-4 md:p-5">
          <div className="flex items-center justify-between"><span className="text-[13px] text-muted">Conversão</span><span className="grid size-9 place-items-center rounded-xl bg-warning-soft text-warning"><Target className="size-[18px]" /></span></div>
          <div className="mt-3 text-[28px] font-semibold tabular-nums">{k.conversion.toLocaleString('pt-BR')}%</div>
          <p className="mt-1 text-xs text-muted">{k.activeListings} imóveis ativos · pipeline {brl(k.pipelineValue, true)}</p>
        </Card>
      </div>

      {/* Desempenho + Funil */}
      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Desempenho — últimos 12 meses</h2>
              <p className="text-xs text-muted">{metric === 'vgv' ? `VGV total fechado: ${brl(k.vgv, true)}` : metric === 'leads' ? 'Novos leads por mês' : 'Visitas realizadas/agendadas por mês'}</p>
            </div>
            <Tabs value={metric} onChange={setMetric} items={[{ value: 'vgv', label: 'VGV' }, { value: 'leads', label: 'Leads' }, { value: 'visits', label: 'Visitas' }]} />
          </div>
          <AreaChart
            label={`Gráfico de ${metric} por mês`}
            data={data.months.map((m) => ({ label: m.label, value: m[metric] }))}
            format={(v) => (metric === 'vgv' ? brl(v, true).replace('R$ ', '') : String(Math.round(v)))}
          />
        </Card>
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Funil de vendas</h2><Link to="/crm/leads" className="text-xs font-medium text-muted hover:text-accent">Ver kanban</Link></div>
          <HBars items={data.funnel.map((f) => ({ key: f.stage, label: f.label, value: f.count }))} onClick={(s) => nav(`/crm/leads?stage=${s}`)} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {/* Próximas visitas */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Próximas visitas</h2><Link to="/crm/agenda" className="text-xs font-medium text-muted hover:text-accent">Agenda</Link></div>
          {!data.nextVisits.length ? <p className="py-6 text-center text-sm text-muted">Nenhuma visita agendada.</p> : (
            <div className="space-y-2">
              {data.nextVisits.map((v) => (
                <div key={v.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-2.5">
                  <Img src={v.cover} alt="" className="size-12 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{v.client_name ?? 'Lead sem conta'}</p>
                    <p className="truncate text-xs text-muted">{v.property_title}</p>
                  </div>
                  <div className="text-right"><p className="text-xs font-semibold">{dateTime(v.scheduled_at)}</p><Badge tone={statusTone(v.status)} className="mt-1">{v.status}</Badge></div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Tarefas */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Tarefas pendentes</h2><Link to="/crm/agenda?tab=tarefas" className="text-xs font-medium text-muted hover:text-accent">Todas</Link></div>
          {!data.tasks.length ? <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted"><CheckCircle2 className="size-4 text-success" />Tudo em dia!</p> : (
            <div className="space-y-1">
              {data.tasks.map((t) => {
                const late = t.due_at && t.due_at < Date.now();
                return (
                  <div key={t.id} className="flex items-start gap-3 rounded-xl px-1 py-2">
                    <button onClick={() => done(t.id)} aria-label="Concluir tarefa" className="mt-0.5 text-faint hover:text-success"><Circle className="size-5" /></button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className={cx('text-xs', late ? 'text-danger' : 'text-muted')}>
                        {t.due_at ? (late ? `Atrasada · ${relative(t.due_at)}` : relative(t.due_at)) : 'Sem prazo'}
                        {t.lead_name && <> · <Link to={`/crm/leads/${t.lead_id}`} className="hover:text-accent">{t.lead_name}</Link></>}
                      </p>
                    </div>
                    {t.priority === 'alta' && <Badge tone="danger">Alta</Badge>}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Leads quentes */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Flame className="size-4 text-danger" />Leads quentes</h2><Link to="/crm/leads?temperature=quente" className="text-xs font-medium text-muted hover:text-accent">Ver todos</Link></div>
          {!data.hotLeads.length ? <p className="py-6 text-center text-sm text-muted">Nenhum lead quente agora.</p> : (
            <div className="space-y-1">
              {data.hotLeads.map((l) => (
                <Link key={l.id} to={`/crm/leads/${l.id}`} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-surface-2">
                  <Avatar name={l.name} size={38} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{l.name}</p><p className="truncate text-xs text-muted">{l.property_title ?? 'Sem imóvel vinculado'}</p></div>
                  <Badge tone={statusTone(l.stage)}>{STAGE_LABEL[l.stage]}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Origem dos leads */}
        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Origem dos leads</h2>
          <HBars items={data.sources.map((s) => ({ key: s.source, label: SOURCE_LABEL[s.source] ?? s.source, value: s.n }))} onClick={(s) => nav(`/crm/leads?source=${s}`)} />
        </Card>

        {/* Imóveis mais vistos */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Imóveis em alta</h2><Link to="/crm/imoveis" className="text-xs font-medium text-muted hover:text-accent">Carteira</Link></div>
          <div className="space-y-2">
            {data.topProperties.map((p) => (
              <Link key={p.id} to={`/crm/imoveis/${p.id}`} className="flex items-center gap-3 rounded-2xl p-1.5 hover:bg-surface-2">
                <Img src={p.cover} alt="" className="size-11 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p.title}</p><p className="text-xs text-muted">{brl(p.price, true)}</p></div>
                <div className="flex shrink-0 gap-3 text-xs text-muted">
                  <span className="flex items-center gap-1" title="Visualizações"><Eye className="size-3.5" />{p.views}</span>
                  <span className="flex items-center gap-1" title="Favoritos"><Heart className="size-3.5" />{p.favorites}</span>
                  <span className="flex items-center gap-1" title="Leads"><Users className="size-3.5" />{p.leads}</span>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        {/* Ranking (admin) ou atalhos */}
        {data.ranking.length ? (
          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 font-semibold"><TrendingUp className="size-4 text-accent" />Ranking de corretores</h2>
            <div className="space-y-2">
              {data.ranking.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-2.5">
                  <span className="w-5 text-center text-sm font-bold text-faint">{i + 1}</span>
                  <Avatar name={r.name} src={r.avatar} size={36} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{r.name}</p><p className="text-xs text-muted">{r.won} ganhos · {r.open} em aberto</p></div>
                  <span className="text-sm font-semibold tabular-nums">{brl(r.vgv, true)}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="p-5">
            <h2 className="mb-4 font-semibold">Atalhos</h2>
            <div className="grid grid-cols-2 gap-2">
              {[['/crm/imoveis/novo', 'Cadastrar imóvel', Building2], ['/crm/leads?novo=1', 'Novo lead', Users], ['/crm/agenda', 'Ver agenda', CalendarDays], ['/crm/propostas', 'Propostas', Wallet]].map(([to, l, I]: any) => (
                <Link key={to} to={to} className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-4 text-sm font-medium hover:bg-surface-3"><I className="size-5 text-accent" />{l}</Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
