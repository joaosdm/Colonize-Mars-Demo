/**
 * Cooperative Construction & Repair Acceleration Engine (Up to 3 Players)
 * Scales construction progress and damaged-module repairs when multiple astronauts
 * press [E] / Action inside the same structure's interaction zone:
 *   - 1 player  = 1.0x
 *   - 2 players = 1.8x
 *   - 3 players = 2.5x
 * Stacks cleanly with each astronaut's cooperative class bonus (e.g., Engineer).
 */

import { AstronautRoleId, getAstronautRole } from './astronautRoles';
import type { BuildingKey } from './marsColonyLogic';
import { BUILDING_COORDS } from './marsEnemies';

export const COOP_MAX_ACTIVE_WORKERS = 3;
export const COOP_ACTION_ACTIVE_WINDOW_MS = 1800;

export const COOP_WORKER_MULTIPLIERS: Record<number, number> = {
  0: 0,
  1: 1.0,
  2: 1.8,
  3: 2.5,
};

export interface InteractionZoneCoord {
  x: number;
  z: number;
  radius: number;
}

export const CONSTRUCTION_ZONE_COORDS: Record<string, InteractionZoneCoord> = {
  'trigger-moxie': { x: -7, z: 4, radius: 3.4 },
  'trigger-solar': { x: 8, z: 4, radius: 3.4 },
  'trigger-water': { x: 14, z: -10, radius: 3.8 },
  'trigger-miner': { x: 18, z: 7, radius: 3.6 },
  'trigger-lab': { x: -12, z: -6, radius: 4.0 },
  'trigger-turret': { x: 10, z: -2, radius: 3.5 },
  'trigger-biodome': { x: 0, z: -19, radius: 5.0 },
  'trigger-plant-0': { x: 5, z: -22, radius: 2.6 },
  'trigger-plant-1': { x: -5, z: -22, radius: 2.6 },
  'trigger-plant-2': { x: 0, z: -27, radius: 2.6 },
  'trigger-habitat': { x: -11, z: 12, radius: 4.1 },
  'trigger-comms': { x: 12, z: 14, radius: 3.7 },
  'trigger-geothermal': { x: -20, z: -4, radius: 4.1 },
  'trigger-terraform': { x: -14, z: -18, radius: 4.2 },
};

export interface CoopActionParticipant {
  id: string;
  roleId: AstronautRoleId;
  x: number;
  z: number;
  activeTriggerId: string | null;
  isActionPressed?: boolean;
  lastActionAtMs?: number;
}

export interface CoopSiteBoostResult {
  triggerId: string;
  presentCount: number;
  pressingCount: number;
  coopMultiplier: number; // 0, 1.0, 1.8, or 2.5
  averageRoleBuildMultiplier: number;
  averageRoleRepairMultiplier: number;
  effectiveBuildMultiplier: number;
  effectiveRepairMultiplier: number;
  participantIds: string[];
  label: string | null;
}

/**
 * Returns the exact cooperative multiplier for 0..3 astronauts:
 * 1 player -> 1.0x | 2 players -> 1.8x | 3 players -> 2.5x
 */
export function getCoopParticipantMultiplier(playerCount: number): number {
  const clamped = Math.max(0, Math.min(COOP_MAX_ACTIVE_WORKERS, Math.floor(playerCount)));
  return COOP_WORKER_MULTIPLIERS[clamped] ?? 2.5;
}

export function getInteractionZoneCoords(triggerId: string): InteractionZoneCoord | null {
  if (triggerId in CONSTRUCTION_ZONE_COORDS) {
    return CONSTRUCTION_ZONE_COORDS[triggerId];
  }
  if (triggerId.startsWith('trigger-repair-')) {
    const key = triggerId.replace('trigger-repair-', '') as BuildingKey;
    const coords = BUILDING_COORDS[key];
    if (coords) {
      return { x: coords.x, z: coords.z, radius: 4.2 };
    }
  }
  return null;
}

export function isParticipantInTriggerZone(
  participant: CoopActionParticipant,
  triggerId: string
): boolean {
  if (participant.activeTriggerId === triggerId) {
    return true;
  }
  const zone = getInteractionZoneCoords(triggerId);
  if (!zone) return false;
  return Math.hypot(participant.x - zone.x, participant.z - zone.z) <= zone.radius + 0.5;
}

export function isParticipantPressingAction(
  participant: CoopActionParticipant,
  nowMs: number
): boolean {
  if (participant.isActionPressed) return true;
  if (
    typeof participant.lastActionAtMs === 'number' &&
    nowMs - participant.lastActionAtMs <= COOP_ACTION_ACTIVE_WINDOW_MS
  ) {
    return true;
  }
  return false;
}

/**
 * Computes cooperative acceleration when 1–3 astronauts press [E] / Action
 * near the same construction or damaged module.
 */
export function computeCoopSiteActionBoost(
  participants: CoopActionParticipant[],
  triggerId: string,
  nowMs: number,
  actingPlayerId?: string
): CoopSiteBoostResult {
  const presentWorkers = participants
    .filter((p) => isParticipantInTriggerZone(p, triggerId))
    .slice(0, COOP_MAX_ACTIVE_WORKERS);

  const pressingWorkers = presentWorkers
    .filter((p) => p.id === actingPlayerId || isParticipantPressingAction(p, nowMs))
    .slice(0, COOP_MAX_ACTIVE_WORKERS);

  // If actingPlayerId pressed [E] right at the boundary, ensure they count as at least 1 active worker
  if (
    actingPlayerId &&
    !pressingWorkers.some((p) => p.id === actingPlayerId)
  ) {
    const acting = participants.find((p) => p.id === actingPlayerId);
    if (acting && pressingWorkers.length < COOP_MAX_ACTIVE_WORKERS) {
      pressingWorkers.unshift(acting);
    }
  }

  const pressingCount = pressingWorkers.length;
  const coopMultiplier = getCoopParticipantMultiplier(pressingCount);

  const rolePool = pressingCount > 0 ? pressingWorkers : presentWorkers;
  const averageRoleBuildMultiplier =
    rolePool.length > 0
      ? rolePool.reduce(
          (sum, p) => sum + getAstronautRole(p.roleId).modifiers.buildSpeedMultiplier,
          0
        ) / rolePool.length
      : 1.0;

  const averageRoleRepairMultiplier =
    rolePool.length > 0
      ? rolePool.reduce(
          (sum, p) => sum + getAstronautRole(p.roleId).modifiers.repairAmountMultiplier,
          0
        ) / rolePool.length
      : 1.0;

  const effectiveBuildMultiplier = Number(
    (coopMultiplier * averageRoleBuildMultiplier).toFixed(3)
  );
  const effectiveRepairMultiplier = Number(
    (coopMultiplier * averageRoleRepairMultiplier).toFixed(3)
  );

  const label =
    pressingCount >= 2
      ? `Co-op ${pressingCount} jogadores (${coopMultiplier}x)`
      : null;

  return {
    triggerId,
    presentCount: presentWorkers.length,
    pressingCount,
    coopMultiplier,
    averageRoleBuildMultiplier,
    averageRoleRepairMultiplier,
    effectiveBuildMultiplier,
    effectiveRepairMultiplier,
    participantIds: pressingWorkers.map((p) => p.id),
    label,
  };
}
