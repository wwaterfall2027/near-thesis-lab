// Unit tests for src/analysis.js and src/thesis.js. Run them by opening tests/index.html.
import {
  weekOf, weekly, logChanges, pearson, crossCorrelation, leadPermutationTest, rng,
  monthly, trailingSum, supplyEconomics, valueCapture, dailyRows,
} from '../src/analysis.js';
import { computeThesis } from '../src/thesis.js';
import { loadSources } from '../src/sources.js';

const results = [];
function test(name, fn) { results.push({ name, fn }); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg ?? ''} expected ${b}, got ${a}`); }
function near(a, b, tol, msg) { if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg ?? ''} expected ${b} ± ${tol}, got ${a}`); }
const ts = (iso) => Date.parse(iso + 'T00:00:00Z') / 1000;

test('weekOf returns the ISO Monday', () => {
  eq(weekOf('2026-11-11'), '2026-11-09'); // Wednesday
  eq(weekOf('2026-11-09'), '2026-11-09'); // Monday
  eq(weekOf('2026-11-15'), '2026-11-09'); // Sunday
});

test('weekly keeps only complete 7-day weeks and sums/averages correctly', () => {
  const rows = [];
  for (let i = 0; i < 10; i++) {
    const d = new Date(Date.UTC(2026, 10, 9 + i)).toISOString().slice(0, 10); // Mon 9 Nov .. Wed 18 Nov
    rows.push({ date: d, intentsVolume: 10, activeAccounts: 100 + i, txns: 2, feeUsd: 1, price: 3 });
  }
  const w = weekly(rows, '2026-11-01', '2026-11-30');
  eq(w.length, 1, 'only the full week');
  eq(w[0].week, '2026-11-09');
  eq(w[0].intentsVolume, 70);
  eq(w[0].txns, 14);
  near(w[0].activeAccounts, 103, 1e-12, 'average of 100..106');
});

test('pearson: perfect, inverse and invalid input', () => {
  near(pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1, 1e-12);
  near(pearson([1, 2, 3, 4], [8, 6, 4, 2]), -1, 1e-12);
  let threw = false; try { pearson([1, 2], [1, 2]); } catch { threw = true; }
  eq(threw, true, 'rejects n < 3');
});

test('crossCorrelation finds a planted 3-week lead at lag +3', () => {
  const rand = rng(7);
  const x = Array.from({ length: 120 }, () => rand() - 0.5);
  const y = x.map((_, i) => (i >= 3 ? x[i - 3] : 0) + 0.1 * (rand() - 0.5)); // y follows x by 3 weeks
  const cc = crossCorrelation(x, y, 6);
  const best = cc.reduce((a, b) => (b.r > a.r ? b : a));
  eq(best.lag, 3, 'best lag');
  if (best.r < 0.9) throw new Error(`r too small: ${best.r}`);
});

test('leadPermutationTest: significant for a planted lead, not for independent noise', () => {
  const rand = rng(11);
  const x = Array.from({ length: 100 }, () => rand() - 0.5);
  const led = x.map((_, i) => (i >= 2 ? x[i - 2] : 0) + 0.3 * (rand() - 0.5));
  const noise = Array.from({ length: 100 }, () => rand() - 0.5);
  const a = leadPermutationTest(x, led, 8, 500, 1);
  const b = leadPermutationTest(x, noise, 8, 500, 1);
  if (a.p >= 0.01) throw new Error(`planted lead p = ${a.p}`);
  if (b.p < 0.05) throw new Error(`noise p = ${b.p}`);
});

test('leadPermutationTest is deterministic for a given seed', () => {
  const rand = rng(3);
  const x = Array.from({ length: 60 }, () => rand());
  const y = Array.from({ length: 60 }, () => rand());
  eq(leadPermutationTest(x, y, 4, 300, 9).p, leadPermutationTest(x, y, 4, 300, 9).p);
});

test('logChanges', () => {
  const s = [{ v: 1 }, { v: Math.E }, { v: Math.E ** 3 }];
  const c = logChanges(s, 'v');
  near(c[0], 1, 1e-12); near(c[1], 2, 1e-12);
});

test('monthly and trailingSum on a DefiLlama-shaped chart', () => {
  const chart = [[ts('2026-09-30'), 5], [ts('2026-10-01'), 1], [ts('2026-10-31'), 2], [ts('2026-11-01'), 4]];
  const m = monthly(chart);
  eq(m.get('2026-09'), 5); eq(m.get('2026-10'), 3); eq(m.get('2026-11'), 4);
  eq(trailingSum(chart, '2026-11-01', 2), 6, 'Oct 31 + Nov 1');
  eq(trailingSum(chart, '2026-11-01', 32), 7, 'Oct 1 .. Nov 1');
});

test('supplyEconomics: net change, inflation and 70% fee burn', () => {
  const rows = [];
  for (let i = 0; i <= 365; i++) {
    const d = new Date(Date.UTC(2025, 10, 11 + i)).toISOString().slice(0, 10);
    rows.push({ date: d, totalSupply: 1000 + i * 0.1, feeNear: 1, price: 2, marketCap: 50 });
  }
  const s = supplyEconomics(rows, '2026-11-11');
  eq(s.startDate, '2025-11-11');
  near(s.netSupplyChange, 36.5, 1e-9);
  near(s.netInflationPct, 3.65, 1e-9);
  eq(s.feesNear, 365, 'days after start through end');
  near(s.feesBurnedNear, 255.5, 1e-9);
});

test('valueCapture: coverage, break-even price and multiple', () => {
  const v = valueCapture(10, 100, 0.5); // $10 revenue, 100 new NEAR at $0.50
  near(v.issuanceUsd, 50, 1e-12);
  near(v.coverage, 0.2, 1e-12);
  near(v.breakevenPrice, 0.1, 1e-12);
  near(v.revenueMultipleNeeded, 5, 1e-12);
});

test('dailyRows joins NearBlocks and DefiLlama by date and converts yocto', () => {
  const nb = { charts: [{ date: '2026-11-10T00:00:00.000Z', near_price: '3', market_cap: '9', total_supply: '2' + '0'.repeat(24), active_accounts: '5', txns: '7', txn_fee_usd: '1.5', txn_fee: '3' + '0'.repeat(23) }] };
  const iv = { totalDataChart: [[ts('2026-11-10'), 42]] };
  const r = dailyRows(nb, iv)[0];
  eq(r.totalSupply, 2); near(r.feeNear, 0.3, 1e-12); eq(r.intentsVolume, 42); eq(r.activeAccounts, 5);
});

test('end to end on the frozen snapshot: the figures quoted in THESIS.md', async () => {
  const t = computeThesis(await loadSources('snapshot', '..'));
  eq(t.endDate, '2026-11-11');
  eq(t.weeks.length, 99);
  eq(Math.round(t.decoupling.intentsGrowth), 1094);
  eq(Math.round(t.decoupling.activeChangePct), -94);
  near(t.capture.coverage, 0.19, 0.005, 'buyback coverage');
  near(t.supply.netInflationPct, 2.48, 0.005, 'net inflation');
  near(t.capture.breakevenPrice, 0.69, 0.005, 'break-even price');
  for (const k of ['priceTest', 'activeTest', 'feesTest']) {
    if (t.leadLag[k].p < 0.05) throw new Error(`${k} unexpectedly significant: p = ${t.leadLag[k].p}`);
  }
});

export async function run() {
  const out = [];
  for (const { name, fn } of results) {
    try { await fn(); out.push({ name, ok: true }); } catch (e) { out.push({ name, ok: false, error: e.message }); }
  }
  return out;
}
