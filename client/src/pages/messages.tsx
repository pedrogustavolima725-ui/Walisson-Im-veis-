import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCheck, Check, MessageCircle, Phone, SendHorizontal, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { brl, priceSuffix, relative, time, whatsappLink } from '../lib/format';
import { useAuth, useCounts, useToast } from '../context/app';
import { Avatar, cx, Empty, Img, PageLoader } from '../components/ui';

type Conv = { id: number; property_title: string | null; last_message_at: number; other_name: string; other_avatar: string | null; other_role: string; last_message: string | null; unread: number };
type Msg = { id: number; sender_id: number; body: string; read_at: number | null; created_at: number };
type Thread = {
  conversation: { id: number; client_id: number; agent_id: number; property_id: number | null; property_title: string | null; price: number | null; purpose: string | null; cover: string | null; agent_name: string; agent_phone: string | null; agent_avatar: string | null; creci: string | null; client_name: string; client_phone: string | null };
  messages: Msg[];
};

export function Messages() {
  const { id } = useParams();
  const loc = useLocation();
  const base = loc.pathname.startsWith('/crm') ? '/crm/mensagens' : '/mensagens';
  const { data, loading, reload } = useApi<Conv[]>('/me/conversations');
  const { isStaff } = useAuth();
  const nav = useNavigate();

  // Corretor que abriu um link /mensagens/:id é levado para dentro do CRM
  useEffect(() => { if (isStaff && !loc.pathname.startsWith('/crm') && id) nav(`/crm/mensagens/${id}`, { replace: true }); }, [isStaff, id, loc.pathname, nav]);

  useEffect(() => {
    const t = setInterval(() => document.visibilityState === 'visible' && reload(true), 15000);
    return () => clearInterval(t);
  }, [reload]);

  return (
    <div className={cx('mx-auto w-full', base === '/mensagens' && 'max-w-[1200px] px-4 pt-5 sm:px-6 lg:px-10 lg:pt-8')}>
      <div className="grid h-[calc(100dvh-150px)] min-h-[480px] overflow-hidden rounded-[28px] border border-line bg-surface lg:h-[calc(100vh-120px)] lg:grid-cols-[340px_1fr]">
        <aside className={cx('flex min-h-0 flex-col border-line lg:border-r', id && 'hidden lg:flex')}>
          <div className="border-b border-line p-5">
            <h1 className="text-xl font-semibold tracking-tight">Mensagens</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted"><ShieldCheck className="size-3.5 text-success" />Conversas protegidas e registradas</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loading && !data ? <PageLoader /> : !data?.length ? (
              <div className="p-4"><Empty icon={<MessageCircle />} title="Nenhuma conversa" text={isStaff ? 'As conversas com clientes aparecerão aqui.' : 'Fale com um corretor pela página de qualquer imóvel.'} /></div>
            ) : data.map((c) => (
              <Link key={c.id} to={`${base}/${c.id}`} className={cx('flex items-center gap-3 rounded-2xl p-3 transition', String(c.id) === id ? 'bg-surface-2' : 'hover:bg-surface-2/60')}>
                <Avatar name={c.other_name} src={c.other_avatar} size={46} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{c.other_name}</span>
                    <span className="shrink-0 text-[11px] text-faint">{relative(c.last_message_at)}</span>
                  </div>
                  {c.property_title && <p className="truncate text-[11px] font-medium text-accent">{c.property_title}</p>}
                  <div className="flex items-center justify-between gap-2">
                    <p className={cx('truncate text-sm', c.unread ? 'font-medium text-text' : 'text-muted')}>{c.last_message}</p>
                    {c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-primary-ink">{c.unread}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </aside>
        <section className={cx('min-h-0', !id && 'hidden lg:block')}>
          {id ? <ThreadView key={id} id={Number(id)} base={base} onActivity={() => reload(true)} /> : (
            <div className="grid h-full place-items-center p-6 text-center text-muted">
              <div><MessageCircle className="mx-auto size-10 text-accent/60" /><p className="mt-3 text-sm">Selecione uma conversa</p></div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ThreadView({ id, base, onActivity }: { id: number; base: string; onActivity: () => void }) {
  const { user } = useAuth();
  const counts = useCounts();
  const toast = useToast();
  const [thread, setThread] = useState<Thread | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const lastId = useRef(0);

  useEffect(() => {
    let alive = true;
    const load = async (initial = false) => {
      try {
        const r = await api<Thread>(`/me/conversations/${id}${initial ? '' : `?after=${lastId.current}`}`);
        if (!alive) return;
        if (initial) setThread(r);
        else if (r.messages.length) setThread((t) => (t ? { ...t, messages: [...t.messages, ...r.messages.filter((m) => !t.messages.some((x) => x.id === m.id))] } : r));
        if (r.messages.length) {
          lastId.current = r.messages[r.messages.length - 1].id;
          counts.reload();
          if (!initial) onActivity();
        }
      } catch (e: any) { if (initial) setErr(e.message); }
    };
    load(true);
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 4000);
    return () => { alive = false; clearInterval(t); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [thread?.messages.length]);

  if (err) return <div className="p-6 text-sm text-danger">{err}</div>;
  if (!thread) return <PageLoader />;
  const c = thread.conversation;
  const iAmClient = user?.id === c.client_id;
  const other = iAmClient ? { name: c.agent_name, avatar: c.agent_avatar, phone: c.agent_phone, sub: c.creci ?? 'Corretor(a)' } : { name: c.client_name, avatar: null, phone: c.client_phone, sub: 'Cliente' };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const m = await api<Msg>(`/me/conversations/${id}/messages`, { body: { body } });
      setThread((t) => (t ? { ...t, messages: [...t.messages, m] } : t));
      lastId.current = m.id;
      setText('');
      onActivity();
    } catch (e: any) { toast(e.message, 'error'); } finally { setSending(false); }
  };

  let lastDay = '';
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line p-3 sm:p-4">
        <Link to={base} className="grid size-10 place-items-center rounded-full bg-surface-2 lg:hidden" aria-label="Voltar"><ArrowLeft className="size-5" /></Link>
        <Avatar name={other.name} src={other.avatar} size={42} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{other.name}</p>
          <p className="truncate text-xs text-muted">{other.sub}</p>
        </div>
        {other.phone && (
          <a href={whatsappLink(other.phone, 'Olá!')} target="_blank" rel="noopener noreferrer" className="grid size-10 place-items-center rounded-full bg-surface-2 text-success" aria-label="WhatsApp"><Phone className="size-[18px]" /></a>
        )}
      </header>
      {c.property_id && (
        <Link to={`/imovel/${c.property_id}`} className="mx-3 mt-3 flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-2 sm:mx-4">
          <Img src={c.cover} alt="" className="size-12 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{c.property_title}</p>{c.price && <p className="text-xs text-muted">{brl(c.price)}{priceSuffix(c.purpose ?? '')}</p>}</div>
          <span className="pr-2 text-xs font-semibold text-accent">Ver</span>
        </Link>
      )}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3 sm:p-4" aria-live="polite">
        {thread.messages.map((m) => {
          const mine = m.sender_id === user?.id;
          const day = new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id}>
              {showDay && <div className="my-3 text-center text-[11px] font-medium text-faint">{day}</div>}
              <div className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cx('max-w-[80%] rounded-3xl px-4 py-2.5 text-[15px] leading-snug', mine ? 'rounded-br-lg bg-primary text-primary-ink' : 'rounded-bl-lg bg-surface-2')}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={cx('mt-1 flex items-center justify-end gap-1 text-[10px]', mine ? 'text-primary-ink/60' : 'text-faint')}>
                    {time(m.created_at)}
                    {mine && (m.read_at ? <CheckCheck className="size-3.5" /> : <Check className="size-3.5" />)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="flex items-end gap-2 border-t border-line p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e as unknown as FormEvent); } }}
          rows={1}
          maxLength={2000}
          placeholder="Escreva uma mensagem..."
          aria-label="Mensagem"
          className="max-h-32 min-h-12 flex-1 resize-none rounded-3xl border border-line bg-surface-2 px-4 py-3 text-[15px] outline-none focus:border-accent"
        />
        <button disabled={sending || !text.trim()} className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-ink transition disabled:opacity-40" aria-label="Enviar">
          <SendHorizontal className="size-5" />
        </button>
      </form>
    </div>
  );
}
