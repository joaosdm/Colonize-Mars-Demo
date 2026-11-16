import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COOP_ACTION_ACTIVE_WINDOW_MS,
  CoopActionParticipant,
  computeCoopSiteActionBoost,
  getCoopParticipantMultiplier,
} from './coopActionBoost.ts';

test('getCoopParticipantMultiplier returns 1x, 1.8x, and 2.5x for 1 to 3 players', () => {
  assert.equal(getCoopParticipantMultiplier(0), 0);
  assert.equal(getCoopParticipantMultiplier(1), 1.0);
  assert.equal(getCoopParticipantMultiplier(2), 1.8);
  assert.equal(getCoopParticipantMultiplier(3), 2.5);
  assert.equal(getCoopParticipantMultiplier(5), 2.5);
});

test('computeCoopSiteActionBoost scales proportionally when 1, 2, or 3 players press [E] near same construction', () => {
  const now = 10_000;
  const p1: CoopActionParticipant = {
    id: 'p1',
    roleId: 'scientist', // 1.0x build
    x: 8,
    z: 4,
    activeTriggerId: 'trigger-solar',
    isActionPressed: true,
    lastActionAtMs: now,
  };
  const p2: CoopActionParticipant = {
    id: 'p2',
    roleId: 'explorer', // 1.0x build
    x: 8.5,
    z: 4.5,
    activeTriggerId: 'trigger-solar',
    isActionPressed: false,
    lastActionAtMs: now - 400, // pressed [E] 400ms ago -> still active
  };
  const p3: CoopActionParticipant = {
    id: 'p3',
    roleId: 'scientist', // 1.0x build
    x: 7.5,
    z: 3.5,
    activeTriggerId: null, // detected spatially inside trigger-solar radius
    isActionPressed: true,
    lastActionAtMs: now,
  };
  const farPlayer: CoopActionParticipant = {
    id: 'p4',
    roleId: 'engineer',
    x: -20,
    z: -20,
    activeTriggerId: 'trigger-moxie',
    isActionPressed: true,
    lastActionAtMs: now,
  };

  const one = computeCoopSiteActionBoost([p1, farPlayer], 'trigger-solar', now, 'p1');
  assert.equal(one.pressingCount, 1);
  assert.equal(one.coopMultiplier, 1.0);
  assert.equal(one.effectiveBuildMultiplier, 1.0);
  assert.equal(one.label, null);

  const two = computeCoopSiteActionBoost([p1, p2, farPlayer], 'trigger-solar', now, 'p1');
  assert.equal(two.pressingCount, 2);
  assert.equal(two.coopMultiplier, 1.8);
  assert.equal(two.effectiveBuildMultiplier, 1.8);
  assert.equal(two.label, 'Co-op 2 jogadores (1.8x)');

  const three = computeCoopSiteActionBoost([p1, p2, p3], 'trigger-solar', now, 'p1');
  assert.equal(three.pressingCount, 3);
  assert.equal(three.coopMultiplier, 2.5);
  assert.equal(three.effectiveBuildMultiplier, 2.5);
  assert.equal(three.label, 'Co-op 3 jogadores (2.5x)');
});

test('computeCoopSiteActionBoost ignores expired [E] presses for cooperative repairs and stacks Engineer bonus', () => {
  const now = 20_000;
  const eng: CoopActionParticipant = {
    id: 'eng',
    roleId: 'engineer', // 1.65x repair
    x: -7,
    z: 4,
    activeTriggerId: 'trigger-repair-moxie',
    isActionPressed: true,
    lastActionAtMs: now,
  };
  const expiredHelper: CoopActionParticipant = {
    id: 'exp',
    roleId: 'explorer', // 1.0x repair
    x: -6.5,
    z: 4.2,
    activeTriggerId: 'trigger-repair-moxie',
    isActionPressed: false,
    lastActionAtMs: now - COOP_ACTION_ACTIVE_WINDOW_MS - 200,
  };

  // Only eng is pressing [E] -> 1 player (1.0x * 1.65 = 1.65)
  const soloRepair = computeCoopSiteActionBoost([eng, expiredHelper], 'trigger-repair-moxie', now, 'eng');
  assert.equal(soloRepair.presentCount, 2);
  assert.equal(soloRepair.pressingCount, 1);
  assert.equal(soloRepair.coopMultiplier, 1.0);
  assert.equal(soloRepair.effectiveRepairMultiplier, 1.65);

  // Now expiredHelper presses [E] too -> 2 players (1.8x * avg(1.65, 1.0) = 1.8 * 1.325 = 2.385)
  expiredHelper.lastActionAtMs = now - 100;
  const coopRepair = computeCoopSiteActionBoost([eng, expiredHelper], 'trigger-repair-moxie', now, 'eng');
  assert.equal(coopRepair.pressingCount, 2);
  assert.equal(coopRepair.coopMultiplier, 1.8);
  assert.equal(coopRepair.effectiveRepairMultiplier, 2.385);
});
