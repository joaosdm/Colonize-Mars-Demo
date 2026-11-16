/**
 * Mars Surface Physics & Deterministic Terrain Heightmap
 * Shared by 3D terrain mesh, astronaut movement, remote player interpolation,
 * resource grounding, and unit tests.
 */

export const MARS_GRAVITY_ACCEL = 10.6; // Scaled 0.38g (Earth ~27.8 -> Mars 0.38g = 10.6 m/s^2)
export const BASE_JUMP_IMPULSE = 8.4; // Floaty ~3.3m high Martian jump
export const JETPACK_THRUST = 15.8; // Exceeds 0.38g to allow gentle hovering & crater leaps
export const PLAYABLE_RADIUS = 68.0;

export interface ObstacleCircle {
  id: string;
  x: number;
  z: number;
  radius: number;
}

export interface PhysicsBody {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  isGrounded: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  jetpackFuel: number; // 0..100
  isJetpacking: boolean;
  squashY: number; // 1.0 = normal, <1 squashed, >1 stretched
  distanceTraveled: number;
}

export interface PhysicsInput {
  moveX: number; // Camera-relative or world X (-1..1)
  moveZ: number; // Camera-relative or world Z (-1..1)
  jumpJustPressed: boolean;
  jumpHeld: boolean;
  jetpackHeld: boolean;
}

export interface PhysicsUpgrades {
  speedMultiplier: number; // e.g., 1.0 base, 1.18 with tech
  jetpackCapacityMultiplier: number; // e.g., 1.0 base, 1.4 with tech
}

export function createPhysicsBody(x = 0, z = 6.5): PhysicsBody {
  const y = groundHeightAt(x, z);
  return {
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: Math.PI,
    isGrounded: true,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    jetpackFuel: 100,
    isJetpacking: false,
    squashY: 1.0,
    distanceTraveled: 0,
  };
}

/**
 * Deterministic Martian terrain heightmap at world (x, z).
 * - Central flat landing zone (radius <= 14m)
 * - Two crater lake basins around (22, -16) and (-24, -18) that fill with water during terraforming
 * - Rolling oxide dunes (14m .. 62m)
 * - Natural surrounding crater rim cliffs (> 62m)
 */
export function groundHeightAt(x: number, z: number): number {
  const distCenter = Math.hypot(x, z);

  // Flat landing zone & colony core
  if (distCenter <= 13.5) {
    return 0;
  }

  // Smooth transition factor out of the flat core
  const blend = Math.min(1, Math.max(0, (distCenter - 13.5) / 8.0));

  // Rolling dunes
  let h =
    (Math.sin(x * 0.055) * Math.cos(z * 0.055) * 1.65 +
      Math.sin(x * 0.11 + z * 0.08) * 0.65) *
    blend;

  // Crater Lake Basin East (22, -16)
  const dLake1 = Math.hypot(x - 22, z + 16);
  if (dLake1 < 12.0) {
    const t = 1 - dLake1 / 12.0;
    h = h * (1 - t) - t * t * 2.5;
  }

  // Crater Lake Basin West (-24, -18)
  const dLake2 = Math.hypot(x + 24, z + 18);
  if (dLake2 < 10.5) {
    const t = 1 - dLake2 / 10.5;
    h = h * (1 - t) - t * t * 2.3;
  }

  // Outer Gale Crater Rim rise beyond 58m
  if (distCenter > 58) {
    const rimT = (distCenter - 58) / 22;
    h += rimT * rimT * 12.0;
  }

  return h;
}

/**
 * Approximate surface normal (nx, ny, nz) at (x, z) using central finite differences.
 */
export function groundNormalAt(x: number, z: number): { nx: number; ny: number; nz: number } {
  const eps = 0.5;
  const hL = groundHeightAt(x - eps, z);
  const hR = groundHeightAt(x + eps, z);
  const hD = groundHeightAt(x, z - eps);
  const hU = groundHeightAt(x, z + eps);

  const nx = hL - hR;
  const ny = 2.0 * eps;
  const nz = hD - hU;
  const len = Math.hypot(nx, ny, nz) || 1;
  return { nx: nx / len, ny: ny / len, nz: nz / len };
}

/**
 * Resolves smooth circle-vs-circle collisions on the XZ plane
 * so the astronaut slides cleanly around the Starship hull and boulders.
 */
export function resolveObstacleCollisions(
  x: number,
  z: number,
  playerRadius: number,
  obstacles: ObstacleCircle[]
): { x: number; z: number } {
  let px = x;
  let pz = z;

  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    const dx = px - obs.x;
    const dz = pz - obs.z;
    const distSq = dx * dx + dz * dz;
    const minDist = playerRadius + obs.radius;

    if (distSq < minDist * minDist) {
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        const push = minDist - dist;
        px += (dx / dist) * push;
        pz += (dz / dist) * push;
      } else {
        px += minDist;
      }
    }
  }

  // Keep player inside crater rim perimeter
  const r = Math.hypot(px, pz);
  if (r > PLAYABLE_RADIUS) {
    const scale = PLAYABLE_RADIUS / r;
    px *= scale;
    pz *= scale;
  }

  return { x: px, z: pz };
}

/**
 * Steps astronaut low-gravity physics with acceleration, friction,
 * slope modulation, coyote time, jump buffering, and EVA jetpack thrust.
 */
export function stepAstronautPhysics(
  body: PhysicsBody,
  input: PhysicsInput,
  dt: number,
  obstacles: ObstacleCircle[],
  upgrades: PhysicsUpgrades = { speedMultiplier: 1.0, jetpackCapacityMultiplier: 1.0 }
): { jumped: boolean; landed: boolean } {
  const clampedDt = Math.min(dt, 0.05);
  let jumped = false;
  let landed = false;

  // 1. Input Buffering & Coyote Time
  if (input.jumpJustPressed) {
    body.jumpBufferTimer = 0.14;
  } else {
    body.jumpBufferTimer = Math.max(0, body.jumpBufferTimer - clampedDt);
  }

  if (body.isGrounded) {
    body.coyoteTimer = 0.12;
  } else {
    body.coyoteTimer = Math.max(0, body.coyoteTimer - clampedDt);
  }

  // 2. Horizontal Acceleration, Slope Factor & Martian Friction
  const inputLen = Math.hypot(input.moveX, input.moveZ);
  const normX = inputLen > 1 ? input.moveX / inputLen : input.moveX;
  const normZ = inputLen > 1 ? input.moveZ / inputLen : input.moveZ;

  const maxSpeed = 10.2 * upgrades.speedMultiplier;
  const accel = body.isGrounded ? 46.0 : 22.0; // Responsive ground control, floaty air control
  const friction = body.isGrounded ? 10.5 : 1.8; // Smooth momentum glide in low gravity

  if (inputLen > 0.05) {
    // Slope factor: uphill slightly slower, downhill slightly faster
    const normal = groundNormalAt(body.x, body.z);
    const slopeAssist = Math.max(0.7, Math.min(1.25, 1.0 - (normX * normal.nx + normZ * normal.nz) * 0.6));

    body.vx += normX * accel * slopeAssist * clampedDt;
    body.vz += normZ * accel * slopeAssist * clampedDt;

    // Smooth yaw turn toward velocity/input direction
    const targetYaw = Math.atan2(normX, normZ);
    let diff = targetYaw - body.yaw;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    body.yaw += diff * Math.min(1.0, 14.0 * clampedDt);
  }

  // Apply damping friction
  const damping = Math.exp(-friction * clampedDt);
  body.vx *= damping;
  body.vz *= damping;

  // Clamp max horizontal speed
  const curHorizSpeed = Math.hypot(body.vx, body.vz);
  if (curHorizSpeed > maxSpeed) {
    const scale = maxSpeed / curHorizSpeed;
    body.vx *= scale;
    body.vz *= scale;
  }

  // 3. Jump Takeoff (with Coyote Time & Jump Buffer)
  if (body.jumpBufferTimer > 0 && body.coyoteTimer > 0) {
    body.vy = BASE_JUMP_IMPULSE;
    body.isGrounded = false;
    body.coyoteTimer = 0;
    body.jumpBufferTimer = 0;
    body.squashY = 1.24; // Takeoff stretch
    jumped = true;
  }

  // Variable jump height cut if jump released early while rising fast
  if (!input.jumpHeld && !input.jetpackHeld && body.vy > 3.5) {
    body.vy *= Math.exp(-5.0 * clampedDt);
  }

  // 4. EVA Jetpack Hover / Boost (hold Shift or Space while airborne after apex)
  const wantJetpack = !body.isGrounded && (input.jetpackHeld || (input.jumpHeld && body.vy < 1.2));
  if (wantJetpack && body.jetpackFuel > 1.0) {
    body.isJetpacking = true;
    body.vy += JETPACK_THRUST * clampedDt;
    if (body.vy > 7.5) body.vy = 7.5;
    const drainRate = 38.0 / upgrades.jetpackCapacityMultiplier;
    body.jetpackFuel = Math.max(0, body.jetpackFuel - drainRate * clampedDt);
  } else {
    body.isJetpacking = false;
    if (body.isGrounded) {
      body.jetpackFuel = Math.min(100, body.jetpackFuel + 42.0 * clampedDt);
    }
  }

  // 5. Apply Mars 0.38g Gravity & Integrate Position
  body.vy -= MARS_GRAVITY_ACCEL * clampedDt;

  const prevX = body.x;
  const prevZ = body.z;

  const nextX = body.x + body.vx * clampedDt;
  const nextZ = body.z + body.vz * clampedDt;

  const resolved = resolveObstacleCollisions(nextX, nextZ, 0.65, obstacles);
  body.x = resolved.x;
  body.z = resolved.z;
  body.y += body.vy * clampedDt;

  // Track ground distance traveled for realistic gait sync
  if (body.isGrounded) {
    body.distanceTraveled += Math.hypot(body.x - prevX, body.z - prevZ);
  }

  // 6. Terrain Ground Contact Resolution
  const groundY = groundHeightAt(body.x, body.z);
  if (body.y <= groundY) {
    if (!body.isGrounded && body.vy < -3.0) {
      // Landing squash impact scaled to fall speed
      const impact = Math.min(0.28, Math.abs(body.vy) * 0.03);
      body.squashY = 1.0 - impact;
      landed = true;
    }
    body.y = groundY;
    body.vy = 0;
    body.isGrounded = true;
  } else if (body.y > groundY + 0.14) {
    body.isGrounded = false;
  }

  // Smoothly recover squash-and-stretch back to 1.0
  body.squashY += (1.0 - body.squashY) * Math.min(1.0, 12.0 * clampedDt);

  return { jumped, landed };
}
