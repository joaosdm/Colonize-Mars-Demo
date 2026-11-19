/**
 * Colonize Mars - Main Application
 * 60FPS ref-driven simulation loop (zero 60Hz React re-renders),
 * 6 Eras / 12 Missions, Complexity-Timed Constructions, 8 Technologies [T],
 * Martian Threats & Plasma Combat [F]/Click, Orbital Contracts, and 3-Player WebSocket Co-op.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  MarsSurfaceScene,
  InteractiveTriggerZone,
  CameraMode,
} from './graphics/MarsSurfaceScene';
import type { ResourceNodeKind } from './graphics/colonyStructures';
import { MarsColonyHUD } from './components/MarsColonyHUD';
import { TouchControls } from './components/TouchControls';
import { FloatingBillboards, ResourcePopupItem } from './components/FloatingBillboards';
import { CutsceneOverlay } from './components/CutsceneOverlay';
import { TitleLobbyOverlay } from './components/TitleLobbyOverlay';
import { TechTreeModal } from './components/TechTreeModal';
import { MissionControlModal } from './components/MissionControlModal';
import { ColonyWorkshopModal, WorkshopTab } from './components/ColonyWorkshopModal';
import { OrbitalExplorerModal } from './components/OrbitalExplorerModal';
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
  applyMissionControlProgress,
  rerollColonyMissionControl,
  excavateCraterAt,
  plantDomeCrop,
  harvestDomeCrop,
  consumeFoodRation,
  runColonyRefineryRecipe,
  craftColonyWeapon,
  equipColonyWeapon,
  discoverPlanetarySite,
  updateColonyTick,
} from './sim/marsColonyLogic';
import {
  MarsEnemy,
  PlasmaBolt,
  EnemyKind,
  ENEMY_ARCHETYPES,
  createEnemy,
  createWeaponVolley,
  stepEnemiesAndCombat,
} from './sim/marsEnemies';
import { applyBuildingCombatDamage } from './sim/buildingDurability';
import { BUILDING_DISPLAY_NAMES } from './sim/marsWeather';
import { getWeaponDef, WeaponId } from './sim/marsChemistry';
import type { CropTypeId } from './sim/marsWorld';
import {
  AstronautRoleId,
  computeActivePlayerStats,
  getAstronautRole,
} from './sim/astronautRoles';
import { computeCoopSiteActionBoost } from './sim/coopActionBoost';
import {
  AdaptivePerformanceMonitor,
  DeviceProfile,
  QualityPreset,
  TouchControlsMode,
  readBrowserDeviceProfile,
  resolveQualityConfig,
  shouldShowTouchControls,
} from './sim/devicePerformance';
import {
  PlaygamaMultiplayerClient,
  type PlaygamaMultiplayerStatus,
} from './net/playgamaMultiplayerClient';
import { RemotePlayerState, RoomSummary } from './net/coopProtocol';

type GameState = 'title' | 'cutscene' | 'playing' | 'paused' | 'gameover';
type InputDeviceType = 'keyboard' | 'touch' | 'gamepad';

function readStoredQualityPreset(): QualityPreset {
  try {
    const saved = window.localStorage.getItem('mars_quality_preset');
    if (saved === 'auto' || saved === 'low' || saved === 'medium' || saved === 'high') {
      return saved;
    }
  } catch {
    // Ignore storage restrictions inside sandboxed web game portal iframes
  }
  return 'auto';
}

function readStoredTouchMode(): TouchControlsMode {
  try {
    const saved = window.localStorage.getItem('mars_touch_mode');
    if (saved === 'auto' || saved === 'always' || saved === 'hidden') {
      return saved;
    }
  } catch {
    // Ignore storage restrictions
  }
  return 'auto';
}

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MarsSurfaceScene | null>(null);
  const coopClientRef = useRef<PlaygamaMultiplayerClient | null>(null);

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
  const isMissionControlOpenRef = useRef<boolean>(false);
  const isWorkshopOpenRef = useRef<boolean>(false);
  const isOrbitalOpenRef = useRef<boolean>(false);
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
  const [hudPlayerPos, setHudPlayerPos] = useState<{ x: number; z: number }>({ x: 0, z: 6.5 });
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
  const [isMissionControlOpen, setIsMissionControlOpen] = useState<boolean>(false);
  const [isWorkshopOpen, setIsWorkshopOpen] = useState<boolean>(false);
  const [workshopTab, setWorkshopTab] = useState<WorkshopTab>('refinery');
  const [isOrbitalOpen, setIsOrbitalOpen] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('third-person');
  const [activeInputDevice, setActiveInputDevice] = useState<InputDeviceType>('keyboard');
  const [deviceProfile, setDeviceProfile] = useState<DeviceProfile>(() => readBrowserDeviceProfile());
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>(() => readStoredQualityPreset());
  const [touchControlsMode, setTouchControlsMode] = useState<TouchControlsMode>(() => readStoredTouchMode());
  const perfMonitorRef = useRef<AdaptivePerformanceMonitor>(
    new AdaptivePerformanceMonitor(1.25, 0.75, 1.75, true)
  );
  const hudSyncIntervalMsRef = useRef<number>(125);

  const resolvedQualityConfig = resolveQualityConfig(
    qualityPreset,
    deviceProfile,
    sceneRef.current?.isSoftwareGl ?? false
  );
  hudSyncIntervalMsRef.current = resolvedQualityConfig.hudSyncIntervalMs;

  const isTouchControlsVisible = shouldShowTouchControls(touchControlsMode, deviceProfile);
  const isMobileLayout = deviceProfile.isMobile || deviceProfile.isCompactScreen || isTouchControlsVisible;

  // Co-op (Playgama Bridge) & Event Banner States
  const [playgamaStatus, setPlaygamaStatus] = useState<PlaygamaMultiplayerStatus>({
    isInitialized: false,
    isSupported: false,
    isInviteSupported: false,
    state: 'disconnected',
    isHost: false,
    region: null,
    regions: [],
    launchRoomId: null,
  });
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

  const closeAllOverlays = useCallback(() => {
    isTechModalOpenRef.current = false;
    setIsTechModalOpen(false);
    isMissionControlOpenRef.current = false;
    setIsMissionControlOpen(false);
    isWorkshopOpenRef.current = false;
    setIsWorkshopOpen(false);
    isOrbitalOpenRef.current = false;
    setIsOrbitalOpen(false);
  }, []);

  const setSyncedTechModal = useCallback(
    (open: boolean) => {
      if (open) closeAllOverlays();
      isTechModalOpenRef.current = open;
      setIsTechModalOpen(open);
    },
    [closeAllOverlays]
  );

  const setSyncedMissionControlModal = useCallback(
    (open: boolean) => {
      if (open) closeAllOverlays();
      isMissionControlOpenRef.current = open;
      setIsMissionControlOpen(open);
    },
    [closeAllOverlays]
  );

  const setSyncedWorkshopModal = useCallback(
    (open: boolean, tab?: WorkshopTab) => {
      if (open) closeAllOverlays();
      if (tab) setWorkshopTab(tab);
      isWorkshopOpenRef.current = open;
      setIsWorkshopOpen(open);
    },
    [closeAllOverlays]
  );

  const setSyncedOrbitalModal = useCallback(
    (open: boolean) => {
      if (open) {
        closeAllOverlays();
        soundManager.playOrbitalLaunch();
      }
      isOrbitalOpenRef.current = open;
      setIsOrbitalOpen(open);
    },
    [closeAllOverlays]
  );

  const showBanner = useCallback((text: string) => {
    setCoopEventBanner(text);
    window.setTimeout(() => {
      setCoopEventBanner((cur) => (cur === text ? null : cur));
    }, 3400);
  }, []);

  useEffect(() => {
    document.body.dataset.cameraMode = cameraMode;
  }, [cameraMode]);

  useEffect(() => {
    document.body.dataset.gameState = gameState;
  }, [gameState]);

  useEffect(() => {
    document.body.dataset.playgamaReady = String(playgamaStatus.isInitialized);
    document.body.dataset.playgamaSupported = String(playgamaStatus.isSupported);
  }, [playgamaStatus.isInitialized, playgamaStatus.isSupported]);

  const handleToggleCameraMode = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const next = scene.toggleCameraMode();
    soundManager.playClick();
    showBanner(
      next === 'first-person'
        ? 'Visão 1ª Pessoa (Combate) · [X] alternar'
        : 'Visão Normal (3ª Pessoa) · [X] alternar'
    );
  }, [showBanner]);

  const currentObjective =
    hudColonyState.stage < INITIAL_OBJECTIVES.length
      ? INITIAL_OBJECTIVES[hudColonyState.stage]
      : null;

  useEffect(() => {
    const syncDevice = () => {
      const next = readBrowserDeviceProfile();
      setDeviceProfile(next);
      if (next.isTouchPrimary) setActiveInputDevice('touch');
    };
    syncDevice();
    window.addEventListener('resize', syncDevice);
    window.addEventListener('orientationchange', syncDevice);
    return () => {
      window.removeEventListener('resize', syncDevice);
      window.removeEventListener('orientationchange', syncDevice);
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const cfg = resolveQualityConfig(qualityPreset, deviceProfile, scene.isSoftwareGl);
    scene.applyQualityConfig(cfg);
    perfMonitorRef.current.reconfigure(
      Math.min(window.devicePixelRatio || 1, cfg.pixelRatioCap),
      cfg.minDynamicPixelRatio,
      Math.min(window.devicePixelRatio || 1, cfg.pixelRatioCap),
      qualityPreset === 'auto' && !scene.isSoftwareGl
    );
  }, [qualityPreset, deviceProfile]);

  const handleChangeQualityPreset = useCallback((next: QualityPreset) => {
    setQualityPreset(next);
    try {
      window.localStorage.setItem('mars_quality_preset', next);
    } catch {
      // Ignore storage errors inside sandboxed iframes
    }
  }, []);

  const handleChangeTouchControlsMode = useCallback((next: TouchControlsMode) => {
    setTouchControlsMode(next);
    try {
      window.localStorage.setItem('mars_touch_mode', next);
    } catch {
      // Ignore storage errors
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

  const spawnPickupPopup = useCallback((type: ResourceNodeKind, worldPos: THREE.Vector3) => {
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
    const styleMap: Record<ResourceNodeKind, { text: string; color: string }> = {
      regolith: { text: '+1 Regolito', color: '#f59e0b' },
      ice: { text: '+1 Gelo', color: '#38bdf8' },
      iron: { text: '+1 Ferro (Fe)', color: '#fb923c' },
      titanium: { text: '+1 Titânio (Ti)', color: '#c084fc' },
      silicon: { text: '+1 Silício (Si)', color: '#2dd4bf' },
      sulfur: { text: '+1 Enxofre (S)', color: '#facc15' },
    };
    const style = styleMap[type] || styleMap.regolith;
    setResourcePopups((prev) => [
      ...prev.slice(-6),
      {
        id: `pop-${performance.now()}-${Math.random()}`,
        text: style.text,
        color: style.color,
        screenX,
        screenY,
        timestamp: performance.now(),
      },
    ]);
  }, []);

  // Resource & Mineral Vein Collection
  const handleResourceCollected = useCallback(
    (resourceId: string, type: ResourceNodeKind, worldPos: THREE.Vector3) => {
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
        iron: type === 'iron' ? prev.iron + 1 : prev.iron,
        titanium: type === 'titanium' ? prev.titanium + 1 : prev.titanium,
        silicon: type === 'silicon' ? prev.silicon + 1 : prev.silicon,
        sulfur: type === 'sulfur' ? prev.sulfur + 1 : prev.sulfur,
      };
      if (type === 'regolith') {
        const res = progressContract(next, 'collect-regolith', 1);
        next = res.state;
        if (res.completedContractTitle) {
          soundManager.playMissionComplete();
          showBanner(`Contrato concluído: ${res.completedContractTitle}`);
        }
      }
      if (type === 'regolith' || type === 'ice') {
        const mcRes = applyMissionControlProgress(
          next,
          type === 'regolith' ? 'gather-regolith' : 'gather-ice',
          1
        );
        next = mcRes.state;
        if (mcRes.completedDailyTitles.length > 0) {
          soundManager.playMissionComplete();
          showBanner(`Objetivo Diário Concluído: ${mcRes.completedDailyTitles[0]}`);
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
      if (triggerId === 'trigger-open-mission-control') {
        setSyncedMissionControlModal(true);
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
            const mcProg = applyMissionControlProgress(next, 'repair-modules', 1);
            next = mcProg.state;
            if (mcProg.completedDailyTitles.length > 0) {
              soundManager.playMissionComplete();
              showBanner(`Objetivo Diário Concluído: ${mcProg.completedDailyTitles[0]}`);
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
    [handleCompletedProjects, setSyncedMissionControlModal, setSyncedTechModal, showBanner]
  );

  // Fire Equipped Weapon ([F], Left-Click, Touch Pulse, Gamepad B)
  const firePlasmaPulse = useCallback((customDirX?: number, customDirZ?: number) => {
    if (
      gameStateRef.current !== 'playing' ||
      isTechModalOpenRef.current ||
      isMissionControlOpenRef.current ||
      isWorkshopOpenRef.current ||
      isOrbitalOpenRef.current
    ) {
      return;
    }
    const scene = sceneRef.current;
    if (!scene) return;

    const now = performance.now();
    const roleMods = getAstronautRole(selectedRoleRef.current).modifiers;
    const hasMk2 = colonyStateRef.current.unlockedTechs.includes('tech-pulse');
    const weaponDef = getWeaponDef(colonyStateRef.current.equippedWeapon);
    const cooldownMs = Math.round(
      weaponDef.cooldownMs * (hasMk2 ? 0.78 : 1.0) * roleMods.plasmaCooldownMultiplier
    );
    if (now - lastShotTimeRef.current < cooldownMs) return;
    lastShotTimeRef.current = now;

    const dir =
      customDirX !== undefined && customDirZ !== undefined
        ? { dirX: customDirX, dirZ: customDirZ }
        : scene.cameraMode === 'first-person'
        ? scene.getCameraForwardDirection()
        : scene.getSmartAimDirection(enemiesRef.current);

    const { drewFromBack } = scene.triggerWeaponDrawAndFire(weaponDef.id, dir);
    if (drewFromBack) {
      soundManager.playWeaponDraw();
    }
    soundManager.playWeaponFire(weaponDef.id);

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

    const volley = createWeaponVolley({
      x: scene.playerPos.x,
      y: scene.playerPos.y + 1.05,
      z: scene.playerPos.z,
      dirX: dir.dirX,
      dirZ: dir.dirZ,
      weaponId: weaponDef.id,
      hasPulseMk2: hasMk2,
      damageMultiplier: roleMods.combatDamageMultiplier,
    });
    boltsRef.current.push(...volley);
  }, []);

  // Excavate 3D Crater & Extract Biome Minerals ([G])
  const handleExcavateCrater = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    const scene = sceneRef.current;
    if (!scene) return;
    const res = excavateCraterAt(
      colonyStateRef.current,
      scene.playerPos.x,
      scene.playerPos.z
    );
    if (!res.ok) {
      showBanner(res.summaryText);
      return;
    }
    colonyStateRef.current = res.state;
    forceHudSyncRef.current = true;
    setHudColonyState(res.state);
    soundManager.playCraterDrill();
    scene.emitExcavationBurst(scene.playerPos.x, scene.playerPos.z);
    showBanner(res.summaryText);
  }, [showBanner]);

  // Chemical Refinery Extraction
  const handleRunRefineryRecipe = useCallback(
    (recipeId: string) => {
      const res = runColonyRefineryRecipe(colonyStateRef.current, recipeId);
      if (res.ok) {
        soundManager.playRefinerySynth();
        colonyStateRef.current = res.state;
        forceHudSyncRef.current = true;
        setHudColonyState(res.state);
      }
      showBanner(res.label);
    },
    [showBanner]
  );

  // Craft & Equip Weapons
  const handleCraftWeapon = useCallback(
    (weaponId: WeaponId) => {
      const res = craftColonyWeapon(colonyStateRef.current, weaponId);
      if (res.crafted) {
        soundManager.playBuildComplete();
        colonyStateRef.current = res.state;
        forceHudSyncRef.current = true;
        setHudColonyState(res.state);
      }
      showBanner(res.label);
    },
    [showBanner]
  );

  const handleEquipWeapon = useCallback(
    (weaponId: WeaponId) => {
      const res = equipColonyWeapon(colonyStateRef.current, weaponId);
      if (res.equipped) {
        soundManager.playClick();
        colonyStateRef.current = res.state;
        sceneRef.current?.setEquippedWeapon(weaponId);
        forceHudSyncRef.current = true;
        setHudColonyState(res.state);
        showBanner(`Arma equipada: ${getWeaponDef(weaponId).name}`);
      }
    },
    [showBanner]
  );

  // Glass-Dome Food Farming & Consumption
  const handlePlantDomeCrop = useCallback(
    (bedIndex: number, cropId: CropTypeId) => {
      const res = plantDomeCrop(colonyStateRef.current, bedIndex, cropId);
      if (res.ok) {
        soundManager.playPlantSprout();
        colonyStateRef.current = res.state;
        forceHudSyncRef.current = true;
        setHudColonyState(res.state);
      }
      showBanner(res.label);
    },
    [showBanner]
  );

  const handleHarvestDomeCrop = useCallback(
    (bedIndex: number) => {
      const res = harvestDomeCrop(colonyStateRef.current, bedIndex);
      if (res.ok) {
        soundManager.playBuildComplete();
        colonyStateRef.current = res.state;
        forceHudSyncRef.current = true;
        setHudColonyState(res.state);
      }
      showBanner(res.label);
    },
    [showBanner]
  );

  const handleConsumeFood = useCallback(() => {
    const res = consumeFoodRation(colonyStateRef.current);
    if (res.ok) {
      soundManager.playEatRation();
      colonyStateRef.current = res.state;
      forceHudSyncRef.current = true;
      setHudColonyState(res.state);
    }
    showBanner(res.label);
  }, [showBanner]);

  // Orbital Planetary Site Discovery
  const handleScanOrbitalSite = useCallback(
    (siteId: string) => {
      const res = discoverPlanetarySite(colonyStateRef.current, siteId);
      if (res.discovered) {
        soundManager.playMissionComplete();
        colonyStateRef.current = res.state;
        forceHudSyncRef.current = true;
        setHudColonyState(res.state);
      }
      showBanner(res.label);
    },
    [showBanner]
  );

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

  // Reroll Daily Objectives in Habitat Mission Control Terminal
  const handleRerollMissionControl = useCallback(() => {
    if (isCoopModeRef.current && coopClientRef.current) {
      soundManager.playClick();
      coopClientRef.current.emitMissionControlReroll();
      return;
    }
    const res = rerollColonyMissionControl(colonyStateRef.current);
    if (res.rerolled) {
      soundManager.playClick();
      colonyStateRef.current = res.state;
      forceHudSyncRef.current = true;
      setHudColonyState(res.state);
      showBanner('Mission Control: 3 novos objetivos diários gerados!');
    } else if (res.reason) {
      showBanner(res.reason);
    }
  }, [showBanner]);

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
    if (trigger.id === 'trigger-open-mission-control') {
      setSyncedMissionControlModal(true);
      return;
    }
    if (trigger.id === 'trigger-open-workshop') {
      setSyncedWorkshopModal(true, 'crops');
      return;
    }
    if (trigger.id === 'trigger-open-orbit') {
      setSyncedOrbitalModal(true);
      return;
    }
    if (trigger.hasRequirements) {
      handleTriggerAction(trigger.id);
    }
  }, [
    handleTriggerAction,
    setSyncedMissionControlModal,
    setSyncedOrbitalModal,
    setSyncedTechModal,
    setSyncedWorkshopModal,
  ]);

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
      setCameraMode('third-person');
      setSyncedTechModal(false);
      setSyncedMissionControlModal(false);

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
    [setSyncedGameState, setSyncedMissionControlModal, setSyncedTechModal, threatsEnabledPref]
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
    setCameraMode('third-person');
    sceneRef.current?.setCameraMode('third-person', false);
    setSyncedTechModal(false);
    setSyncedMissionControlModal(false);
    setSyncedGameState('title');
  }, [setSyncedGameState, setSyncedMissionControlModal, setSyncedTechModal]);

  // Playgama Bridge Multiplayer Client (Host-Authoritative 3-Player Co-op)
  useEffect(() => {
    const client = new PlaygamaMultiplayerClient({
      onStatusChange: (status) => {
        setPlaygamaStatus(status);
      },
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
          `Sala Playgama ${payload.roomCode} (${payload.isHost ? 'Host' : 'Membro'} · ${roleDef.name})`
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
      onHostChanged: (isNowHost, hostName) => {
        showBanner(
          isNowHost
            ? 'Você assumiu como Host da colônia!'
            : `Novo Host da colônia: ${hostName}`
        );
      },
      onRoomLeft: (reason) => {
        if (!isCoopModeRef.current) return;
        isCoopModeRef.current = false;
        coopSelfIdRef.current = null;
        enemiesRef.current = [];
        boltsRef.current = [];
        setCoopRoomCode(null);
        setCoopPlayers([]);
        setIsConnecting(false);
        setSyncedGameState('title');
        if (reason === 'connection_lost') {
          setLobbyError('Conexão perdida com o servidor Playgama.');
        } else if (reason === 'room_closed') {
          setLobbyError('A sala cooperativa foi encerrada pelo servidor.');
        }
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
    });

    coopClientRef.current = client;

    // Initialize Playgama Bridge SDK & auto-join launchRoomId invite if present
    client.initialize().then((status) => {
      const params = new URLSearchParams(window.location.search);
      if (
        status.isSupported &&
        status.launchRoomId &&
        params.get('autostart') !== '1' &&
        gameStateRef.current === 'title'
      ) {
        setIsConnecting(true);
        client
          .joinRoom(status.launchRoomId, 'Astronauta', selectedRoleRef.current)
          .catch(() => {
            setIsConnecting(false);
          });
      }
    });

    return () => {
      client.dispose();
      coopClientRef.current = null;
    };
  }, [setSyncedGameState, showBanner]);

  const handleQuickMatchCoop = useCallback(
    async (playerName: string, roleId: AstronautRoleId) => {
      selectedRoleRef.current = roleId;
      setSelectedRole(roleId);
      setLobbyError(null);
      setIsConnecting(true);
      try {
        await coopClientRef.current?.joinOrCreateRoom(playerName, threatsEnabledPref, roleId);
      } catch (err) {
        setIsConnecting(false);
        setLobbyError(err instanceof Error ? err.message : 'Erro na partida rápida Playgama.');
      }
    },
    [threatsEnabledPref]
  );

  const handleCreateCoopRoom = useCallback(
    async (playerName: string, roleId: AstronautRoleId, isVisible = false) => {
      selectedRoleRef.current = roleId;
      setSelectedRole(roleId);
      setLobbyError(null);
      setIsConnecting(true);
      try {
        await coopClientRef.current?.createRoom(playerName, threatsEnabledPref, roleId, isVisible);
      } catch (err) {
        setIsConnecting(false);
        setLobbyError(err instanceof Error ? err.message : 'Erro ao criar sala Playgama.');
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
        setLobbyError(err instanceof Error ? err.message : 'Erro ao entrar na sala Playgama.');
      }
    },
    []
  );

  const handleFetchOpenRooms = useCallback(async (): Promise<RoomSummary[]> => {
    return (await coopClientRef.current?.fetchOpenRooms()) || [];
  }, []);

  const handleSelectPlaygamaRegion = useCallback((regionId: string) => {
    coopClientRef.current?.setRegion(regionId);
  }, []);

  const handleInviteToRoom = useCallback(() => {
    coopClientRef.current?.inviteToRoom().then((ok) => {
      if (ok) {
        showBanner('Convite da sala compartilhado via Playgama!');
      }
    });
  }, [showBanner]);

  // Stable callback refs for Scene construction
  const onResourceRef = useRef(handleResourceCollected);
  onResourceRef.current = handleResourceCollected;
  const onTriggerRef = useRef(handleTriggerAction);
  onTriggerRef.current = handleTriggerAction;
  const onOpenTechRef = useRef(() => setSyncedTechModal(true));
  const onOpenMissionControlRef = useRef(() => setSyncedMissionControlModal(true));
  const onOpenWorkshopRef = useRef(() => setSyncedWorkshopModal(true, 'crops'));
  const onOpenOrbitalRef = useRef(() => setSyncedOrbitalModal(true));
  const onCanvasShootRef = useRef(firePlasmaPulse);
  onCanvasShootRef.current = firePlasmaPulse;
  const onCameraModeChangeRef = useRef<(mode: CameraMode) => void>((mode) => setCameraMode(mode));

  useEffect(() => {
    if (!mountRef.current) return;

    const initialProfile = readBrowserDeviceProfile();
    const storedPreset = readStoredQualityPreset();
    const initialQuality = resolveQualityConfig(storedPreset, initialProfile, false);
    const scene = new MarsSurfaceScene({
      container: mountRef.current,
      qualityConfig: initialQuality,
      onCutsceneEnd: () => {
        setSyncedGameState('playing');
        soundManager.playMissionComplete();
      },
      onResourceCollected: (id, type, pos) => onResourceRef.current(id, type, pos),
      onTriggerCompleted: (id) => onTriggerRef.current(id),
      onOpenTechModal: () => onOpenTechRef.current(),
      onOpenMissionControl: () => onOpenMissionControlRef.current(),
      onOpenWorkshop: () => onOpenWorkshopRef.current(),
      onOpenOrbital: () => onOpenOrbitalRef.current(),
      onCanvasShoot: (dx, dz) => onCanvasShootRef.current(dx, dz),
      onCameraModeChange: (mode) => onCameraModeChangeRef.current(mode),
    });
    sceneRef.current = scene;
    const syncedQuality = resolveQualityConfig(storedPreset, initialProfile, scene.isSoftwareGl);
    scene.applyQualityConfig(syncedQuality);
    perfMonitorRef.current.reconfigure(
      Math.min(window.devicePixelRatio || 1, syncedQuality.pixelRatioCap),
      syncedQuality.minDynamicPixelRatio,
      Math.min(window.devicePixelRatio || 1, syncedQuality.pixelRatioCap),
      storedPreset === 'auto' && !scene.isSoftwareGl
    );

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      startSoloMission(true);
      if (params.get('habitat') === '1') {
        const seededHab: ColonyState = {
          ...colonyStateRef.current,
          buildings: {
            ...colonyStateRef.current.buildings,
            moxie: true,
            solarPanels: true,
            habitat: true,
          },
          buildingHealth: {
            ...colonyStateRef.current.buildingHealth,
            moxie: 68,
            solarPanels: 54,
            habitat: 100,
          },
          oxygenMax: 125,
          oxygen: 125,
        };
        colonyStateRef.current = seededHab;
        setHudColonyState(seededHab);
      }
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
      if (params.get('fire') === '1') {
        const seededFire: ColonyState = {
          ...colonyStateRef.current,
          stage: Math.max(2, colonyStateRef.current.stage),
          buildings: {
            ...colonyStateRef.current.buildings,
            moxie: true,
            solarPanels: true,
          },
          buildingHealth: {
            ...colonyStateRef.current.buildingHealth,
            moxie: 72,
            solarPanels: 24,
          },
        };
        colonyStateRef.current = seededFire;
        setHudColonyState(seededFire);
        enemiesRef.current = [createEnemy('brute', 10.5, 4.5, 'enemy-demo-brute')];
        setActiveEnemiesCount(1);
        scene.cameraYaw = -1.05;
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

      if (e.code === 'KeyC' && curState === 'playing') {
        setSyncedMissionControlModal(!isMissionControlOpenRef.current);
        return;
      }

      if (e.code === 'KeyB' && curState === 'playing') {
        setSyncedWorkshopModal(!isWorkshopOpenRef.current);
        return;
      }

      if (e.code === 'KeyV' && curState === 'playing') {
        setSyncedOrbitalModal(!isOrbitalOpenRef.current);
        return;
      }

      if (e.code === 'KeyG' && curState === 'playing' && !isOrbitalOpenRef.current) {
        handleExcavateCrater();
        return;
      }

      if (e.code === 'KeyH' && curState === 'playing') {
        handleConsumeFood();
        return;
      }

      if (curState === 'playing' && !isOrbitalOpenRef.current) {
        if (e.code === 'Digit1') handleEquipWeapon('pulse-pistol');
        else if (e.code === 'Digit2') handleEquipWeapon('plasma-rifle');
        else if (e.code === 'Digit3') handleEquipWeapon('ion-shotgun');
        else if (e.code === 'Digit4') handleEquipWeapon('titanium-railgun');
      }

      if (e.code === 'KeyM') {
        handleToggleMute();
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (
          isTechModalOpenRef.current ||
          isMissionControlOpenRef.current ||
          isWorkshopOpenRef.current ||
          isOrbitalOpenRef.current
        ) {
          closeAllOverlays();
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

      if (curState === 'playing' && !isOrbitalOpenRef.current) {
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
        if (e.code === 'KeyX') {
          handleToggleCameraMode();
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
    closeAllOverlays,
    firePlasmaPulse,
    handleConsumeFood,
    handleEquipWeapon,
    handleExcavateCrater,
    handleInstantAction,
    handleSkipCutscene,
    handleToggleCameraMode,
    handleToggleMute,
    setSyncedGameState,
    setSyncedMissionControlModal,
    setSyncedOrbitalModal,
    setSyncedTechModal,
    setSyncedWorkshopModal,
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

      // Pause WebGL rendering & simulation when tab/portal iframe is hidden to save battery & CPU
      if (document.hidden) {
        animId = window.setTimeout(() => tick(performance.now()), 250);
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
        animId = window.setTimeout(() => tick(performance.now()), 180);
        return;
      }

      // Pause surface WebGL rendering while piloting the Starship in Orbital Explorer
      if (isOrbitalOpenRef.current) {
        animId = window.setTimeout(() => tick(performance.now()), 180);
        return;
      }

      // Dynamic resolution scaling for smooth 60FPS on mobile & online game platforms
      const nextDynamicDpr = perfMonitorRef.current.recordFrame(rawDt);
      if (nextDynamicDpr !== null) {
        scene.setDynamicPixelRatio(nextDynamicDpr);
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
              workingState.stage >= 6
                ? ['crawler', 'drone', 'stalker', 'brute']
                : workingState.stage >= 3
                ? ['crawler', 'drone', 'stalker']
                : ['crawler', 'stalker'];
            const kind = kinds[Math.floor(Math.random() * kinds.length)];
            const newEnemy = createEnemy(
              kind,
              Math.cos(angle) * r,
              Math.sin(angle) * r,
              `enemy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
            );
            enemiesRef.current.push(newEnemy);
            soundManager.playAlertWarning();
            const label = ENEMY_ARCHETYPES[kind].displayName;
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

            if (Object.keys(step.result.buildingHits).length > 0) {
              const dmgRes = applyBuildingCombatDamage(
                workingState,
                step.result.buildingHits,
                [activeRoleId]
              );
              workingState = dmgRes.state;
              for (const criticalKey of dmgRes.newlyCriticalKeys) {
                soundManager.playAlertWarning();
                forceHudSyncRef.current = true;
                showBanner(
                  `CRÍTICO: ${BUILDING_DISPLAY_NAMES[criticalKey]} em chamas! Repare [E]!`
                );
              }
              for (const destroyedKey of dmgRes.destroyedKeys) {
                scene.triggerBuildingExplosion(destroyedKey);
                soundManager.playBuildingExplosion();
                forceHudSyncRef.current = true;
                showBanner(
                  `EXPLOSÃO: ${BUILDING_DISPLAY_NAMES[destroyedKey]} destruído! Reconstrua a estrutura!`
                );
              }
            }

            if (step.result.kills.length > 0) {
              soundManager.playEnemyHit(true);
              let nextKillState = { ...workingState };
              for (const k of step.result.kills) {
                nextKillState.regolith += k.regolith;
                nextKillState.waterIce += k.ice;
                nextKillState.biomass += k.biomass;
                nextKillState.iron += k.iron;
                nextKillState.titanium += k.titanium;
                nextKillState.sulfur += k.sulfur;
                nextKillState.enemiesDefeated += 1;
                const prog = progressContract(nextKillState, 'kill-enemies', 1);
                nextKillState = prog.state;
                if (prog.completedContractTitle) {
                  soundManager.playMissionComplete();
                  showBanner(`Contrato concluído: ${prog.completedContractTitle}`);
                }
              }
              const mcEnemyRes = applyMissionControlProgress(
                nextKillState,
                'defeat-enemies',
                step.result.kills.length
              );
              nextKillState = mcEnemyRes.state;
              if (mcEnemyRes.completedDailyTitles.length > 0) {
                soundManager.playMissionComplete();
                showBanner(`Objetivo Diário Concluído: ${mcEnemyRes.completedDailyTitles[0]}`);
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

      // Throttled React HUD Sync (scaled by device performance tier or immediate on discrete change)
      if (forceHudSyncRef.current || now - lastHudSyncMs >= hudSyncIntervalMsRef.current) {
        forceHudSyncRef.current = false;
        lastHudSyncMs = now;
        setHudColonyState(colonyStateRef.current);
        setHudPlayerPos({ x: scene.playerPos.x, z: scene.playerPos.z });
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

  const handleCycleWeapon = useCallback(() => {
    const crafted = colonyStateRef.current.craftedWeapons;
    if (crafted.length <= 1) return;
    const idx = crafted.indexOf(colonyStateRef.current.equippedWeapon);
    const nextWeapon = crafted[(idx + 1) % crafted.length];
    handleEquipWeapon(nextWeapon);
  }, [handleEquipWeapon]);

  const equippedWeaponDef = getWeaponDef(hudColonyState.equippedWeapon);

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden bg-slate-950 select-none touch-none">
      {/* 1. Three.js Canvas Mount */}
      <div ref={mountRef} className="absolute inset-0 z-0 cursor-crosshair active:cursor-grabbing touch-none" />

      {/* 2. Title & 3-Player Co-op Lobby (Playgama Bridge) */}
      {gameState === 'title' && (
        <TitleLobbyOverlay
          isMuted={isMuted}
          threatsEnabled={threatsEnabledPref}
          selectedRole={selectedRole}
          isMobileDetected={deviceProfile.isMobile || deviceProfile.isTouchPrimary}
          playgamaStatus={playgamaStatus}
          onSelectRole={(roleId) => {
            selectedRoleRef.current = roleId;
            setSelectedRole(roleId);
          }}
          onToggleThreatsPref={() => setThreatsEnabledPref((v) => !v)}
          onToggleMute={handleToggleMute}
          onStartSolo={() => startSoloMission(false)}
          onQuickMatchCoop={handleQuickMatchCoop}
          onCreateCoopRoom={handleCreateCoopRoom}
          onJoinCoopRoom={handleJoinCoopRoom}
          onFetchOpenRooms={handleFetchOpenRooms}
          onSelectRegion={handleSelectPlaygamaRegion}
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
      {gameState === 'playing' && !isOrbitalOpen && (
        <MarsColonyHUD
          colonyState={hudColonyState}
          currentObjective={currentObjective}
          playerRoleId={selectedRole}
          playerPos={hudPlayerPos}
          jetpackFuel={jetpackFuel}
          activeEnemiesCount={activeEnemiesCount}
          isMuted={isMuted}
          isMobileLayout={isMobileLayout}
          cameraMode={cameraMode}
          activeInputDevice={activeInputDevice}
          coopRoomCode={coopRoomCode}
          coopPlayers={coopPlayers}
          coopEventBanner={coopEventBanner}
          isCoopHost={playgamaStatus.isHost}
          coopConnectionState={playgamaStatus.state}
          isInviteSupported={playgamaStatus.isInviteSupported}
          onInviteToRoom={handleInviteToRoom}
          onToggleMute={handleToggleMute}
          onToggleThreats={handleToggleThreats}
          onToggleCameraMode={handleToggleCameraMode}
          onPause={() => setSyncedGameState('paused')}
          onOpenTechTree={() => setSyncedTechModal(true)}
          onOpenMissionControl={() => setSyncedMissionControlModal(true)}
          onExcavateCrater={handleExcavateCrater}
          onOpenWorkshop={() => setSyncedWorkshopModal(true)}
          onOpenOrbital={() => setSyncedOrbitalModal(true)}
          onConsumeFood={handleConsumeFood}
        />
      )}

      {/* 6. Mobile & Tablet Touch Controls */}
      {gameState === 'playing' && isTouchControlsVisible && !isOrbitalOpen && (
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
          onExcavatePress={() => {
            setActiveInputDevice('touch');
            handleExcavateCrater();
          }}
          onCycleWeapon={handleCycleWeapon}
          hasActiveTrigger={Boolean(activeTrigger?.hasRequirements)}
          equippedWeaponName={equippedWeaponDef.name}
          craftedWeaponCount={hudColonyState.craftedWeapons.length}
          isPortrait={deviceProfile.isPortrait}
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

      {/* 7b. Habitat Mission Control Terminal Modal [C] */}
      {gameState === 'playing' && isMissionControlOpen && (
        <MissionControlModal
          colonyState={hudColonyState}
          onRerollObjectives={handleRerollMissionControl}
          onClose={() => setSyncedMissionControlModal(false)}
        />
      )}

      {/* 7c. Colony Workshop Modal [B]: Chemical Refinery, Craftable Weapons & Glass-Dome Farming */}
      {gameState === 'playing' && isWorkshopOpen && (
        <ColonyWorkshopModal
          colonyState={hudColonyState}
          activeTab={workshopTab}
          onChangeTab={setWorkshopTab}
          onRunRecipe={handleRunRefineryRecipe}
          onCraftWeapon={handleCraftWeapon}
          onEquipWeapon={handleEquipWeapon}
          onPlantCrop={handlePlantDomeCrop}
          onHarvestCrop={handleHarvestDomeCrop}
          onConsumeFood={handleConsumeFood}
          onClose={() => setSyncedWorkshopModal(false)}
        />
      )}

      {/* 7d. Interactive 3D Mars Orbital Planetary Explorer [V] */}
      {gameState === 'playing' && isOrbitalOpen && (
        <OrbitalExplorerModal
          colonyState={hudColonyState}
          qualityConfig={resolvedQualityConfig}
          isMobileLayout={isMobileLayout}
          onScanSite={handleScanOrbitalSite}
          onLandAtBase={() => setSyncedOrbitalModal(false)}
        />
      )}

      {/* 8. Pause Modal */}
      {gameState === 'paused' && (
        <PauseModal
          isCoop={Boolean(coopRoomCode)}
          qualityPreset={qualityPreset}
          resolvedQualityTier={resolvedQualityConfig.tier}
          touchControlsMode={touchControlsMode}
          onChangeQualityPreset={handleChangeQualityPreset}
          onChangeTouchControlsMode={handleChangeTouchControlsMode}
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
