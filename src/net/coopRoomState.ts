/**
 * Authoritative Server-Side Room State & Idempotent Mutation Rules
 * Handles up to 3 cooperative players per room:
 * - Complexity-timed construction queue (workers nearby accelerate build speed!)
 * - Building repair & integrity
 * - Enemy wave spawning, plasma bolts & automated defense turret combat
 * - Tech Tree research & dynamic contracts
 */

import {
  AstronautRoleId,
  getAstronautRole,
  isAstronautRoleId,
} from '../sim/astronautRoles';
import { computeCoopSiteActionBoost } from '../sim/coopActionBoost';
import {
  BuildingKey,
  ColonyState,
  TechId,
  TECH_CATALOG,
  createInitialColonyState,
  startTechResearch,
  advanceTechResearch,
  computeTotalColonyEnergy,
  startConstruction,
  advanceConstructions,
  boostConstruction,
  stepColonyDustStorm,
  progressContract,
  applyMissionControlProgress,
  rerollColonyMissionControl,
  updateColonyTick,
} from '../sim/marsColonyLogic';
import {
  MarsEnemy,
  PlasmaBolt,
  createEnemy,
  createPlasmaBolt,
  stepEnemiesAndCombat,
} from '../sim/marsEnemies';
import { applyBuildingCombatDamage } from '../sim/buildingDurability';
import { MAX_COOP_PLAYERS, RemotePlayerState } from './coopProtocol';

export const PLAYER_SUIT_PALETTES: Array<{ namePrefix: string; colorHex: string; defaultRole: AstronautRoleId }> = [
  { namePrefix: 'Engenheiro', colorHex: '#f97316', defaultRole: 'engineer' },
  { namePrefix: 'Cientista', colorHex: '#06b6d4', defaultRole: 'scientist' },
  { namePrefix: 'Explorador', colorHex: '#10b981', defaultRole: 'explorer' },
];

export interface CoopRoom {
  code: string;
  colonyState: ColonyState;
  collectedResourceIds: Set<string>;
  plantedPlots: Set<number>;
  players: Map<string, RemotePlayerState>;
  enemies: MarsEnemy[];
  bolts: PlasmaBolt[];
  turretCooldown: number;
  enemySpawnTimer: number;
  lastTickMs: number;
  lastCombatTickMs: number;
}

export function getRoomRoleIds(room: CoopRoom): AstronautRoleId[] {
  const roles = Array.from(room.players.values()).map((p) => p.roleId);
  return roles.length > 0 ? roles : ['engineer'];
}

export function recomputeRoomEnergy(room: CoopRoom) {
  const energy = computeTotalColonyEnergy(
    room.colonyState.buildings,
    getRoomRoleIds(room),
    room.colonyState.dustStorm.solarEfficiencyMultiplier
  );
  if (energy !== room.colonyState.energy) {
    room.colonyState = { ...room.colonyState, energy };
  }
}

export function createCoopRoom(code: string, threatsEnabled = true): CoopRoom {
  const now = Date.now();
  return {
    code: code.toUpperCase(),
    colonyState: createInitialColonyState(threatsEnabled),
    collectedResourceIds: new Set<string>(),
    plantedPlots: new Set<number>(),
    players: new Map<string, RemotePlayerState>(),
    enemies: [],
    bolts: [],
    turretCooldown: 0,
    enemySpawnTimer: 16,
    lastTickMs: now,
    lastCombatTickMs: now,
  };
}

export function addPlayerToRoom(
  room: CoopRoom,
  playerId: string,
  playerName: string,
  requestedRoleId?: AstronautRoleId
): { ok: true; player: RemotePlayerState } | { ok: false; error: string } {
  if (room.players.size >= MAX_COOP_PLAYERS) {
    return { ok: false, error: `Sala ${room.code} já está cheia (máx. 3 astronautas).` };
  }

  const usedSlots = new Set(Array.from(room.players.values()).map((p) => p.slot));
  let slot: 0 | 1 | 2 = 0;
  if (usedSlots.has(0)) slot = usedSlots.has(1) ? 2 : 1;

  const palette = PLAYER_SUIT_PALETTES[slot];
  const roleId: AstronautRoleId = isAstronautRoleId(requestedRoleId)
    ? requestedRoleId
    : palette.defaultRole;
  const roleDef = getAstronautRole(roleId);

  const cleanName = playerName.trim().slice(0, 16) || `${roleDef.name.split(' ')[0]} ${slot + 1}`;
  const spawnX = slot === 0 ? 0 : slot === 1 ? -2.5 : 2.5;
  const spawnZ = 6.5;

  const player: RemotePlayerState = {
    id: playerId,
    slot,
    name: cleanName,
    roleId: roleDef.id,
    roleName: roleDef.name,
    suitColorHex: roleDef.accentHex,
    x: spawnX,
    y: 0,
    z: spawnZ,
    yaw: Math.PI,
    vx: 0,
    vz: 0,
    isMoving: false,
    isGrounded: true,
    isJetpacking: false,
    activeTriggerId: null,
    isActionPressed: false,
    lastActionAtMs: 0,
  };

  room.players.set(playerId, player);
  recomputeRoomEnergy(room);
  return { ok: true, player };
}

export function setPlayerRoleInRoom(
  room: CoopRoom,
  playerId: string,
  roleId: AstronautRoleId
): { changed: boolean; player?: RemotePlayerState } {
  const player = room.players.get(playerId);
  if (!player || !isAstronautRoleId(roleId)) return { changed: false };
  if (player.roleId === roleId) return { changed: false, player };

  const roleDef = getAstronautRole(roleId);
  player.roleId = roleDef.id;
  player.roleName = roleDef.name;
  player.suitColorHex = roleDef.accentHex;
  recomputeRoomEnergy(room);
  return { changed: true, player };
}

export function applyRoomResourceCollect(
  room: CoopRoom,
  resourceId: string,
  resourceType: 'regolith' | 'ice' | 'iron' | 'titanium' | 'silicon' | 'sulfur'
): boolean {
  if (room.collectedResourceIds.has(resourceId)) {
    return false;
  }
  room.collectedResourceIds.add(resourceId);

  if (resourceType === 'regolith') {
    room.colonyState = { ...room.colonyState, regolith: room.colonyState.regolith + 1 };
    room.colonyState = progressContract(room.colonyState, 'collect-regolith', 1).state;
    room.colonyState = applyMissionControlProgress(room.colonyState, 'gather-regolith', 1).state;
  } else if (resourceType === 'ice') {
    room.colonyState = { ...room.colonyState, waterIce: room.colonyState.waterIce + 1 };
    room.colonyState = applyMissionControlProgress(room.colonyState, 'gather-ice', 1).state;
  } else if (resourceType === 'iron') {
    room.colonyState = { ...room.colonyState, iron: room.colonyState.iron + 1 };
  } else if (resourceType === 'titanium') {
    room.colonyState = { ...room.colonyState, titanium: room.colonyState.titanium + 1 };
  } else if (resourceType === 'silicon') {
    room.colonyState = { ...room.colonyState, silicon: room.colonyState.silicon + 1 };
  } else if (resourceType === 'sulfur') {
    room.colonyState = { ...room.colonyState, sulfur: room.colonyState.sulfur + 1 };
  }
  return true;
}

/**
 * Starts a timed construction OR boosts an already-active construction site.
 * When 1–3 players press [E] near the same site, boost scales cooperatively (1x, 1.8x, 2.5x).
 */
export function applyRoomTriggerComplete(
  room: CoopRoom,
  triggerId: string,
  roleId: AstronautRoleId = 'engineer',
  actingPlayerId?: string,
  nowMs: number = Date.now()
): { changed: boolean; label: string; isPlant?: boolean } {
  const plots = Array.from(room.plantedPlots);
  const activeRoles = getRoomRoleIds(room);

  if (actingPlayerId) {
    const actor = room.players.get(actingPlayerId);
    if (actor) {
      actor.lastActionAtMs = nowMs;
    }
  }

  // If already under construction, apply cooperative acceleration scaled by active workers (1x / 1.8x / 2.5x) & role
  const existing = room.colonyState.activeConstructions.find((c) => c.id === triggerId);
  if (existing) {
    const boostInfo = actingPlayerId
      ? computeCoopSiteActionBoost(
          Array.from(room.players.values()),
          triggerId,
          nowMs,
          actingPlayerId
        )
      : null;

    const effectiveMult = boostInfo
      ? Math.max(1.0, boostInfo.effectiveBuildMultiplier)
      : getAstronautRole(roleId).modifiers.buildSpeedMultiplier;

    const boosted = boostConstruction(
      room.colonyState,
      triggerId,
      plots,
      1.5 * effectiveMult,
      activeRoles
    );
    room.colonyState = boosted.state;
    boosted.nextPlantedPlots.forEach((p) => room.plantedPlots.add(p));
    if (boosted.completedIds.includes(triggerId)) {
      return {
        changed: true,
        label: boostInfo?.label
          ? `Obra Concluída (${boostInfo.label}): ${existing.name}!`
          : `Obra Concluída: ${existing.name}!`,
        isPlant: triggerId.startsWith('trigger-plant-'),
      };
    }
    return {
      changed: true,
      label: boostInfo?.label
        ? `Acelerando ${existing.name} · ${boostInfo.label}`
        : `Acelerando ${existing.name}`,
    };
  }

  // Otherwise start new timed construction project
  const started = startConstruction(triggerId, room.colonyState, plots);
  if (!started.started) {
    return { changed: false, label: '' };
  }
  room.colonyState = started.state;
  const created = room.colonyState.activeConstructions.find((c) => c.id === triggerId);
  return {
    changed: true,
    label: `Obra Iniciada: ${created?.name || triggerId} (${created?.durationSec || 5}s)`,
    isPlant: triggerId.startsWith('trigger-plant-'),
  };
}

export function applyRoomRepairBuilding(
  room: CoopRoom,
  buildingKey: BuildingKey,
  roleId: AstronautRoleId = 'engineer',
  actingPlayerId?: string,
  nowMs: number = Date.now()
): { changed: boolean; label: string } {
  if (!room.colonyState.buildings[buildingKey]) return { changed: false, label: '' };
  if (room.colonyState.buildingHealth[buildingKey] >= 100) return { changed: false, label: '' };

  if (actingPlayerId) {
    const actor = room.players.get(actingPlayerId);
    if (actor) {
      actor.lastActionAtMs = nowMs;
    }
  }

  const repairTriggerId = `trigger-repair-${buildingKey}`;
  const boostInfo = actingPlayerId
    ? computeCoopSiteActionBoost(
        Array.from(room.players.values()),
        repairTriggerId,
        nowMs,
        actingPlayerId
      )
    : null;

  const repairMult = boostInfo
    ? Math.max(1.0, boostInfo.effectiveRepairMultiplier)
    : getAstronautRole(roleId).modifiers.repairAmountMultiplier;

  const repairGain = Math.round(32 * repairMult);
  const nextHp = Math.min(100, room.colonyState.buildingHealth[buildingKey] + repairGain);
  let nextState: ColonyState = {
    ...room.colonyState,
    buildingHealth: {
      ...room.colonyState.buildingHealth,
      [buildingKey]: nextHp,
    },
  };
  if (nextHp >= 100) {
    nextState = progressContract(nextState, 'repair-module', 1).state;
    nextState = applyMissionControlProgress(nextState, 'repair-modules', 1).state;
  }
  room.colonyState = nextState;
  const coopTag = boostInfo?.label ? ` · ${boostInfo.label}` : '';
  return {
    changed: true,
    label:
      nextHp >= 100
        ? `Módulo ${buildingKey} Reparado (100%)!${coopTag}`
        : `Reparando ${buildingKey} (${Math.round(nextHp)}%)${coopTag}`,
  };
}

export function applyRoomPlayerShoot(
  room: CoopRoom,
  x: number,
  y: number,
  z: number,
  dirX: number,
  dirZ: number,
  roleId: AstronautRoleId = 'engineer'
) {
  const hasMk2 = room.colonyState.unlockedTechs.includes('tech-pulse');
  const dmgMult = getAstronautRole(roleId).modifiers.combatDamageMultiplier;
  room.bolts.push(createPlasmaBolt(x, y + 1.15, z, dirX, dirZ, hasMk2, false, dmgMult));
}

export function applyRoomTechResearch(
  room: CoopRoom,
  techId: TechId
): { changed: boolean; label: string } {
  const started = startTechResearch(techId, room.colonyState);
  if (!started.started) {
    return { changed: false, label: '' };
  }
  room.colonyState = started.state;
  const tech = TECH_CATALOG.find((t) => t.id === techId);
  return {
    changed: true,
    label: `Pesquisa Iniciada: ${tech?.name || techId} (${tech?.durationSec || 8}s)`,
  };
}

export function applyRoomMissionControlReroll(room: CoopRoom): {
  changed: boolean;
  label: string;
} {
  const res = rerollColonyMissionControl(room.colonyState);
  if (!res.rerolled) {
    return { changed: false, label: res.reason || '' };
  }
  room.colonyState = res.state;
  return {
    changed: true,
    label: 'Novos Objetivos Diários gerados no Mission Control Terminal!',
  };
}

/**
 * Steps room combat (~20Hz) and colony passive ticks (~2Hz)
 */
export function tickCoopRoomCombat(room: CoopRoom, nowMs: number): boolean {
  const dt = Math.min(0.1, (nowMs - room.lastCombatTickMs) / 1000);
  if (dt < 0.04) return false;
  room.lastCombatTickMs = nowMs;

  if (!room.colonyState.threatsEnabled) {
    if (room.enemies.length > 0 || room.bolts.length > 0) {
      room.enemies = [];
      room.bolts = [];
      return true;
    }
    return false;
  }

  // Spawn waves gently starting Stage >= 2
  if (room.colonyState.stage >= 2 && room.players.size > 0) {
    room.enemySpawnTimer -= dt;
    const maxEnemies = Math.min(6, 1 + Math.floor(room.colonyState.stage / 2));
    if (room.enemySpawnTimer <= 0 && room.enemies.length < maxEnemies) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 34 + Math.random() * 14;
      const sx = Math.cos(angle) * dist;
      const sz = Math.sin(angle) * dist;
      const kind =
        room.colonyState.stage >= 7 && Math.random() < 0.25
          ? 'brute'
          : room.colonyState.stage >= 4 && Math.random() < 0.45
          ? 'drone'
          : 'crawler';
      room.enemies.push(createEnemy(kind, sx, sz, `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`));
      room.enemySpawnTimer = Math.max(12, 26 - room.colonyState.stage * 1.1);
    }
  }

  if (room.enemies.length === 0 && room.bolts.length === 0) {
    return false;
  }

  const firstPlayer = Array.from(room.players.values())[0];
  const anchorPos = firstPlayer ? { x: firstPlayer.x, y: firstPlayer.y, z: firstPlayer.z } : { x: 0, y: 0, z: 6 };

  const step = stepEnemiesAndCombat({
    enemies: room.enemies,
    bolts: room.bolts,
    colonyState: room.colonyState,
    playerPos: anchorPos,
    turretCooldown: room.turretCooldown,
    dt,
  });

  room.enemies = step.result.enemies;
  room.bolts = step.result.bolts;
  room.turretCooldown = step.nextTurretCooldown;

  // Apply enemy drops and building damage
  let stateChanged = false;
  if (step.result.kills.length > 0) {
    let reg = 0;
    let ice = 0;
    let bio = 0;
    let iron = 0;
    let titanium = 0;
    let sulfur = 0;
    for (const k of step.result.kills) {
      reg += k.regolith;
      ice += k.ice;
      bio += k.biomass;
      iron += k.iron;
      titanium += k.titanium;
      sulfur += k.sulfur;
    }
    room.colonyState = {
      ...room.colonyState,
      regolith: room.colonyState.regolith + reg,
      waterIce: room.colonyState.waterIce + ice,
      biomass: room.colonyState.biomass + bio,
      iron: room.colonyState.iron + iron,
      titanium: room.colonyState.titanium + titanium,
      sulfur: room.colonyState.sulfur + sulfur,
      enemiesDefeated: room.colonyState.enemiesDefeated + step.result.kills.length,
    };
    room.colonyState = progressContract(room.colonyState, 'kill-enemies', step.result.kills.length).state;
    room.colonyState = applyMissionControlProgress(
      room.colonyState,
      'defeat-enemies',
      step.result.kills.length
    ).state;
    if (reg > 0) {
      room.colonyState = applyMissionControlProgress(room.colonyState, 'gather-regolith', reg).state;
    }
    if (ice > 0) {
      room.colonyState = applyMissionControlProgress(room.colonyState, 'gather-ice', ice).state;
    }
    stateChanged = true;
  }

  const hitKeys = Object.keys(step.result.buildingHits) as BuildingKey[];
  if (hitKeys.length > 0) {
    const activeRoles = Array.from(room.players.values()).map((p) => p.roleId);
    const dmgRes = applyBuildingCombatDamage(
      room.colonyState,
      step.result.buildingHits,
      activeRoles.length > 0 ? activeRoles : ['engineer']
    );
    room.colonyState = dmgRes.state;
    if (dmgRes.damagedKeys.length > 0 || dmgRes.destroyedKeys.length > 0) {
      stateChanged = true;
    }
  }

  return stateChanged || room.enemies.length > 0 || room.bolts.length > 0;
}

export function tickCoopRoom(room: CoopRoom, nowMs: number): {
  changed: boolean;
  completedNames: string[];
  completedTechName: string | null;
  stormEvent: 'started' | 'ended' | null;
} {
  const dt = Math.min(1.0, (nowMs - room.lastTickMs) / 1000);
  if (dt < 0.45) {
    return { changed: false, completedNames: [], completedTechName: null, stormEvent: null };
  }
  room.lastTickMs = nowMs;

  const prevWater = room.colonyState.water;
  const prevBio = room.colonyState.biomass;
  const prevReg = room.colonyState.regolith;
  const prevActiveCount = room.colonyState.activeConstructions.length;
  const hadTechJob = Boolean(room.colonyState.activeTechResearch);
  const wasStormActive = room.colonyState.dustStorm.isActive;

  const activeRoles = getRoomRoleIds(room);

  const playersList = Array.from(room.players.values());

  // Cooperative construction acceleration (1x, 1.8x, 2.5x when 1–3 players press [E] / assist at site)
  const workerPowerBySite: Record<string, number> = {};
  for (const job of room.colonyState.activeConstructions) {
    const boostInfo = computeCoopSiteActionBoost(playersList, job.id, nowMs);
    if (boostInfo.pressingCount > 0) {
      workerPowerBySite[job.id] = boostInfo.effectiveBuildMultiplier;
    } else if (boostInfo.presentCount > 0) {
      // Passive presence near site without holding [E] still assists smoothly
      workerPowerBySite[job.id] =
        boostInfo.presentCount * 0.65 * boostInfo.averageRoleBuildMultiplier;
    }
  }

  const plots = Array.from(room.plantedPlots);
  const adv = advanceConstructions(room.colonyState, plots, dt, workerPowerBySite, activeRoles);
  adv.nextPlantedPlots.forEach((p) => room.plantedPlots.add(p));

  // Continuous cooperative repair when 1–3 players press/hold [E] near a damaged module
  let workingColonyState = adv.state;
  let repairedDuringTick = false;
  for (const key of Object.keys(workingColonyState.buildings) as BuildingKey[]) {
    if (!workingColonyState.buildings[key] || workingColonyState.buildingHealth[key] >= 100) {
      continue;
    }
    const repairTriggerId = `trigger-repair-${key}`;
    const repairBoost = computeCoopSiteActionBoost(playersList, repairTriggerId, nowMs);
    if (repairBoost.pressingCount > 0) {
      const repairGain = 14 * repairBoost.effectiveRepairMultiplier * dt;
      const nextHp = Math.min(100, workingColonyState.buildingHealth[key] + repairGain);
      workingColonyState = {
        ...workingColonyState,
        buildingHealth: {
          ...workingColonyState.buildingHealth,
          [key]: nextHp,
        },
      };
      if (nextHp >= 100) {
        workingColonyState = progressContract(workingColonyState, 'repair-module', 1).state;
        workingColonyState = applyMissionControlProgress(
          workingColonyState,
          'repair-modules',
          1
        ).state;
      }
      repairedDuringTick = true;
    }
  }

  const techAdv = advanceTechResearch(workingColonyState, dt, activeRoles);
  const completedTechDef = techAdv.completedTechId
    ? TECH_CATALOG.find((t) => t.id === techAdv.completedTechId)
    : null;

  const stormAdv = stepColonyDustStorm(techAdv.state, dt, activeRoles);
  const stormEvent: 'started' | 'ended' | null = stormAdv.stormStarted
    ? 'started'
    : stormAdv.stormEnded
    ? 'ended'
    : null;

  const completedNames = adv.completedIds.map((id) => id.replace('trigger-', '').toUpperCase());
  room.colonyState = updateColonyTick(stormAdv.state, dt, true);

  const changed =
    room.colonyState.water !== prevWater ||
    room.colonyState.biomass !== prevBio ||
    room.colonyState.regolith !== prevReg ||
    prevActiveCount > 0 ||
    hadTechJob ||
    wasStormActive ||
    repairedDuringTick ||
    Boolean(stormEvent) ||
    completedNames.length > 0 ||
    Boolean(completedTechDef);

  return {
    changed,
    completedNames,
    completedTechName: completedTechDef ? completedTechDef.name : null,
    stormEvent,
  };
}
