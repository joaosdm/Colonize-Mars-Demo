import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMarketPrice,
  generateStationMarket,
  processPlayerTrade,
  COMMODITIES,
} from './economy';

test('calculateMarketPrice responds to supply and demand', () => {
  const base = 100;
  // High demand / low supply -> high price
  const high = calculateMarketPrice(base, 20, 200);
  assert.ok(high.buyPrice > base, `Expected buy price > ${base}, got ${high.buyPrice}`);
  assert.ok(high.sellPrice < high.buyPrice, 'Sell price must include station spread margin');

  // Low demand / high supply -> low price
  const low = calculateMarketPrice(base, 200, 20);
  assert.ok(low.buyPrice < base, `Expected buy price < ${base}, got ${low.buyPrice}`);
});

test('generateStationMarket creates valid commodities for Mars', () => {
  const marsMarket = generateStationMarket('mars');
  assert.ok(marsMarket['bio_fertilizer']);
  assert.ok(marsMarket['water_ice']);
  assert.ok(marsMarket['regolith_bricks']);

  // Fertilizer is in high demand on Mars, so its buyPrice should be high
  const fert = marsMarket['bio_fertilizer'];
  const baseFert = COMMODITIES.find((c) => c.id === 'bio_fertilizer')!.basePrice;
  assert.ok(fert.buyPrice > baseFert);
});

test('processPlayerTrade modifies local market supply and price', () => {
  const initial = generateStationMarket('earth');
  const initialBuy = initial['water_ice'].buyPrice;

  // When player buys large amount, supply drops and price increases
  const updated = processPlayerTrade(initial, 'water_ice', 50, true);
  assert.ok(
    updated['water_ice'].buyPrice >= initialBuy,
    `Price after buying should rise or stay high, was ${initialBuy}, now ${updated['water_ice'].buyPrice}`
  );
  assert.ok(updated['water_ice'].supply < initial['water_ice'].supply);
});
