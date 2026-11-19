import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILDING_DURABILITY_SPECS,
  BUILDING_FIRE_THRESHOLD_PCT,
  applyBuildingCombatDamage,
  calculateMitigatedBuildingDamage,
  getBuildingCondition,
  isBuildingBurning,
} from './buildingDurability.ts';
import {
  canStartConstruction,
  createInitialColonyState,
} from './marsColonyLogic.ts';
import {
  ENEMY_ARCHETYPES,
  createEnemy,
  stepEnemiesAndCombat,
} from './marsEnemies.ts';

test('building resistance tiers mitigate damage proportionally (Blindada > Reforçada > Média > Leve)', () => {
  const lightLoss = calculateMitigatedBuildingDamage('solarPanels', 15, 2).hpPercentLoss;
  const mediumLoss = calculateMitigatedBuildingDamage('moxie', 15, 2).hpPercentLoss;
  const reinforcedLoss = calculateMitigatedBuildingDamage('habitat', 15, 2).hpPercentLoss;
  const armoredLoss = calculateMitigatedBuildingDamage('geothermalPlant', 15, 2).hpPercentLoss;

  assert.equal(BUILDING_DURABILITY_SPECS.solarPanels.tier, 'Leve');
  assert.equal(BUILDING_DURABILITY_SPECS.moxie.tier, 'Média');
  assert.equal(BUILDING_DURABILITY_SPECS.habitat.tier, 'Reforçada');
  assert.equal(BUILDING_DURABILITY_SPECS.geothermalPlant.tier, 'Blindada');

  assert.ok(lightLoss > mediumLoss, 'Leve should lose more % than Média');
  assert.ok(mediumLoss > reinforcedLoss, 'Média should lose more % than Reforçada');
  assert.ok(reinforcedLoss > armoredLoss, 'Reforçada should lose more % than Blindada');
});

test('enemy archetypes have distinct HP, attack strength, and siege armor penetration', () => {
  const crawler = createEnemy('crawler', 0, 0, 'e-c');
  const drone = createEnemy('drone', 0, 0, 'e-d');
  const stalker = createEnemy('stalker', 0, 0, 'e-s');
  const brute = createEnemy('brute', 0, 0, 'e-b');

  assert.ok(brute.maxHp > stalker.maxHp && stalker.maxHp > drone.maxHp && drone.maxHp > crawler.maxHp);
  assert.ok(
    brute.buildingDamage > stalker.buildingDamage &&
      stalker.buildingDamage > drone.buildingDamage &&
      drone.buildingDamage > crawler.buildingDamage
  );
  assert.ok(brute.armorPenetration > crawler.armorPenetration);
  assert.equal(ENEMY_ARCHETYPES.brute.displayName, 'Colosso de Basalto');
});

test('building catches fire at critical <= 35% integrity and explodes at 0% requiring full rebuild', () => {
  const base = createInitialColonyState();
  base.buildings.moxie = true;
  base.buildings.solarPanels = true;
  base.buildingHealth.solarPanels = 50;
  base.regolith = 10;

  // Hit solar panels enough to drop below 35% fire threshold (without destroying)
  const hit1 = applyBuildingCombatDamage(base, {
    solarPanels: [{ rawDamage: 38, armorPenetration: 8 }],
  });
  assert.equal(hit1.destroyedKeys.length, 0);
  assert.deepEqual(hit1.newlyCriticalKeys, ['solarPanels']);
  assert.ok(hit1.state.buildingHealth.solarPanels <= BUILDING_FIRE_THRESHOLD_PCT);
  assert.equal(isBuildingBurning(hit1.state.buildingHealth.solarPanels, true), true);
  assert.equal(getBuildingCondition(hit1.state.buildingHealth.solarPanels, true), 'critical');

  // Deliver finishing siege hits to drop integrity to 0% -> explosion & rebuild required!
  const hit2 = applyBuildingCombatDamage(hit1.state, {
    solarPanels: [
      { rawDamage: 38, armorPenetration: 8 },
      { rawDamage: 38, armorPenetration: 8 },
    ],
  });
  assert.deepEqual(hit2.destroyedKeys, ['solarPanels']);
  assert.equal(hit2.state.buildings.solarPanels, false);
  assert.equal(hit2.state.buildingHealth.solarPanels, 100);
  assert.equal(hit2.state.energy, 15); // Lost the +30kW solar power!

  // Player must now be able to rebuild solar panels from scratch
  const canRebuild = canStartConstruction('trigger-solar', hit2.state, []);
  assert.equal(canRebuild.ok, true);
});

test('heavy brute continues assaulting critical building until it reaches 0% and explodes', () => {
  const s = createInitialColonyState();
  s.buildings.moxie = true;
  s.buildings.solarPanels = true;
  s.buildingHealth.solarPanels = 12; // Already below old 15% floor!

  // Place brute right beside solarPanels (8, 4) while player is far away
  const brute = createEnemy('brute', 8.5, 4.5, 'e-siege');
  brute.attackCooldown = 0;

  const { result } = stepEnemiesAndCombat({
    enemies: [brute],
    bolts: [],
    colonyState: s,
    playerPos: { x: -30, y: 0, z: -30 },
    turretCooldown: 0,
    dt: 0.04,
  });

  assert.ok((result.buildingHits.solarPanels?.length ?? 0) > 0, 'Brute should keep hitting critical building');
  const resolved = applyBuildingCombatDamage(s, result.buildingHits);
  assert.deepEqual(resolved.destroyedKeys, ['solarPanels']);
  assert.equal(resolved.state.buildings.solarPanels, false);
});
