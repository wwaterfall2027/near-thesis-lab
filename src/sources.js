// Every number in the thesis comes from these four public, keyless endpoints.
// `snapshot` mode reads the frozen copies in data/; `live` mode fetches them again.

export const SOURCES = {
  nearblocks: {
    url: 'https://api.nearblocks.io/v1/charts',
    file: 'data/nearblocks-charts.json',
    what: 'NearBlocks daily chain stats: active accounts, transactions, fees, total supply, price.',
  },
  intentsVolume: {
    url: 'https://api.llama.fi/summary/dexs/near-intents?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true',
    file: 'data/llama-intents-volume.json',
    what: 'DefiLlama daily NEAR Intents swap volume (USD).',
  },
  intentsFees: {
    url: 'https://api.llama.fi/summary/fees/near-intents?dataType=dailyFees&excludeTotalDataChartBreakdown=true',
    file: 'data/llama-intents-fees.json',
    what: 'DefiLlama daily gross NEAR Intents fees (protocol + front-end affiliate fees, USD).',
  },
  intentsRevenue: {
    url: 'https://api.llama.fi/summary/fees/near-intents?dataType=dailyRevenue&excludeTotalDataChartBreakdown=true',
    file: 'data/llama-intents-revenue.json',
    what: "DefiLlama daily revenue NEAR captures from Intents (USD); since 2026-02-23 it funds NEAR buybacks.",
  },
};

export async function loadSources(mode, base = '.') {
  const entries = await Promise.all(
    Object.entries(SOURCES).map(async ([key, s]) => {
      const url = mode === 'live' ? s.url : `${base}/${s.file}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${key}: HTTP ${res.status} from ${url}`);
      return [key, await res.json()];
    }),
  );
  return Object.fromEntries(entries);
}
