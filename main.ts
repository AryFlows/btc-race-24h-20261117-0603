// Frost Burst: dip-buying cbBTC bot for the 24h race.
// Lesson from the dev window: 1-minute BTC bars are noise (stdev ~6 bps) and
// 30-120 bar momentum mean-reverts, so chasing breakouts bled ~$21-37 in fees.
// What works here is the opposite: buy sharp 60-bar dips and sell the recovery.
// The window's hourly swings run 0.5-1.3%, so a dip of 80 bps bought and sold at
// +120 bps clears the ~34 bps round-trip cost with room to spare. One position,
// full size, long only. Every signal is integer math on closes (deterministic).

import { BPS, runBars, type BarsState, type BuyInput, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// Dip window (bars) and the drop that counts as a dip (bps).
const DIP_WIN = 60;
const DIP_BPS = 100n;

// Exit: take profit at this gain over cost (bps), or a trailing stop this far
// below the peak close since entry (bps). The trail is a safety net: exits are
// normally driven by the take-profit.
const TAKE_BPS = 120n;
const TRAIL_BPS = 200n;

// After a sell, wait this many bars before re-entering.
const COOLDOWN_BARS = 10;

const MAX_SLIPPAGE_BPS = 100;

// Closes by batch seq (null when the symbol had no bar that minute).
const closes: (bigint | null)[] = [];
// Peak close since the current entry, for the trailing stop.
let entryPeak: bigint | null = null;
let lastSellSeq = -1_000_000;

// Return in bps between the latest close and the close `back` bars ago; null when
// there is not enough history or a gap in it.
function retBps(back: number): bigint | null {
  const now = closes[closes.length - 1];
  const then = closes[closes.length - 1 - back];
  if (now === null || now === undefined || then === null || then === undefined || then === 0n) return null;
  return ((now - then) * 10_000n) / then;
}

// Gain of the open position in bps, from its recorded cost to its value at the
// latest close; null when flat.
function gainBps(state: BarsState): bigint | null {
  const p = state.positions.get(SYMBOL);
  if (p === undefined) return null;
  const value = state.value(SYMBOL, p.qty);
  if (p.cost === 0n) return null;
  return ((value - p.cost) * 10_000n) / p.cost;
}

await runBars({
  onBatch(state, batch) {
    const close = state.close(SYMBOL);
    closes.push(close ?? null);
    if (state.warmingUp || close === null) return [];

    if (state.positions.has(SYMBOL)) {
      entryPeak = entryPeak === null ? close : (close > entryPeak ? close : entryPeak);
      const g = gainBps(state);
      const tookProfit = g !== null && g >= TAKE_BPS;
      const trailHit = entryPeak !== null && ((entryPeak - close) * 10_000n) / entryPeak >= TRAIL_BPS;
      if (tookProfit || trailHit) {
        const p = state.positions.get(SYMBOL)!;
        lastSellSeq = batch.seq;
        entryPeak = null;
        const sell: OrderInput = { side: 'sell', symbol: SYMBOL, qty: p.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [sell];
      }
      return [];
    }

    // Flat: buy the dip — a sharp 60-bar drop — once the cooldown has passed.
    const dip = retBps(DIP_WIN);
    const cooledDown = batch.seq - lastSellSeq >= COOLDOWN_BARS;
    if (dip !== null && dip <= -DIP_BPS && cooledDown) {
      const cash = state.cash;
      if (cash < BigInt(state.hello.fees.min_notional_quote_units)) return [];
      const buy: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS };
      entryPeak = close;
      return [buy];
    }
    return [];
  },
});
