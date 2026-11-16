export type DashboardRange = '7d' | '30d' | '90d' | 'all';

export interface DateWindow {
  range: DashboardRange;
  days: number;
  currentStart: Date | null;
  currentEnd: Date;
  previousStart: Date | null;
  previousEnd: Date | null;
}

export function resolveDateWindow(rawRange: unknown, now = new Date()): DateWindow {
  const normalized = typeof rawRange === 'string' ? rawRange.toLowerCase() : '30d';
  const range: DashboardRange =
    normalized === '7d' || normalized === '30d' || normalized === '90d' || normalized === 'all'
      ? normalized
      : '30d';

  const currentEnd = new Date(now);
  if (range === 'all') {
    return {
      range,
      days: 30,
      currentStart: null,
      currentEnd,
      previousStart: null,
      previousEnd: null,
    };
  }

  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  const currentStart = new Date(currentEnd.getTime() - days * 24 * 60 * 60 * 1000);
  const previousEnd = new Date(currentStart.getTime());
  const previousStart = new Date(previousEnd.getTime() - days * 24 * 60 * 60 * 1000);

  return {
    range,
    days,
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
  };
}

/**
 * Computes real period-over-period percentage change.
 * Returns null if no valid prior-period baseline exists (never fabricates fake percentages).
 */
export function computeGrowthPercent(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous <= 0) {
    return null;
  }
  const pct = ((current - previous) / previous) * 100;
  return Math.round(pct * 10) / 10;
}

export interface SalesPoint {
  dateKey: string;
  label: string;
  revenue: number;
  orders: number;
  previousRevenue: number | null;
}

export function formatShortDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

export function toIsoDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildSalesTimeSeries(params: {
  currentOrders: Array<{ createdAt: Date | string; grandTotal: number }>;
  previousOrders: Array<{ createdAt: Date | string; grandTotal: number }>;
  window: DateWindow;
}): SalesPoint[] {
  const { currentOrders, previousOrders, window } = params;
  const bucketCount = window.range === '7d' ? 7 : window.range === '90d' ? 15 : 15;
  const totalDays = window.range === 'all' ? 30 : window.days;
  const stepDays = Math.max(1, Math.ceil(totalDays / bucketCount));

  const endMs = window.currentEnd.getTime();
  const startMs =
    window.currentStart?.getTime() ?? endMs - totalDays * 24 * 60 * 60 * 1000;

  const hasPreviousData = previousOrders.length > 0;
  const prevStartMs = window.previousStart?.getTime() ?? startMs - (endMs - startMs);

  const buckets: SalesPoint[] = [];
  const spanMs = Math.max(24 * 60 * 60 * 1000, endMs - startMs);
  const actualBuckets = Math.min(bucketCount, Math.max(1, Math.ceil(totalDays / stepDays)));
  const bucketWidthMs = spanMs / actualBuckets;

  for (let i = 0; i < actualBuckets; i++) {
    const bStart = new Date(startMs + i * bucketWidthMs);
    buckets.push({
      dateKey: toIsoDayKey(bStart),
      label: formatShortDateLabel(bStart),
      revenue: 0,
      orders: 0,
      previousRevenue: hasPreviousData ? 0 : null,
    });
  }

  for (const ord of currentOrders) {
    const t = new Date(ord.createdAt).getTime();
    if (t < startMs || t > endMs) continue;
    const idx = Math.min(actualBuckets - 1, Math.max(0, Math.floor((t - startMs) / bucketWidthMs)));
    buckets[idx].revenue += Number(ord.grandTotal || 0);
    buckets[idx].orders += 1;
  }

  if (hasPreviousData && window.previousStart && window.previousEnd) {
    const prevSpanMs = Math.max(24 * 60 * 60 * 1000, window.previousEnd.getTime() - prevStartMs);
    const prevBucketWidthMs = prevSpanMs / actualBuckets;
    for (const ord of previousOrders) {
      const t = new Date(ord.createdAt).getTime();
      if (t < prevStartMs || t > window.previousEnd.getTime()) continue;
      const idx = Math.min(actualBuckets - 1, Math.max(0, Math.floor((t - prevStartMs) / prevBucketWidthMs)));
      buckets[idx].previousRevenue = (buckets[idx].previousRevenue ?? 0) + Number(ord.grandTotal || 0);
    }
  }

  return buckets;
}

export interface StatusDistributionItem {
  key: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  label: string;
  count: number;
  percent: number;
  color: string;
}

export function buildOrderStatusDistribution(
  statusCounts: Array<{ _id: string; count: number }>
): { totalSubOrders: number; items: StatusDistributionItem[] } {
  const map: Record<StatusDistributionItem['key'], number> = {
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  };

  for (const row of statusCounts) {
    const st = String(row._id || '').toLowerCase();
    const c = Number(row.count || 0);
    if (st === 'pending' || st === 'confirmed') {
      map.pending += c;
    } else if (st === 'processing' || st === 'packed') {
      map.processing += c;
    } else if (st === 'shipped') {
      map.shipped += c;
    } else if (st === 'delivered') {
      map.delivered += c;
    } else {
      map.cancelled += c;
    }
  }

  const totalSubOrders = Object.values(map).reduce((s, n) => s + n, 0);
  const defs: Array<{ key: StatusDistributionItem['key']; label: string; color: string }> = [
    { key: 'pending', label: 'Pending', color: '#0D63F3' },
    { key: 'processing', label: 'Processing', color: '#F59E0B' },
    { key: 'shipped', label: 'Shipped', color: '#8B5CF6' },
    { key: 'delivered', label: 'Delivered', color: '#10B981' },
    { key: 'cancelled', label: 'Cancelled / Returned', color: '#EF3E36' },
  ];

  const items: StatusDistributionItem[] = defs.map((d) => ({
    ...d,
    count: map[d.key],
    percent: totalSubOrders > 0 ? Math.round((map[d.key] / totalSubOrders) * 1000) / 10 : 0,
  }));

  return { totalSubOrders, items };
}

export function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const str = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsvReport(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  return lines.join('\n');
}
