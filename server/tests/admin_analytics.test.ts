import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCsvReport,
  buildOrderStatusDistribution,
  buildSalesTimeSeries,
  computeGrowthPercent,
  escapeCsvCell,
  resolveDateWindow,
} from '../services/adminAnalytics';

test('adminAnalytics pure helpers behave deterministically with zero fake baselines', () => {
  // 1. computeGrowthPercent returns null when prior period is 0 or negative (no fabricated percentages)
  assert.equal(computeGrowthPercent(10, 0), null);
  assert.equal(computeGrowthPercent(0, 0), null);
  assert.equal(computeGrowthPercent(150, 100), 50);
  assert.equal(computeGrowthPercent(75, 100), -25);

  // 2. resolveDateWindow produces consistent intervals for 7d, 30d, 90d, and all
  const now = new Date('2026-11-15T12:00:00.000Z');
  const win7 = resolveDateWindow('7d', now);
  assert.equal(win7.range, '7d');
  assert.equal(win7.days, 7);
  assert.ok(win7.currentStart && win7.previousStart && win7.previousEnd);

  const winAll = resolveDateWindow('all', now);
  assert.equal(winAll.range, 'all');
  assert.equal(winAll.currentStart, null);
  assert.equal(winAll.previousStart, null);

  // 3. buildSalesTimeSeries aggregates revenues and order counts accurately across buckets
  const dayA = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const dayB = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const series = buildSalesTimeSeries({
    currentOrders: [
      { createdAt: dayA, grandTotal: 1500 },
      { createdAt: dayA, grandTotal: 500 },
      { createdAt: dayB, grandTotal: 3200 },
    ],
    previousOrders: [],
    window: win7,
  });
  assert.equal(series.length, 7);
  const totalSeriesRev = series.reduce((s, p) => s + p.revenue, 0);
  const totalSeriesOrders = series.reduce((s, p) => s + p.orders, 0);
  assert.equal(totalSeriesRev, 5200);
  assert.equal(totalSeriesOrders, 3);
  assert.ok(series.every((p) => p.previousRevenue === null));

  // 4. buildOrderStatusDistribution calculates percentages summing closely to 100%
  const dist = buildOrderStatusDistribution([
    { _id: 'pending', count: 1 },
    { _id: 'processing', count: 2 },
    { _id: 'shipped', count: 3 },
    { _id: 'delivered', count: 4 },
  ]);
  assert.equal(dist.totalSubOrders, 10);
  const pendingSeg = dist.items.find((d) => d.key === 'pending');
  const deliveredSeg = dist.items.find((d) => d.key === 'delivered');
  assert.equal(pendingSeg?.percent, 10);
  assert.equal(deliveredSeg?.percent, 40);

  // 5. CSV escaping neutralizes commas, quotes, newlines, and spreadsheet formulas
  assert.equal(escapeCsvCell('Dhaka, BD'), '"Dhaka, BD"');
  assert.equal(escapeCsvCell('=CMD()'), "'=CMD()");
  const csv = buildCsvReport(['Order', 'Amount'], [['ORD-1', 1200], ['=SUM(A1)', '500']]);
  assert.ok(csv.includes('Order,Amount'));
  assert.ok(csv.includes('ORD-1,1200'));
  assert.ok(csv.includes("'=SUM(A1),500"));
});
