/**
 * Shared Cooperative Multiplayer WebSocket Protocol (up to 3 Players)
 */

import type { AstronautRoleId } from '../sim/astronautRoles';
import type { BuildingKey, ColonyState, TechId } from '../sim/marsColonyLogic';
import type { MarsEnemy, PlasmaBolt } from '../sim/marsEnemies';

export const MAX_COOP_PLAYERS = 3;

export interface RemotePlayerState {
  id: string;
  slot: 0 | 1 | 2;
  name: string;
  roleId: AstronautRoleId;
  roleName: string;
  suitColorHex: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  isMoving: boolean;
  isGrounded: boolean;
  isJetpacking: boolean;
  activeTriggerId: string | null;
  isActionPressed?: boolean;
  lastActionAtMs?: number;
}

export interface RoomSummary {
  code: string;
  playerCount: number;
  maxPlayers: number;
  habitability: number;
  hostName: string;
  roles: AstronautRoleId[];
}

export type ClientToServerMessage =
  | {
      type: 'room:create';
      playerName: string;
      roleId?: AstronautRoleId;
      customCode?: string;
      threatsEnabled?: boolean;
    }
  | { type: 'room:join'; roomCode: string; playerName: string; roleId?: AstronautRoleId }
  | { type: 'room:leave' }
  | { type: 'role:change'; roleId: AstronautRoleId }
  | {
      type: 'player:move';
      x: number;
      y: number;
      z: number;
      yaw: number;
      vx: number;
      vz: number;
      isMoving: boolean;
      isGrounded: boolean;
      isJetpacking: boolean;
      activeTriggerId: string | null;
      isActionPressed?: boolean;
    }
  | {
      type: 'resource:collect';
      resourceId: string;
      resourceType: 'regolith' | 'ice' | 'iron' | 'titanium' | 'silicon' | 'sulfur';
    }
  | { type: 'trigger:complete'; triggerId: string }
  | { type: 'building:repair'; buildingKey: BuildingKey }
  | { type: 'player:shoot'; x: number; y: number; z: number; dirX: number; dirZ: number }
  | { type: 'tech:research'; techId: TechId }
  | { type: 'mission-control:reroll' }
  | { type: 'threats:toggle'; enabled: boolean }
  | { type: 'sandbox:enable' };

export type ServerToClientMessage =
  | {
      type: 'room:joined';
      roomCode: string;
      selfId: string;
      selfSlot: 0 | 1 | 2;
      colonyState: ColonyState;
      collectedResourceIds: string[];
      plantedPlots: number[];
      players: RemotePlayerState[];
      enemies: MarsEnemy[];
      bolts: PlasmaBolt[];
    }
  | { type: 'room:error'; message: string }
  | { type: 'player:joined'; player: RemotePlayerState }
  | { type: 'player:left'; playerId: string }
  | { type: 'players:snapshot'; players: RemotePlayerState[] }
  | { type: 'combat:snapshot'; enemies: MarsEnemy[]; bolts: PlasmaBolt[] }
  | {
      type: 'colony:sync';
      colonyState: ColonyState;
      collectedResourceIds: string[];
      plantedPlots: number[];
      event?: {
        kind: 'resource' | 'build' | 'tech' | 'plant' | 'combat' | 'repair';
        label: string;
        byPlayer: string;
      };
    };
