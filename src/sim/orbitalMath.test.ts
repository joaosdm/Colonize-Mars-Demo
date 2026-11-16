import test from 'node:test';
import assert from 'node:assert/strict';
import {
  vectorLength,
  normalizeVector,
  addVectors,
  computeBodyPosition,
  calculateOrbitalElements,
  calculateTsiolkovskyDeltaV,
  calculateHohmannTransfer,
  SIM_G,
} from './orbitalMath';
import { CelestialBodyData } from '../types/game';

test('vector math functions behave correctly', () => {
  const v1 = { x: 3, y: 4, z: 0 };
  assert.equal(vectorLength(v1), 5);

  const norm = normalizeVector(v1);
  assert.equal(norm.x, 0.6);
  assert.equal(norm.y, 0.8);
  assert.equal(norm.z, 0);

  const sum = addVectors(v1, { x: 1, y: 1, z: 2 });
  assert.deepEqual(sum, { x: 4, y: 5, z: 2 });
});

test('computeBodyPosition returns circular orbit points', () => {
  const dummyBody: CelestialBodyData = {
    id: 'test-planet',
    name: 'Test Planet',
    type: 'planet',
    radius: 10,
    mass: 100,
    semiMajorAxis: 50,
    orbitalPeriod: 100,
    initialAnomaly: 0,
    color: '#ff0000',
    description: 'Test',
    resources: {},
  };

  // At t=0, angle = 0 -> x = 50, z = 0
  const pos0 = computeBodyPosition(dummyBody, 0);
  assert.ok(Math.abs(pos0.x - 50) < 1e-4);
  assert.ok(Math.abs(pos0.z) < 1e-4);

  // At quarter period t=25, angle = pi/2 -> x = 0, z = 50
  const pos25 = computeBodyPosition(dummyBody, 25);
  assert.ok(Math.abs(pos25.x) < 1e-4);
  assert.ok(Math.abs(pos25.z - 50) < 1e-4);
});

test('calculateOrbitalElements calculates circular orbit properly', () => {
  const centralSun: CelestialBodyData = {
    id: 'sun',
    name: 'Sun',
    type: 'star',
    radius: 20,
    mass: 1000,
    semiMajorAxis: 0,
    orbitalPeriod: 0,
    initialAnomaly: 0,
    color: '#ffff00',
    description: 'Sun',
    resources: {},
  };

  const sunPos = { x: 0, y: 0, z: 0 };
  const r = 100;
  // Circular velocity: v = sqrt(G*M / r) = sqrt(1 * 1000 / 100) = sqrt(10) ≈ 3.162277
  const vCirc = Math.sqrt((SIM_G * centralSun.mass) / r);

  const shipPos = { x: r, y: 0, z: 0 };
  const shipVel = { x: 0, y: 0, z: vCirc };

  const elements = calculateOrbitalElements(shipPos, shipVel, centralSun, sunPos);

  assert.equal(elements.isBound, true);
  assert.ok(Math.abs(elements.eccentricity) < 0.05, `eccentricity ${elements.eccentricity} should be ~0`);
  assert.ok(Math.abs(elements.semiMajorAxis - r) < 2.0, `semiMajorAxis ${elements.semiMajorAxis} should be ~${r}`);
  assert.ok(elements.orbitalPeriod > 0);
});

test('calculateTsiolkovskyDeltaV produces accurate rocket equation results', () => {
  const isp = 380; // Raptor engine Isp ~380s
  const dryMass = 50; // tons
  const fuelMass = 100; // tons
  const deltaV = calculateTsiolkovskyDeltaV(isp, dryMass, fuelMass);

  // DeltaV = 380 * 9.80665 * ln(150 / 50) = 3726.527 * ln(3) ≈ 4094 m/s
  assert.ok(deltaV > 4000 && deltaV < 4200, `Delta-V should be around 4094 m/s, got ${deltaV}`);
});

test('calculateHohmannTransfer returns positive delta-v requirements', () => {
  const r1 = 100; // Earth orbit radius
  const r2 = 152; // Mars orbit radius
  const sunMass = 10000;

  const transfer = calculateHohmannTransfer(r1, r2, sunMass);
  assert.ok(transfer.deltaV1 > 0);
  assert.ok(transfer.deltaV2 > 0);
  assert.ok(transfer.totalDeltaV > 0);
  assert.ok(transfer.transferTime > 0);
});
