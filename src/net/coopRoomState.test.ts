import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCoopRoom,
  addPlayerToRoom,
  setPlayerRoleInRoom,
  applyRoomResourceCollect,
  applyRoomTriggerComplete,
  applyRoomRepairBuilding,
  applyRoomTechResearch,
  applyRoomPlayerShoot,
  tickCoopRoom,
} from './coopRoomState.ts';

test('coop room enforces maximum of 3 players and assigns distinct slots', () => {
  const room = createCoopRoom('M101');
  const p1 = addPlayerToRoom(room, 'id-1', 'Alice');
  const p2 = addPlayerToRoom(room, 'id-2', 'Bob');
  const p3 = addPlayerToRoom(room, 'id-3', 'Carol');
  const p4 = addPlayerToRoom(room, 'id-4', 'Dave');

  assert.equal(p1.ok, true);
  assert.equal(p2.ok, true);
  assert.equal(p3.ok, true);
  assert.equal(p4.ok, false);
});

test('resource collection is idempotent across concurrent players', () => {
  const room = createCoopRoom('M202');
  const first = applyRoomResourceCollect(room, 'regolith-0', 'regolith');
  const duplicate = applyRoomResourceCollect(room, 'regolith-0', 'regolith');

  assert.equal(first, true);
  assert.equal(duplicate, false);
  assert.equal(room.colonyState.regolith, 1);
});

test('timed construction starts and advances via server ticks and Engineer boost', () => {
  const room = createCoopRoom('M303');
  addPlayerToRoom(room, 'p1', 'Alice', 'engineer');
  addPlayerToRoom(room, 'p2', 'Bob', 'explorer');

  const startRes = applyRoomTriggerComplete(room, 'trigger-moxie', 'engineer');
  assert.equal(startRes.changed, true);
  assert.equal(room.colonyState.buildings.moxie, false);
  assert.equal(room.colonyState.activeConstructions.length, 1);

  // Engineer boost (+2.625s) + 2 ticks (+2.0s) completes 4s MOXIE
  applyRoomTriggerComplete(room, 'trigger-moxie', 'engineer');
  room.lastTickMs = Date.now() - 1000;
  tickCoopRoom(room, Date.now());
  room.lastTickMs = Date.now() - 1000;
  tickCoopRoom(room, Date.now());

  assert.equal(room.colonyState.buildings.moxie, true);
  assert.equal(room.colonyState.habitability, 10);
});

test('building repair scales higher for Engineer than Explorer', () => {
  const room = createCoopRoom('M404');
  room.colonyState.buildings.solarPanels = true;
  room.colonyState.buildingHealth.solarPanels = 20;

  const explorerRep = applyRoomRepairBuilding(room, 'solarPanels', 'explorer');
  assert.equal(explorerRep.changed, true);
  assert.equal(room.colonyState.buildingHealth.solarPanels, 52); // +32

  room.colonyState.buildingHealth.solarPanels = 20;
  const engRep = applyRoomRepairBuilding(room, 'solarPanels', 'engineer');
  assert.equal(engRep.changed, true);
  assert.equal(room.colonyState.buildingHealth.solarPanels, 73); // +53 (32 * 1.65)
});

test('Scientist boosts room energy generation and accelerates timed tech research', () => {
  const room = createCoopRoom('M505');
  addPlayerToRoom(room, 'p1', 'Ada', 'engineer');
  room.colonyState.buildings.researchLab = true;
  room.colonyState.buildings.solarPanels = true;
  room.colonyState.regolith = 10;
  room.colonyState.water = 5;

  // Switching to scientist triggers energy recalculation: 15 + 30*1.35 (41) + 8 = 64
  const roleRes = setPlayerRoleInRoom(room, 'p1', 'scientist');
  assert.equal(roleRes.changed, true);
  assert.equal(room.colonyState.energy, 64);

  const started = applyRoomTechResearch(room, 'tech-jetpack'); // 6s base
  assert.equal(started.changed, true);
  assert.equal(room.colonyState.activeTechResearch?.techId, 'tech-jetpack');

  // Tick 1s -> 1.8s effective elapsed due to Scientist 1.8x
  room.lastTickMs = Date.now() - 1000;
  tickCoopRoom(room, Date.now());
  assert.ok((room.colonyState.activeTechResearch?.elapsedSec || 0) > 1.7);
});

test('Explorer deals +60% plasma bolt damage against Silica invaders', () => {
  const room = createCoopRoom('M606');
  applyRoomPlayerShoot(room, 0, 0, 0, 1, 0, 'engineer');
  applyRoomPlayerShoot(room, 0, 0, 0, 1, 0, 'explorer');

  assert.equal(room.bolts.length, 2);
  assert.equal(room.bolts[0].damage, 26);
  assert.equal(room.bolts[1].damage, 42);
});

test('coop room triggers Dust Storm on scheduled Sol, cuts solar power 50%, and degrades built modules', () => {
  const room = createCoopRoom('M707');
  addPlayerToRoom(room, 'p1', 'Alice', 'engineer');
  room.colonyState.buildings.solarPanels = true;
  room.colonyState.solDay = room.colonyState.dustStorm.nextStormSol;

  // Tick 1: starts storm -> solar efficiency drops to 0.5 (15 + 15 = 30 kW)
  room.lastTickMs = Date.now() - 1000;
  const t1 = tickCoopRoom(room, Date.now());
  assert.equal(t1.stormEvent, 'started');
  assert.equal(room.colonyState.dustStorm.isActive, true);
  assert.equal(room.colonyState.energy, 30);

  // Tick 2: degrades built solarPanels integrity
  room.lastTickMs = Date.now() - 1000;
  tickCoopRoom(room, Date.now());
  assert.ok(room.colonyState.buildingHealth.solarPanels < 100);
});

test('coop room scales construction & repair progress proportionally (1x, 1.8x, 2.5x) for 1–3 players pressing [E]', () => {
  const now = 50_000;

  const createSquadRoom = (count: 1 | 2 | 3) => {
    const r = createCoopRoom(`C0${count}`);
    for (let i = 1; i <= count; i++) {
      const added = addPlayerToRoom(r, `p${i}`, `Astra${i}`, 'scientist'); // 1.0x build & repair
      assert.equal(added.ok, true);
      if (added.ok) {
        added.player.x = 8;
        added.player.z = 4;
        added.player.activeTriggerId = 'trigger-solar';
        added.player.isActionPressed = true;
        added.player.lastActionAtMs = now;
      }
    }
    r.colonyState.regolith = 10;
    applyRoomTriggerComplete(r, 'trigger-solar', 'scientist', 'p1', now);
    return r;
  };

  const r1 = createSquadRoom(1);
  const r2 = createSquadRoom(2);
  const r3 = createSquadRoom(3);

  applyRoomTriggerComplete(r1, 'trigger-solar', 'scientist', 'p1', now + 50);
  applyRoomTriggerComplete(r2, 'trigger-solar', 'scientist', 'p1', now + 50);
  applyRoomTriggerComplete(r3, 'trigger-solar', 'scientist', 'p1', now + 50);

  const e1 = r1.colonyState.activeConstructions[0].elapsedSec;
  const e2 = r2.colonyState.activeConstructions[0].elapsedSec;
  const e3 = r3.colonyState.activeConstructions[0].elapsedSec;

  assert.equal(Number((e2 / e1).toFixed(2)), 1.8);
  assert.equal(Number((e3 / e1).toFixed(2)), 2.5);

  // Also test cooperative repair scaling on damaged Solar Panels
  const repRoom1 = createCoopRoom('R01');
  const repRoom3 = createCoopRoom('R03');
  [repRoom1, repRoom3].forEach((r, idx) => {
    const count = idx === 0 ? 1 : 3;
    for (let i = 1; i <= count; i++) {
      const p = addPlayerToRoom(r, `rp${i}`, `Tech${i}`, 'explorer');
      if (p.ok) {
        p.player.x = 8;
        p.player.z = 4;
        p.player.activeTriggerId = 'trigger-repair-solarPanels';
        p.player.isActionPressed = true;
        p.player.lastActionAtMs = now;
      }
    }
    r.colonyState.buildings.solarPanels = true;
    r.colonyState.buildingHealth.solarPanels = 10;
  });

  applyRoomRepairBuilding(repRoom1, 'solarPanels', 'explorer', 'rp1', now + 20);
  applyRoomRepairBuilding(repRoom3, 'solarPanels', 'explorer', 'rp1', now + 20);

  assert.equal(repRoom1.colonyState.buildingHealth.solarPanels, 42); // 10 + 32*1.0
  assert.equal(repRoom3.colonyState.buildingHealth.solarPanels, 90); // 10 + 32*2.5
});

