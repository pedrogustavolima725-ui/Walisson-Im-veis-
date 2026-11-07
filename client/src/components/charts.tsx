import { useMemo, useRef, useState } from 'react';
import { cx } from './ui';

/**
 * Gráfico de área (série única) com crosshair + tooltip.
 * Um eixo só; cor da série = token --chart (validado para claro/escuro).
 */
export function AreaChart({ data, format, height = 240, label }: { data: { label: string; value: number }[]; format: (v: number) => string; height?: number; label: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = height;
  const pad = { l: 56, r: 16, t: 16, b: 28 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = niceMax(max);
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, data.length - 1);
  const y = (v: number) => pad.t + (1 - v / nice) * (H - pad.t - pad.b);
  const pts = data.map((d, i) => [x(i), y(d.value)] as const);
  const path = smooth(pts);
  const area = `${path} L ${x(data.length - 1)} ${H - pad.b} L ${x(0)} ${H - pad.b} Z`;
  const empty = data.every((d) => !d.value);
  const ticks = empty ? [0] : [0, 0.25, 0.5, 0.75, 1].map((t) => t * nice);

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" role="img" aria-label={label} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--chart)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--chart)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t ? '3 5' : undefined} />
            <text x={pad.l - 10} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--faint)">{format(t)}</text>
          </g>
        ))}
        {data.map((d, i) => (
          <text key={d.label + i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={hover === i ? 'var(--text)' : 'var(--faint)'} className="capitalize">{d.label}</text>
        ))}
        {empty && <text x={(W + pad.l) / 2} y={H / 2 - 10} textAnchor="middle" fontSize="13" fill="var(--muted)">Os números aparecem aqui conforme os negócios acontecem</text>}
        <path d={area} fill="url(#area-fill)" />
        <path d={path} fill="none" stroke="var(--chart)" strokeWidth="2" strokeLinecap="round" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--line-strong)" strokeDasharray="4 4" />
            <circle cx={x(hover)} cy={y(data[hover].value)} r="6" fill="var(--chart)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-xl border border-line-strong bg-bg-elev px-3 py-2 text-xs shadow-soft"
          style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(data[hover].value) / H) * 100}%`, marginTop: -12 }}
        >
          <div className="capitalize text-muted">{data[hover].label}</div>
          <div className="text-sm font-semibold tabular-nums text-text">{format(data[hover].value)}</div>
        </div>
      )}
    </div>
  );
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function smooth(pts: readonly (readonly [number, number])[]) {
  if (!pts.length) return '';
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
  }
  return d;
}

/** Barras horizontais de magnitude (uma cor), com rótulo e valor em tokens de texto. */
export function HBars({ items, format = String, onClick }: { items: { key: string; label: string; value: number }[]; format?: (v: number) => string; onClick?: (key: string) => void }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => onClick?.(it.key)}
          className={cx('group block w-full text-left', !onClick && 'cursor-default')}
          title={`${it.label}: ${format(it.value)}`}
        >
          <div className="mb-1 flex items-center justify-between text-[13px]">
            <span className="text-muted group-hover:text-text">{it.label}</span>
            <span className="font-semibold tabular-nums">{format(it.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-chart transition-all duration-700" style={{ width: `${Math.max(it.value ? 3 : 0, (it.value / max) * 100)}%` }} />
          </div>
        </button>
      ))}
    </div>
  );
}

/** Sparkline minimalista para KPIs. */
export function Spark({ values }: { values: number[] }) {
  const d = useMemo(() => {
    const max = Math.max(1, ...values);
    return values.map((v, i) => `${i ? 'L' : 'M'} ${(i / Math.max(1, values.length - 1)) * 100} ${28 - (v / max) * 26}`).join(' ');
  }, [values]);
  return (
    <svg viewBox="0 0 100 30" className="h-8 w-24" preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke="var(--chart)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}
