import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getMarsBiomeAt,
  craterOffsetAt,
  computeExcavationYield,
  stepDomeCrops,
  PLANETARY_SITES,
} from './marsWorld';
import {
  createInitialColonyState,
  excavateCraterAt,
  plantDomeCrop,
  harvestDomeCrop,
  consumeFoodRation,
  discoverPlanetarySite,
} from './marsColonyLogic';
import { groundHeightAt } from './marsPhysics';

test('getMarsBiomeAt resolves all 4 distinct Martian biomes by coordinates', () => {
  assert.equal(getMarsBiomeAt(0, 0).id, 'gale-plains');
  assert.equal(getMarsBiomeAt(45, 0).id, 'basalt-canyon');
  assert.equal(getMarsBiomeAt(0, -55).id, 'polar-frost');
  assert.equal(getMarsBiomeAt(-48, 12).id, 'tharsis-fissure');
});

test('craterOffsetAt carves a recessed bowl at center and raised ejecta rim at outer ring', () => {
  const craters = [
    { id: 'c1', x: 10, z: 10, radius: 3.0, depth: 1.4, biomeId: 'gale-plains' as const },
  ];
  const centerDelta = craterOffsetAt(10, 10, craters);
  const rimDelta = craterOffsetAt(10 + 3.65, 10, craters);
  const farDelta = craterOffsetAt(30, 30, craters);

  assert.ok(centerDelta < -1.2, `Expected center depression, got ${centerDelta}`);
  assert.ok(rimDelta > 0.05, `Expected raised ejecta rim, got ${rimDelta}`);
  assert.equal(farDelta, 0);

  const baseY = groundHeightAt(10, 10);
  const carvedY = groundHeightAt(10, 10, craters);
  assert.ok(carvedY < baseY - 1.0);
});

test('excavateCraterAt records a crater, grants biome minerals, and blocks digging inside Starship pad', () => {
  const initial = createInitialColonyState(true);

  const blocked = excavateCraterAt(initial, 1.0, 1.0);
  assert.equal(blocked.ok, false);

  const dug = excavateCraterAt(initial, 45, 0, () => 0.8);
  assert.equal(dug.ok, true);
  assert.equal(dug.state.craters.length, 1);
  assert.ok(dug.state.iron > initial.iron, 'Basalt Canyon excavation must yield iron');
  assert.ok(dug.state.titanium > initial.titanium, 'Basalt Canyon excavation must yield titanium');

  const polarYield = computeExcavationYield(0, -60, () => 0.8);
  assert.equal(polarYield.biome.id, 'polar-frost');
  assert.ok(polarYield.yieldData.waterIce >= 2);
  assert.ok(polarYield.yieldData.silicon >= 2);
});

test('glass-dome food farming supports planting, growth ticking, harvesting, and eating rations', () => {
  let state = { ...createInitialColonyState(true), water: 4, hunger: 50, oxygen: 60 };

  const planted = plantDomeCrop(state, 0, 'potato');
  assert.equal(planted.ok, true);
  assert.equal(planted.state.water, 3);
  assert.equal(planted.state.domeCrops[0].cropId, 'potato');

  const grownBeds = stepDomeCrops(planted.state.domeCrops, 15, 1.0);
  assert.equal(grownBeds[0].readyToHarvest, true);

  state = { ...planted.state, domeCrops: grownBeds };
  const harvested = harvestDomeCrop(state, 0);
  assert.equal(harvested.ok, true);
  assert.equal(harvested.state.food, state.food + 6);
  assert.equal(harvested.state.biomass, state.biomass + 1);
  assert.equal(harvested.state.domeCrops[0].cropId, null);

  const ate = consumeFoodRation(harvested.state);
  assert.equal(ate.ok, true);
  assert.equal(ate.state.food, harvested.state.food - 1);
  assert.ok(ate.state.hunger > 80);
  assert.ok(ate.state.oxygen > 70);
});

test('discoverPlanetarySite consumes H2 fuel, awards rare site loot, and prevents duplicate claims', () => {
  const initial = createInitialColonyState(true);
  const olympus = PLANETARY_SITES[0];

  const first = discoverPlanetarySite(initial, olympus.id);
  assert.equal(first.discovered, true);
  assert.equal(first.state.fuel, initial.fuel - olympus.fuelCost);
  assert.equal(first.state.titanium, initial.titanium + (olympus.reward.titanium || 0));
  assert.ok(first.state.discoveredSites.includes(olympus.id));

  const dup = discoverPlanetarySite(first.state, olympus.id);
  assert.equal(dup.discovered, false);
});
