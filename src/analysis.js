// Pure analysis functions. No network, no DOM: the dashboard, the tests and anyone
// re-running the thesis call these on the same raw inputs and get the same numbers.

export const YOCTO = 1e24;
const DAY = 86400;

/** ISO date (YYYY-MM-DD) from a unix timestamp in seconds. */
export const isoDay = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);

/** Monday (ISO week start) of an ISO date, as YYYY-MM-DD. */
export function weekOf(isoDate) {
  const t = Date.parse(isoDate + 'T00:00:00Z');
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - dow * DAY * 1000).toISOString().slice(0, 10);
}

/**
 * Joins the raw sources into one row per day.
 * nearblocks: response of https://api.nearblocks.io/v1/charts
 * intentsVolume: response of DefiLlama /summary/dexs/near-intents
 */
export function dailyRows(nearblocks, intentsVolume) {
  const iv = new Map(intentsVolume.totalDataChart.map(([t, v]) => [isoDay(t), v]));
  return nearblocks.charts.map((r) => {
    const d = r.date.slice(0, 10);
    return {
      date: d,
      price: +r.near_price,
      marketCap: +r.market_cap,
      totalSupply: +r.total_supply / YOCTO,
      activeAccounts: +r.active_accounts,
      txns: +r.txns,
      feeUsd: +r.txn_fee_usd,
      feeNear: +r.txn_fee / YOCTO,
      intentsVolume: iv.has(d) ? iv.get(d) : null,
    };
  });
}

/** Aggregates complete ISO weeks (7 days) between from and to (inclusive). */
export function weekly(rows, from, to) {
  const groups = new Map();
  for (const r of rows) {
    if (r.date < from || r.date > to) continue;
    const w = weekOf(r.date);
    if (!groups.has(w)) groups.set(w, []);
    groups.get(w).push(r);
  }
  const out = [];
  for (const [week, days] of groups) {
    if (days.length !== 7) continue;
    const sum = (k) => days.reduce((s, d) => s + (d[k] ?? 0), 0);
    out.push({
      week,
      intentsVolume: sum('intentsVolume'),
      activeAccounts: sum('activeAccounts') / 7, // average daily active accounts
      txns: sum('txns'),
      feeUsd: sum('feeUsd'),
      price: sum('price') / 7,
    });
  }
  return out.sort((a, b) => (a.week < b.week ? -1 : 1));
}

/** Week-over-week log changes of one field. */
export function logChanges(series, key) {
  const out = [];
  for (let i = 1; i < series.length; i++) out.push(Math.log(series[i][key] / series[i - 1][key]));
  return out;
}

export function pearson(a, b) {
  const n = a.length;
  if (n !== b.length || n < 3) throw new Error('pearson: need two equal series of length >= 3');
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb);
    sa += (a[i] - ma) ** 2;
    sb += (b[i] - mb) ** 2;
  }
  return sab / Math.sqrt(sa * sb);
}

/**
 * Cross-correlation of x against y at lags -maxLag..maxLag.
 * A positive lag L pairs x[t] with y[t+L]: a large r at L > 0 means x LEADS y by L weeks.
 */
export function crossCorrelation(x, y, maxLag) {
  const out = [];
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const a = [], b = [];
    for (let i = 0; i < x.length; i++) {
      const j = i + lag;
      if (j >= 0 && j < y.length) { a.push(x[i]); b.push(y[j]); }
    }
    out.push({ lag, r: pearson(a, b), n: a.length });
  }
  return out;
}

/** Deterministic PRNG (mulberry32), so the permutation test gives the same p-value for everyone. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Permutation test for "x leads y": the statistic is the largest r over lags 1..maxLag.
 * Shuffling x destroys any timing link, so p = share of shuffles with a statistic at least as large.
 * Testing the maximum over all lags corrects for having looked at several lags.
 */
export function leadPermutationTest(x, y, maxLag, iterations = 2000, seed = 42) {
  const stat = (xs) => Math.max(...crossCorrelation(xs, y, maxLag).filter((c) => c.lag >= 1).map((c) => c.r));
  const observed = stat(x);
  const rand = rng(seed);
  const xs = x.slice();
  let atLeast = 0;
  for (let k = 0; k < iterations; k++) {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    if (stat(xs) >= observed) atLeast++;
  }
  return { observed, p: (atLeast + 1) / (iterations + 1), iterations };
}

/** Sum of a DefiLlama totalDataChart per calendar month (YYYY-MM). */
export function monthly(chart) {
  const m = new Map();
  for (const [t, v] of chart) {
    const k = isoDay(t).slice(0, 7);
    m.set(k, (m.get(k) ?? 0) + v);
  }
  return m;
}

/** Sum of a DefiLlama totalDataChart over the `days` days ending at `endDate` (inclusive). */
export function trailingSum(chart, endDate, days) {
  const end = Date.parse(endDate + 'T00:00:00Z') / 1000;
  const start = end - (days - 1) * DAY;
  return chart.filter(([t]) => t >= start && t <= end).reduce((s, [, v]) => s + v, 0);
}

/**
 * Token supply economics over the 365 days ending at endDate.
 * NEAR burns 70% of transaction fees; the other 30% goes to the called contracts.
 */
export function supplyEconomics(rows, endDate) {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const end = byDate.get(endDate);
  const startDate = new Date(Date.parse(endDate + 'T00:00:00Z') - 365 * DAY * 1000).toISOString().slice(0, 10);
  const start = byDate.get(startDate);
  if (!end || !start) throw new Error(`supplyEconomics: missing ${!end ? endDate : startDate}`);
  const feesNear = rows.filter((r) => r.date > startDate && r.date <= endDate).reduce((s, r) => s + r.feeNear, 0);
  const netSupplyChange = end.totalSupply - start.totalSupply;
  return {
    startDate,
    endDate,
    supplyStart: start.totalSupply,
    supplyEnd: end.totalSupply,
    netSupplyChange,
    netInflationPct: (netSupplyChange / start.totalSupply) * 100,
    feesNear,
    feesBurnedNear: feesNear * 0.7,
    price: end.price,
    marketCap: end.marketCap,
  };
}

/**
 * Does NEAR's captured Intents revenue offset new supply?
 * coverage = revenue (USD) / (net new NEAR x price): the share of a year's net issuance the revenue could buy back.
 * breakevenPrice = the NEAR price at which the same revenue buys back the whole net issuance.
 */
export function valueCapture(annualRevenueUsd, netNewNear, price) {
  const issuanceUsd = netNewNear * price;
  return {
    annualRevenueUsd,
    issuanceUsd,
    coverage: annualRevenueUsd / issuanceUsd,
    breakevenPrice: annualRevenueUsd / netNewNear,
    revenueMultipleNeeded: issuanceUsd / annualRevenueUsd,
  };
}

/** Ratio of the last value to the first value of a field. */
export const growth = (series, key) => series[series.length - 1][key] / series[0][key];
