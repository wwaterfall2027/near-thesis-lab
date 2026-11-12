// Turns the four raw sources into every figure the thesis cites.
import {
  dailyRows, weekly, logChanges, crossCorrelation, leadPermutationTest,
  monthly, trailingSum, supplyEconomics, valueCapture, isoDay, weekOf,
} from './analysis.js';

const MAX_LAG = 8; // weeks
const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

export function computeThesis(raw) {
  const rows = dailyRows(raw.nearblocks, raw.intentsVolume);
  const ivChart = raw.intentsVolume.totalDataChart;
  const revChart = raw.intentsRevenue.totalDataChart;
  const feeChart = raw.intentsFees.totalDataChart;

  // Common end date: the last day every source has.
  const endDate = [rows[rows.length - 1].date, isoDay(ivChart.at(-1)[0]), isoDay(revChart.at(-1)[0]), isoDay(feeChart.at(-1)[0])]
    .sort()[0];
  // First full ISO week on or after the first day of Intents volume.
  const firstIntents = isoDay(ivChart[0][0]);
  const startWeek = weekOf(firstIntents) === firstIntents
    ? firstIntents
    : new Date(Date.parse(weekOf(firstIntents) + 'T00:00:00Z') + 7 * 864e5).toISOString().slice(0, 10);
  const weeks = weekly(rows, startWeek, endDate);
  const first4 = weeks.slice(0, 4), last4 = weeks.slice(-4);

  // 1. Decoupling: value through Intents vs. headcount on chain.
  const decoupling = {
    weeks: weeks.length,
    from: weeks[0].week,
    to: weeks.at(-1).week,
    intentsWeeklyFirst4: avg(first4.map((w) => w.intentsVolume)),
    intentsWeeklyLast4: avg(last4.map((w) => w.intentsVolume)),
    activeFirst4: avg(first4.map((w) => w.activeAccounts)),
    activeLast4: avg(last4.map((w) => w.activeAccounts)),
    txnsFirst4: avg(first4.map((w) => w.txns)),
    txnsLast4: avg(last4.map((w) => w.txns)),
    intents30d: trailingSum(ivChart, endDate, 30),
  };
  decoupling.intentsGrowth = decoupling.intentsWeeklyLast4 / decoupling.intentsWeeklyFirst4;
  decoupling.activeChangePct = (decoupling.activeLast4 / decoupling.activeFirst4 - 1) * 100;
  decoupling.txnsChangePct = (decoupling.txnsLast4 / decoupling.txnsFirst4 - 1) * 100;

  // 2. Is Intents volume a leading indicator? Weekly log changes, lags 1..8 weeks.
  const dIv = logChanges(weeks, 'intentsVolume');
  const dPrice = logChanges(weeks, 'price');
  const dActive = logChanges(weeks, 'activeAccounts');
  const dFee = logChanges(weeks, 'feeUsd');
  const leadLag = {
    maxLag: MAX_LAG,
    n: dIv.length,
    band95: 1.96 / Math.sqrt(dIv.length),
    price: crossCorrelation(dIv, dPrice, MAX_LAG),
    active: crossCorrelation(dIv, dActive, MAX_LAG),
    fees: crossCorrelation(dIv, dFee, MAX_LAG),
    priceTest: leadPermutationTest(dIv, dPrice, MAX_LAG),
    activeTest: leadPermutationTest(dIv, dActive, MAX_LAG),
    feesTest: leadPermutationTest(dIv, dFee, MAX_LAG),
  };

  // 3. Value capture: captured revenue vs. net new supply.
  const supply = supplyEconomics(rows, endDate);
  const rev30 = trailingSum(revChart, endDate, 30);
  const rev365 = trailingSum(revChart, endDate, 365);
  const fees365 = trailingSum(feeChart, endDate, 365);
  const runRate = (rev30 * 365) / 30;
  const capture = {
    rev30,
    rev365,
    fees365,
    runRate,
    takeRate365: rev365 / trailingSum(ivChart, endDate, 365),
    ...valueCapture(runRate, supply.netSupplyChange, supply.price),
    priceToRunRate: supply.marketCap / runRate,
  };

  // Monthly series for the charts (complete months only).
  const endMonth = endDate.slice(0, 7);
  const revM = monthly(revChart), feeM = monthly(feeChart);
  const supplyByMonth = new Map();
  for (const r of rows) {
    const m = r.date.slice(0, 7);
    if (!supplyByMonth.has(m)) supplyByMonth.set(m, { first: r, last: r, prices: [] });
    const e = supplyByMonth.get(m);
    e.last = r;
    e.prices.push(r.price);
  }
  const prevMonth = (m) => {
    const [y, mo] = m.split('-').map(Number);
    return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`;
  };
  const months = [...revM.keys()]
    .filter((m) => m < endMonth && supplyByMonth.has(m) && supplyByMonth.has(prevMonth(m)))
    .sort();
  const monthlySeries = months.map((m) => {
    const e = supplyByMonth.get(m);
    // Net new supply in the month: end of this month minus end of the previous month.
    const issuanceNear = e.last.totalSupply - supplyByMonth.get(prevMonth(m)).last.totalSupply;
    return {
      month: m,
      revenue: revM.get(m) ?? 0,
      fees: feeM.get(m) ?? 0,
      issuanceUsd: issuanceNear * avg(e.prices),
    };
  });

  return { endDate, rows, weeks, decoupling, leadLag, supply, capture, monthlySeries };
}
