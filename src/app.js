import { SOURCES, loadSources } from './sources.js';
import { computeThesis } from './thesis.js';

const $ = (sel) => document.querySelector(sel);
const usd = (x, d = 1) => {
  const a = Math.abs(x);
  if (a >= 1e9) return `$${(x / 1e9).toFixed(d)}B`;
  if (a >= 1e6) return `$${(x / 1e6).toFixed(d)}M`;
  if (a >= 1e3) return `$${(x / 1e3).toFixed(d)}K`;
  return `$${x.toFixed(2)}`;
};
const num = (x, d = 1) => {
  const a = Math.abs(x);
  if (a >= 1e9) return `${(x / 1e9).toFixed(d)}B`;
  if (a >= 1e6) return `${(x / 1e6).toFixed(d)}M`;
  if (a >= 1e3) return `${(x / 1e3).toFixed(d)}K`;
  return x.toFixed(d);
};
const times = (x) => `${Math.round(x).toLocaleString('en-US')}x`;
const pct = (x, d = 1) => `${x >= 0 ? '+' : ''}${x.toFixed(d)}%`;
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const params = new URLSearchParams(location.search);
const mode = params.get('live') === '1' ? 'live' : 'snapshot';
const charts = [];

function card(label, value, note) {
  return `<div class="card"><div class="label">${label}</div><div class="value">${value}</div><div class="note">${note}</div></div>`;
}

function sourceList(keys) {
  return keys.map((k) => `<a href="${SOURCES[k].url}" target="_blank" rel="noopener">${k}</a>`).join(', ');
}

function lineChart(canvas, labels, datasets, { logY = false, yLabel = '', y2Label = null } = {}) {
  const grid = css('--grid'), ink = css('--muted');
  const scales = {
    x: { ticks: { color: ink, maxTicksLimit: 8 }, grid: { color: grid } },
    y: { type: logY ? 'logarithmic' : 'linear', title: { display: !!yLabel, text: yLabel, color: ink }, ticks: { color: ink }, grid: { color: grid } },
  };
  if (y2Label) scales.y2 = { type: logY ? 'logarithmic' : 'linear', position: 'right', title: { display: true, text: y2Label, color: ink }, ticks: { color: ink }, grid: { drawOnChartArea: false } };
  charts.push(new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: ink } } },
      elements: { point: { radius: 0 }, line: { borderWidth: 2 } },
      scales,
    },
  }));
}

function barChart(canvas, labels, datasets, band) {
  const grid = css('--grid'), ink = css('--muted');
  charts.push(new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [
      ...datasets,
      { type: 'line', label: '95% noise band', data: labels.map(() => band), borderColor: css('--warn'), borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0 },
      { type: 'line', label: '', data: labels.map(() => -band), borderColor: css('--warn'), borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0 },
    ] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { labels: { color: ink, filter: (i) => i.text !== '' } } },
      scales: {
        x: { title: { display: true, text: 'lag in weeks (positive = Intents volume moves first)', color: ink }, ticks: { color: ink }, grid: { color: grid } },
        y: { min: -0.6, max: 0.6, title: { display: true, text: 'correlation r', color: ink }, ticks: { color: ink }, grid: { color: grid } },
      },
    },
  }));
}

function render(t, snapshotMeta) {
  const { decoupling: d, leadLag: l, supply: s, capture: c } = t;
  const bestLead = (series) => series.filter((x) => x.lag >= 1).reduce((a, b) => (b.r > a.r ? b : a));

  $('#asof').textContent = mode === 'live'
    ? `Live data, fetched just now. Common end date of all sources: ${t.endDate}.`
    : `Frozen snapshot fetched ${snapshotMeta.fetchedAtUtc}. Common end date of all sources: ${t.endDate}.`;

  $('#cards').innerHTML = [
    card('Intents volume, last 30 days', usd(d.intents30d), `${source('intentsVolume')}`),
    card('Intents weekly volume growth', times(d.intentsGrowth), `first 4 vs last 4 full weeks since ${d.from}`),
    card('Daily active accounts', pct(d.activeChangePct, 0), `${num(d.activeFirst4, 0)} → ${num(d.activeLast4, 0)} (same weeks)`),
    card('Captured Intents revenue', `${usd(c.runRate)}/yr`, `30-day run-rate; ${usd(c.rev365)} in the last 365 days`),
    card('Net new NEAR per year', `${num(s.netSupplyChange, 1)} NEAR`, `${pct(s.netInflationPct, 2)} supply, ${usd(c.issuanceUsd)} at ${usd(s.price)}`),
    card('Buyback coverage of new supply', `${(c.coverage * 100).toFixed(0)}%`, `break-even NEAR price ${usd(c.breakevenPrice)}`),
  ].join('');
  function source(k) { return `source: ${sourceList([k])}`; }

  // Chart 1: decoupling.
  const wk = t.weeks.map((w) => w.week);
  lineChart($('#c-decoupling'), wk, [
    { label: 'Intents volume per week (USD)', data: t.weeks.map((w) => w.intentsVolume), borderColor: css('--a1'), yAxisID: 'y' },
    { label: 'Daily active accounts (weekly avg)', data: t.weeks.map((w) => w.activeAccounts), borderColor: css('--a2'), yAxisID: 'y2' },
  ], { logY: true, yLabel: 'USD per week (log)', y2Label: 'accounts (log)' });
  $('#s-decoupling').textContent = `Weekly Intents volume went from ${usd(d.intentsWeeklyFirst4)} to ${usd(d.intentsWeeklyLast4)} (${times(d.intentsGrowth)}) while daily active accounts went from ${num(d.activeFirst4, 0)} to ${num(d.activeLast4, 0)} (${pct(d.activeChangePct, 0)}) and weekly transactions ${pct(d.txnsChangePct, 0)}. Headcount and value moved in opposite directions.`;

  // Chart 2: lead-lag.
  const lags = l.price.map((x) => String(x.lag));
  barChart($('#c-leadlag'), lags, [
    { label: 'Intents → NEAR price', data: l.price.map((x) => x.r), backgroundColor: css('--a1') },
    { label: 'Intents → active accounts', data: l.active.map((x) => x.r), backgroundColor: css('--a2') },
    { label: 'Intents → chain fees', data: l.fees.map((x) => x.r), backgroundColor: css('--a3') },
  ], l.band95);
  const bp = bestLead(l.price), ba = bestLead(l.active), bf = bestLead(l.fees);
  $('#s-leadlag').textContent = `On ${l.n} weekly changes, the strongest lead of Intents volume over price is r = ${bp.r.toFixed(2)} at ${bp.lag} week(s) (permutation p = ${l.priceTest.p.toFixed(2)}); over active accounts r = ${ba.r.toFixed(2)} at ${ba.lag} (p = ${l.activeTest.p.toFixed(2)}); over chain fees r = ${bf.r.toFixed(2)} at ${bf.lag} (p = ${l.feesTest.p.toFixed(2)}). ${[l.priceTest, l.activeTest, l.feesTest].some((x) => x.p < 0.05) ? 'At least one lead is significant at 5%.' : 'None is significant at 5%: the data does not show Intents volume leading any of them.'}`;

  // Chart 3: value capture.
  // Plot from the first month NEAR captured meaningful revenue (>= $10K); earlier months are zero or dust.
  const firstRev = t.monthlySeries.findIndex((m) => m.revenue >= 10_000);
  const ms = t.monthlySeries.slice(Math.max(0, firstRev));
  lineChart($('#c-capture'), ms.map((m) => m.month), [
    { label: 'Captured Intents revenue (USD/month)', data: ms.map((m) => m.revenue), borderColor: css('--a1') },
    { label: 'Gross Intents fees (USD/month)', data: ms.map((m) => m.fees), borderColor: css('--a3') },
    { label: 'Net new NEAR supply, valued at price (USD/month)', data: ms.map((m) => m.issuanceUsd), borderColor: css('--a2') },
  ], { logY: true, yLabel: 'USD per month (log)' });
  const lastM = ms.at(-1);
  $('#s-capture').textContent = `In ${lastM.month}, NEAR captured ${usd(lastM.revenue)} from Intents against ${usd(lastM.issuanceUsd)} of net new supply. At the 30-day run-rate (${usd(c.runRate)}/yr) buybacks could absorb ${(c.coverage * 100).toFixed(0)}% of a year's net issuance at ${usd(s.price)}; full coverage needs ${c.revenueMultipleNeeded.toFixed(1)}x the revenue, or a NEAR price of ${usd(c.breakevenPrice)}. NEAR keeps ${(c.takeRate365 * 100).toFixed(3)}% of Intents volume as revenue.`;

  // Supply table.
  $('#supply').innerHTML = `
    <tr><td>Total supply ${s.startDate}</td><td>${num(s.supplyStart, 2)} NEAR</td></tr>
    <tr><td>Total supply ${s.endDate}</td><td>${num(s.supplyEnd, 2)} NEAR</td></tr>
    <tr><td>Net change (issuance minus burn)</td><td>${num(s.netSupplyChange, 2)} NEAR (${pct(s.netInflationPct, 2)})</td></tr>
    <tr><td>Transaction fees paid, 365 days</td><td>${num(s.feesNear, 0)} NEAR (70% burned: ${num(s.feesBurnedNear, 0)})</td></tr>
    <tr><td>Market cap / Intents revenue run-rate</td><td>${c.priceToRunRate.toFixed(0)}x</td></tr>`;

  // Falsifiers, evaluated on the current data.
  const checks = [
    ['Buybacks cover at least 100% of net new supply', c.coverage >= 1],
    ['Intents volume leads NEAR price (p < 0.05)', l.priceTest.p < 0.05],
    ['Intents volume leads active accounts (p < 0.05)', l.activeTest.p < 0.05],
    [`Captured revenue in the last full month (${lastM.month}) is above the mean of the 3 before it`, lastM.revenue > (ms.at(-2).revenue + ms.at(-3).revenue + ms.at(-4).revenue) / 3],
  ];
  $('#checks').innerHTML = checks.map(([k, v]) => `<li class="${v ? 'yes' : 'no'}"><span>${v ? 'YES' : 'NO'}</span> ${k}</li>`).join('');

  $('#sources').innerHTML = Object.entries(SOURCES).map(([k, v]) => {
    const f = snapshotMeta?.files?.[v.file.replace('data/', '')];
    return `<tr><td><code>${k}</code></td><td>${v.what}<br><a href="${v.url}" target="_blank" rel="noopener">${v.url}</a>${f ? `<br><small>snapshot sha256 ${f.sha256}</small>` : ''}</td></tr>`;
  }).join('');

  window.THESIS = t; // for anyone who wants to inspect every number in the console
  document.body.dataset.ready = '1';
}

async function main() {
  $('#mode').innerHTML = mode === 'live'
    ? 'Mode: <b>live</b> · <a href="?">use frozen snapshot</a>'
    : 'Mode: <b>frozen snapshot</b> · <a href="?live=1">re-run on live data</a>';
  try {
    const [raw, meta] = await Promise.all([
      loadSources(mode),
      fetch('data/snapshot.json').then((r) => r.json()),
    ]);
    render(computeThesis(raw), meta);
  } catch (e) {
    $('#asof').textContent = `Could not load data: ${e.message}`;
    document.body.dataset.ready = 'error';
    throw e;
  }
}

main();
