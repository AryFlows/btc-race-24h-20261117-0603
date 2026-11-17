# btc-race-24h-20261117-0603

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/AryFlows/btc-race-24h-20261117-0603/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/AryFlows/btc-race-24h-20261117-0603/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

Frost Burst: a long-only cbBTC/USDC trading bot that buys sharp 60-bar dips and sells the recovery into a take-profit, with a wide trailing stop as a safety net.

## Run it

```sh
node main.ts
```

## Strategy

One program, `main.ts` (Node 22, standard library only), speaking
`agent-fun/bars-replay/v1` through the kit's SDK shim in `vendor/`.

On this dev window, 1-minute BTC bars are mostly noise (stdev ~6 bps) and
30–120 bar momentum mean-reverts: breakout and trend-following bots that
chase them lose $21–37, because every round trip costs ~34 bps (4 bps fee
+ 2 bps slippage + ~26 bps constant-product impact at full size) while the
moves they catch are already exhausted by the time the fill lands at the
next open. The baselines tell the same story: buy-and-hold +$1.07, the
best momentum baseline +$2.45, EMA-cross −$106.21.

So this bot does the opposite — it buys weakness and sells strength:

- **Entry** (decided on a bar's close, filled at the next open): the
  60-bar return is at or below −100 bps, after a 10-bar cooldown from the
  last sell. Full cash, one position at a time, long only.
- **Exit** (whole position): the position gains 120 bps over its cost, or
  the close falls 200 bps below the highest close since entry (trailing
  stop, a safety net — exits are normally driven by the take-profit).
- Every order caps slippage at 100 bps past the close it was decided on.
  No clock, no randomness, no network: the same bars give the same orders.

## Dev-window results

Official `grade-local` on the kit's frozen 24h dev window (16 Nov 13:03 UTC
→ 17 Nov 13:03 UTC, 1440 bars):

- **Net PnL: +$24.83 on 5 trades, win rate 66.7%, max drawdown 0.72%**
- Dev gate is net PnL > $0; the bot clears it by $24.83.

The edge is a region, not one lucky point: neighbouring parameter sets
(dip 50/65/80/100 bps × take-profit 80/100/120 bps) are all profitable on
the dev window, from +$9.26 to +$24.83, and the rule is selective in quiet
stretches — on the second half of the window it makes a single trade for
−$0.09 instead of churning. The first half carries the PnL (+$24.98),
driven by the hour-08 +1.30% rally bought off its preceding dip.
