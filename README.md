# NEAR Thesis Lab

An evidence-first, re-runnable investment thesis for NEAR. Built at NEAR HACKATHON, track **Investment Thesis** (`thesis`).

**Live dashboard:** https://wwaterfall2027.github.io/near-thesis-lab/ · **Tests:** https://wwaterfall2027.github.io/near-thesis-lab/tests/ · **The thesis:** [THESIS.md](THESIS.md)

## What it shows

| Question | What the data says (snapshot ending 2026-11-11) |
|---|---|
| Is NEAR being used more or less? | Weekly NEAR Intents volume grew **1,094x** since December 2024, while daily active accounts fell **94%** and weekly transactions **91%**. Value and headcount moved in opposite directions. |
| Does Intents volume lead price, activity or fees? | **No.** Lags of 1 to 8 weeks, permutation-tested: p = 0.80 (price), 0.87 (active accounts), 0.81 (fees). I started with this hypothesis and the data rejected it. |
| Does any of that value reach NEAR holders? | Yes, through buybacks funded by captured Intents revenue (since 2026-02-23): **$21.9M/yr** run-rate. That covers **19%** of the **31.8M NEAR** of net new supply per year. Full coverage needs 5.2x the revenue, or a NEAR price of $0.69. |

The full argument, with evidence for and against, what the sources cannot answer and what would change the verdict, is in [THESIS.md](THESIS.md).

## Try it

1. Open the [dashboard](https://wwaterfall2027.github.io/near-thesis-lab/). You see six headline figures, three charts, a plain sentence under each chart that is generated from the numbers, and four falsification checks marked YES or NO.
2. Click **re-run on live data** (or add `?live=1`). The page refetches all four sources and recomputes every figure, sentence and check in your browser. The common end date at the top changes as new data arrives.
3. Open the [tests](https://wwaterfall2027.github.io/near-thesis-lab/tests/). You see `12/12 passing`. The last test recomputes THESIS.md's headline numbers from the frozen snapshot.
4. In the browser console on the dashboard, `window.THESIS` holds every intermediate series (daily rows, weekly aggregates, every cross-correlation, the permutation tests, monthly revenue and issuance).

Run it locally from any static file server in the repository root, for example `python -m http.server 8000`, then open `http://localhost:8000/`. Opening `index.html` as a `file://` page does not work, because browsers block module and data loading there.

## How it works

```
data/*.json          frozen raw API responses + snapshot.json (URL and SHA-256 of each)
src/sources.js       the four public endpoints; loads the snapshot or fetches live
src/analysis.js      pure functions: weekly aggregation, log changes, cross-correlation,
                     seeded permutation test, supply economics, value capture
src/thesis.js        computes every figure the thesis cites
src/app.js           renders cards, charts (Chart.js 4.4.1) and the generated sentences
tests/               12 unit tests, run in the browser
```

- **No keys, no backend and no build step.** Everything runs in the browser from public endpoints: NearBlocks `/v1/charts` and DefiLlama NEAR Intents volume, fees and revenue.
- **Lead-lag method.** Correlations use week-over-week log changes, so shared trends do not create fake correlation. Eight lags are tested, so significance comes from a permutation test of the *maximum* lead correlation (2,000 shuffles, fixed seed), which corrects for multiple comparisons and is reproducible.
- **Supply.** Net new supply is the change in total supply, which is issuance minus burnt fees. Coverage = annualised 30-day captured revenue ÷ (net new NEAR × price).

## How NEAR fits in

The thesis is about NEAR's own economics. It covers NEAR Intents as the cross-chain settlement flow, NEAR's on-chain activity and fee burn, and the token's supply. Intents revenue is NEAR's live value-capture mechanism. The thesis asks the question that decides the token's long-term case: can that revenue outgrow dilution?

## Limits

The sources cannot show how concentrated Intents volume is, or how many distinct users produce it (that needs the Intents Explorer API with a JWT, or BigQuery). They also cannot show how much revenue was actually spent on buybacks rather than swept to the revenue wallets. THESIS.md lists these limits explicitly. This is analysis, not investment advice.

## Credits

Built with AI assistance (Claude Code). Data from NearBlocks and DefiLlama. MIT licensed.
