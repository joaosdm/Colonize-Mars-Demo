import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAYGAMA_MATCH_FILTER,
  PLAYGAMA_MAX_SYNC_BYTES,
  estimateSyncWorldBytes,
  formatPlaygamaRegionLabel,
  hydrateCoopRoomFromSync,
  isValidSyncedWorld,
  serializeCoopRoomForSync,
  translatePlaygamaError,
} from './playgamaSync';
import {
  addPlayerToRoom,
  applyRoomResourceCollect,
  applyRoomTriggerComplete,
  createCoopRoom,
} from './coopRoomState';

test('PLAYGAMA_MATCH_FILTER contains only stable flat matchmaking primitives', () => {
  const entries = Object.entries(PLAYGAMA_MATCH_FILTER);
  assert.ok(entries.length >= 1 && entries.length <= 16);
  for (const [, val] of entries) {
    assert.ok(
      typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean'
    );
  }
});

test('serializeCoopRoomForSync and hydrateCoopRoomFromSync preserve full colony state on host migration', () => {
  const room = createCoopRoom('K7M4X9TR', true);
  addPlayerToRoom(room, 'p-host', 'Cmdr Ana', 'engineer');
  addPlayerToRoom(room, 'p-guest', 'Dr Leo', 'scientist');

  applyRoomResourceCollect(room, 'res-reg-1', 'regolith');
  applyRoomResourceCollect(room, 'res-ice-1', 'ice');
  room.colonyState = { ...room.colonyState, regolith: 10, waterIce: 10 };
  applyRoomTriggerComplete(room, 'trigger-moxie', 'engineer', 'p-host');

  const snapshot = serializeCoopRoomForSync(room);
  assert.equal(isValidSyncedWorld(snapshot), true);

  // Must stay well below Playgama's 64 KB syncState hard limit
  const bytes = estimateSyncWorldBytes(snapshot);
  assert.ok(bytes > 200 && bytes < PLAYGAMA_MAX_SYNC_BYTES, `Expected < 64KB, got ${bytes}`);

  // Simulate host leaving and guest hydrating a brand new authoritative room from syncState
  const migrated = hydrateCoopRoomFromSync('K7M4X9TR', snapshot);
  assert.equal(migrated.code, 'K7M4X9TR');
  assert.equal(migrated.players.size, 2);
  assert.equal(migrated.collectedResourceIds.has('res-reg-1'), true);
  assert.equal(migrated.collectedResourceIds.has('res-ice-1'), true);
  assert.equal(migrated.colonyState.activeConstructions.length, 1);
  assert.equal(migrated.colonyState.activeConstructions[0].id, 'trigger-moxie');
});

test('isValidSyncedWorld rejects empty or malformed sync payloads', () => {
  assert.equal(isValidSyncedWorld(null), false);
  assert.equal(isValidSyncedWorld({}), false);
  assert.equal(isValidSyncedWorld({ schemaVersion: 2 }), false);
});

test('translatePlaygamaError covers all official Playgama Multiplayer error codes and region labels', () => {
  const codes = [
    'MULTIPLAYER_NOT_SUPPORTED',
    'MULTIPLAYER_ALREADY_IN_ROOM',
    'MULTIPLAYER_NOT_IN_ROOM',
    'MULTIPLAYER_ROOM_NOT_FOUND',
    'MULTIPLAYER_ROOM_FULL',
    'MULTIPLAYER_ROOM_CLOSED',
    'MULTIPLAYER_INVALID_REQUEST',
    'MULTIPLAYER_CONNECTION_FAILED',
  ];
  for (const code of codes) {
    const msg = translatePlaygamaError(code);
    assert.ok(msg.length > 10);
    assert.notEqual(msg, 'Falha na conexão multiplayer Playgama.');
  }

  assert.equal(formatPlaygamaRegionLabel('eu'), 'Europa (EU)');
  assert.equal(formatPlaygamaRegionLabel('us'), 'Américas (US)');
  assert.equal(formatPlaygamaRegionLabel('ap'), 'Ásia-Pacífico (AP)');
});
