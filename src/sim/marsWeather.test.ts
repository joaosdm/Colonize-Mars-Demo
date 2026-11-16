import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialColonyState,
  computeTotalColonyEnergy,
  stepColonyDustStorm,
  forceTriggerDustStorm,
} from './marsColonyLogic.ts';
import {
  getUrgentMaintenanceModules,
  STORM_SOLAR_EFFICIENCY,
} from './marsWeather.ts';

test('dust storm triggers randomly at scheduled Sol and reschedules after clearing', () => {
  let s = createInitialColonyState();
  s.buildings.moxie = true;
  s.buildings.solarPanels = true;
  s.energy = computeTotalColonyEnergy(s.buildings, ['engineer'], 1.0);
  assert.equal(s.energy, 45);

  // Before nextStormSol, no storm starts
  s.solDay = 1;
  const before = stepColonyDustStorm(s, 1.0, ['engineer'], () => 0.5);
  assert.equal(before.stormStarted, false);
  assert.equal(before.state.dustStorm.isActive, false);

  // Reaching nextStormSol triggers a dust storm
  s.solDay = s.dustStorm.nextStormSol;
  const started = stepColonyDustStorm(s, 0.5, ['engineer'], () => 0.25);
  assert.equal(started.stormStarted, true);
  assert.equal(started.state.dustStorm.isActive, true);
  assert.equal(started.state.dustStorm.solarEfficiencyMultiplier, STORM_SOLAR_EFFICIENCY);
  assert.equal(started.state.dustStorm.stormCount, 1);

  // Solar panel generation drops by 50%: 15 base + (30 * 0.5) = 30 kW
  assert.equal(started.state.energy, 30);

  // Advance past duration -> storm clears, energy restores, next storm scheduled 2–3 Sols ahead
  const rem = started.state.dustStorm.remainingSec;
  const cleared = stepColonyDustStorm(started.state, rem + 1, ['engineer'], () => 0.9);
  assert.equal(cleared.stormEnded, true);
  assert.equal(cleared.state.dustStorm.isActive, false);
  assert.equal(cleared.state.dustStorm.solarEfficiencyMultiplier, 1.0);
  assert.equal(cleared.state.energy, 45);
  assert.ok(cleared.state.dustStorm.nextStormSol >= s.solDay + 2);
  assert.ok(cleared.state.dustStorm.nextStormSol <= s.solDay + 3);
});

test('dust storm accelerates degradation of built modules and lowers Scientist solar bonus by 50%', () => {
  let s = createInitialColonyState(true, ['scientist']);
  s.buildings.moxie = true;
  s.buildings.solarPanels = true;
  s.energy = computeTotalColonyEnergy(s.buildings, ['scientist'], 1.0);
  // 15 base + round(30 * 1.35) + 8 = 64 kW
  assert.equal(s.energy, 64);

  s = forceTriggerDustStorm(s, ['scientist'], () => 0.5);
  // During storm: 15 base + round(15 * 1.35) + 8 = 43 kW
  assert.equal(s.energy, 43);

  const stepped = stepColonyDustStorm(s, 10.0, ['scientist'], () => 0.5);
  assert.ok(stepped.state.buildingHealth.moxie < 90);
  assert.ok(stepped.state.buildingHealth.solarPanels < stepped.state.buildingHealth.moxie);
  // Unbuilt structures stay at 100%
  assert.equal(stepped.state.buildingHealth.bioDome, 100);
});

test('getUrgentMaintenanceModules highlights damaged built modules sorted by lowest integrity', () => {
  const s = createInitialColonyState();
  s.buildings.moxie = true;
  s.buildings.solarPanels = true;
  s.buildings.waterExtractor = true;
  s.buildingHealth.moxie = 64;
  s.buildingHealth.solarPanels = 38;
  s.buildingHealth.waterExtractor = 92; // above threshold
  s.buildingHealth.bioDome = 20; // not built, ignored

  const urgent = getUrgentMaintenanceModules(s.buildings, s.buildingHealth);
  assert.equal(urgent.length, 2);
  assert.equal(urgent[0].key, 'solarPanels');
  assert.equal(urgent[0].severity, 'critical');
  assert.equal(urgent[1].key, 'moxie');
  assert.equal(urgent[1].severity, 'warning');
});
