import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groundHeightAt,
  groundNormalAt,
  resolveObstacleCollisions,
  createPhysicsBody,
  stepAstronautPhysics,
} from './marsPhysics';

test('groundHeightAt is flat inside central landing pad and depressed inside crater lakes', () => {
  assert.equal(groundHeightAt(0, 0), 0);
  assert.equal(groundHeightAt(5, 5), 0);
  assert.ok(groundHeightAt(22, -16) < -1.5, 'East lake basin should dip below 0');
  assert.ok(groundHeightAt(-24, -18) < -1.5, 'West lake basin should dip below 0');
  assert.ok(groundHeightAt(75, 0) > 2.0, 'Outer crater rim should rise');
});

test('groundNormalAt returns upward unit vector on flat terrain', () => {
  const n = groundNormalAt(0, 0);
  assert.ok(Math.abs(n.nx) < 0.001);
  assert.ok(Math.abs(n.ny - 1) < 0.001);
  assert.ok(Math.abs(n.nz) < 0.001);
});

test('resolveObstacleCollisions pushes astronaut smoothly out of starship lander hull', () => {
  const obstacles = [{ id: 'lander', x: 0, z: 0, radius: 2.8 }];
  const res = resolveObstacleCollisions(1.0, 0.0, 0.65, obstacles);
  const dist = Math.hypot(res.x, res.z);
  assert.ok(dist >= 3.44, `Expected push outside radius 3.45, got ${dist}`);
});

test('stepAstronautPhysics executes floaty 0.38g jump and jetpack hover', () => {
  const body = createPhysicsBody(0, 6.5);
  const res = stepAstronautPhysics(
    body,
    { moveX: 0, moveZ: -1, jumpJustPressed: true, jumpHeld: true, jetpackHeld: false },
    0.016,
    []
  );
  assert.equal(res.jumped, true);
  assert.equal(body.isGrounded, false);
  assert.ok(body.vy > 7.5, 'Jump impulse should lift astronaut strongly');
  assert.ok(body.vz < 0, 'Forward movement should accelerate along -Z');

  // Simulate mid-air jetpack burn
  body.vy = -1.0;
  const fuelBefore = body.jetpackFuel;
  stepAstronautPhysics(
    body,
    { moveX: 0, moveZ: 0, jumpJustPressed: false, jumpHeld: true, jetpackHeld: true },
    0.05,
    []
  );
  assert.equal(body.isJetpacking, true);
  assert.ok(body.jetpackFuel < fuelBefore, 'Jetpack should consume fuel when active');
  assert.ok(body.vy > -1.0, 'Jetpack thrust should counteract Martian gravity');
});
