import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEnemy,
  createPlasmaBolt,
  stepEnemiesAndCombat,
  findRepairableBuildingNear,
} from './marsEnemies.ts';
import { createInitialColonyState } from './marsColonyLogic.ts';

test('plasma bolt hits and destroys enemy yielding resource drops', () => {
  const s = createInitialColonyState();
  const enemy = createEnemy('crawler', 10, 0, 'e-1');
  enemy.hp = 20; // low HP for 1-shot kill
  const bolt = createPlasmaBolt(8.8, 1.0, 0, 1, 0, false);

  const { result } = stepEnemiesAndCombat({
    enemies: [enemy],
    bolts: [bolt],
    colonyState: s,
    playerPos: { x: 0, y: 0, z: 0 },
    turretCooldown: 0,
    dt: 0.04,
  });

  assert.equal(result.enemies.length, 0);
  assert.equal(result.kills.length, 1);
  assert.equal(result.kills[0].regolith, 1);
});

test('automated defense turret locks onto nearby enemies and fires', () => {
  const s = createInitialColonyState();
  s.buildings.defenseTurret = true;
  const enemy = createEnemy('drone', 15, -2, 'e-2');

  const { result, nextTurretCooldown } = stepEnemiesAndCombat({
    enemies: [enemy],
    bolts: [],
    colonyState: s,
    playerPos: { x: 0, y: 0, z: 0 },
    turretCooldown: 0,
    dt: 0.03,
  });

  assert.ok(result.turretFiredAt !== null);
  assert.equal(result.bolts.length, 1);
  assert.ok(nextTurretCooldown > 0.4);
});

test('findRepairableBuildingNear detects damaged built structure in range', () => {
  const s = createInitialColonyState();
  s.buildings.solarPanels = true;
  s.buildingHealth.solarPanels = 65;

  const found = findRepairableBuildingNear({ x: 8.5, z: 4.5 }, s);
  assert.ok(found !== null);
  assert.equal(found.key, 'solarPanels');
  assert.equal(found.health, 65);

  const far = findRepairableBuildingNear({ x: -20, z: -20 }, s);
  assert.equal(far, null);
});
