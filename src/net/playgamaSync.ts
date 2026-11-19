/**
 * Pure Serialization, Host-Migration Hydration, Matchmaking Filter & Error Mapping
 * for Playgama Bridge Multiplayer (Host-Authoritative 3-Player Co-op).
 */

import type { ColonyState } from '../sim/marsColonyLogic';
import type { MarsEnemy, PlasmaBolt } from '../sim/marsEnemies';
import type { RemotePlayerState } from './coopProtocol';
import { CoopRoom, createCoopRoom } from './coopRoomState';

/**
 * Minimal matchmaking filter (mode + protocol version only, per Playgama guidelines).
 * Never include unique IDs, timestamps, or room codes here.
 */
export const PLAYGAMA_MATCH_FILTER = {
  mode: 'coop-mars',
  version: 3,
} as const;

/** Playgama syncState snapshot budget: 4 snapshots/s keeps traffic well under 64 KB/s. */
export const PLAYGAMA_SYNC_UPDATES_PER_SEC = 4;

/** Maximum byte size permitted by Playgama Bridge for a single syncState payload. */
export const PLAYGAMA_MAX_SYNC_BYTES = 64 * 1024;

export interface PlaygamaSyncedWorld {
  schemaVersion: 1;
  colonyState: ColonyState;
  collectedResourceIds: string[];
  plantedPlots: number[];
  players: RemotePlayerState[];
  enemies: MarsEnemy[];
  bolts: PlasmaBolt[];
}

export type PlaygamaConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

export type PlaygamaRoomLeaveReason = 'left' | 'connection_lost' | 'room_closed';

/**
 * Serializes the authoritative CoopRoom into a compact JSON-safe object for
 * Playgama `bridge.multiplayer.setSyncState()`.
 */
export function serializeCoopRoomForSync(room: CoopRoom): PlaygamaSyncedWorld {
  return {
    schemaVersion: 1,
    colonyState: room.colonyState,
    collectedResourceIds: Array.from(room.collectedResourceIds),
    plantedPlots: Array.from(room.plantedPlots),
    players: Array.from(room.players.values()),
    enemies: room.enemies,
    bolts: room.bolts,
  };
}

/**
 * Validates whether an unknown payload received from `MULTIPLAYER_SYNC_STATE_RECEIVED`
 * is a valid `PlaygamaSyncedWorld`.
 */
export function isValidSyncedWorld(value: unknown): value is PlaygamaSyncedWorld {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PlaygamaSyncedWorld>;
  return (
    candidate.schemaVersion === 1 &&
    Boolean(candidate.colonyState) &&
    typeof candidate.colonyState === 'object' &&
    Array.isArray(candidate.collectedResourceIds) &&
    Array.isArray(candidate.plantedPlots) &&
    Array.isArray(candidate.players)
  );
}

/**
 * Reconstructs a full authoritative `CoopRoom` from a Playgama `syncState` snapshot.
 * Used seamlessly when a non-host player becomes the new host after host migration.
 */
export function hydrateCoopRoomFromSync(
  roomCode: string,
  world: PlaygamaSyncedWorld
): CoopRoom {
  const room = createCoopRoom(roomCode, world.colonyState.threatsEnabled);
  room.colonyState = world.colonyState;
  room.collectedResourceIds = new Set(world.collectedResourceIds);
  room.plantedPlots = new Set(world.plantedPlots);
  room.players = new Map<string, RemotePlayerState>();
  for (const player of world.players) {
    if (player && typeof player.id === 'string') {
      room.players.set(player.id, { ...player });
    }
  }
  room.enemies = Array.isArray(world.enemies) ? world.enemies.map((e) => ({ ...e })) : [];
  room.bolts = Array.isArray(world.bolts) ? world.bolts.map((b) => ({ ...b })) : [];
  return room;
}

/**
 * Measures UTF-8 byte length of a serialized syncState payload so we can enforce
 * Playgama's 64 KB limit cleanly.
 */
export function estimateSyncWorldBytes(world: PlaygamaSyncedWorld): number {
  const json = JSON.stringify(world);
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(json).length;
  }
  return Buffer.byteLength(json, 'utf8');
}

/**
 * Translates Playgama Bridge Multiplayer error codes into user-friendly Portuguese messages.
 */
export function translatePlaygamaError(code?: string, fallbackMessage?: string): string {
  switch (code) {
    case 'MULTIPLAYER_NOT_SUPPORTED':
      return 'Multiplayer Playgama não suportado neste ambiente ou token ausente.';
    case 'MULTIPLAYER_ALREADY_IN_ROOM':
      return 'Você já está conectado em uma sala cooperativa.';
    case 'MULTIPLAYER_NOT_IN_ROOM':
      return 'Você precisa estar em uma sala para executar esta ação.';
    case 'MULTIPLAYER_ROOM_NOT_FOUND':
      return 'Sala não encontrada ou já encerrada. Verifique o código ou use Partida Rápida.';
    case 'MULTIPLAYER_ROOM_FULL':
      return 'Esta sala já atingiu o limite de 3 astronautas.';
    case 'MULTIPLAYER_ROOM_CLOSED':
      return 'Esta sala foi fechada pelo host e não aceita novos jogadores.';
    case 'MULTIPLAYER_INVALID_REQUEST':
      return 'Parâmetros inválidos na requisição da sala Playgama.';
    case 'MULTIPLAYER_CONNECTION_FAILED':
      return 'Não foi possível alcançar o servidor Playgama. Verifique sua conexão.';
    default:
      return fallbackMessage || 'Falha na conexão multiplayer Playgama.';
  }
}

/**
 * Formats Playgama server region identifiers (`eu`, `us`, `ap`) for the lobby selector.
 */
export function formatPlaygamaRegionLabel(regionId: string): string {
  const key = regionId.trim().toLowerCase();
  switch (key) {
    case 'eu':
      return 'Europa (EU)';
    case 'us':
      return 'Américas (US)';
    case 'ap':
      return 'Ásia-Pacífico (AP)';
    default:
      return regionId.toUpperCase();
  }
}
