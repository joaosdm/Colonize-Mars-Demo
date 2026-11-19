import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REFINERY_RECIPES,
  executeRefineryRecipe,
  craftWeapon,
} from './marsChemistry';
import {
  createInitialColonyState,
  runColonyRefineryRecipe,
  craftColonyWeapon,
  equipColonyWeapon,
} from './marsColonyLogic';
import { createWeaponVolley } from './marsEnemies';

test('chemical extraction transforms raw elements into essential elements and refills O2 on electrolysis', () => {
  const base = {
    ...createInitialColonyState(true),
    regolith: 6,
    waterIce: 4,
    water: 4,
    oxygen: 40,
  };

  // Regolith -> Iron + Silicon
  const smelt = runColonyRefineryRecipe(base, 'smelt-regolith');
  assert.equal(smelt.ok, true);
  assert.equal(smelt.state.regolith, 3);
  assert.equal(smelt.state.iron, base.iron + 2);
  assert.equal(smelt.state.silicon, base.silicon + 1);

  // Water electrolysis -> H2 Fuel + O2 100%
  const elec = executeRefineryRecipe(smelt.state, 'water-electrolysis');
  assert.equal(elec.ok, true);
  assert.equal(elec.state.fuel, smelt.state.fuel + 2);
  assert.equal(elec.state.oxygen, elec.state.oxygenMax);

  assert.ok(REFINERY_RECIPES.length >= 6);
});

test('craftColonyWeapon deducts minerals, unlocks & equips weapon, and createWeaponVolley respects weapon traits', () => {
  const rich = {
    ...createInitialColonyState(true),
    iron: 10,
    titanium: 10,
    silicon: 10,
    sulfur: 5,
    fuel: 5,
  };

  const shotgunCraft = craftColonyWeapon(rich, 'ion-shotgun');
  assert.equal(shotgunCraft.crafted, true);
  assert.equal(shotgunCraft.state.equippedWeapon, 'ion-shotgun');
  assert.ok(shotgunCraft.state.craftedWeapons.includes('ion-shotgun'));

  const shotgunVolley = createWeaponVolley({
    x: 0,
    y: 1,
    z: 0,
    dirX: 1,
    dirZ: 0,
    weaponId: 'ion-shotgun',
    hasPulseMk2: false,
    damageMultiplier: 1.0,
  });
  assert.equal(shotgunVolley.length, 4);

  const railCraft = craftWeapon(shotgunCraft.state, 'titanium-railgun');
  assert.equal(railCraft.crafted, true);
  const railVolley = createWeaponVolley({
    x: 0,
    y: 1,
    z: 0,
    dirX: 0,
    dirZ: 1,
    weaponId: 'titanium-railgun',
    hasPulseMk2: false,
    damageMultiplier: 1.0,
  });
  assert.equal(railVolley.length, 1);
  assert.equal(railVolley[0].piercing, true);
  assert.ok(railVolley[0].damage >= 90);

  const swapped = equipColonyWeapon(railCraft.state, 'pulse-pistol');
  assert.equal(swapped.equipped, true);
  assert.equal(swapped.state.equippedWeapon, 'pulse-pistol');
});
