/**
 * WebSocket Client for 3-Player Cooperative Multiplayer
 */

import type {
  ClientToServerMessage,
  ServerToClientMessage,
  RemotePlayerState,
  RoomSummary,
} from './coopProtocol';
import type { AstronautRoleId } from '../sim/astronautRoles';
import type { BuildingKey, ColonyState, TechId } from '../sim/marsColonyLogic';
import type { MarsEnemy, PlasmaBolt } from '../sim/marsEnemies';

export interface CoopClientCallbacks {
  onJoined: (payload: {
    roomCode: string;
    selfId: string;
    selfSlot: 0 | 1 | 2;
    colonyState: ColonyState;
    collectedResourceIds: string[];
    plantedPlots: number[];
    players: RemotePlayerState[];
    enemies: MarsEnemy[];
    bolts: PlasmaBolt[];
  }) => void;
  onError: (message: string) => void;
  onPlayersSnapshot: (players: RemotePlayerState[]) => void;
  onCombatSnapshot: (enemies: MarsEnemy[], bolts: PlasmaBolt[]) => void;
  onColonySync: (payload: {
    colonyState: ColonyState;
    collectedResourceIds: string[];
    plantedPlots: number[];
    event?: {
      kind: 'resource' | 'build' | 'tech' | 'plant' | 'combat' | 'repair';
      label: string;
      byPlayer: string;
    };
  }) => void;
  onPlayerJoined: (player: RemotePlayerState) => void;
  onPlayerLeft: (playerId: string) => void;
  onConnectionChange: (connected: boolean) => void;
}

export class CoopClient {
  private ws: WebSocket | null = null;
  private callbacks: CoopClientCallbacks;
  private lastMoveEmitMs = 0;

  constructor(callbacks: CoopClientCallbacks) {
    this.callbacks = callbacks;
  }

  public connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.callbacks.onConnectionChange(true);
        resolve();
      };

      ws.onerror = () => {
        this.callbacks.onConnectionChange(false);
        reject(new Error('Falha ao conectar ao servidor cooperativo.'));
      };

      ws.onclose = () => {
        this.callbacks.onConnectionChange(false);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as ServerToClientMessage;
          switch (msg.type) {
            case 'room:joined':
              this.callbacks.onJoined(msg);
              break;
            case 'room:error':
              this.callbacks.onError(msg.message);
              break;
            case 'players:snapshot':
              this.callbacks.onPlayersSnapshot(msg.players);
              break;
            case 'combat:snapshot':
              this.callbacks.onCombatSnapshot(msg.enemies, msg.bolts);
              break;
            case 'colony:sync':
              this.callbacks.onColonySync(msg);
              break;
            case 'player:joined':
              this.callbacks.onPlayerJoined(msg.player);
              break;
            case 'player:left':
              this.callbacks.onPlayerLeft(msg.playerId);
              break;
          }
        } catch {
          // ignore malformed messages
        }
      };
    });
  }

  private send(payload: ClientToServerMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public async createRoom(
    playerName: string,
    threatsEnabled = true,
    roleId: AstronautRoleId = 'engineer'
  ) {
    await this.connect();
    this.send({ type: 'room:create', playerName, threatsEnabled, roleId });
  }

  public async joinRoom(
    roomCode: string,
    playerName: string,
    roleId: AstronautRoleId = 'scientist'
  ) {
    await this.connect();
    this.send({ type: 'room:join', roomCode, playerName, roleId });
  }

  public leaveRoom() {
    this.send({ type: 'room:leave' });
  }

  public emitRoleChange(roleId: AstronautRoleId) {
    this.send({ type: 'role:change', roleId });
  }

  public emitMove(data: Omit<Extract<ClientToServerMessage, { type: 'player:move' }>, 'type'>) {
    const now = performance.now();
    if (now - this.lastMoveEmitMs < 45) return;
    this.lastMoveEmitMs = now;
    this.send({ type: 'player:move', ...data });
  }

  public emitResourceCollect(resourceId: string, resourceType: 'regolith' | 'ice') {
    this.send({ type: 'resource:collect', resourceId, resourceType });
  }

  public emitTriggerComplete(triggerId: string) {
    this.send({ type: 'trigger:complete', triggerId });
  }

  public emitRepairBuilding(buildingKey: BuildingKey) {
    this.send({ type: 'building:repair', buildingKey });
  }

  public emitShoot(x: number, y: number, z: number, dirX: number, dirZ: number) {
    this.send({ type: 'player:shoot', x, y, z, dirX, dirZ });
  }

  public emitTechResearch(techId: TechId) {
    this.send({ type: 'tech:research', techId });
  }

  public emitToggleThreats(enabled: boolean) {
    this.send({ type: 'threats:toggle', enabled });
  }

  public emitSandboxEnable() {
    this.send({ type: 'sandbox:enable' });
  }

  public dispose() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export async function fetchOpenRooms(): Promise<RoomSummary[]> {
  try {
    const res = await fetch('/api/rooms');
    if (!res.ok) return [];
    const data = (await res.json()) as { rooms: RoomSummary[] };
    return data.rooms || [];
  } catch {
    return [];
  }
}
