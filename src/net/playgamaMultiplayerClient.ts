/**
 * Playgama Bridge Multiplayer Client (Host-Authoritative 3-Player Co-op)
 *
 * Implements the full Playgama Bridge Multiplayer lifecycle:
 *  1. Initializes `@playgama/bridge` using `./playgama-bridge-config.json` (`saas.publicToken`).
 *  2. Checks `bridge.multiplayer.isSupported` before enabling online rooms.
 *  3. Supports Create Room (private/public), Join by Code, Quick Match (`joinOrCreateRoom`),
 *     Open Room List (`getRooms`), Region Selection (`getRegions` / `setRegion`),
 *     Friend Invites (`inviteToRoom`) and Invite Launch (`launchRoomId`).
 *  4. Runs the authoritative `CoopRoom` simulation on the current Host and mirrors the
 *     colony state via `syncState` + relay messages (`send`), with seamless host migration
 *     on `MULTIPLAYER_HOST_CHANGED` and connection/reconnection handling via
 *     `MULTIPLAYER_STATE_CHANGED` and `MULTIPLAYER_ROOM_LEFT`.
 */

import bridge, {
  EVENT_NAME,
  MULTIPLAYER_TARGET,
  PLATFORM_MESSAGE,
} from '@playgama/bridge';

type BridgeMultiplayerPlayer = (typeof bridge.multiplayer.players)[number];
type BridgeMultiplayerRoomInfo = Awaited<
  ReturnType<typeof bridge.multiplayer.getRooms>
>[number];
interface BridgeMultiplayerMessage {
  type: string;
  data: unknown;
  from: string;
}
import {
  AstronautRoleId,
  getAstronautRole,
  isAstronautRoleId,
} from '../sim/astronautRoles';
import type { BuildingKey, ColonyState, TechId } from '../sim/marsColonyLogic';
import type { MarsEnemy, PlasmaBolt } from '../sim/marsEnemies';
import {
  MAX_COOP_PLAYERS,
  type ClientToServerMessage,
  type RemotePlayerState,
  type RoomSummary,
} from './coopProtocol';
import {
  type CoopRoom,
  addPlayerToRoom,
  applyRoomMissionControlReroll,
  applyRoomPlayerShoot,
  applyRoomRepairBuilding,
  applyRoomResourceCollect,
  applyRoomTechResearch,
  applyRoomTriggerComplete,
  createCoopRoom,
  getRoomRoleIds,
  recomputeRoomEnergy,
  setPlayerRoleInRoom,
  tickCoopRoom,
  tickCoopRoomCombat,
} from './coopRoomState';
import {
  PLAYGAMA_MATCH_FILTER,
  PLAYGAMA_SYNC_UPDATES_PER_SEC,
  type PlaygamaConnectionState,
  type PlaygamaRoomLeaveReason,
  type PlaygamaSyncedWorld,
  hydrateCoopRoomFromSync,
  isValidSyncedWorld,
  serializeCoopRoomForSync,
  translatePlaygamaError,
} from './playgamaSync';

const REGION_STORAGE_KEY = 'mars_playgama_region';

export interface PlaygamaMultiplayerStatus {
  isInitialized: boolean;
  isSupported: boolean;
  isInviteSupported: boolean;
  state: PlaygamaConnectionState;
  isHost: boolean;
  region: string | null;
  regions: string[];
  launchRoomId: string | null;
}

export interface PlaygamaCoopCallbacks {
  onStatusChange: (status: PlaygamaMultiplayerStatus) => void;
  onJoined: (payload: {
    roomCode: string;
    selfId: string;
    selfSlot: 0 | 1 | 2;
    isHost: boolean;
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
  onHostChanged: (isNowHost: boolean, hostName: string) => void;
  onRoomLeft: (reason: PlaygamaRoomLeaveReason) => void;
}

type RelayActionMessage = Exclude<
  ClientToServerMessage,
  { type: 'room:create' } | { type: 'room:join' } | { type: 'room:leave' }
>;

interface ColonySyncEventPayload {
  kind: 'resource' | 'build' | 'tech' | 'plant' | 'combat' | 'repair';
  label: string;
  byPlayer: string;
}

let bridgeInitPromise: Promise<void> | null = null;

function readStoredRegion(): string | null {
  try {
    return window.localStorage.getItem(REGION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveStoredRegion(region: string) {
  try {
    window.localStorage.setItem(REGION_STORAGE_KEY, region);
  } catch {
    // Ignore storage restrictions inside sandboxed portal iframes
  }
}

export class PlaygamaMultiplayerClient {
  private callbacks: PlaygamaCoopCallbacks;
  private isInitialized = false;
  private isDisposed = false;
  private regions: string[] = [];
  private listenersBound = false;

  // Authoritative state maintained ONLY while `bridge.multiplayer.isHost === true`
  private hostRoom: CoopRoom | null = null;
  private hostWorldTickTimer: number | null = null;
  private hostCombatTickTimer: number | null = null;
  private hostPlayersSnapshotTimer: number | null = null;
  private hostPropsSyncTimer: number | null = null;

  // Last synced world received (used for fast host-migration hydration)
  private lastKnownWorld: PlaygamaSyncedWorld | null = null;

  // Local player profile for room entry / join
  private localName = 'Comandante';
  private localRoleId: AstronautRoleId = 'engineer';
  private lastMoveEmitMs = 0;

  // Bound event listeners so dispose() detaches cleanly
  private boundHandlers: Array<{ event: string; fn: (...args: unknown[]) => void }> = [];

  constructor(callbacks: PlaygamaCoopCallbacks) {
    this.callbacks = callbacks;
  }

  public async initialize(): Promise<PlaygamaMultiplayerStatus> {
    try {
      if (!bridge.isInitialized) {
        if (!bridgeInitPromise) {
          bridgeInitPromise = bridge
            .initialize({ configFilePath: './playgama-bridge-config.json' })
            .catch((err) => {
              bridgeInitPromise = null;
              throw err;
            });
        }
        await bridgeInitPromise;
      }

      try {
        bridge.platform.sendMessage(PLATFORM_MESSAGE.GAME_READY);
      } catch {
        // Ignore on standalone browser environments
      }

      this.isInitialized = true;
      this.bindMultiplayerEvents();

      if (bridge.multiplayer.isSupported) {
        // Playgama automatically picks the optimal region; only apply an explicit stored preference if present.
        try {
          const saved = readStoredRegion();
          if (saved) {
            bridge.multiplayer.setRegion(saved);
          }
        } catch {
          // Ignore optional region preference errors
        }
      }
    } catch {
      this.isInitialized = true;
    }

    const status = this.getStatus();
    if (!this.isDisposed) {
      this.callbacks.onStatusChange(status);
    }
    return status;
  }

  public getStatus(): PlaygamaMultiplayerStatus {
    try {
      const mp = bridge.multiplayer;
      return {
        isInitialized: this.isInitialized,
        isSupported: this.isInitialized && Boolean(mp?.isSupported),
        isInviteSupported: this.isInitialized && Boolean(mp?.isInviteSupported),
        state: (mp?.state as PlaygamaConnectionState) || 'disconnected',
        isHost: Boolean(mp?.isHost),
        region: mp?.region ?? null,
        regions: this.regions,
        launchRoomId: mp?.launchRoomId ?? null,
      };
    } catch {
      return {
        isInitialized: this.isInitialized,
        isSupported: false,
        isInviteSupported: false,
        state: 'disconnected',
        isHost: false,
        region: null,
        regions: this.regions,
        launchRoomId: null,
      };
    }
  }

  public setRegion(regionId: string) {
    if (!bridge.multiplayer.isSupported) return;
    bridge.multiplayer.setRegion(regionId);
    saveStoredRegion(regionId);
    this.emitStatus();
  }

  public async fetchOpenRooms(): Promise<RoomSummary[]> {
    if (!this.isInitialized || !bridge.multiplayer.isSupported) return [];
    try {
      const rooms: BridgeMultiplayerRoomInfo[] = await bridge.multiplayer.getRooms({
        filter: { ...PLAYGAMA_MATCH_FILTER },
        maxPlayers: MAX_COOP_PLAYERS,
        limit: 20,
      });
      return rooms.map((room) => {
        const props = room.properties || {};
        const rawRoles = typeof props.roles === 'string' ? props.roles.split(',') : [];
        const roles = rawRoles.filter(isAstronautRoleId);
        return {
          code: room.id,
          playerCount: room.playerCount,
          maxPlayers: room.maxPlayers,
          habitability: typeof props.habitability === 'number' ? props.habitability : 4,
          hostName: typeof props.hostName === 'string' ? props.hostName : 'Host',
          roles,
        };
      });
    } catch {
      return [];
    }
  }

  public async createRoom(
    playerName: string,
    threatsEnabled = true,
    roleId: AstronautRoleId = 'engineer',
    isVisible = true
  ): Promise<string> {
    await this.ensureReadyAndSupported();
    this.localName = playerName.trim().slice(0, 16) || 'Comandante';
    this.localRoleId = roleId;

    // Prepare starting world BEFORE entering room so Playgama syncState captures initial state immediately
    const initialRoom = createCoopRoom('INIT', threatsEnabled);
    const startingWorld = serializeCoopRoomForSync(initialRoom);
    bridge.multiplayer.setSyncState(startingWorld as unknown as Record<string, unknown>);

    try {
      const roomId = await bridge.multiplayer.createRoom({
        maxPlayers: MAX_COOP_PLAYERS,
        isVisible,
        isOpen: true,
        filter: { ...PLAYGAMA_MATCH_FILTER },
        properties: {
          hostName: this.localName,
          habitability: initialRoom.colonyState.habitability,
          threatsEnabled,
          roles: roleId,
        },
        playerName: this.localName,
        playerProperties: {
          name: this.localName,
          roleId,
        },
        syncState: { updatesPerSecond: PLAYGAMA_SYNC_UPDATES_PER_SEC },
      });

      this.setupHostSession(roomId, initialRoom, threatsEnabled);
      return roomId;
    } catch (err) {
      const msg = this.extractErrorMessage(err);
      this.callbacks.onError(msg);
      throw new Error(msg);
    }
  }

  public async joinRoom(
    roomCode: string,
    playerName: string,
    roleId: AstronautRoleId = 'scientist'
  ): Promise<void> {
    await this.ensureReadyAndSupported();
    const trimmed = roomCode.trim();
    const cleanCode = trimmed.includes('-') ? trimmed : trimmed.toUpperCase();
    if (!cleanCode) {
      const msg = 'Informe o código da sala Playgama.';
      this.callbacks.onError(msg);
      throw new Error(msg);
    }

    this.localName = playerName.trim().slice(0, 16) || 'Astronauta';
    this.localRoleId = roleId;

    try {
      await bridge.multiplayer.joinRoom(cleanCode, {
        playerName: this.localName,
        playerProperties: {
          name: this.localName,
          roleId,
        },
        syncState: { updatesPerSecond: PLAYGAMA_SYNC_UPDATES_PER_SEC },
      });

      this.finalizeRoomEntry(cleanCode, true);
    } catch (err) {
      const msg = this.extractErrorMessage(err);
      this.callbacks.onError(msg);
      throw new Error(msg);
    }
  }

  public async joinOrCreateRoom(
    playerName: string,
    threatsEnabled = true,
    roleId: AstronautRoleId = 'engineer'
  ): Promise<string> {
    await this.ensureReadyAndSupported();
    this.localName = playerName.trim().slice(0, 16) || 'Comandante';
    this.localRoleId = roleId;

    const initialRoom = createCoopRoom('MATCH', threatsEnabled);
    bridge.multiplayer.setSyncState(
      serializeCoopRoomForSync(initialRoom) as unknown as Record<string, unknown>
    );

    try {
      const roomId = await bridge.multiplayer.joinOrCreateRoom({
        maxPlayers: MAX_COOP_PLAYERS,
        filter: { ...PLAYGAMA_MATCH_FILTER },
        properties: {
          hostName: this.localName,
          habitability: initialRoom.colonyState.habitability,
          threatsEnabled,
          roles: roleId,
        },
        playerName: this.localName,
        playerProperties: {
          name: this.localName,
          roleId,
        },
        syncState: { updatesPerSecond: PLAYGAMA_SYNC_UPDATES_PER_SEC },
      });

      if (bridge.multiplayer.isHost) {
        this.setupHostSession(roomId, initialRoom, threatsEnabled);
      } else {
        this.finalizeRoomEntry(roomId, threatsEnabled);
      }
      return roomId;
    } catch (err) {
      const msg = this.extractErrorMessage(err);
      this.callbacks.onError(msg);
      throw new Error(msg);
    }
  }

  public async inviteToRoom(): Promise<boolean> {
    if (!bridge.multiplayer.isInRoom || !bridge.multiplayer.isInviteSupported) {
      return false;
    }
    try {
      await bridge.multiplayer.inviteToRoom({
        text: `Junte-se à minha colônia em Colonize Mars! Sala: ${bridge.multiplayer.roomId || ''}`,
      });
      return true;
    } catch {
      return false;
    }
  }

  public leaveRoom() {
    this.stopHostLoops();
    this.hostRoom = null;
    this.lastKnownWorld = null;
    if (bridge.multiplayer.isInRoom) {
      bridge.multiplayer.leaveRoom();
    }
    this.emitStatus();
  }

  // ---- Gameplay Action Emitters (Route locally if Host, or send to Host via Playgama Relay) ----

  public emitRoleChange(roleId: AstronautRoleId) {
    this.localRoleId = roleId;
    if (bridge.multiplayer.isInRoom) {
      bridge.multiplayer.setPlayerProperties({ name: this.localName, roleId });
    }
    this.dispatchAction({ type: 'role:change', roleId });
  }

  public emitMove(data: Omit<Extract<ClientToServerMessage, { type: 'player:move' }>, 'type'>) {
    const now = performance.now();
    if (now - this.lastMoveEmitMs < 55) return;
    this.lastMoveEmitMs = now;
    this.dispatchAction({ type: 'player:move', ...data });
  }

  public emitResourceCollect(
    resourceId: string,
    resourceType: 'regolith' | 'ice' | 'iron' | 'titanium' | 'silicon' | 'sulfur'
  ) {
    this.dispatchAction({ type: 'resource:collect', resourceId, resourceType });
  }

  public emitTriggerComplete(triggerId: string) {
    this.dispatchAction({ type: 'trigger:complete', triggerId });
  }

  public emitRepairBuilding(buildingKey: BuildingKey) {
    this.dispatchAction({ type: 'building:repair', buildingKey });
  }

  public emitShoot(x: number, y: number, z: number, dirX: number, dirZ: number) {
    this.dispatchAction({ type: 'player:shoot', x, y, z, dirX, dirZ });
  }

  public emitTechResearch(techId: TechId) {
    this.dispatchAction({ type: 'tech:research', techId });
  }

  public emitMissionControlReroll() {
    this.dispatchAction({ type: 'mission-control:reroll' });
  }

  public emitToggleThreats(enabled: boolean) {
    this.dispatchAction({ type: 'threats:toggle', enabled });
  }

  public emitSandboxEnable() {
    this.dispatchAction({ type: 'sandbox:enable' });
  }

  public dispose() {
    this.isDisposed = true;
    this.stopHostLoops();
    if (bridge.multiplayer.isInRoom) {
      bridge.multiplayer.leaveRoom();
    }
    for (const entry of this.boundHandlers) {
      bridge.multiplayer.off(entry.event, entry.fn);
    }
    this.boundHandlers = [];
    this.listenersBound = false;
  }

  // ---- Internal Helpers ----

  private async ensureReadyAndSupported() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    if (!bridge.multiplayer.isSupported) {
      throw new Error(translatePlaygamaError('MULTIPLAYER_NOT_SUPPORTED'));
    }
  }

  private emitStatus() {
    if (!this.isDisposed) {
      this.callbacks.onStatusChange(this.getStatus());
    }
  }

  private extractErrorMessage(err: unknown): string {
    if (err && typeof err === 'object') {
      const obj = err as { code?: string; message?: string };
      return translatePlaygamaError(obj.code, obj.message);
    }
    return translatePlaygamaError(undefined, err instanceof Error ? err.message : undefined);
  }

  private dispatchAction(action: RelayActionMessage) {
    if (!bridge.multiplayer.isInRoom) return;
    const selfId = bridge.multiplayer.playerId;
    if (!selfId) return;

    if (bridge.multiplayer.isHost && this.hostRoom) {
      this.processAuthoritativeAction(selfId, action);
    } else {
      bridge.multiplayer.send(action.type, action, { to: MULTIPLAYER_TARGET.HOST });
    }
  }

  private setupHostSession(roomId: string, baseRoom: CoopRoom, threatsEnabled: boolean) {
    baseRoom.code = roomId;
    baseRoom.colonyState = { ...baseRoom.colonyState, threatsEnabled };
    this.hostRoom = baseRoom;

    // Register all players currently present in the Playgama room
    const selfId = bridge.multiplayer.playerId || 'host-self';
    this.syncPlaygamaPlayersIntoHostRoom();
    if (!this.hostRoom.players.has(selfId)) {
      addPlayerToRoom(this.hostRoom, selfId, this.localName, this.localRoleId);
    }

    const selfPlayer = this.hostRoom.players.get(selfId);
    const snapshot = serializeCoopRoomForSync(this.hostRoom);
    this.lastKnownWorld = snapshot;
    bridge.multiplayer.setSyncState(snapshot as unknown as Record<string, unknown>);
    this.startHostLoops();
    this.emitStatus();

    this.callbacks.onJoined({
      roomCode: roomId,
      selfId,
      selfSlot: selfPlayer?.slot ?? 0,
      isHost: true,
      colonyState: this.hostRoom.colonyState,
      collectedResourceIds: snapshot.collectedResourceIds,
      plantedPlots: snapshot.plantedPlots,
      players: snapshot.players,
      enemies: snapshot.enemies,
      bolts: snapshot.bolts,
    });
  }

  private finalizeRoomEntry(roomId: string, defaultThreats: boolean) {
    const selfId = bridge.multiplayer.playerId || 'client-self';
    const syncedRaw = bridge.multiplayer.syncState;
    const syncedWorld = isValidSyncedWorld(syncedRaw)
      ? syncedRaw
      : this.lastKnownWorld;

    if (bridge.multiplayer.isHost) {
      const room = syncedWorld
        ? hydrateCoopRoomFromSync(roomId, syncedWorld)
        : createCoopRoom(roomId, defaultThreats);
      this.setupHostSession(roomId, room, room.colonyState.threatsEnabled);
      return;
    }

    // Non-host client: announce join profile to host and hydrate initial state from syncState
    const tempRoom = syncedWorld
      ? hydrateCoopRoomFromSync(roomId, syncedWorld)
      : createCoopRoom(roomId, defaultThreats);
    if (!tempRoom.players.has(selfId)) {
      addPlayerToRoom(tempRoom, selfId, this.localName, this.localRoleId);
    }
    const selfPlayer = tempRoom.players.get(selfId);
    const snap = serializeCoopRoomForSync(tempRoom);
    this.lastKnownWorld = snap;

    // Request authoritative full sync & register profile with host
    bridge.multiplayer.send(
      'client:hello',
      { name: this.localName, roleId: this.localRoleId },
      { to: MULTIPLAYER_TARGET.HOST }
    );

    this.emitStatus();
    this.callbacks.onJoined({
      roomCode: roomId,
      selfId,
      selfSlot: selfPlayer?.slot ?? 1,
      isHost: false,
      colonyState: snap.colonyState,
      collectedResourceIds: snap.collectedResourceIds,
      plantedPlots: snap.plantedPlots,
      players: snap.players,
      enemies: snap.enemies,
      bolts: snap.bolts,
    });
  }

  private bindMultiplayerEvents() {
    if (this.listenersBound) return;
    this.listenersBound = true;

    const addListener = (event: string, fn: (...args: unknown[]) => void) => {
      bridge.multiplayer.on(event, fn);
      this.boundHandlers.push({ event, fn });
    };

    addListener(EVENT_NAME.MULTIPLAYER_STATE_CHANGED, () => {
      this.emitStatus();
    });

    addListener(EVENT_NAME.MULTIPLAYER_ROOM_LEFT, (reasonArg: unknown) => {
      const reason =
        reasonArg === 'connection_lost' || reasonArg === 'room_closed'
          ? reasonArg
          : 'left';
      this.stopHostLoops();
      this.hostRoom = null;
      this.lastKnownWorld = null;
      this.emitStatus();
      if (!this.isDisposed) {
        this.callbacks.onRoomLeft(reason);
      }
    });

    addListener(EVENT_NAME.MULTIPLAYER_PLAYER_JOINED, (playerArg: unknown) => {
      const mpPlayer = playerArg as BridgeMultiplayerPlayer | undefined;
      if (!mpPlayer || !mpPlayer.id) return;

      if (bridge.multiplayer.isHost && this.hostRoom) {
        const added = this.ensurePlayerInHostRoom(mpPlayer);
        if (added) {
          this.pushHostSyncState();
          this.broadcastHostColonySync();
          this.broadcastHostPlayersSnapshot();
          this.callbacks.onPlayerJoined(added);
        }
      }
    });

    addListener(EVENT_NAME.MULTIPLAYER_PLAYER_LEFT, (playerArg: unknown) => {
      const mpPlayer = playerArg as BridgeMultiplayerPlayer | undefined;
      const departedId = mpPlayer?.id;
      if (!departedId) return;

      if (bridge.multiplayer.isHost && this.hostRoom) {
        if (this.hostRoom.players.delete(departedId)) {
          recomputeRoomEnergy(this.hostRoom);
          this.pushHostSyncState();
          this.broadcastHostPlayersSnapshot();
          this.broadcastHostColonySync();
        }
      }
      if (!this.isDisposed) {
        this.callbacks.onPlayerLeft(departedId);
      }
    });

    addListener(EVENT_NAME.MULTIPLAYER_PLAYER_UPDATED, (playerArg: unknown) => {
      const mpPlayer = playerArg as BridgeMultiplayerPlayer | undefined;
      if (!mpPlayer || !mpPlayer.id) return;

      if (bridge.multiplayer.isHost && this.hostRoom) {
        const requestedRole = mpPlayer.properties?.roleId;
        if (isAstronautRoleId(requestedRole)) {
          const res = setPlayerRoleInRoom(this.hostRoom, mpPlayer.id, requestedRole);
          if (res.changed) {
            this.pushHostSyncState();
            this.broadcastHostPlayersSnapshot();
            this.broadcastHostColonySync();
          }
        }
      }
    });

    addListener(EVENT_NAME.MULTIPLAYER_HOST_CHANGED, (hostArg: unknown) => {
      const newHost = hostArg as BridgeMultiplayerPlayer | null | undefined;
      const isNowHost = bridge.multiplayer.isHost;
      this.emitStatus();

      if (isNowHost && bridge.multiplayer.isInRoom) {
        const roomId = bridge.multiplayer.roomId || 'MARS';
        const syncedRaw = bridge.multiplayer.syncState;
        const sourceWorld = isValidSyncedWorld(syncedRaw)
          ? syncedRaw
          : this.lastKnownWorld;

        this.hostRoom = sourceWorld
          ? hydrateCoopRoomFromSync(roomId, sourceWorld)
          : createCoopRoom(roomId, true);
        this.syncPlaygamaPlayersIntoHostRoom();
        this.pushHostSyncState();
        this.startHostLoops();
        this.broadcastHostColonySync();
        this.broadcastHostPlayersSnapshot();
      } else {
        this.stopHostLoops();
        this.hostRoom = null;
      }

      if (!this.isDisposed) {
        this.callbacks.onHostChanged(isNowHost, newHost?.name || 'Host');
      }
    });

    addListener(EVENT_NAME.MULTIPLAYER_SYNC_STATE_RECEIVED, (stateArg: unknown) => {
      if (!isValidSyncedWorld(stateArg)) return;
      this.lastKnownWorld = stateArg;

      // Non-host clients hydrate full colony state, players & combat smoothly from host snapshots
      if (!bridge.multiplayer.isHost && !this.isDisposed) {
        this.callbacks.onColonySync({
          colonyState: stateArg.colonyState,
          collectedResourceIds: stateArg.collectedResourceIds,
          plantedPlots: stateArg.plantedPlots,
        });
        this.callbacks.onPlayersSnapshot(stateArg.players);
        this.callbacks.onCombatSnapshot(stateArg.enemies || [], stateArg.bolts || []);
      }
    });

    addListener(EVENT_NAME.MULTIPLAYER_MESSAGE_RECEIVED, (msgArg: unknown) => {
      const message = msgArg as BridgeMultiplayerMessage | undefined;
      if (!message || typeof message.type !== 'string') return;
      this.handleRelayMessage(message);
    });
  }

  private handleRelayMessage(message: BridgeMultiplayerMessage) {
    if (this.isDisposed) return;

    // 1. Messages processed by Host (from remote clients)
    if (bridge.multiplayer.isHost && this.hostRoom) {
      if (message.type === 'client:hello') {
        const data = (message.data || {}) as { name?: string; roleId?: AstronautRoleId };
        const existing = this.hostRoom.players.get(message.from);
        if (!existing) {
          const added = addPlayerToRoom(
            this.hostRoom,
            message.from,
            data.name || 'Astronauta',
            data.roleId
          );
          if (added.ok) {
            this.callbacks.onPlayerJoined(added.player);
          }
        } else if (data.roleId && isAstronautRoleId(data.roleId)) {
          setPlayerRoleInRoom(this.hostRoom, message.from, data.roleId);
        }
        this.pushHostSyncState();
        this.broadcastHostColonySync();
        this.broadcastHostPlayersSnapshot();
        return;
      }

      const payload = message.data as RelayActionMessage | undefined;
      if (payload && typeof payload === 'object' && typeof payload.type === 'string') {
        this.processAuthoritativeAction(message.from, payload);
        return;
      }
    }

    // 2. Broadcast messages received by Non-Host clients from Host
    if (!bridge.multiplayer.isHost) {
      if (message.type === 'players:snapshot') {
        const data = message.data as { players?: RemotePlayerState[] };
        if (Array.isArray(data?.players)) {
          this.callbacks.onPlayersSnapshot(data.players);
        }
      } else if (message.type === 'combat:snapshot') {
        const data = message.data as { enemies?: MarsEnemy[]; bolts?: PlasmaBolt[] };
        this.callbacks.onCombatSnapshot(data?.enemies || [], data?.bolts || []);
      } else if (message.type === 'colony:sync') {
        const data = message.data as {
          colonyState: ColonyState;
          collectedResourceIds: string[];
          plantedPlots: number[];
          event?: ColonySyncEventPayload;
        };
        if (data?.colonyState) {
          this.callbacks.onColonySync(data);
        }
      }
    }
  }

  private syncPlaygamaPlayersIntoHostRoom() {
    if (!this.hostRoom) return;
    const connectedIds = new Set<string>();
    for (const mpPlayer of bridge.multiplayer.players) {
      connectedIds.add(mpPlayer.id);
      this.ensurePlayerInHostRoom(mpPlayer);
    }
    // Remove players who are no longer in the Playgama room
    for (const id of Array.from(this.hostRoom.players.keys())) {
      if (!connectedIds.has(id)) {
        this.hostRoom.players.delete(id);
      }
    }
    recomputeRoomEnergy(this.hostRoom);
  }

  private ensurePlayerInHostRoom(mpPlayer: BridgeMultiplayerPlayer): RemotePlayerState | null {
    if (!this.hostRoom) return null;
    const existing = this.hostRoom.players.get(mpPlayer.id);
    if (existing) return null;
    const propName =
      typeof mpPlayer.properties?.name === 'string' && mpPlayer.properties.name.trim()
        ? mpPlayer.properties.name
        : mpPlayer.name || 'Astronauta';
    const propRole = isAstronautRoleId(mpPlayer.properties?.roleId)
      ? mpPlayer.properties.roleId
      : undefined;
    const res = addPlayerToRoom(this.hostRoom, mpPlayer.id, propName, propRole);
    return res.ok ? res.player : null;
  }

  private processAuthoritativeAction(senderId: string, msg: RelayActionMessage) {
    const room = this.hostRoom;
    if (!room) return;
    let player = room.players.get(senderId);
    if (!player) {
      const mpPlayer = bridge.multiplayer.players.find((p) => p.id === senderId);
      const added = addPlayerToRoom(
        room,
        senderId,
        mpPlayer?.name || 'Astronauta',
        isAstronautRoleId(mpPlayer?.properties?.roleId)
          ? mpPlayer.properties.roleId
          : undefined
      );
      if (added.ok) player = added.player;
    }
    if (!player) return;

    switch (msg.type) {
      case 'player:move': {
        player.x = msg.x;
        player.y = msg.y;
        player.z = msg.z;
        player.yaw = msg.yaw;
        player.vx = msg.vx;
        player.vz = msg.vz;
        player.isMoving = msg.isMoving;
        player.isGrounded = msg.isGrounded;
        player.isJetpacking = msg.isJetpacking;
        player.activeTriggerId = msg.activeTriggerId;
        player.isActionPressed = Boolean(msg.isActionPressed);
        if (msg.isActionPressed) {
          player.lastActionAtMs = Date.now();
        }
        break;
      }

      case 'role:change': {
        const res = setPlayerRoleInRoom(room, senderId, msg.roleId);
        if (res.changed && res.player) {
          this.pushHostSyncState();
          this.broadcastHostPlayersSnapshot();
          this.broadcastHostColonySync({
            kind: 'build',
            label: `Classe alterada para ${getAstronautRole(res.player.roleId).name}`,
            byPlayer: res.player.name,
          });
        }
        break;
      }

      case 'resource:collect': {
        const changed = applyRoomResourceCollect(room, msg.resourceId, msg.resourceType);
        if (changed) {
          this.pushHostSyncState();
          this.broadcastHostColonySync();
        }
        break;
      }

      case 'trigger:complete': {
        const res = applyRoomTriggerComplete(
          room,
          msg.triggerId,
          player.roleId,
          senderId,
          Date.now()
        );
        if (res.changed) {
          this.pushHostSyncState();
          this.broadcastHostColonySync({
            kind: res.isPlant ? 'plant' : 'build',
            label: res.label,
            byPlayer: player.name,
          });
        }
        break;
      }

      case 'building:repair': {
        const res = applyRoomRepairBuilding(
          room,
          msg.buildingKey,
          player.roleId,
          senderId,
          Date.now()
        );
        if (res.changed) {
          this.pushHostSyncState();
          this.broadcastHostColonySync({
            kind: 'repair',
            label: res.label,
            byPlayer: player.name,
          });
        }
        break;
      }

      case 'player:shoot': {
        applyRoomPlayerShoot(room, msg.x, msg.y, msg.z, msg.dirX, msg.dirZ, player.roleId);
        this.broadcastHostCombatSnapshot();
        break;
      }

      case 'tech:research': {
        const res = applyRoomTechResearch(room, msg.techId);
        if (res.changed) {
          this.pushHostSyncState();
          this.broadcastHostColonySync({
            kind: 'tech',
            label: res.label,
            byPlayer: player.name,
          });
        }
        break;
      }

      case 'mission-control:reroll': {
        const res = applyRoomMissionControlReroll(room);
        if (res.changed) {
          this.pushHostSyncState();
          this.broadcastHostColonySync({
            kind: 'build',
            label: res.label,
            byPlayer: player.name,
          });
        }
        break;
      }

      case 'threats:toggle': {
        room.colonyState = { ...room.colonyState, threatsEnabled: msg.enabled };
        if (!msg.enabled) {
          room.enemies = [];
          room.bolts = [];
        }
        this.pushHostSyncState();
        this.broadcastHostColonySync({
          kind: 'combat',
          label: msg.enabled ? 'Ameaças Marcianas Ativadas' : 'Modo Pacífico Ativado',
          byPlayer: player.name,
        });
        this.broadcastHostCombatSnapshot();
        break;
      }

      case 'sandbox:enable': {
        room.colonyState = { ...room.colonyState, isSandboxMode: true };
        this.pushHostSyncState();
        this.broadcastHostColonySync();
        break;
      }
    }
  }

  private startHostLoops() {
    this.stopHostLoops();

    // 1. Player positions snapshot (~15 Hz)
    this.hostPlayersSnapshotTimer = window.setInterval(() => {
      if (!bridge.multiplayer.isHost || !this.hostRoom) return;
      this.broadcastHostPlayersSnapshot();
    }, 66);

    // 2. Combat simulation (~15 Hz)
    this.hostCombatTickTimer = window.setInterval(() => {
      if (!bridge.multiplayer.isHost || !this.hostRoom) return;
      const changed = tickCoopRoomCombat(this.hostRoom, Date.now());
      if (changed) {
        this.broadcastHostCombatSnapshot();
      }
    }, 66);

    // 3. Colony passive production, timed constructions, tech & dust storms (~2 Hz)
    this.hostWorldTickTimer = window.setInterval(() => {
      if (!bridge.multiplayer.isHost || !this.hostRoom) return;
      const res = tickCoopRoom(this.hostRoom, Date.now());
      if (res.changed) {
        this.pushHostSyncState();
        if (res.completedNames.length > 0) {
          this.broadcastHostColonySync({
            kind: 'build',
            label: `Obra concluída: ${res.completedNames.join(', ')}`,
            byPlayer: 'Colônia',
          });
        } else if (res.completedTechName) {
          this.broadcastHostColonySync({
            kind: 'tech',
            label: `Tecnologia desbloqueada: ${res.completedTechName}`,
            byPlayer: 'Laboratório',
          });
        } else if (res.stormEvent === 'started') {
          this.broadcastHostColonySync({
            kind: 'combat',
            label: 'Tempestade de Poeira! Matrizes Solares em -50%',
            byPlayer: 'Clima',
          });
        } else if (res.stormEvent === 'ended') {
          this.broadcastHostColonySync({
            kind: 'build',
            label: 'Tempestade de Poeira dissipada!',
            byPlayer: 'Clima',
          });
        } else {
          this.broadcastHostColonySync();
        }
      }
    }, 500);

    // 4. Keep Playgama room lobby properties fresh (~every 5s)
    this.hostPropsSyncTimer = window.setInterval(() => {
      if (!bridge.multiplayer.isHost || !this.hostRoom) return;
      const rolesStr = getRoomRoleIds(this.hostRoom).join(',');
      bridge.multiplayer.setRoomProperties({
        hostName: this.localName,
        habitability: Math.round(this.hostRoom.colonyState.habitability),
        threatsEnabled: this.hostRoom.colonyState.threatsEnabled,
        roles: rolesStr,
      });
    }, 5000);
  }

  private stopHostLoops() {
    if (this.hostPlayersSnapshotTimer !== null) {
      clearInterval(this.hostPlayersSnapshotTimer);
      this.hostPlayersSnapshotTimer = null;
    }
    if (this.hostCombatTickTimer !== null) {
      clearInterval(this.hostCombatTickTimer);
      this.hostCombatTickTimer = null;
    }
    if (this.hostWorldTickTimer !== null) {
      clearInterval(this.hostWorldTickTimer);
      this.hostWorldTickTimer = null;
    }
    if (this.hostPropsSyncTimer !== null) {
      clearInterval(this.hostPropsSyncTimer);
      this.hostPropsSyncTimer = null;
    }
  }

  private pushHostSyncState() {
    if (!this.hostRoom || !bridge.multiplayer.isHost) return;
    const world = serializeCoopRoomForSync(this.hostRoom);
    this.lastKnownWorld = world;
    bridge.multiplayer.setSyncState(world as unknown as Record<string, unknown>);
  }

  private broadcastHostPlayersSnapshot() {
    if (!this.hostRoom) return;
    const players = Array.from(this.hostRoom.players.values());
    if (!this.isDisposed) {
      this.callbacks.onPlayersSnapshot(players);
    }
    if (bridge.multiplayer.players.length > 1) {
      bridge.multiplayer.send(
        'players:snapshot',
        { players },
        { to: MULTIPLAYER_TARGET.OTHERS }
      );
    }
  }

  private broadcastHostCombatSnapshot() {
    if (!this.hostRoom) return;
    const enemies = this.hostRoom.enemies;
    const bolts = this.hostRoom.bolts;
    if (!this.isDisposed) {
      this.callbacks.onCombatSnapshot(enemies, bolts);
    }
    if (bridge.multiplayer.players.length > 1) {
      bridge.multiplayer.send(
        'combat:snapshot',
        { enemies, bolts },
        { to: MULTIPLAYER_TARGET.OTHERS }
      );
    }
  }

  private broadcastHostColonySync(event?: ColonySyncEventPayload) {
    if (!this.hostRoom) return;
    const payload = {
      colonyState: this.hostRoom.colonyState,
      collectedResourceIds: Array.from(this.hostRoom.collectedResourceIds),
      plantedPlots: Array.from(this.hostRoom.plantedPlots),
      event,
    };
    if (!this.isDisposed) {
      this.callbacks.onColonySync(payload);
    }
    if (bridge.multiplayer.players.length > 1) {
      bridge.multiplayer.send('colony:sync', payload, {
        to: MULTIPLAYER_TARGET.OTHERS,
      });
    }
  }
}
