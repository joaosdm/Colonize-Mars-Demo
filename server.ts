/**
 * Colonize Mars - Full-Stack Express + Vite + WebSocket Co-op Server
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  CoopRoom,
  createCoopRoom,
  addPlayerToRoom,
  setPlayerRoleInRoom,
  recomputeRoomEnergy,
  applyRoomResourceCollect,
  applyRoomTriggerComplete,
  applyRoomRepairBuilding,
  applyRoomPlayerShoot,
  applyRoomTechResearch,
  applyRoomMissionControlReroll,
  tickCoopRoomCombat,
  tickCoopRoom,
} from './src/net/coopRoomState';
import type {
  ClientToServerMessage,
  ServerToClientMessage,
  RoomSummary,
} from './src/net/coopProtocol';
import { MAX_COOP_PLAYERS } from './src/net/coopProtocol';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

interface ClientMeta {
  ws: WebSocket;
  playerId: string;
  roomCode: string | null;
}

const rooms = new Map<string, CoopRoom>();
const clients = new Map<WebSocket, ClientMeta>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = 'M';
    for (let i = 0; i < 3; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return 'M' + Math.floor(100 + Math.random() * 899);
}

function sendJson(ws: WebSocket, payload: ServerToClientMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastToRoom(roomCode: string, payload: ServerToClientMessage, excludeWs?: WebSocket) {
  const msg = JSON.stringify(payload);
  for (const [, client] of clients) {
    if (client.roomCode === roomCode && client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  }
}

function broadcastColonySync(
  room: CoopRoom,
  event?: {
    kind: 'resource' | 'build' | 'tech' | 'plant' | 'combat' | 'repair';
    label: string;
    byPlayer: string;
  }
) {
  broadcastToRoom(room.code, {
    type: 'colony:sync',
    colonyState: room.colonyState,
    collectedResourceIds: Array.from(room.collectedResourceIds),
    plantedPlots: Array.from(room.plantedPlots),
    event,
  });
}

function leaveCurrentRoom(meta: ClientMeta) {
  if (!meta.roomCode) return;
  const room = rooms.get(meta.roomCode);
  if (room) {
    room.players.delete(meta.playerId);
    broadcastToRoom(room.code, { type: 'player:left', playerId: meta.playerId }, meta.ws);
    if (room.players.size === 0) {
      rooms.delete(room.code);
    } else {
      recomputeRoomEnergy(room);
      broadcastColonySync(room);
    }
  }
  meta.roomCode = null;
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const server = http.createServer(app);

  app.get('/api/rooms', (_req, res) => {
    const list: RoomSummary[] = [];
    for (const [code, room] of rooms) {
      if (room.players.size > 0) {
        const playersArr = Array.from(room.players.values());
        list.push({
          code,
          playerCount: room.players.size,
          maxPlayers: MAX_COOP_PLAYERS,
          habitability: Math.round(room.colonyState.habitability),
          hostName: playersArr[0]?.name || 'Comandante',
          roles: playersArr.map((p) => p.roleId),
        });
      }
    }
    res.json({ rooms: list });
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: !isHmrDisabled,
        ws: { server, path: '/vite-hmr' },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.get('/playgama-bridge-config.json', (_req, res, next) => {
      const token = (
        process.env.PLAYGAMA_PUBLIC_TOKEN ||
        process.env.VITE_PLAYGAMA_PUBLIC_TOKEN ||
        ''
      ).trim();
      if (token) {
        res.json({ saas: { publicToken: token } });
        return;
      }
      next();
    });
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(
      request.url || '/',
      `http://${request.headers.host || 'localhost'}`
    ).pathname;
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws) => {
    const playerId = 'p-' + Math.random().toString(36).slice(2, 10);
    const meta: ClientMeta = { ws, playerId, roomCode: null };
    clients.set(ws, meta);

    ws.on('message', (raw) => {
      let msg: ClientToServerMessage;
      try {
        msg = JSON.parse(String(raw)) as ClientToServerMessage;
      } catch {
        return;
      }

      if (msg.type === 'room:create') {
        leaveCurrentRoom(meta);
        const requested = msg.customCode?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
        const code = requested && requested.length >= 3 && !rooms.has(requested) ? requested : generateRoomCode();
        const room = createCoopRoom(code, msg.threatsEnabled !== false);
        rooms.set(code, room);

        const joined = addPlayerToRoom(room, meta.playerId, msg.playerName, msg.roleId);
        if (!joined.ok) {
          sendJson(ws, { type: 'room:error', message: joined.error });
          return;
        }
        meta.roomCode = code;

        sendJson(ws, {
          type: 'room:joined',
          roomCode: code,
          selfId: meta.playerId,
          selfSlot: joined.player.slot,
          colonyState: room.colonyState,
          collectedResourceIds: Array.from(room.collectedResourceIds),
          plantedPlots: Array.from(room.plantedPlots),
          players: Array.from(room.players.values()),
          enemies: room.enemies,
          bolts: room.bolts,
        });
        return;
      }

      if (msg.type === 'room:join') {
        leaveCurrentRoom(meta);
        const code = msg.roomCode.trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          sendJson(ws, { type: 'room:error', message: `Sala "${code}" não encontrada.` });
          return;
        }

        const joined = addPlayerToRoom(room, meta.playerId, msg.playerName, msg.roleId);
        if (!joined.ok) {
          sendJson(ws, { type: 'room:error', message: joined.error });
          return;
        }
        meta.roomCode = code;

        sendJson(ws, {
          type: 'room:joined',
          roomCode: code,
          selfId: meta.playerId,
          selfSlot: joined.player.slot,
          colonyState: room.colonyState,
          collectedResourceIds: Array.from(room.collectedResourceIds),
          plantedPlots: Array.from(room.plantedPlots),
          players: Array.from(room.players.values()),
          enemies: room.enemies,
          bolts: room.bolts,
        });

        broadcastToRoom(code, { type: 'player:joined', player: joined.player }, ws);
        broadcastColonySync(room);
        return;
      }

      if (msg.type === 'room:leave') {
        leaveCurrentRoom(meta);
        return;
      }

      if (!meta.roomCode) return;
      const room = rooms.get(meta.roomCode);
      if (!room) return;
      const player = room.players.get(meta.playerId);
      if (!player) return;

      if (msg.type === 'player:move') {
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
        if (player.isActionPressed) {
          player.lastActionAtMs = Date.now();
        }
        return;
      }

      if (msg.type === 'resource:collect') {
        const added = applyRoomResourceCollect(room, msg.resourceId, msg.resourceType);
        if (added) {
          const labelMap: Record<string, string> = {
            regolith: '+1 Regolito',
            ice: '+1 Gelo',
            iron: '+1 Ferro (Fe)',
            titanium: '+1 Titânio (Ti)',
            silicon: '+1 Silício (Si)',
            sulfur: '+1 Enxofre (S)',
          };
          broadcastColonySync(room, {
            kind: 'resource',
            label: labelMap[msg.resourceType] || '+1 Recurso',
            byPlayer: player.name,
          });
        }
        return;
      }

      if (msg.type === 'role:change') {
        const res = setPlayerRoleInRoom(room, meta.playerId, msg.roleId);
        if (res.changed && res.player) {
          broadcastToRoom(room.code, {
            type: 'players:snapshot',
            players: Array.from(room.players.values()),
          });
          broadcastColonySync(room, {
            kind: 'tech',
            label: `Classe alterada para ${res.player.roleName}`,
            byPlayer: res.player.name,
          });
        }
        return;
      }

      if (msg.type === 'trigger:complete') {
        const res = applyRoomTriggerComplete(
          room,
          msg.triggerId,
          player.roleId,
          player.id,
          Date.now()
        );
        if (res.changed) {
          broadcastColonySync(room, {
            kind: res.isPlant ? 'plant' : 'build',
            label: res.label,
            byPlayer: player.name,
          });
        }
        return;
      }

      if (msg.type === 'building:repair') {
        const res = applyRoomRepairBuilding(
          room,
          msg.buildingKey,
          player.roleId,
          player.id,
          Date.now()
        );
        if (res.changed) {
          broadcastColonySync(room, {
            kind: 'repair',
            label: res.label,
            byPlayer: player.name,
          });
        }
        return;
      }

      if (msg.type === 'player:shoot') {
        applyRoomPlayerShoot(room, msg.x, msg.y, msg.z, msg.dirX, msg.dirZ, player.roleId);
        return;
      }

      if (msg.type === 'tech:research') {
        const res = applyRoomTechResearch(room, msg.techId);
        if (res.changed) {
          broadcastColonySync(room, {
            kind: 'tech',
            label: res.label,
            byPlayer: player.name,
          });
        }
        return;
      }

      if (msg.type === 'mission-control:reroll') {
        const res = applyRoomMissionControlReroll(room);
        if (res.changed) {
          broadcastColonySync(room, {
            kind: 'build',
            label: res.label,
            byPlayer: player.name,
          });
        }
        return;
      }

      if (msg.type === 'threats:toggle') {
        room.colonyState = { ...room.colonyState, threatsEnabled: msg.enabled };
        broadcastColonySync(room, {
          kind: 'combat',
          label: msg.enabled ? 'Ameaças Marcianas Ativadas' : 'Modo Pacífico Ativado',
          byPlayer: player.name,
        });
        return;
      }

      if (msg.type === 'sandbox:enable') {
        room.colonyState = { ...room.colonyState, isSandboxMode: true };
        broadcastColonySync(room);
      }
    });

    ws.on('close', () => {
      leaveCurrentRoom(meta);
      clients.delete(ws);
    });
  });

  // 20Hz player snapshot, combat tick & construction/resource tick
  setInterval(() => {
    const now = Date.now();
    for (const [, room] of rooms) {
      if (room.players.size === 0) continue;

      broadcastToRoom(room.code, {
        type: 'players:snapshot',
        players: Array.from(room.players.values()),
      });

      if (tickCoopRoomCombat(room, now)) {
        broadcastToRoom(room.code, {
          type: 'combat:snapshot',
          enemies: room.enemies,
          bolts: room.bolts,
        });
      }

      const tickRes = tickCoopRoom(room, now);
      if (tickRes.changed) {
        const event =
          tickRes.stormEvent === 'started'
            ? {
                kind: 'combat' as const,
                label: 'Tempestade de Poeira! Matrizes Solares em -50% — repare módulos!',
                byPlayer: 'Clima de Marte',
              }
            : tickRes.stormEvent === 'ended'
            ? {
                kind: 'build' as const,
                label: 'Tempestade de Poeira dissipada. Energia solar normalizada!',
                byPlayer: 'Clima de Marte',
              }
            : tickRes.completedNames.length > 0
            ? {
                kind: 'build' as const,
                label: `Construção Concluída: ${tickRes.completedNames.join(', ')}`,
                byPlayer: 'Colônia',
              }
            : tickRes.completedTechName
            ? {
                kind: 'tech' as const,
                label: `Pesquisa Concluída: ${tickRes.completedTechName}`,
                byPlayer: 'Laboratório',
              }
            : undefined;
        broadcastColonySync(room, event);
      }
    }
  }, 50);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Colonize Mars server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Colonize Mars server:', err);
  process.exit(1);
});
