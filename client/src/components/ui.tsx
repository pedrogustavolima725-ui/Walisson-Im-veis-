import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Home, Loader2, Minus, Plus, X } from 'lucide-react';
import { initials } from '../lib/format';

export const cx = (...c: unknown[]) => c.filter(Boolean).join(' ');

/* ---------------- Botões ---------------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
};
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'h-9 px-4 text-[13px]',
        size === 'md' && 'h-11 px-5 text-sm',
        size === 'lg' && 'h-14 px-6 text-[15px]',
        variant === 'primary' && 'bg-primary text-primary-ink hover:brightness-105',
        variant === 'secondary' && 'bg-surface-2 text-text hover:bg-surface-3',
        variant === 'outline' && 'border border-line-strong text-text hover:bg-surface-2',
        variant === 'ghost' && 'text-muted hover:bg-surface-2 hover:text-text',
        variant === 'danger' && 'bg-danger-soft text-danger hover:bg-danger hover:text-white',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ className, label, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx('glass relative grid size-11 shrink-0 place-items-center rounded-full border border-line text-text transition hover:bg-surface-3 active:scale-95', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function BackButton({ to }: { to?: string }) {
  const nav = useNavigate();
  return (
    <IconButton label="Voltar" onClick={() => (to ? nav(to) : window.history.length > 1 ? nav(-1) : nav('/'))}>
      <ArrowLeft className="size-5" />
    </IconButton>
  );
}

/* ---------------- Campos ---------------- */
export function Field({ label, error, hint, children, className }: { label?: string; error?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>}
      {children}
      {error ? <span className="mt-1.5 block text-xs text-danger">{error}</span> : hint ? <span className="mt-1.5 block text-xs text-faint">{hint}</span> : null}
    </label>
  );
}

const inputBase =
  'rounded-2xl border border-line bg-surface-2 px-4 text-[15px] text-text placeholder:text-faint outline-none transition focus:border-accent focus:bg-surface';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode; invalid?: boolean }>(function Input(
  { className, icon, invalid, ...rest }, ref,
) {
  return (
    <div className="relative">
      {icon && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint">{icon}</span>}
      <input ref={ref} className={cx(inputBase, 'h-12 w-full', icon && 'pl-11', invalid && 'border-danger', className)} aria-invalid={invalid || undefined} {...rest} />
    </div>
  );
});

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; icon?: ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} className="pr-12" />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-faint hover:text-text">
        {show ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
      </button>
    </div>
  );
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(inputBase, 'min-h-28 w-full py-3', className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputBase, !/\bw-/.test(className ?? '') && 'w-full', 'h-12 appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a69c90' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      {(label || description) && (
        <span>
          {label && <span className="block text-[15px] font-medium">{label}</span>}
          {description && <span className="block text-[13px] text-muted">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-accent' : 'bg-surface-3')}
      >
        <span className={cx('absolute top-1 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-6' : 'left-1')} />
      </button>
    </label>
  );
}

export function Stepper({ value, onChange, min = 0, max = 20, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-line bg-surface-2 px-3 py-2">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" aria-label={`Diminuir ${label}`} className="grid size-8 place-items-center rounded-full bg-surface-3 disabled:opacity-40" disabled={value <= min} onClick={() => onChange(value - 1)}>
          <Minus className="size-4" />
        </button>
        <span className="w-6 text-center font-semibold tabular-nums">{value}{value === max ? '' : ''}</span>
        <button type="button" aria-label={`Aumentar ${label}`} className="grid size-8 place-items-center rounded-full bg-surface-3 disabled:opacity-40" disabled={value >= max} onClick={() => onChange(value + 1)}>
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- Chips / Badges ---------------- */
export function Chip({ active, children, onClick, icon, className }: { active?: boolean; children: ReactNode; onClick?: () => void; icon?: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-medium transition',
        active ? 'border-transparent bg-primary text-primary-ink' : 'border-line bg-surface-2 text-muted hover:text-text',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

const TONES = {
  neutral: 'bg-surface-3 text-muted',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
} as const;
export type Tone = keyof typeof TONES;
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide', TONES[tone], className)}>{children}</span>;
}

export const statusTone = (s: string): Tone =>
  ({ disponivel: 'success', reservado: 'warning', vendido: 'info', alugado: 'info', inativo: 'neutral', pendente: 'accent',
     agendada: 'warning', confirmada: 'success', realizada: 'info', cancelada: 'danger',
     enviada: 'warning', contraproposta: 'accent', aceita: 'success', recusada: 'danger', rascunho: 'neutral',
     quente: 'danger', morno: 'warning', frio: 'info', ganho: 'success', perdido: 'danger' } as Record<string, Tone>)[s] ?? 'neutral';

/* ---------------- Cartões / layout ---------------- */
export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('rounded-3xl border border-line bg-surface', className)} {...rest}>{children}</div>;
}

export function SectionTitle({ title, action, to }: { title: string; action?: string; to?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
      {action && to && <Link to={to} className="text-[13px] font-medium text-muted hover:text-accent">{action}</Link>}
    </div>
  );
}

export function PageHeader({ title, subtitle, back, actions }: { title: ReactNode; subtitle?: ReactNode; back?: boolean | string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex items-start gap-3">
      {back && <BackButton to={typeof back === 'string' ? back : undefined} />}
      <div className="min-w-0 flex-1">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Avatar({ name, src, size = 40, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const [err, setErr] = useState(false);
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return src && !err ? (
    <img src={src} alt={name} onError={() => setErr(true)} className={cx('shrink-0 rounded-full object-cover', className)} style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className={cx('grid shrink-0 place-items-center rounded-full font-semibold text-[#1a140e]', className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, hsl(${hue} 45% 78%), hsl(${(hue + 40) % 360} 35% 62%))` }}
    >
      {initials(name)}
    </span>
  );
}

/** Imagem com fallback elegante caso a URL falhe ou não exista. */
export function Img({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [err, setErr] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setErr(false); setLoaded(false); }, [src]);
  if (!src || err)
    return (
      <div className={cx('img-fallback grid place-items-center', className)} role="img" aria-label={alt}>
        <Home className="size-8 text-accent/60" strokeWidth={1.4} />
      </div>
    );
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      onError={() => setErr(true)}
      className={cx('object-cover transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0', className)}
      style={{ background: 'var(--surface-2)' }}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton rounded-2xl', className)} />;
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line-strong px-6 py-14 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">{icon}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('size-6 animate-spin text-accent', className)} />;
}
export function PageLoader() {
  return <div className="grid min-h-[50vh] place-items-center"><Spinner /></div>;
}
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-3xl border border-danger/30 bg-danger-soft p-5 text-sm text-danger">
      {message}
      {onRetry && <button onClick={onRetry} className="ml-3 font-semibold underline">Tentar novamente</button>}
    </div>
  );
}

/* ---------------- Modal / Bottom sheet ---------------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className={cx('animate-fade-up relative max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] border border-line bg-bg-elev p-5 shadow-soft sm:rounded-[28px] sm:p-6 safe-bottom', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-surface-3 sm:hidden" />
        <div className="mb-4 flex items-center justify-between gap-4">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          <button onClick={onClose} aria-label="Fechar" className="ml-auto grid size-9 place-items-center rounded-full bg-surface-2 text-muted hover:text-text"><X className="size-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cx('no-scrollbar flex gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1', className)} role="tablist">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cx('h-9 shrink-0 rounded-full px-4 text-[13px] font-medium transition', value === it.value ? 'bg-surface-3 text-text' : 'text-muted hover:text-text')}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, hint, icon, tone = 'accent' }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: Tone }) {
  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted">{label}</span>
        {icon && <span className={cx('grid size-9 place-items-center rounded-xl', TONES[tone])}>{icon}</span>}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums md:text-[28px]">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}
