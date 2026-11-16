/**
 * Orbital Mechanics & Physics Mathematics Engine
 * Pure deterministic calculations for Keplerian motion, N-body gravity,
 * orbital parameters, delta-v budgeting and Hohmann transfers.
 */

import { Vector3D, CelestialBodyData } from '../types/game';

// Gravitational constant scaled for the simulation visual coordinate frame
export const SIM_G = 1.0;
export const STANDARD_GRAVITY_G0 = 9.80665;

export function addVectors(a: Vector3D, b: Vector3D): Vector3D {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subtractVectors(a: Vector3D, b: Vector3D): Vector3D {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scaleVector(v: Vector3D, s: number): Vector3D {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function vectorLength(v: Vector3D): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function normalizeVector(v: Vector3D): Vector3D {
  const len = vectorLength(v);
  if (len < 1e-9) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function crossProduct(a: Vector3D, b: Vector3D): Vector3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function dotProduct(a: Vector3D, b: Vector3D): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Computes celestial body position at a given simulation epoch (seconds).
 */
export function computeBodyPosition(
  body: CelestialBodyData,
  timeSeconds: number,
  parentPos: Vector3D = { x: 0, y: 0, z: 0 }
): Vector3D {
  if (body.semiMajorAxis === 0 || body.orbitalPeriod === 0) {
    return { ...parentPos };
  }

  const meanMotion = (2 * Math.PI) / body.orbitalPeriod;
  const currentAngle = body.initialAnomaly + meanMotion * timeSeconds;

  const localX = body.semiMajorAxis * Math.cos(currentAngle);
  const localZ = body.semiMajorAxis * Math.sin(currentAngle);

  return {
    x: parentPos.x + localX,
    y: parentPos.y,
    z: parentPos.z + localZ,
  };
}

/**
 * Computes celestial body orbital velocity at a given simulation epoch.
 */
export function computeBodyVelocity(
  body: CelestialBodyData,
  timeSeconds: number,
  parentVel: Vector3D = { x: 0, y: 0, z: 0 }
): Vector3D {
  if (body.semiMajorAxis === 0 || body.orbitalPeriod === 0) {
    return { ...parentVel };
  }

  const meanMotion = (2 * Math.PI) / body.orbitalPeriod;
  const currentAngle = body.initialAnomaly + meanMotion * timeSeconds;
  const orbitalSpeed = (2 * Math.PI * body.semiMajorAxis) / body.orbitalPeriod;

  const localVx = -orbitalSpeed * Math.sin(currentAngle);
  const localVz = orbitalSpeed * Math.cos(currentAngle);

  return {
    x: parentVel.x + localVx,
    y: parentVel.y,
    z: parentVel.z + localVz,
  };
}

/**
 * Computes gravitational acceleration on a ship at shipPos from celestial bodies.
 * Uses inverse square law with smoothing radius to avoid singularities.
 */
export function computeGravitationalAcceleration(
  shipPos: Vector3D,
  bodies: CelestialBodyData[],
  bodyPositions: Map<string, Vector3D>
): Vector3D {
  let totalAcc: Vector3D = { x: 0, y: 0, z: 0 };

  for (const body of bodies) {
    const pos = bodyPositions.get(body.id) || { x: 0, y: 0, z: 0 };
    const rVec = subtractVectors(pos, shipPos);
    const distSq = rVec.x * rVec.x + rVec.y * rVec.y + rVec.z * rVec.z;
    const dist = Math.sqrt(distSq);

    // Softening radius equal to 60% of body radius to avoid division by zero
    const softening = body.radius * 0.6;
    const effectiveDist = Math.max(dist, softening);

    // a = G * M / r^2
    const accMagnitude = (SIM_G * body.mass) / (effectiveDist * effectiveDist);
    const unitR = normalizeVector(rVec);

    totalAcc = addVectors(totalAcc, scaleVector(unitR, accMagnitude));
  }

  return totalAcc;
}

/**
 * Calculates current orbital elements relative to primary body.
 */
export function calculateOrbitalElements(
  shipPos: Vector3D,
  shipVel: Vector3D,
  primaryBody: CelestialBodyData,
  primaryPos: Vector3D,
  primaryVel: Vector3D = { x: 0, y: 0, z: 0 }
) {
  const rVec = subtractVectors(shipPos, primaryPos);
  const vVec = subtractVectors(shipVel, primaryVel);

  const r = vectorLength(rVec);
  const v = vectorLength(vVec);
  const mu = SIM_G * primaryBody.mass;

  if (r < 1e-5 || mu < 1e-5) {
    return {
      apoapsis: 0,
      periapsis: 0,
      semiMajorAxis: 0,
      eccentricity: 0,
      orbitalPeriod: 0,
      speed: v,
      altitude: Math.max(0, r - primaryBody.radius),
      isBound: false,
    };
  }

  // Specific mechanical energy: epsilon = v^2 / 2 - mu / r
  const epsilon = (v * v) / 2 - mu / r;

  // Semi-major axis: a = -mu / (2 * epsilon)
  const isBound = epsilon < 0;
  const a = isBound ? -mu / (2 * epsilon) : Infinity;

  // Specific relative angular momentum: h = r x v
  const h = crossProduct(rVec, vVec);
  const hMag = vectorLength(h);

  // Eccentricity vector: e_vec = (v x h) / mu - (r / |r|)
  const vCrossH = crossProduct(vVec, h);
  const term1 = scaleVector(vCrossH, 1 / mu);
  const term2 = scaleVector(rVec, 1 / r);
  const eVec = subtractVectors(term1, term2);
  const e = Math.min(vectorLength(eVec), 9.99);

  let periapsis = 0;
  let apoapsis = 0;
  let period = 0;

  if (isBound && e < 1.0) {
    periapsis = a * (1 - e);
    apoapsis = a * (1 + e);
    period = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / mu);
  } else {
    // Hyperbolic or parabolic trajectory
    periapsis = hMag * hMag / (mu * (1 + e));
    apoapsis = Infinity;
    period = Infinity;
  }

  const altitude = Math.max(0, r - primaryBody.radius);

  return {
    apoapsis,
    periapsis,
    semiMajorAxis: a,
    eccentricity: e,
    orbitalPeriod: period,
    speed: v,
    altitude,
    isBound,
  };
}

/**
 * Tsiolkovsky Rocket Equation:
 * Delta-V = Isp * g0 * ln(m0 / mf)
 * Returns delta-V in m/s.
 */
export function calculateTsiolkovskyDeltaV(
  isp: number, // specific impulse (seconds)
  dryMass: number, // metric tons
  fuelMass: number // metric tons
): number {
  if (dryMass <= 0 || fuelMass <= 0 || isp <= 0) return 0;
  const totalMass = dryMass + fuelMass;
  return isp * STANDARD_GRAVITY_G0 * Math.log(totalMass / dryMass);
}

/**
 * Hohmann Transfer Delta-V & Travel Time calculator.
 */
export function calculateHohmannTransfer(
  r1: number, // origin orbit radius
  r2: number, // destination orbit radius
  primaryMass: number
) {
  const mu = SIM_G * primaryMass;
  if (r1 <= 0 || r2 <= 0 || mu <= 0) {
    return { deltaV1: 0, deltaV2: 0, totalDeltaV: 0, transferTime: 0 };
  }

  // Delta V 1: Departure burn into elliptical transfer orbit
  const deltaV1 = Math.sqrt(mu / r1) * (Math.sqrt((2 * r2) / (r1 + r2)) - 1);

  // Delta V 2: Insertion burn into target circular orbit
  const deltaV2 = Math.sqrt(mu / r2) * (1 - Math.sqrt((2 * r1) / (r1 + r2)));

  const totalDeltaV = Math.abs(deltaV1) + Math.abs(deltaV2);
  const semiMajorAxisTransfer = (r1 + r2) / 2;
  const transferTime = Math.PI * Math.sqrt(Math.pow(semiMajorAxisTransfer, 3) / mu);

  return {
    deltaV1,
    deltaV2,
    totalDeltaV,
    transferTime,
  };
}

/**
 * Predicts trajectory future positions using numerical integration (Runge-Kutta 2nd order / Midpoint).
 */
export function predictTrajectory(
  startPos: Vector3D,
  startVel: Vector3D,
  bodies: CelestialBodyData[],
  epochTime: number,
  steps: number = 80,
  stepDt: number = 0.5
): Vector3D[] {
  const points: Vector3D[] = [{ ...startPos }];
  let curPos = { ...startPos };
  let curVel = { ...startVel };
  let curTime = epochTime;

  for (let i = 0; i < steps; i++) {
    // 1. Calculate celestial body positions at curTime
    const bodyPosMap = new Map<string, Vector3D>();
    for (const b of bodies) {
      bodyPosMap.set(b.id, computeBodyPosition(b, curTime));
    }

    // 2. Gravitational acceleration at current state
    const acc = computeGravitationalAcceleration(curPos, bodies, bodyPosMap);

    // Midpoint step
    const midVel = addVectors(curVel, scaleVector(acc, stepDt * 0.5));
    const midPos = addVectors(curPos, scaleVector(curVel, stepDt * 0.5));

    // Midpoint acceleration
    const midBodyPosMap = new Map<string, Vector3D>();
    for (const b of bodies) {
      midBodyPosMap.set(b.id, computeBodyPosition(b, curTime + stepDt * 0.5));
    }
    const midAcc = computeGravitationalAcceleration(midPos, bodies, midBodyPosMap);

    // Update pos and vel
    curVel = addVectors(curVel, scaleVector(midAcc, stepDt));
    curPos = addVectors(curPos, scaleVector(midVel, stepDt));
    curTime += stepDt;

    points.push({ ...curPos });
  }

  return points;
}
