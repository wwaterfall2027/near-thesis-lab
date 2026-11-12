# NEAR: from headcount to throughput

**Track:** Investment Thesis (`thesis`) · **Data end date:** 2026-11-11 · **Snapshot fetched:** 2026-11-12 10:11 UTC

Every number in this file is printed by the dashboard (`index.html`) from the frozen snapshot in `data/`, and is checked by the end-to-end test in `tests/analysis.test.js`. Open the dashboard with `?live=1` to recompute everything from today's data.

## The claim

1. **NEAR's real usage is value settled through NEAR Intents, not raw activity counts.** The two now move in opposite directions.
2. **Intents volume is not a leading indicator of NEAR's price, active accounts or chain fees.** I started from that hypothesis and the data rejects it.
3. **Since 2026-02-23, part of the Intents flow returns to NEAR holders through buybacks.** The capture is growing, but at today's run-rate it absorbs about a fifth of the net new supply.

Long-term thesis: NEAR is becoming the settlement layer for cross-chain value. The token's case depends on one variable: how much of that flow is captured relative to issuance. Activity metrics and price momentum say little about it.

## Data

| Source | Endpoint | Used for |
|---|---|---|
| NearBlocks | `https://api.nearblocks.io/v1/charts` | Daily active accounts, transactions, fees (NEAR and USD), total supply, price, market cap |
| DefiLlama | `/summary/dexs/near-intents` | Daily NEAR Intents swap volume (USD) |
| DefiLlama | `/summary/fees/near-intents?dataType=dailyFees` | Gross Intents fees: protocol plus front-end affiliate fees |
| DefiLlama | `/summary/fees/near-intents?dataType=dailyRevenue` | Revenue NEAR captures from Intents (NEAR/wNEAR swept to its revenue wallets; funds open-market buybacks since 2026-02-23) |

All four are public and need no key. `data/snapshot.json` stores the exact URLs and a SHA-256 hash of each frozen response.

## Evidence for

**Value and headcount diverged (claim 1).** I compared the first four and the last four complete ISO weeks since Intents data begins (weeks of 2024-12-16 to 2026-11-02, 99 weeks):

| Metric | First 4 weeks | Last 4 weeks | Change |
|---|---|---|---|
| Intents volume per week | $785.7K | $859.7M | **1,094x** |
| Daily active accounts (weekly average) | 915,323 | 57,645 | **−94%** |
| Transactions per week | 52.5M | 4.47M | **−91%** |

Intents volume over the last 30 days: **$3.73B**.

**Value capture exists and is accelerating (claim 3).** Captured Intents revenue was $9.41M over the last 365 days. The last 30 days were $1.80M, an annualised run-rate of **$21.9M**. The last full months were $0.72M (2026-08), $1.84M (2026-09) and $2.19M (2026-10).

## Evidence against

**Intents volume does not lead anything (claim 2: the hypothesis I tested and lost).** I used week-over-week log changes (98 observations) and cross-correlation at lags of 1 to 8 weeks. To correct for testing eight lags at once, significance comes from a permutation test of the maximum lead correlation, with 2,000 shuffles and a fixed seed.

| Intents volume leading… | Strongest lead | r | Permutation p |
|---|---|---|---|
| NEAR price | 4 weeks | 0.080 | 0.80 |
| Daily active accounts | 1 week | 0.088 | 0.87 |
| Chain fees (USD) | 4 weeks | 0.087 | 0.81 |

None is close to significant; the single-lag 95% noise band is ±0.198. The only correlation above the band is same-week Intents volume against chain fees (r = 0.22 at lag 0), which is contemporaneous rather than leading. Anyone who trades NEAR on Intents volume momentum is, on this evidence, trading noise.

**Capture is far below dilution.**

| Item | Value |
|---|---|
| Total supply, 2025-11-11 → 2026-11-11 | 1,279.71M → 1,311.47M NEAR |
| Net new supply (issuance minus burnt fees) | **31.77M NEAR (+2.48%)**, $113.9M at $3.58 |
| Transaction fees, 365 days | 591.7K NEAR (70% burned: 414.2K) |
| Captured revenue, 30-day run-rate | $21.9M per year |
| **Share of net new supply the buybacks could absorb** | **19%** |
| Revenue multiple needed for full coverage at $3.58 | 5.2x |
| NEAR price at which today's revenue covers net issuance | $0.69 |
| Market cap / revenue run-rate | 214x |
| NEAR's take of Intents volume (365 days) | 0.029% |

Fee burn offsets about 1.3% of gross issuance (414K of roughly 32.2M NEAR), so at today's levels the burn is economically irrelevant. NEAR keeps about 17% of gross Intents fees ($9.4M of $53.9M over 365 days); the rest goes to solvers and distribution partners.

**The activity collapse could also be a shrinking ecosystem, not just bots leaving.** These sources cannot separate genuine users from farmed or automated accounts, so I cannot prove that the 94% fall was low-quality activity. I treat claim 1 as "activity counts stopped tracking value", not as "the lost accounts were fake".

## What these sources cannot tell us

- Who generates the Intents volume: the number of distinct users, its concentration and the share from a few market makers. This needs the Intents Explorer API (JWT) or BigQuery.
- How much of the volume touches the NEAR token rather than only settling on NEAR.
- Buyback execution: the revenue series measures funds swept to NEAR's revenue wallets, not NEAR actually bought. Coverage is therefore an upper bound on what was bought.

## What would change my mind

The dashboard evaluates the first three on whatever data it loads; the fourth is a manual check:

- **Thesis confirmed:** buyback coverage reaches 100% of net new supply (today 19%).
- **Claim 2 overturned:** a lead of Intents volume over price or over active accounts becomes significant (permutation p < 0.05) as more weeks accumulate.
- **Capture stalls:** captured revenue in the last full month falls below the mean of the three months before it. Today it does not: October 2026 is above July to September.
- **Take-rate compression:** volume keeps growing while revenue per dollar of volume falls for two consecutive quarters. That would mean competition is pricing the capture away.

## Reproduce

- Open `index.html` from any static server, or the hosted copy. Frozen-snapshot mode prints every number in this file. `?live=1` refetches all four sources and recomputes.
- Open `tests/index.html` to run 12 unit tests, including one that recomputes this file's headline numbers from the snapshot.
- `window.THESIS` in the browser console holds every intermediate series.

Not investment advice. This tests claims; it does not recommend a trade.
