import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASTRONAUT_ROLES,
  ASTRONAUT_ROLE_LIST,
  computeActivePlayerStats,
  computeSquadRoleBonuses,
  getAstronautRole,
  isAstronautRoleId,
} from './astronautRoles.ts';

test('defines all 3 cooperative astronaut roles with distinct modifiers and accents', () => {
  assert.equal(ASTRONAUT_ROLE_LIST.length, 3);
  assert.equal(isAstronautRoleId('engineer'), true);
  assert.equal(isAstronautRoleId('scientist'), true);
  assert.equal(isAstronautRoleId('explorer'), true);
  assert.equal(isAstronautRoleId('invalid'), false);

  assert.ok(ASTRONAUT_ROLES.engineer.modifiers.buildSpeedMultiplier > 1.5);
  assert.ok(ASTRONAUT_ROLES.engineer.modifiers.repairAmountMultiplier > 1.5);

  assert.ok(ASTRONAUT_ROLES.scientist.modifiers.techResearchSpeedMultiplier > 1.5);
  assert.ok(ASTRONAUT_ROLES.scientist.modifiers.energyGenerationMultiplier > 1.2);
  assert.ok(ASTRONAUT_ROLES.scientist.modifiers.energyBonusKw > 0);

  assert.ok(ASTRONAUT_ROLES.explorer.modifiers.moveSpeedMultiplier > 1.2);
  assert.ok(ASTRONAUT_ROLES.explorer.modifiers.pickupRadiusMultiplier >= 1.5);
  assert.ok(ASTRONAUT_ROLES.explorer.modifiers.combatDamageMultiplier >= 1.5);
});

test('computeActivePlayerStats combines role perks and unlocked technologies accurately', () => {
  const engStats = computeActivePlayerStats('engineer', ['tech-robotics']);
  assert.equal(engStats.roleName, 'Engenheiro');
  // 1.75 * 1.45 = 2.5375 -> 254%
  assert.equal(engStats.buildSpeedPct, 254);
  assert.equal(engStats.repairEfficiencyPct, 165);

  const sciStats = computeActivePlayerStats('scientist', []);
  assert.equal(sciStats.researchSpeedPct, 180);
  assert.equal(sciStats.energyBonusPct, 35);
  assert.equal(sciStats.energyFlatKw, 8);

  const expStats = computeActivePlayerStats('explorer', ['tech-magnet', 'tech-pulse']);
  assert.equal(expStats.moveSpeedPct, 124);
  assert.equal(expStats.pickupRadiusM, 12.8); // 8.5 * 1.5 = 12.75 -> 12.8
  assert.equal(expStats.plasmaDamage, 70); // 44 * 1.6 = 70.4 -> 70
});

test('computeSquadRoleBonuses scales research speed and energy generation cleanly for co-op', () => {
  const noSci = computeSquadRoleBonuses(['engineer', 'explorer']);
  assert.equal(noSci.techResearchSpeedMultiplier, 1.0);
  assert.equal(noSci.energyGenerationMultiplier, 1.0);
  assert.equal(noSci.energyFlatBonusKw, 0);

  const oneSci = computeSquadRoleBonuses(['engineer', 'scientist', 'explorer']);
  assert.equal(oneSci.techResearchSpeedMultiplier, 1.8);
  assert.equal(oneSci.energyGenerationMultiplier, 1.35);
  assert.equal(oneSci.energyFlatBonusKw, 8);

  const twoSci = computeSquadRoleBonuses(['scientist', 'scientist']);
  assert.equal(twoSci.techResearchSpeedMultiplier, 2.2);
  assert.equal(twoSci.energyGenerationMultiplier, 1.53); // 1 + 0.35 + 0.175 = 1.525 -> 1.53
  assert.equal(twoSci.energyFlatBonusKw, 12);
  assert.equal(getAstronautRole('scientist').shortLabel, 'CIE');
});
