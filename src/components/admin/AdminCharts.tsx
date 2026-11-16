import React, { useMemo, useState } from 'react';
import { formatBDT } from '../../lib/api';

export function MiniSparkline({
  values,
  color = '#0D63F3',
}: {
  values: number[];
  color?: string;
}) {
  const safeValues = values.length >= 2 ? values : [0, ...values, 0];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const span = max - min || 1;
  const width = 92;
  const height = 34;

  const points = safeValues.map((v, idx) => {
    const x = (idx / (safeValues.length - 1)) * width;
    const y = height - 4 - ((v - min) / span) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;
  const gradId = `spark-${color.replace('#', '')}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-[88px] h-8 shrink-0 overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface SalesSeriesPoint {
  dateKey: string;
  label: string;
  revenue: number;
  orders: number;
  previousRevenue: number | null;
}

function buildSmoothPath(coords: Array<{ x: number; y: number }>): string {
  if (coords.length === 0) return '';
  if (coords.length === 1) return `M ${coords[0].x},${coords[0].y}`;
  let d = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx.toFixed(1)},${p0.y.toFixed(1)} ${cx.toFixed(1)},${p1.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
  }
  return d;
}

export function SalesOverviewChart({
  series,
  height = 228,
}: {
  series: SalesSeriesPoint[];
  height?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const hasPrevious = useMemo(
    () => series.some((pt) => pt.previousRevenue !== null && pt.previousRevenue > 0),
    [series]
  );

  const chart = useMemo(() => {
    const w = 560;
    const h = height;
    const padL = 54;
    const padR = 16;
    const padT = 18;
    const padB = 28;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const allVals = series.flatMap((pt) =>
      pt.previousRevenue !== null ? [pt.revenue, pt.previousRevenue] : [pt.revenue]
    );
    const rawMax = Math.max(100, ...allVals);
    const maxVal = Math.ceil(rawMax * 1.15);

    const coords = series.map((pt, i) => {
      const x = padL + (series.length <= 1 ? plotW / 2 : (i / (series.length - 1)) * plotW);
      const y = padT + plotH - (pt.revenue / maxVal) * plotH;
      return { x, y, pt };
    });

    const prevCoords = hasPrevious
      ? series.map((pt, i) => {
          const x = padL + (series.length <= 1 ? plotW / 2 : (i / (series.length - 1)) * plotW);
          const val = pt.previousRevenue ?? 0;
          const y = padT + plotH - (val / maxVal) * plotH;
          return { x, y };
        })
      : [];

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
      const val = Math.round(maxVal * ratio);
      const y = padT + plotH - ratio * plotH;
      const formatted =
        val >= 100000
          ? `৳${Number((val / 100000).toFixed(1))}L`
          : val >= 1000
            ? `৳${Number((val / 1000).toFixed(1))}k`
            : `৳${val}`;
      return { y, label: formatted };
    });

    const xStep = Math.max(1, Math.ceil(series.length / 6));
    const xTicks = coords.filter((_, idx) => idx === 0 || idx === coords.length - 1 || idx % xStep === 0);

    const linePath = buildSmoothPath(coords);
    const areaPath =
      coords.length > 0
        ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)},${(padT + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)},${(padT + plotH).toFixed(1)} Z`
        : '';
    const prevPath = hasPrevious ? buildSmoothPath(prevCoords) : '';

    return { w, h, padL, padR, padT, padB, plotH, coords, yTicks, xTicks, linePath, areaPath, prevPath };
  }, [series, hasPrevious, height]);

  const activeIdx = hoverIdx !== null && chart.coords[hoverIdx] ? hoverIdx : null;
  const activePoint = activeIdx !== null ? chart.coords[activeIdx] : null;

  if (series.length === 0) {
    return (
      <div className="h-52 flex items-center justify-center text-xs text-slate-400">
        No order activity recorded in this window yet.
      </div>
    );
  }

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${chart.w} ${chart.h}`}
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label="Sales overview revenue chart"
      >
        <defs>
          <linearGradient id="novaraSalesArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0D63F3" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#0D63F3" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {chart.yTicks.map((t, idx) => (
          <g key={idx}>
            <line
              x1={chart.padL}
              y1={t.y}
              x2={chart.w - chart.padR}
              y2={t.y}
              stroke="#E2E8F0"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <text x={chart.padL - 8} y={t.y + 3.5} textAnchor="end" className="fill-slate-400 text-[10px] font-medium">
              {t.label}
            </text>
          </g>
        ))}

        {chart.xTicks.map((t, idx) => (
          <text
            key={idx}
            x={t.x}
            y={chart.h - 6}
            textAnchor="middle"
            className="fill-slate-400 text-[10px] font-medium"
          >
            {t.pt.label}
          </text>
        ))}

        {chart.prevPath && (
          <path
            d={chart.prevPath}
            fill="none"
            stroke="#94A3B8"
            strokeWidth="1.8"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
        )}

        {chart.areaPath && <path d={chart.areaPath} fill="url(#novaraSalesArea)" />}
        {chart.linePath && (
          <path
            d={chart.linePath}
            fill="none"
            stroke="#0D63F3"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {activePoint && (
          <g>
            <line
              x1={activePoint.x}
              y1={chart.padT}
              x2={activePoint.x}
              y2={chart.padT + chart.plotH}
              stroke="#0D63F3"
              strokeDasharray="3 3"
              strokeWidth="1.2"
            />
            <circle cx={activePoint.x} cy={activePoint.y} r="5.5" fill="#0D63F3" stroke="#FFFFFF" strokeWidth="2" />
          </g>
        )}

        {chart.coords.map((c, idx) => (
          <rect
            key={c.pt.dateKey}
            x={c.x - 12}
            y={chart.padT}
            width="24"
            height={chart.plotH}
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setHoverIdx(idx)}
            onMouseLeave={() => setHoverIdx(null)}
          />
        ))}
      </svg>

      {activePoint && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-xl bg-[#0B1F4B] px-3 py-2 text-[11px] text-white shadow-lg border border-white/10"
          style={{
            left: `${Math.min(72, Math.max(8, (activePoint.x / chart.w) * 100 - 10))}%`,
          }}
        >
          <p className="font-bold text-slate-200">{activePoint.pt.label}</p>
          <p className="font-extrabold text-white tabular-nums mt-0.5">
            Sales: {formatBDT(activePoint.pt.revenue)}
          </p>
          <p className="text-[10px] text-blue-200 tabular-nums">{activePoint.pt.orders} orders</p>
        </div>
      )}
    </div>
  );
}

export interface OrderStatusSegment {
  key: string;
  label: string;
  count: number;
  percent: number;
  color: string;
}

export function OrderStatusDonutChart({
  segments,
  totalCount,
}: {
  segments: OrderStatusSegment[];
  totalCount: number;
}) {
  const radius = 56;
  const strokeWidth = 17;
  const circumference = 2 * Math.PI * radius;
  const visible = segments.filter((s) => s.count > 0);

  let cumulativeOffset = 0;

  return (
    <div className="flex flex-col sm:flex-row lg:flex-col 2xl:flex-row items-center gap-4">
      <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 144 144" className="w-full h-full -rotate-90" role="img" aria-label="Order status distribution">
          <circle
            cx="72"
            cy="72"
            r={radius}
            fill="none"
            stroke="#EEF2F7"
            strokeWidth={strokeWidth}
          />
          {visible.map((seg) => {
            const frac = seg.percent / 100;
            const dashLength = Math.max(2, frac * circumference - 2);
            const dashOffset = -cumulativeOffset;
            cumulativeOffset += frac * circumference;
            return (
              <circle
                key={seg.key}
                cx="72"
                cy="72"
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashLength} ${circumference}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-extrabold text-slate-900 tabular-nums leading-tight">
            {totalCount.toLocaleString('en-US')}
          </span>
          <span className="text-[10px] font-semibold text-slate-500">Total Orders</span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="text-slate-600 font-medium truncate">{seg.label}</span>
            </div>
            <span className="font-bold text-slate-900 tabular-nums shrink-0">{seg.percent.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
