/**
 * Colonize Mars - Main Application
 * 60FPS ref-driven simulation loop (zero 60Hz React re-renders),
 * 6 Eras / 12 Missions, Complexity-Timed Constructions, 8 Technologies [T],
 * Martian Threats & Plasma Combat [F]/Click, Orbital Contracts, and 3-Player WebSocket Co-op.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { MarsSurfaceScene, InteractiveTriggerZone } from './graphics/MarsSurfaceScene';
import { MarsColonyHUD } from './components/MarsColonyHUD';
import { TouchControls } from './components/TouchControls';
import { FloatingBillboards, ResourcePopupItem } from './components/FloatingBillboards';
import { CutsceneOverlay } from './components/CutsceneOverlay';
import { TitleLobbyOverlay } from './components/TitleLobbyOverlay';
import { TechTreeModal } from './components/TechTreeModal';
import { PauseModal, VictoryModal, GameOverModal } from './components/StatusModals';
import { soundManager } from './audio/soundManager';
import {
  BuildingKey,
  ColonyState,
  CONSTRUCTION_CONFIGS,
  INITIAL_OBJECTIVES,
  TECH_CATALOG,
  TechId,
  createInitialColonyState,
  startConstruction,
  advanceConstructions,
  boostConstruction,
  startTechResearch,
  advanceTechResearch,
  stepColonyDustStorm,
  forceTriggerDustStorm,
  progressContract,
  updateColonyTick,
} from './sim/marsColonyLogic';
import {
  MarsEnemy,
  PlasmaBolt,
  EnemyKind,
  createEnemy,
  createPlasmaBolt,
  stepEnemiesAndCombat,
} from './sim/marsEnemies';
import {
  AstronautRoleId,
  computeActivePlayerStats,
  getAstronautRole,
} from './sim/astronautRoles';
import { computeCoopSiteActionBoost } from './sim/coopActionBoost';
import { CoopClient } from './net/coopClient';
import { RemotePlayerState } from './net/coopProtocol';

type GameState = 'title' | 'cutscene' | 'playing' | 'paused' | 'gameover';
type InputDeviceType = 'keyboard' | 'touch' | 'gamepad';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MarsSurfaceScene | null>(null);
  const coopClientRef = useRef<CoopClient | null>(null);

  // Ref-backed simulation state
  const gameStateRef = useRef<GameState>('title');
  const colonyStateRef = useRef<ColonyState>(createInitialColonyState(true));
  const plantedPlotsRef = useRef<number[]>([]);
  const enemiesRef = useRef<MarsEnemy[]>([]);
  const boltsRef = useRef<PlasmaBolt[]>([]);
  const turretCooldownRef = useRef<number>(0);
  const enemySpawnTimerRef = useRef<number>(14);
  const lastShotTimeRef = useRef<number>(0);
  const turretFiredAtRef = useRef<{ x: number; y: number; z: number } | null>(null);

  const isTechModalOpenRef = useRef<boolean>(false);
  const isCoopModeRef = useRef<boolean>(false);
  const coopSelfIdRef = useRef<string | null>(null);
  const coopPlayersRef = useRef<RemotePlayerState[]>([]);
  const selectedRoleRef = useRef<AstronautRoleId>('engineer');
  const lastActionPressMsRef = useRef<number>(0);
  const victoryTriggeredRef = useRef<boolean>(false);
  const forceHudSyncRef = useRef<boolean>(false);

  // React UI States (throttled ~8Hz or discrete event)
  const [gameState, setGameState] = useState<GameState>('title');
  const [selectedRole, setSelectedRole] = useState<AstronautRoleId>('engineer');
  const [hudColonyState, setHudColonyState] = useState<ColonyState>(colonyStateRef.current);
  const [jetpackFuel, setJetpackFuel] = useState<number>(100);
  const [activeEnemiesCount, setActiveEnemiesCount] = useState<number>(0);
  const [activeTrigger, setActiveTrigger] = useState<InteractiveTriggerZone | null>(null);
  const [projectionKey, setProjectionKey] = useState<number>(0);
  const [resourcePopups, setResourcePopups] = useState<ResourcePopupItem[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [threatsEnabledPref, setThreatsEnabledPref] = useState<boolean>(true);
  const [isVictory, setIsVictory] = useState<boolean>(false);
  const [gameOverReason, setGameOverReason] = useState<string>('');
  const [isTechModalOpen, setIsTechModalOpen] = useState<boolean>(false);
  const [activeInputDevice, setActiveInputDevice] = useState<InputDeviceType>('keyboard');
  const [isTouchSupported, setIsTouchSupported] = useState<boolean>(false);

  // Co-op & Event Banner States
  const [coopRoomCode, setCoopRoomCode] = useState<string | null>(null);
  const [coopPlayers, setCoopPlayers] = useState<RemotePlayerState[]>([]);
  const [coopEventBanner, setCoopEventBanner] = useState<string | null>(null);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Input refs
  const keyboardMovement = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchMovement = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const activeKeys = useRef<Set<string>>(new Set());
  const jumpJustPressedRef = useRef<boolean>(false);
  const jumpHeldRef = useRef<boolean>(false);
  const jetpackHeldRef = useRef<boolean>(false);
  const wasGamepadJumpRef = useRef<boolean>(false);
  const wasGamepadActionRef = useRef<boolean>(false);
  const wasGamepadShootRef = useRef<boolean>(false);

  const setSyncedGameState = useCallback((next: GameState) => {
    gameStateRef.current = next;
    setGameState(next);
  }, []);

  const setSyncedTechModal = useCallback((open: boolean) => {
    isTechModalOpenRef.current = open;
    setIsTechModalOpen(open);
  }, []);

  const showBanner = useCallback((text: string) => {
    setCoopEventBanner(text);
    window.setTimeout(() => {
      setCoopEventBanner((cur) => (cur === text ? null : cur));
    }, 3400);
  }, []);

  const currentObjective =
    hudColonyState.stage < INITIAL_OBJECTIVES.length
      ? INITIAL_OBJECTIVES[hudColonyState.stage]
      : null;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouchSupported(isTouch);
      if (isTouch) setActiveInputDevice('touch');
    }
  }, []);

  useEffect(() => {
    if (resourcePopups.length === 0) return;
    const timer = window.setInterval(() => {
      const now = performance.now();
      setResourcePopups((prev) => prev.filter((p) => now - p.timestamp < 1150));
    }, 220);
    return () => clearInterval(timer);
  }, [resourcePopups.length]);

  const spawnPickupPopup = useCallback((type: 'regolith' | 'ice', worldPos: THREE.Vector3) => {
    const scene = sceneRef.current;
    let screenX = window.innerWidth / 2;
    let screenY = window.innerHeight / 2;
    if (scene && scene.camera) {
      const proj = worldPos.clone().project(scene.camera);
      if (proj.z >= -1 && proj.z <= 1) {
        screenX = (proj.x * 0.5 + 0.5) * window.innerWidth;
        screenY = (-(proj.y * 0.5) + 0.5) * window.innerHeight;
      }
    }
    const isReg = type === 'regolith';
    setResourcePopups((prev) => [
      ...prev.slice(-6),
      {
        id: `pop-${performance.now()}-${Math.random()}`,
        text: isReg ? '+1 Regolito' : '+1 Gelo',
        color: isReg ? '#f59e0b' : '#38bdf8',
        screenX,
        screenY,
        timestamp: performance.now(),
      },
    ]);
  }, []);

  // Resource Collection
  const handleResourceCollected = useCallback(
    (resourceId: string, type: 'regolith' | 'ice', worldPos: THREE.Vector3) => {
      soundManager.playResourcePickup(type);
      spawnPickupPopup(type, worldPos);

      if (isCoopModeRef.current && coopClientRef.current) {
        coopClientRef.current.emitResourceCollect(resourceId, type);
        return;
      }

      const prev = colonyStateRef.current;
      let next: ColonyState = {
        ...prev,
        regolith: type === 'regolith' ? prev.regolith + 1 : prev.regolith,
        waterIce: type === 'ice' ? prev.waterIce + 1 : prev.waterIce,
      };
      if (type === 'regolith') {
        const res = progressContract(next, 'collect-regolith', 1);
        next = res.state;
        if (res.completedContractTitle) {
          soundManager.playMissionComplete();
          showBanner(`Contrato concluído: ${res.completedContractTitle}`);
        }
      }
      colonyStateRef.current = next;
      forceHudSyncRef.current = true;
    },
    [showBanner, spawnPickupPopup]
  );

  // Play build/plant completion audio + check victory
  const handleCompletedProjects = useCallback(
    (completedIds: string[], state: ColonyState) => {
      for (const id of completedIds) {
        const cfg = CONSTRUCTION_CONFIGS[id];
        if (id === 'trigger-water') soundManager.playWaterCreate();
        else if (id.startsWith('trigger-plant-')) soundManager.playPlantSprout();
        else if (id === 'trigger-terraform') soundManager.playMissionComplete();
        else soundManager.playBuildComplete();

        if (cfg) {
          showBanner(`Obra concluída: ${cfg.name}`);
        }
      }

      if (state.buildings.terraformer && !victoryTriggeredRef.current) {
        victoryTriggeredRef.current = true;
        setIsVictory(true);
        setHudColonyState(state);
        setSyncedGameState('gameover');
      }
    },
    [setSyncedGameState, showBanner]
  );

  // Timed Construction Start / Boost / Module Repair
  const handleTriggerAction = useCallback(
    (triggerId: string) => {
      if (triggerId === 'trigger-open-tech') {
        setSyncedTechModal(true);
        return;
      }

      // Repair damaged module
      if (triggerId.startsWith('trigger-repair-')) {
        const key = triggerId.replace('trigger-repair-', '') as BuildingKey;
        if (isCoopModeRef.current && coopClientRef.current) {
          soundManager.playRepairTick();
          coopClientRef.current.emitRepairBuilding(key);
          return;
        }
        const cur = colonyStateRef.current;
        const curHp = cur.buildingHealth[key];
        if (cur.buildings[key] && curHp < 100) {
          soundManager.playRepairTick();
          const repairMult = getAstronautRole(selectedRoleRef.current).modifiers.repairAmountMultiplier;
          const repairGain = Math.round(28 * repairMult);
          const newHp = Math.min(100, curHp + repairGain);
          let next: ColonyState = {
            ...cur,
            buildingHealth: { ...cur.buildingHealth, [key]: newHp },
          };
          if (newHp >= 100) {
            const prog = progressContract(next, 'repair-module', 1);
            next = prog.state;
            if (prog.completedContractTitle) {
              soundManager.playMissionComplete();
              showBanner(`Contrato concluído: ${prog.completedContractTitle}`);
            }
          }
          colonyStateRef.current = next;
          forceHudSyncRef.current = true;
        }
        return;
      }

      // Co-op delegates start / boost to server
      if (isCoopModeRef.current && coopClientRef.current) {
        soundManager.playClick();
        coopClientRef.current.emitTriggerComplete(triggerId);
        return;
      }

      const cur = colonyStateRef.current;
      const roleId = selectedRoleRef.current;
      const buildMult = getAstronautRole(roleId).modifiers.buildSpeedMultiplier;

      // Boost if already in activeConstructions
      if (cur.activeConstructions.some((c) => c.id === triggerId)) {
        soundManager.playClick();
        const boosted = boostConstruction(cur, triggerId, plantedPlotsRef.current, 1.5 * buildMult, [roleId]);
        colonyStateRef.current = boosted.state;
        plantedPlotsRef.current = boosted.nextPlantedPlots;
        forceHudSyncRef.current = true;
        if (boosted.completedIds.length > 0) {
          handleCompletedProjects(boosted.completedIds, boosted.state);
        }
        return;
      }

      // Otherwise start new complexity-timed construction
      const started = startConstruction(triggerId, cur, plantedPlotsRef.current);
      if (started.started) {
        soundManager.playClick();
        colonyStateRef.current = started.state;
        forceHudSyncRef.current = true;
        const cfg = CONSTRUCTION_CONFIGS[triggerId];
        if (cfg) {
          showBanner(`Obra iniciada: ${cfg.name} (${cfg.complexity} · ${cfg.durationSec}s)`);
        }
      }
    },
    [handleCompletedProjects, setSyncedTechModal, showBanner]
  );

  // Fire Plasma Pulse ([F], Left-Click, Touch Pulse, Gamepad B)
  const firePlasmaPulse = useCallback((customDirX?: number, customDirZ?: number) => {
    if (gameStateRef.current !== 'playing' || isTechModalOpenRef.current) return;
    const scene = sceneRef.current;
    if (!scene) return;

    const now = performance.now();
    const roleMods = getAstronautRole(selectedRoleRef.current).modifiers;
    const hasMk2 = colonyStateRef.current.unlockedTechs.includes('tech-pulse');
    const cooldownMs = Math.round((hasMk2 ? 170 : 270) * roleMods.plasmaCooldownMultiplier);
    if (now - lastShotTimeRef.current < cooldownMs) return;
    lastShotTimeRef.current = now;

    const dir =
      customDirX !== undefined && customDirZ !== undefined
        ? { dirX: customDirX, dirZ: customDirZ }
        : scene.getSmartAimDirection(enemiesRef.current);

    soundManager.playLaserPulse();

    if (isCoopModeRef.current && coopClientRef.current) {
      coopClientRef.current.emitShoot(
        scene.playerPos.x,
        scene.playerPos.y + 1.05,
        scene.playerPos.z,
        dir.dirX,
        dir.dirZ
      );
      return;
    }

    const bolt = createPlasmaBolt(
      scene.playerPos.x,
      scene.playerPos.y + 1.05,
      scene.playerPos.z,
      dir.dirX,
      dir.dirZ,
      hasMk2,
      false,
      roleMods.combatDamageMultiplier
    );
    boltsRef.current.push(bolt);
  }, []);

  // Tech Research (Timed, accelerated by Scientist class)
  const handleResearchTech = useCallback(
    (techId: TechId) => {
      if (isCoopModeRef.current && coopClientRef.current) {
        soundManager.playClick();
        coopClientRef.current.emitTechResearch(techId);
        return;
      }
      const started = startTechResearch(techId, colonyStateRef.current);
      if (started.started) {
        soundManager.playClick();
        colonyStateRef.current = started.state;
        forceHudSyncRef.current = true;
        setHudColonyState(started.state);
        const techDef = TECH_CATALOG.find((t) => t.id === techId);
        if (techDef) {
          showBanner(`Pesquisa iniciada: ${techDef.name}`);
        }
      }
    },
    [showBanner]
  );

  // Instant Action (E / Enter / Touch Action / Gamepad X)
  const handleInstantAction = useCallback(() => {
    lastActionPressMsRef.current = performance.now();
    const scene = sceneRef.current;
    if (!scene || !scene.currentTrigger) return;
    const trigger = scene.currentTrigger;
    if (trigger.id === 'trigger-open-tech') {
      setSyncedTechModal(true);
      return;
    }
    if (trigger.hasRequirements) {
      handleTriggerAction(trigger.id);
    }
  }, [handleTriggerAction, setSyncedTechModal]);

  // Toggle Threats vs Peaceful Mode mid-game
  const handleToggleThreats = useCallback(() => {
    const nextEnabled = !colonyStateRef.current.threatsEnabled;
    if (isCoopModeRef.current && coopClientRef.current) {
      coopClientRef.current.emitToggleThreats(nextEnabled);
      return;
    }
    colonyStateRef.current = {
      ...colonyStateRef.current,
      threatsEnabled: nextEnabled,
    };
    if (!nextEnabled) {
      enemiesRef.current = [];
      boltsRef.current = [];
      setActiveEnemiesCount(0);
    }
    forceHudSyncRef.current = true;
    showBanner(nextEnabled ? 'Ameaças Marcianas Ativadas!' : 'Modo Pacífico Ativado');
  }, [showBanner]);

  // Start Solo Mission
  const startSoloMission = useCallback(
    (skipCutscene = false) => {
      isCoopModeRef.current = false;
      coopSelfIdRef.current = null;
      setCoopRoomCode(null);
      setCoopPlayers([]);
      victoryTriggeredRef.current = false;
      plantedPlotsRef.current = [];
      enemiesRef.current = [];
      boltsRef.current = [];
      turretCooldownRef.current = 0;
      enemySpawnTimerRef.current = 14;
      setActiveEnemiesCount(0);

      const roleDef = getAstronautRole(selectedRoleRef.current);
      colonyStateRef.current = createInitialColonyState(threatsEnabledPref, [roleDef.id]);
      setHudColonyState(colonyStateRef.current);
      setIsVictory(false);
      setSyncedTechModal(false);

      const scene = sceneRef.current;
      if (scene) {
        scene.setLocalSuitAccent(roleDef.accentHex);
        scene.resetCollectibles();
        scene.resetPlayerPosition(0);
        if (skipCutscene) {
          scene.skipCutscene();
          setSyncedGameState('playing');
        } else {
          scene.startCutscene();
          setSyncedGameState('cutscene');
        }
      } else {
        setSyncedGameState(skipCutscene ? 'playing' : 'cutscene');
      }
    },
    [setSyncedGameState, setSyncedTechModal, threatsEnabledPref]
  );

  const handleExitToLobby = useCallback(() => {
    if (coopClientRef.current) {
      coopClientRef.current.leaveRoom();
    }
    isCoopModeRef.current = false;
    coopSelfIdRef.current = null;
    enemiesRef.current = [];
    boltsRef.current = [];
    setCoopRoomCode(null);
    setCoopPlayers([]);
    setIsVictory(false);
    setSyncedTechModal(false);
    setSyncedGameState('title');
  }, [setSyncedGameState, setSyncedTechModal]);

  // Cooperative WebSocket Client
  useEffect(() => {
    const client = new CoopClient({
      onJoined: (payload) => {
        setIsConnecting(false);
        setLobbyError(null);
        isCoopModeRef.current = true;
        coopSelfIdRef.current = payload.selfId;
        victoryTriggeredRef.current = payload.colonyState.buildings.terraformer;

        colonyStateRef.current = payload.colonyState;
        plantedPlotsRef.current = payload.plantedPlots;
        enemiesRef.current = payload.enemies || [];
        boltsRef.current = payload.bolts || [];
        setActiveEnemiesCount(enemiesRef.current.length);

        setCoopRoomCode(payload.roomCode);
        coopPlayersRef.current = payload.players;
        setCoopPlayers(payload.players);
        setHudColonyState(payload.colonyState);

        const selfPlayer = payload.players.find((p) => p.id === payload.selfId);
        const joinedRole = selfPlayer?.roleId || selectedRoleRef.current;
        selectedRoleRef.current = joinedRole;
        setSelectedRole(joinedRole);
        const roleDef = getAstronautRole(joinedRole);

        const scene = sceneRef.current;
        if (scene) {
          scene.setLocalSuitAccent(selfPlayer?.suitColorHex || roleDef.accentHex);
          scene.resetCollectibles();
          scene.applyCollectedResourceIds(payload.collectedResourceIds);
          scene.resetPlayerPosition(payload.selfSlot);
          scene.syncRemotePlayers(payload.players, payload.selfId);
          scene.isCutscene = false;
        }
        soundManager.playBuildComplete();
        setSyncedGameState('playing');
        showBanner(
          `Sala ${payload.roomCode} (${payload.players.length}/3) · Classe: ${roleDef.name}`
        );
      },
      onError: (msg) => {
        setIsConnecting(false);
        setLobbyError(msg);
      },
      onPlayerJoined: (player) => {
        showBanner(`${player.name} pousou em Marte!`);
      },
      onPlayerLeft: () => {
        showBanner('Um astronauta deixou a colônia.');
      },
      onPlayersSnapshot: (players) => {
        coopPlayersRef.current = players;
        setCoopPlayers(players);
        sceneRef.current?.syncRemotePlayers(players, coopSelfIdRef.current);
      },
      onCombatSnapshot: (enemies, bolts) => {
        enemiesRef.current = enemies;
        boltsRef.current = bolts;
      },
      onColonySync: (payload) => {
        const localO2 = colonyStateRef.current.oxygen;
        const localO2Max = payload.colonyState.oxygenMax;
        const merged: ColonyState = {
          ...payload.colonyState,
          oxygen: Math.min(localO2Max, payload.event?.kind === 'build' ? localO2Max : localO2),
        };
        colonyStateRef.current = merged;
        plantedPlotsRef.current = payload.plantedPlots;
        sceneRef.current?.applyCollectedResourceIds(payload.collectedResourceIds);
        forceHudSyncRef.current = true;
        setHudColonyState(merged);

        if (payload.event) {
          if (payload.event.kind === 'build') soundManager.playBuildComplete();
          else if (payload.event.kind === 'tech') soundManager.playTechUnlock();
          else if (payload.event.kind === 'plant') soundManager.playPlantSprout();
          else if (payload.event.kind === 'repair') soundManager.playRepairTick();
          else if (payload.event.kind === 'combat') soundManager.playEnemyHit(true);
          showBanner(`${payload.event.byPlayer}: ${payload.event.label}`);
        }

        if (merged.buildings.terraformer && !victoryTriggeredRef.current) {
          victoryTriggeredRef.current = true;
          soundManager.playMissionComplete();
          setIsVictory(true);
          setSyncedGameState('gameover');
        }
      },
      onConnectionChange: () => {},
    });

    coopClientRef.current = client;
    return () => {
      client.dispose();
      coopClientRef.current = null;
    };
  }, [setSyncedGameState, showBanner]);

  const handleCreateCoopRoom = useCallback(
    async (playerName: string, roleId: AstronautRoleId) => {
      selectedRoleRef.current = roleId;
      setSelectedRole(roleId);
      setLobbyError(null);
      setIsConnecting(true);
      try {
        await coopClientRef.current?.createRoom(playerName, threatsEnabledPref, roleId);
      } catch (err) {
        setIsConnecting(false);
        setLobbyError(err instanceof Error ? err.message : 'Erro ao criar sala.');
      }
    },
    [threatsEnabledPref]
  );

  const handleJoinCoopRoom = useCallback(
    async (roomCode: string, playerName: string, roleId: AstronautRoleId) => {
      selectedRoleRef.current = roleId;
      setSelectedRole(roleId);
      setLobbyError(null);
      setIsConnecting(true);
      try {
        await coopClientRef.current?.joinRoom(roomCode, playerName, roleId);
      } catch (err) {
        setIsConnecting(false);
        setLobbyError(err instanceof Error ? err.message : 'Erro ao entrar na sala.');
      }
    },
    []
  );

  // Stable callback refs for Scene construction
  const onResourceRef = useRef(handleResourceCollected);
  onResourceRef.current = handleResourceCollected;
  const onTriggerRef = useRef(handleTriggerAction);
  onTriggerRef.current = handleTriggerAction;
  const onOpenTechRef = useRef(() => setSyncedTechModal(true));
  const onCanvasShootRef = useRef(firePlasmaPulse);
  onCanvasShootRef.current = firePlasmaPulse;

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new MarsSurfaceScene({
      container: mountRef.current,
      onCutsceneEnd: () => {
        setSyncedGameState('playing');
        soundManager.playMissionComplete();
      },
      onResourceCollected: (id, type, pos) => onResourceRef.current(id, type, pos),
      onTriggerCompleted: (id) => onTriggerRef.current(id),
      onOpenTechModal: () => onOpenTechRef.current(),
      onCanvasShoot: (dx, dz) => onCanvasShootRef.current(dx, dz),
    });
    sceneRef.current = scene;

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      startSoloMission(true);
      if (params.get('storm') === '1') {
        const seeded = {
          ...colonyStateRef.current,
          buildings: {
            ...colonyStateRef.current.buildings,
            moxie: true,
            solarPanels: true,
          },
          buildingHealth: {
            ...colonyStateRef.current.buildingHealth,
            moxie: 62,
            solarPanels: 38,
          },
        };
        colonyStateRef.current = forceTriggerDustStorm(seeded, [selectedRoleRef.current]);
        setHudColonyState(colonyStateRef.current);
      }
    }

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [setSyncedGameState, startSoloMission]);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      soundManager.setMuted(next);
      return next;
    });
  }, []);

  const handleSkipCutscene = useCallback(() => {
    sceneRef.current?.skipCutscene();
    setSyncedGameState('playing');
    soundManager.playMissionComplete();
  }, [setSyncedGameState]);

  // Keyboard Listeners
  useEffect(() => {
    const updateKeyboardVector = () => {
      let x = 0;
      let y = 0;
      const keys = activeKeys.current;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;

      const mag = Math.hypot(x, y);
      if (mag > 0) {
        x /= mag;
        y /= mag;
      }
      keyboardMovement.current = { x, y };
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      setActiveInputDevice('keyboard');
      activeKeys.current.add(e.code);

      const curState = gameStateRef.current;

      if (curState === 'title' && e.code === 'Enter') {
        startSoloMission(false);
        return;
      }

      if (e.code === 'KeyT' && curState === 'playing') {
        setSyncedTechModal(!isTechModalOpenRef.current);
        return;
      }

      if (e.code === 'KeyM') {
        handleToggleMute();
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (isTechModalOpenRef.current) {
          setSyncedTechModal(false);
        } else if (curState === 'playing') {
          setSyncedGameState('paused');
        } else if (curState === 'paused') {
          setSyncedGameState('playing');
        }
        return;
      }

      if (curState === 'cutscene' && (e.code === 'Space' || e.code === 'Enter')) {
        handleSkipCutscene();
        return;
      }

      if (curState === 'playing') {
        if (e.code === 'Space') {
          if (!jumpHeldRef.current) {
            jumpJustPressedRef.current = true;
          }
          jumpHeldRef.current = true;
        }
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
          jetpackHeldRef.current = true;
        }
        if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'NumpadEnter') {
          handleInstantAction();
        }
        if (e.code === 'KeyF') {
          firePlasmaPulse();
        }
      }

      updateKeyboardVector();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      activeKeys.current.delete(e.code);
      if (e.code === 'Space') {
        jumpHeldRef.current = false;
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        jetpackHeldRef.current = false;
      }
      updateKeyboardVector();
    };

    const handleBlur = () => {
      activeKeys.current.clear();
      jumpHeldRef.current = false;
      jetpackHeldRef.current = false;
      keyboardMovement.current = { x: 0, y: 0 };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [
    firePlasmaPulse,
    handleInstantAction,
    handleSkipCutscene,
    handleToggleMute,
    setSyncedGameState,
    setSyncedTechModal,
    startSoloMission,
  ]);

  // Ref-driven 60FPS Simulation Loop
  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();
    let totalTime = 0;
    let lastHudSyncMs = 0;

    const tick = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.15);
      totalTime += dt;

      const scene = sceneRef.current;
      if (!scene) {
        animId = requestAnimationFrame(tick);
        return;
      }

      const curGameState = gameStateRef.current;

      if (curGameState === 'title') {
        scene.updateTitleFlyby(totalTime);
        scene.syncColonyStructures(colonyStateRef.current, plantedPlotsRef.current, totalTime);
        scene.render();
        animId = scene.scheduleNextFrame(tick);
        return;
      }

      if (curGameState === 'cutscene') {
        scene.updateCutscene(dt);
        scene.syncColonyStructures(colonyStateRef.current, plantedPlotsRef.current, totalTime);
        scene.render();
        animId = scene.scheduleNextFrame(tick);
        return;
      }

      if (curGameState === 'paused' || curGameState === 'gameover') {
        scene.render();
        animId = scene.scheduleNextFrame(tick);
        return;
      }

      // Gamepad + Keyboard + Touch Polling
      let gpX = 0;
      let gpY = 0;
      let gpJump = false;
      let gpAction = false;
      let gpShoot = false;

      if (typeof navigator !== 'undefined' && navigator.getGamepads) {
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
          const gp = gamepads[i];
          if (gp && gp.connected) {
            const ax = gp.axes[0] || 0;
            const ay = gp.axes[1] || 0;
            if (Math.abs(ax) > 0.15) gpX = ax;
            if (Math.abs(ay) > 0.15) gpY = ay;
            if (gp.buttons[14]?.pressed) gpX = -1;
            if (gp.buttons[15]?.pressed) gpX = 1;
            if (gp.buttons[12]?.pressed) gpY = -1;
            if (gp.buttons[13]?.pressed) gpY = 1;
            if (gp.buttons[0]?.pressed) gpJump = true;
            if (gp.buttons[2]?.pressed) gpAction = true;
            if (gp.buttons[1]?.pressed || gp.buttons[7]?.pressed) gpShoot = true;

            if (Math.abs(gpX) > 0.1 || Math.abs(gpY) > 0.1 || gpJump || gpAction || gpShoot) {
              setActiveInputDevice('gamepad');
            }
            break;
          }
        }
      }

      if (gpJump && !wasGamepadJumpRef.current) jumpJustPressedRef.current = true;
      wasGamepadJumpRef.current = gpJump;

      if (gpAction && !wasGamepadActionRef.current) handleInstantAction();
      wasGamepadActionRef.current = gpAction;

      if (gpShoot && !wasGamepadShootRef.current) firePlasmaPulse();
      wasGamepadShootRef.current = gpShoot;

      const inputVector = {
        x: gpX || touchMovement.current.x || keyboardMovement.current.x,
        y: gpY || touchMovement.current.y || keyboardMovement.current.y,
      };

      const jumpJust = jumpJustPressedRef.current;
      jumpJustPressedRef.current = false;
      const jumpHeld = gpJump || jumpHeldRef.current;
      const jetpackHeld = jetpackHeldRef.current;

      let camOrbit = 0;
      if (activeKeys.current.has('KeyQ')) camOrbit -= 1;
      if (activeKeys.current.has('KeyR')) camOrbit += 1;

      const activeRoleId = selectedRoleRef.current;

      const physResult = scene.updatePlayerPhysics(
        inputVector,
        jumpJust,
        jumpHeld,
        jetpackHeld,
        camOrbit,
        colonyStateRef.current,
        dt,
        totalTime,
        activeRoleId
      );
      if (physResult.jumped) {
        soundManager.playJumpThruster();
      }

      // Co-op Remote Sync
      if (isCoopModeRef.current) {
        scene.updateRemotePlayers(dt, totalTime);
        const isActionActive =
          activeKeys.current.has('KeyE') ||
          activeKeys.current.has('Enter') ||
          now - lastActionPressMsRef.current <= 1200;
        coopClientRef.current?.emitMove({
          x: scene.physicsBody.x,
          y: scene.physicsBody.y,
          z: scene.physicsBody.z,
          yaw: scene.physicsBody.yaw,
          vx: scene.physicsBody.vx,
          vz: scene.physicsBody.vz,
          isMoving: Math.hypot(scene.physicsBody.vx, scene.physicsBody.vz) > 0.35,
          isGrounded: scene.physicsBody.isGrounded,
          isJetpacking: scene.physicsBody.isJetpacking,
          activeTriggerId: scene.currentTrigger?.id || null,
          isActionPressed: isActionActive,
        });
      }

      // Magnet Pickups & Proximity Trigger Zones
      scene.updateInteractiveSystems(
        colonyStateRef.current,
        plantedPlotsRef.current,
        !isCoopModeRef.current,
        dt,
        totalTime,
        activeRoleId
      );

      // Solo Mode: Timed Constructions, Timed Tech Research, Enemies, Combat & Colony Production
      turretFiredAtRef.current = null;
      const curState = colonyStateRef.current;
      const dLander = Math.hypot(scene.playerPos.x, scene.playerPos.z);
      const dBioDome = Math.hypot(scene.playerPos.x, scene.playerPos.z + 19);
      const dHabitat = Math.hypot(scene.playerPos.x + 11, scene.playerPos.z - 12);
      const isNearO2 =
        dLander < 9.5 ||
        (curState.buildings.moxie && dLander < 14.5) ||
        (curState.buildings.bioDome && dBioDome < 8.0) ||
        (curState.buildings.habitat && dHabitat < 9.0) ||
        curState.buildings.terraformer;

      if (isCoopModeRef.current) {
        let nextO2 = curState.oxygen;
        if (isNearO2) {
          nextO2 = Math.min(curState.oxygenMax, nextO2 + 22 * dt);
        } else {
          const drainMult = curState.buildings.moxie ? 0.55 : 1.0;
          nextO2 = Math.max(0, nextO2 - 0.65 * drainMult * dt);
        }
        colonyStateRef.current = {
          ...curState,
          oxygen: nextO2,
          isNearO2Source: isNearO2,
        };
      } else {
        // 1. Advance active timed constructions (player standing in zone gives role-weighted worker power)
        let workingState = curState;
        if (workingState.activeConstructions.length > 0) {
          const workerPowerBySite: Record<string, number> = {};
          if (scene.currentTrigger?.isConstructionActive) {
            workerPowerBySite[scene.currentTrigger.id] =
              getAstronautRole(activeRoleId).modifiers.buildSpeedMultiplier;
          }
          const adv = advanceConstructions(
            workingState,
            plantedPlotsRef.current,
            dt,
            workerPowerBySite,
            [activeRoleId]
          );
          workingState = adv.state;
          plantedPlotsRef.current = adv.nextPlantedPlots;
          if (adv.completedIds.length > 0) {
            forceHudSyncRef.current = true;
            handleCompletedProjects(adv.completedIds, workingState);
          }
        }

        // 2. Advance timed tech research (Scientist class accelerates speed)
        if (workingState.activeTechResearch) {
          const techAdv = advanceTechResearch(workingState, dt, [activeRoleId]);
          workingState = techAdv.state;
          if (techAdv.completedTechId) {
            soundManager.playTechUnlock();
            forceHudSyncRef.current = true;
            const techDef = TECH_CATALOG.find((t) => t.id === techAdv.completedTechId);
            showBanner(`Tecnologia desbloqueada: ${techDef?.name || techAdv.completedTechId}`);
          }
        }

        // 3. Passive O2, Water, Auto-Miner, Biomass & Sol Day tick
        workingState = updateColonyTick(workingState, dt, isNearO2);

        // 4. Dynamic Weather: Martian Dust Storm lifecycle & module degradation
        const stormStep = stepColonyDustStorm(workingState, dt, [activeRoleId]);
        workingState = stormStep.state;
        if (stormStep.stormStarted) {
          soundManager.playAlertWarning();
          forceHudSyncRef.current = true;
          showBanner('Alerta Climático: Tempestade de Poeira! Matrizes Solares em -50%');
        } else if (stormStep.stormEnded) {
          forceHudSyncRef.current = true;
          showBanner('Tempestade de Poeira dissipada. Energia solar restaurada!');
        }

        // 3. Enemy Wave Spawning & Combat Simulation
        if (workingState.threatsEnabled && workingState.stage >= 2) {
          const maxEnemies = Math.min(5, 2 + Math.floor(workingState.stage / 3));
          enemySpawnTimerRef.current -= dt;
          if (enemySpawnTimerRef.current <= 0 && enemiesRef.current.length < maxEnemies) {
            const angle = Math.random() * Math.PI * 2;
            const r = 33 + Math.random() * 6;
            const kinds: EnemyKind[] =
              workingState.stage >= 7
                ? ['crawler', 'drone', 'brute']
                : workingState.stage >= 4
                ? ['crawler', 'drone']
                : ['crawler'];
            const kind = kinds[Math.floor(Math.random() * kinds.length)];
            const newEnemy = createEnemy(
              kind,
              Math.cos(angle) * r,
              Math.sin(angle) * r,
              `enemy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
            );
            enemiesRef.current.push(newEnemy);
            soundManager.playAlertWarning();
            const label =
              kind === 'brute'
                ? 'Colosso de Basalto'
                : kind === 'drone'
                ? 'Drone Pirata'
                : 'Rastejador de Sílica';
            showBanner(`Alerta de Invasão: ${label} detectado!`);
            enemySpawnTimerRef.current = Math.max(12, 22 - workingState.stage);
          }

          if (enemiesRef.current.length > 0 || boltsRef.current.length > 0) {
            const step = stepEnemiesAndCombat({
              enemies: enemiesRef.current,
              bolts: boltsRef.current,
              colonyState: workingState,
              playerPos: scene.playerPos,
              turretCooldown: turretCooldownRef.current,
              dt,
            });
            enemiesRef.current = step.result.enemies;
            boltsRef.current = step.result.bolts;
            turretCooldownRef.current = step.nextTurretCooldown;
            turretFiredAtRef.current = step.result.turretFiredAt;

            if (step.result.playerO2Damage > 0) {
              workingState = {
                ...workingState,
                oxygen: Math.max(0, workingState.oxygen - step.result.playerO2Damage),
              };
            }

            const damagedKeys = Object.keys(step.result.buildingDamage) as BuildingKey[];
            if (damagedKeys.length > 0) {
              const nextHp = { ...workingState.buildingHealth };
              for (const k of damagedKeys) {
                nextHp[k] = Math.max(10, nextHp[k] - (step.result.buildingDamage[k] || 0));
              }
              workingState = { ...workingState, buildingHealth: nextHp };
            }

            if (step.result.kills.length > 0) {
              soundManager.playEnemyHit(true);
              let nextKillState = { ...workingState };
              for (const k of step.result.kills) {
                nextKillState.regolith += k.regolith;
                nextKillState.waterIce += k.ice;
                nextKillState.biomass += k.biomass;
                nextKillState.enemiesDefeated += 1;
                const prog = progressContract(nextKillState, 'kill-enemies', 1);
                nextKillState = prog.state;
                if (prog.completedContractTitle) {
                  soundManager.playMissionComplete();
                  showBanner(`Contrato concluído: ${prog.completedContractTitle}`);
                }
              }
              workingState = nextKillState;
              forceHudSyncRef.current = true;
            }
          }
        } else if (!workingState.threatsEnabled && enemiesRef.current.length > 0) {
          enemiesRef.current = [];
          boltsRef.current = [];
        }

        colonyStateRef.current = workingState;
      }

      // Sync 3D Structures, Scaffolding & Combat Visuals
      scene.syncColonyStructures(colonyStateRef.current, plantedPlotsRef.current, totalTime);
      scene.syncCombatEntities(
        enemiesRef.current,
        boltsRef.current,
        turretFiredAtRef.current,
        dt,
        totalTime
      );

      // Low O2 Warning & Asphyxia Check
      const afterTick = colonyStateRef.current;
      if (afterTick.oxygen < 25 && afterTick.oxygen > 0) {
        soundManager.playLowO2Warning();
      }
      if (afterTick.oxygen <= 0 && !afterTick.isSandboxMode) {
        soundManager.playLowO2Warning();
        setGameOverReason('Asfixia: O suprimento de oxigênio do traje esgotou.');
        setIsVictory(false);
        setHudColonyState(afterTick);
        setSyncedGameState('gameover');
      }

      // Throttled React HUD Sync (~8Hz or immediate on discrete change)
      if (forceHudSyncRef.current || now - lastHudSyncMs >= 120) {
        forceHudSyncRef.current = false;
        lastHudSyncMs = now;
        setHudColonyState(colonyStateRef.current);
        setJetpackFuel(scene.jetpackFuel);
        setActiveEnemiesCount(enemiesRef.current.length);
        if (scene.currentTrigger) {
          let coopAssistLabel: string | null = null;
          if (isCoopModeRef.current && coopPlayersRef.current.length > 1) {
            const localPressing =
              activeKeys.current.has('KeyE') ||
              activeKeys.current.has('Enter') ||
              now - lastActionPressMsRef.current <= 1200;
            const snapshot = coopPlayersRef.current.map((p) =>
              p.id === coopSelfIdRef.current
                ? {
                    ...p,
                    activeTriggerId: scene.currentTrigger?.id || null,
                    isActionPressed: localPressing,
                  }
                : { ...p, lastActionAtMs: p.isActionPressed ? Date.now() : 0 }
            );
            const boostInfo = computeCoopSiteActionBoost(
              snapshot,
              scene.currentTrigger.id,
              Date.now(),
              localPressing ? coopSelfIdRef.current || undefined : undefined
            );
            coopAssistLabel = boostInfo.label;
          }
          setActiveTrigger({ ...scene.currentTrigger, coopAssistLabel });
        } else {
          setActiveTrigger(null);
        }
        setProjectionKey((k) => k + 1);
      }

      scene.render();
      animId = scene.scheduleNextFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(animId);
    };
  }, [firePlasmaPulse, handleCompletedProjects, handleInstantAction, setSyncedGameState, showBanner]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* 1. Three.js Canvas Mount */}
      <div ref={mountRef} className="absolute inset-0 z-0 cursor-crosshair active:cursor-grabbing" />

      {/* 2. Title & 3-Player Co-op Lobby */}
      {gameState === 'title' && (
        <TitleLobbyOverlay
          isMuted={isMuted}
          threatsEnabled={threatsEnabledPref}
          selectedRole={selectedRole}
          onSelectRole={(roleId) => {
            selectedRoleRef.current = roleId;
            setSelectedRole(roleId);
          }}
          onToggleThreatsPref={() => setThreatsEnabledPref((v) => !v)}
          onToggleMute={handleToggleMute}
          onStartSolo={() => startSoloMission(false)}
          onCreateCoopRoom={handleCreateCoopRoom}
          onJoinCoopRoom={handleJoinCoopRoom}
          lobbyError={lobbyError}
          isConnecting={isConnecting}
        />
      )}

      {/* 3. Opening Cutscene Overlay */}
      {gameState === 'cutscene' && <CutsceneOverlay onSkip={handleSkipCutscene} />}

      {/* 4. Floating 3D Proximity Billboards & Pickup Popups */}
      {gameState === 'playing' && (
        <FloatingBillboards
          camera={sceneRef.current?.camera || null}
          activeTrigger={activeTrigger}
          popups={resourcePopups}
          projectionKey={projectionKey}
        />
      )}

      {/* 5. Main HUD */}
      {gameState === 'playing' && (
        <MarsColonyHUD
          colonyState={hudColonyState}
          currentObjective={currentObjective}
          playerRoleId={selectedRole}
          jetpackFuel={jetpackFuel}
          activeEnemiesCount={activeEnemiesCount}
          isMuted={isMuted}
          activeInputDevice={activeInputDevice}
          coopRoomCode={coopRoomCode}
          coopPlayers={coopPlayers}
          coopEventBanner={coopEventBanner}
          onToggleMute={handleToggleMute}
          onToggleThreats={handleToggleThreats}
          onPause={() => setSyncedGameState('paused')}
          onOpenTechTree={() => setSyncedTechModal(true)}
        />
      )}

      {/* 6. Mobile & Tablet Touch Controls */}
      {gameState === 'playing' && isTouchSupported && (
        <TouchControls
          onMoveChange={(vec) => {
            touchMovement.current = vec;
            if (vec.x !== 0 || vec.y !== 0) setActiveInputDevice('touch');
          }}
          onJumpPress={(pressed) => {
            if (pressed && !jumpHeldRef.current) {
              jumpJustPressedRef.current = true;
            }
            jumpHeldRef.current = pressed;
            if (pressed) setActiveInputDevice('touch');
          }}
          onActionPress={() => {
            setActiveInputDevice('touch');
            handleInstantAction();
          }}
          onShootPress={() => {
            setActiveInputDevice('touch');
            firePlasmaPulse();
          }}
          hasActiveTrigger={Boolean(activeTrigger?.hasRequirements)}
        />
      )}

      {/* 7. Technology Tree Modal [T] */}
      {gameState === 'playing' && isTechModalOpen && (
        <TechTreeModal
          colonyState={hudColonyState}
          researchSpeedPct={
            computeActivePlayerStats(
              selectedRole,
              hudColonyState.unlockedTechs,
              coopPlayers.length > 0 ? coopPlayers.map((p) => p.roleId) : [selectedRole]
            ).researchSpeedPct
          }
          onResearchTech={handleResearchTech}
          onClose={() => setSyncedTechModal(false)}
        />
      )}

      {/* 8. Pause Modal */}
      {gameState === 'paused' && (
        <PauseModal
          isCoop={Boolean(coopRoomCode)}
          onResume={() => setSyncedGameState('playing')}
          onRestart={() => startSoloMission(true)}
          onExitToLobby={handleExitToLobby}
        />
      )}

      {/* 9. Victory Modal (100% Terraformed World) */}
      {gameState === 'gameover' && isVictory && (
        <VictoryModal
          colonyState={hudColonyState}
          onContinueSandbox={() => {
            if (isCoopModeRef.current) {
              coopClientRef.current?.emitSandboxEnable();
            } else {
              colonyStateRef.current = { ...colonyStateRef.current, isSandboxMode: true };
            }
            setIsVictory(false);
            setSyncedGameState('playing');
          }}
          onExitToLobby={handleExitToLobby}
        />
      )}

      {/* 10. Game Over Modal (Oxygen Depletion) */}
      {gameState === 'gameover' && !isVictory && (
        <GameOverModal
          reason={gameOverReason}
          onRestart={() => {
            if (isCoopModeRef.current) {
              colonyStateRef.current = { ...colonyStateRef.current, oxygen: colonyStateRef.current.oxygenMax };
              sceneRef.current?.resetPlayerPosition(0);
              setSyncedGameState('playing');
            } else {
              startSoloMission(true);
            }
          }}
        />
      )}
    </div>
  );
}
