/**
 * Mars Surface 3D Master Scene Manager
 * Integrates:
 * - Deterministic Mars terrain heightmap, crater lakes & sprouting flora
 * - Realistic 0.38g low-gravity physics (inertia, coyote time, jump buffer, sprint, jetpack, collisions)
 * - Mouse-drag & Q/R camera-relative third-person orbit + quick-click plasma aiming + anti-occlusion
 * - 11 Evolutionary Colony Modules + 3 Planting Plots + Holographic Construction Scaffolding
 * - Martian Threats (Crawlers, Drones, Basalt Brutes), Defense Turret Laser & Plasma Combat
 * - Cooperative 3-player remote astronaut avatars with smooth interpolation
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createMarsTerrain, MarsTerrainEnvironment } from './marsTerrain';
import { createAstronaut, AstronautCharacter } from './astronautModel';
import {
  createColonyStructures,
  ColonyStructures,
  CollectableResource,
  ResourceNodeKind,
  PLANTING_PLOT_COORDS,
} from './colonyStructures';
import {
  BuildingKey,
  ColonyState,
  CONSTRUCTION_CONFIGS,
  canStartConstruction,
} from '../sim/marsColonyLogic';
import { ExcavatedCrater, getCropDef } from '../sim/marsWorld';
import {
  BUILDING_COORDS,
  MarsEnemy,
  PlasmaBolt,
  findRepairableBuildingNear,
} from '../sim/marsEnemies';
import {
  PhysicsBody,
  createPhysicsBody,
  stepAstronautPhysics,
  groundHeightAt,
} from '../sim/marsPhysics';
import {
  AstronautRoleId,
  getAstronautRole,
} from '../sim/astronautRoles';
import { RemotePlayerState } from '../net/coopProtocol';
import type { QualityConfig } from '../sim/devicePerformance';

export interface InteractiveTriggerZone {
  id: string;
  name: string;
  actionText: string;
  requirementText: string;
  hasRequirements: boolean;
  isInfoOnly?: boolean;
  isConstructionActive?: boolean;
  isRepair?: boolean;
  complexity?: string;
  remainingSec?: number;
  coopAssistLabel?: string | null;
  progressRatio: number; // 0.0 to 1.0
  worldPos: THREE.Vector3;
}

export interface MarsSceneOptions {
  container: HTMLDivElement;
  qualityConfig?: QualityConfig;
  onCutsceneEnd?: () => void;
  onResourceCollected?: (
    resourceId: string,
    type: ResourceNodeKind,
    worldPos: THREE.Vector3
  ) => void;
  onTriggerCompleted?: (triggerId: string) => void;
  onOpenTechModal?: () => void;
  onOpenMissionControl?: () => void;
  onOpenWorkshop?: () => void;
  onOpenOrbital?: () => void;
  onCanvasShoot?: (dirX: number, dirZ: number) => void;
}

interface RemoteAvatarEntry {
  character: AstronautCharacter;
  roleId: AstronautRoleId;
  targetPos: THREE.Vector3;
  targetYaw: number;
  isMoving: boolean;
  isGrounded: boolean;
  isJetpacking: boolean;
  distanceTraveled: number;
  lastX: number;
  lastZ: number;
}

interface EnemyVisualEntry {
  group: THREE.Group;
  hpBg: THREE.Mesh;
  hpBarFill: THREE.Mesh;
  bodyMat: THREE.MeshStandardMaterial;
  baseEmissive: number;
  kind: MarsEnemy['kind'];
}

const TRIGGER_COORDS: Record<string, { x: number; z: number; radius: number; labelHeight: number }> = {
  'trigger-moxie': { x: -7, z: 4, radius: 3.4, labelHeight: 2.3 },
  'trigger-solar': { x: 8, z: 4, radius: 3.4, labelHeight: 2.3 },
  'trigger-water': { x: 14, z: -10, radius: 3.8, labelHeight: 2.5 },
  'trigger-miner': { x: 18, z: 7, radius: 3.6, labelHeight: 2.5 },
  'trigger-lab': { x: -12, z: -6, radius: 4.0, labelHeight: 2.6 },
  'trigger-turret': { x: 10, z: -2, radius: 3.5, labelHeight: 2.5 },
  'trigger-biodome': { x: 0, z: -19, radius: 5.0, labelHeight: 2.9 },
  'trigger-plant-0': { x: 5, z: -22, radius: 2.6, labelHeight: 1.9 },
  'trigger-plant-1': { x: -5, z: -22, radius: 2.6, labelHeight: 1.9 },
  'trigger-plant-2': { x: 0, z: -27, radius: 2.6, labelHeight: 1.9 },
  'trigger-habitat': { x: -11, z: 12, radius: 4.1, labelHeight: 2.7 },
  'trigger-comms': { x: 12, z: 14, radius: 3.7, labelHeight: 2.8 },
  'trigger-geothermal': { x: -20, z: -4, radius: 4.1, labelHeight: 2.8 },
  'trigger-terraform': { x: -14, z: -18, radius: 4.2, labelHeight: 3.2 },
};

const MARS_SKY_COLOR = new THREE.Color(0xb44a28);
const STORM_SKY_COLOR = new THREE.Color(0xc25e28);
const TERRA_SKY_COLOR = new THREE.Color(0x3882c4);
const TEMP_SKY_COLOR = new THREE.Color();
const TEMP_CROP_COLOR = new THREE.Color();

export class MarsSurfaceScene {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public isSoftwareGl: boolean;

  public terrain: MarsTerrainEnvironment;
  public astronaut: AstronautCharacter;
  public structures: ColonyStructures;

  // Authoritative local physics body
  public physicsBody: PhysicsBody = createPhysicsBody(0, 6.5);
  public playerPos = new THREE.Vector3(0, 0, 6.5);
  public isGrounded: boolean = true;
  public jetpackFuel: number = 100;

  // Remote Co-op Avatars
  private remoteAvatars: Map<string, RemoteAvatarEntry> = new Map();

  // Combat Visual Pools & Zero-GC Scratch Collections
  private enemyMeshes: Map<string, EnemyVisualEntry> = new Map();
  private boltMeshes: Map<string, THREE.Mesh> = new Map();
  private boltColorMats: Map<string, THREE.MeshBasicMaterial> = new Map();
  private activeEnemyIds: Set<string> = new Set();
  private activeBoltIds: Set<string> = new Set();
  private lastDomeCropIds: Array<string | null> = [null, null, null, null];
  private turretLaserLine: THREE.Line;
  private turretLaserTimer: number = 0;
  private playerBoltGeo = new THREE.SphereGeometry(0.22, 8, 8);
  private railgunBoltGeo = new THREE.BoxGeometry(0.18, 0.18, 1.45);
  private playerBoltMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  private turretBoltMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  private enemyBoltMat = new THREE.MeshBasicMaterial({ color: 0xa3e635 });
  private envMapTexture: THREE.Texture | null = null;
  private dustScaleFactor: number = 1.0;

  // Active craters synced from ColonyState
  private activeCraters: ExcavatedCrater[] = [];
  private lastCraterCount: number = 0;

  // Cutscene State
  public isCutscene: boolean = false;
  private cutsceneTime: number = 0;
  private cutsceneDuration: number = 4.6;

  // Camera Orbit State, Multi-Touch Pinch Zoom & Click Aiming
  public cameraYaw: number = 0;
  public cameraPitch: number = 0.46;
  public cameraDistance: number = 9.0;
  private cameraLookTarget = new THREE.Vector3();
  private cameraDesiredPos = new THREE.Vector3();
  private isDraggingCamera: boolean = false;
  private activeCameraPointerId: number | null = null;
  private activeTouchPointers: Map<number, { x: number; y: number }> = new Map();
  private lastPinchDistance: number | null = null;
  private lastPointerX: number = 0;
  private lastPointerY: number = 0;
  private pointerMoveDist: number = 0;
  private pointerButton: number = -1;
  private raycaster = new THREE.Raycaster();
  private tempNdcVec2 = new THREE.Vector2();
  private tempHitVec3 = new THREE.Vector3();
  private aimGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // Particle systems (dust & jetpack exhaust)
  private dustPoints: THREE.Points;
  private dustPositions: Float32Array;
  private maxDust = 260;
  private dustIndex = 0;
  private stormBlend = 0;

  // Proximity Triggers
  public currentTrigger: InteractiveTriggerZone | null = null;
  private triggerTimer: number = 0;
  private triggerHoldDuration = 1.05;
  private lastTriggerId: string | null = null;

  // Callbacks
  private onCutsceneEnd?: () => void;
  private onResourceCollected?: (
    resourceId: string,
    type: ResourceNodeKind,
    worldPos: THREE.Vector3
  ) => void;
  private onTriggerCompleted?: (triggerId: string) => void;
  private onOpenTechModal?: () => void;
  private onOpenMissionControl?: () => void;
  private onOpenWorkshop?: () => void;
  private onOpenOrbital?: () => void;
  private onCanvasShoot?: (dirX: number, dirZ: number) => void;

  private frameId: number = 0;
  private isDisposed: boolean = false;
  private container: HTMLDivElement;

  constructor(options: MarsSceneOptions) {
    this.container = options.container;
    this.onCutsceneEnd = options.onCutsceneEnd;
    this.onResourceCollected = options.onResourceCollected;
    this.onTriggerCompleted = options.onTriggerCompleted;
    this.onOpenTechModal = options.onOpenTechModal;
    this.onOpenMissionControl = options.onOpenMissionControl;
    this.onOpenWorkshop = options.onOpenWorkshop;
    this.onOpenOrbital = options.onOpenOrbital;
    this.onCanvasShoot = options.onCanvasShoot;
    (window as unknown as { __marsScene: MarsSurfaceScene }).__marsScene = this;

    // 1. Software WebGL probe
    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const quality = options.qualityConfig;
    this.maxDust = quality ? quality.maxDustParticles : this.isSoftwareGl ? 96 : 240;

    // 2. Renderer
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const initialPixelRatio = this.isSoftwareGl
      ? 0.75
      : Math.min(window.devicePixelRatio || 1, quality?.pixelRatioCap ?? 1.75);

    this.renderer = new THREE.WebGLRenderer({
      antialias: quality ? quality.antialias && !this.isSoftwareGl : !this.isSoftwareGl,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(initialPixelRatio);
    this.renderer.domElement.style.touchAction = 'none';
    this.container.appendChild(this.renderer.domElement);

    // 3. Scene & Martian Atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = MARS_SKY_COLOR.clone();
    this.scene.fog = new THREE.FogExp2(0xb44a28, 0.0068);

    const aspect = width / Math.max(1, height);
    const fov = aspect < 0.85 ? 62 : 54;
    const farClip = quality?.farClip ?? 460;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.15, farClip);
    this.camera.position.set(0, 12, 26);

    // 4. Studio Reflection Environment (optional on low-end mobile GPUs)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMapTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = quality?.enableEnvMap === false ? null : this.envMapTexture;

    // 5. Lighting
    const marsSun = new THREE.DirectionalLight(0xffecd2, 2.35);
    marsSun.position.set(42, 62, 32);
    this.scene.add(marsSun);

    const hemiLight = new THREE.HemisphereLight(0xf97316, 0x431407, 0.88);
    this.scene.add(hemiLight);

    // 6. Terrain, Crater Lakes, Rocks, Sky & Sprouting Flora
    const maxAniso = this.isSoftwareGl
      ? 1
      : Math.min(quality?.maxAnisotropy ?? 4, this.renderer.capabilities.getMaxAnisotropy());
    this.terrain = createMarsTerrain({
      maxAnisotropy: maxAniso,
      segments: quality?.terrainSegments ?? (this.isSoftwareGl ? 72 : 128),
      textureSize: quality?.terrainTextureSize ?? (this.isSoftwareGl ? 256 : 512),
      rockCount: quality?.rockCount ?? 120,
      floraCount: quality?.floraCount ?? 95,
      enableBumpMap: quality?.enableBumpMap ?? !this.isSoftwareGl,
    });
    this.scene.add(
      this.terrain.terrainMesh,
      this.terrain.rocksInstanced,
      this.terrain.decorationsGroup,
      this.terrain.lakeEast,
      this.terrain.lakeWest,
      this.terrain.floraInstanced,
      this.terrain.skyGroup
    );

    // 7. Colony Structures, Glass Food Greenhouse, Scaffolding & Damage Rings
    this.structures = createColonyStructures();
    this.scene.add(
      this.structures.landerGroup,
      this.structures.miniGreenhouseGroup,
      this.structures.moxieSlotRing,
      this.structures.moxieGroup,
      this.structures.moxieAuraDome,
      this.structures.solarSlotRing,
      this.structures.solarGroup,
      this.structures.waterSlotRing,
      this.structures.waterExtractorGroup,
      this.structures.autoMinerSlotRing,
      this.structures.autoMinerGroup,
      this.structures.labSlotRing,
      this.structures.labGroup,
      this.structures.defenseTurretSlotRing,
      this.structures.defenseTurretGroup,
      this.structures.bioDomeSlotRing,
      this.structures.bioDomeGroup,
      this.structures.habitatSlotRing,
      this.structures.habitatGroup,
      this.structures.commsSlotRing,
      this.structures.commsGroup,
      this.structures.geothermalSlotRing,
      this.structures.geothermalGroup,
      this.structures.terraformerSlotRing,
      this.structures.terraformerGroup
    );

    this.structures.plantingPlots.forEach((plot) => {
      this.scene.add(plot.ring, plot.cropsGroup);
    });

    Object.values(this.structures.scaffoldingRigs).forEach((rig) => {
      this.scene.add(rig.group);
    });

    Object.values(this.structures.damageRings).forEach((ring) => {
      this.scene.add(ring);
    });

    this.structures.resources.forEach((res) => {
      this.scene.add(res.mesh);
    });

    // Defense Turret laser flash line
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
    ]);
    this.turretLaserLine = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.9 })
    );
    this.turretLaserLine.visible = false;
    this.scene.add(this.turretLaserLine);

    // 8. Local Astronaut Character
    this.astronaut = createAstronaut({
      accentColorHex: '#f97316',
      showGuideArrow: true,
    });
    this.syncBodyToVisuals(0);
    this.scene.add(this.astronaut.rootGroup);

    // 9. Dust / Exhaust Particle Buffer
    const dGeo = new THREE.BufferGeometry();
    this.dustPositions = new Float32Array(this.maxDust * 3);
    dGeo.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));
    const dMat = new THREE.PointsMaterial({
      color: 0xea8c42,
      size: 0.42,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    this.dustPoints = new THREE.Points(dGeo, dMat);
    this.scene.add(this.dustPoints);

    // 10. Pointer/Touch drag camera orbit, pinch-to-zoom, quick-click shoot & resize listeners
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    dom.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('resize', this.onResize);
  }

  /**
   * Dynamically updates rendering quality at runtime without tearing down the WebGL context.
   */
  public applyQualityConfig(config: QualityConfig) {
    if (this.isDisposed) return;
    const dpr = this.isSoftwareGl
      ? 0.75
      : Math.min(window.devicePixelRatio || 1, config.pixelRatioCap);
    this.renderer.setPixelRatio(dpr);
    this.camera.far = config.farClip;
    this.camera.updateProjectionMatrix();
    this.terrain.setBumpEnabled(config.enableBumpMap);
    this.scene.environment = config.enableEnvMap ? this.envMapTexture : null;
    this.dustScaleFactor = config.tier === 'low' ? 0.45 : config.tier === 'medium' ? 0.75 : 1.0;
  }

  /**
   * Adjusts dynamic WebGL resolution during runtime (used by AdaptivePerformanceMonitor).
   */
  public setDynamicPixelRatio(dpr: number) {
    if (this.isDisposed || this.isSoftwareGl) return;
    const clamped = Math.max(0.65, Math.min(window.devicePixelRatio || 1, dpr));
    if (Math.abs(this.renderer.getPixelRatio() - clamped) >= 0.04) {
      this.renderer.setPixelRatio(clamped);
    }
  }

  private onPointerDown = (e: PointerEvent) => {
    // Only bind pointers that begin directly on the 3D canvas (never steal TouchControls touches)
    if (e.target !== this.renderer.domElement) return;

    if (e.pointerType === 'touch') {
      this.activeTouchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.activeTouchPointers.size === 2) {
        const pts = Array.from(this.activeTouchPointers.values());
        this.lastPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        this.isDraggingCamera = false;
        this.activeCameraPointerId = null;
        return;
      }
      if (this.activeCameraPointerId === null) {
        this.activeCameraPointerId = e.pointerId;
        this.isDraggingCamera = true;
        this.pointerButton = 0;
        this.pointerMoveDist = 0;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
      }
      return;
    }

    if (e.button === 0 || e.button === 2) {
      this.activeCameraPointerId = e.pointerId;
      this.isDraggingCamera = true;
      this.pointerButton = e.button;
      this.pointerMoveDist = 0;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch' && this.activeTouchPointers.has(e.pointerId)) {
      this.activeTouchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.activeTouchPointers.size === 2) {
        const pts = Array.from(this.activeTouchPointers.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (this.lastPinchDistance !== null) {
          const delta = this.lastPinchDistance - dist;
          this.cameraDistance = Math.max(5.5, Math.min(17.5, this.cameraDistance + delta * 0.025));
        }
        this.lastPinchDistance = dist;
        return;
      }
    }

    if (!this.isDraggingCamera || e.pointerId !== this.activeCameraPointerId) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.pointerMoveDist += Math.hypot(dx, dy);
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    const sensX = e.pointerType === 'touch' ? 0.0068 : 0.0055;
    const sensY = e.pointerType === 'touch' ? 0.0048 : 0.004;
    this.cameraYaw -= dx * sensX;
    this.cameraPitch = Math.max(0.2, Math.min(1.05, this.cameraPitch + dy * sensY));
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      this.activeTouchPointers.delete(e.pointerId);
      if (this.activeTouchPointers.size < 2) {
        this.lastPinchDistance = null;
      }
    }

    if (e.pointerId !== this.activeCameraPointerId) return;

    // On desktop mouse: quick left-click shoots toward cursor; on touch: dedicated PULSO button fires, tap-to-shoot only if very deliberate short tap on canvas
    if (
      this.isDraggingCamera &&
      this.pointerButton === 0 &&
      e.pointerType !== 'touch' &&
      this.pointerMoveDist < 6 &&
      !this.isCutscene &&
      e.target === this.renderer.domElement
    ) {
      const aim = this.getAimDirectionFromClient(e.clientX, e.clientY);
      this.onCanvasShoot?.(aim.dirX, aim.dirZ);
    }
    this.isDraggingCamera = false;
    this.activeCameraPointerId = null;
    this.pointerButton = -1;
  };

  private onWheel = (e: WheelEvent) => {
    this.cameraDistance = Math.max(5.5, Math.min(17.0, this.cameraDistance + e.deltaY * 0.005));
  };

  private onResize = () => {
    if (!this.container || this.isDisposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const aspect = width / Math.max(1, height);
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 0.85 ? 62 : 54;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  /**
   * Computes ground-plane aim direction from a screen click relative to astronaut (zero allocations)
   */
  public getAimDirectionFromClient(clientX: number, clientY: number): { dirX: number; dirZ: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.tempNdcVec2.set(
      ((clientX - rect.left) / (rect.width || 1)) * 2 - 1,
      -((clientY - rect.top) / (rect.height || 1)) * 2 + 1
    );
    this.raycaster.setFromCamera(this.tempNdcVec2, this.camera);
    this.aimGroundPlane.constant = -(this.playerPos.y + 0.9);
    if (this.raycaster.ray.intersectPlane(this.aimGroundPlane, this.tempHitVec3)) {
      const dx = this.tempHitVec3.x - this.playerPos.x;
      const dz = this.tempHitVec3.z - this.playerPos.z;
      const len = Math.hypot(dx, dz);
      if (len > 0.2) {
        return { dirX: dx / len, dirZ: dz / len };
      }
    }
    return this.getFacingDirection();
  }

  /**
   * Returns aim vector toward nearest enemy within 18m (soft lock-on) or astronaut facing yaw
   */
  public getSmartAimDirection(enemies: MarsEnemy[]): { dirX: number; dirZ: number } {
    let nearest: MarsEnemy | null = null;
    let bestD = 18.5;
    for (const e of enemies) {
      const d = Math.hypot(e.x - this.playerPos.x, e.z - this.playerPos.z);
      if (d < bestD) {
        bestD = d;
        nearest = e;
      }
    }
    if (nearest) {
      const dx = nearest.x - this.playerPos.x;
      const dz = nearest.z - this.playerPos.z;
      const len = Math.hypot(dx, dz) || 1;
      return { dirX: dx / len, dirZ: dz / len };
    }
    return this.getFacingDirection();
  }

  public getFacingDirection(): { dirX: number; dirZ: number } {
    const yaw = this.physicsBody.yaw;
    return { dirX: Math.sin(yaw), dirZ: Math.cos(yaw) };
  }

  public setLocalSuitAccent(colorHex: string) {
    const oldPos = this.astronaut.rootGroup.position.clone();
    const oldYaw = this.astronaut.rootGroup.rotation.y;
    this.scene.remove(this.astronaut.rootGroup);
    this.astronaut = createAstronaut({
      accentColorHex: colorHex,
      showGuideArrow: true,
    });
    this.astronaut.rootGroup.position.copy(oldPos);
    this.astronaut.rootGroup.rotation.y = oldYaw;
    this.scene.add(this.astronaut.rootGroup);
  }

  public resetPlayerPosition(slot: 0 | 1 | 2 = 0) {
    const spawnX = slot === 0 ? 0 : slot === 1 ? -2.6 : 2.6;
    const spawnZ = 6.5;
    this.physicsBody = createPhysicsBody(spawnX, spawnZ);
    this.cameraYaw = 0;
    this.syncBodyToVisuals(0);
    this.snapCameraToPlayer();
  }

  public resetCollectibles() {
    this.structures.resources.forEach((res) => {
      res.collected = false;
      res.isMagnetized = false;
      res.respawnTimer = 0;
      res.mesh.position.copy(res.spawnPos);
      res.mesh.visible = true;
    });
  }

  public applyCollectedResourceIds(collectedIds: string[]) {
    const idSet = new Set(collectedIds);
    this.structures.resources.forEach((res) => {
      const isCol = idSet.has(res.id);
      if (isCol && !res.collected) {
        res.collected = true;
        res.isMagnetized = false;
        res.mesh.visible = false;
      } else if (!isCol && res.collected) {
        res.collected = false;
        res.isMagnetized = false;
        res.mesh.position.copy(res.spawnPos);
        res.mesh.visible = true;
      }
    });
  }

  public updateTitleFlyby(totalTime: number) {
    const angle = totalTime * 0.16;
    const r = 24;
    this.camera.position.set(
      Math.sin(angle) * r,
      10.5 + Math.sin(totalTime * 0.4) * 1.2,
      Math.cos(angle) * r
    );
    this.camera.lookAt(0, 4.5, -4);
  }

  public startCutscene() {
    this.isCutscene = true;
    this.cutsceneTime = 0;
    this.astronaut.rootGroup.visible = false;
    this.structures.landerGroup.position.set(0, 28, 0);
  }

  public updateCutscene(dt: number) {
    this.cutsceneTime += dt;
    const progress = Math.min(1.0, this.cutsceneTime / this.cutsceneDuration);

    if (progress < 0.72) {
      const descentProgress = progress / 0.72;
      const curY = 28 * Math.pow(1.0 - descentProgress, 1.8);
      this.structures.landerGroup.position.set(0, curY, 0);
      (this.structures.landerPlume.material as THREE.MeshBasicMaterial).opacity = 0.85;
      this.structures.landerPlume.scale.set(1.2, 1.0 + Math.random() * 0.35, 1.2);

      this.camera.position.set(17, 6 + curY * 0.28, 22);
      this.cameraLookTarget.set(0, curY + 3.5, 0);
      this.camera.lookAt(this.cameraLookTarget);

      if (curY < 8) {
        this.emitLandingDust();
      }
    } else if (progress < 1.0) {
      this.structures.landerGroup.position.set(0, 0, 0);
      (this.structures.landerPlume.material as THREE.MeshBasicMaterial).opacity = 0;
      this.astronaut.rootGroup.visible = true;

      const walkProgress = (progress - 0.72) / 0.28;
      this.physicsBody.x = 0;
      this.physicsBody.z = 2.5 + walkProgress * 4.0;
      this.physicsBody.y = groundHeightAt(this.physicsBody.x, this.physicsBody.z);
      this.physicsBody.yaw = 0;
      this.physicsBody.distanceTraveled += dt * 4.5;
      this.syncBodyToVisuals(this.cutsceneTime, true);

      this.camera.position.set(3.5, 4.4, 14.5);
      this.cameraLookTarget.set(0, 1.4, this.physicsBody.z - 1.5);
      this.camera.lookAt(this.cameraLookTarget);
    } else {
      this.finishCutscene(true);
    }
  }

  public skipCutscene() {
    this.finishCutscene(true);
  }

  private finishCutscene(notify: boolean) {
    this.cutsceneTime = this.cutsceneDuration;
    this.isCutscene = false;
    this.structures.landerGroup.position.set(0, 0, 0);
    (this.structures.landerPlume.material as THREE.MeshBasicMaterial).opacity = 0;
    this.astronaut.rootGroup.visible = true;
    this.physicsBody = createPhysicsBody(this.physicsBody.x || 0, 6.5);
    this.syncBodyToVisuals(0);
    this.snapCameraToPlayer();
    if (notify && this.onCutsceneEnd) {
      this.onCutsceneEnd();
    }
  }

  public snapCameraToPlayer() {
    const horizDist = Math.cos(this.cameraPitch) * this.cameraDistance;
    const height = Math.sin(this.cameraPitch) * this.cameraDistance + 1.4;
    const targetX = this.playerPos.x + Math.sin(this.cameraYaw) * horizDist;
    const targetZ = this.playerPos.z + Math.cos(this.cameraYaw) * horizDist;
    const targetY = this.playerPos.y + height;
    this.camera.position.set(targetX, targetY, targetZ);
    this.cameraLookTarget.set(this.playerPos.x, this.playerPos.y + 1.3, this.playerPos.z);
    this.camera.lookAt(this.cameraLookTarget);
  }

  public updatePlayerPhysics(
    rawInput: { x: number; y: number },
    jumpJustPressed: boolean,
    jumpHeld: boolean,
    jetpackHeld: boolean,
    cameraOrbitDelta: number,
    colonyState: ColonyState,
    dt: number,
    totalTime: number,
    roleId: AstronautRoleId = 'engineer'
  ): { jumped: boolean; landed: boolean } {
    if (this.isCutscene) return { jumped: false, landed: false };

    if (cameraOrbitDelta !== 0) {
      this.cameraYaw += cameraOrbitDelta * 2.1 * dt;
    }

    const cosY = Math.cos(this.cameraYaw);
    const sinY = Math.sin(this.cameraYaw);
    const worldMoveX = rawInput.x * cosY + rawInput.y * sinY;
    const worldMoveZ = -rawInput.x * sinY + rawInput.y * cosY;

    const obstacles = [
      ...this.terrain.rockObstacles,
      ...this.structures.getObstacles(colonyState.buildings),
    ];

    const roleMods = getAstronautRole(roleId).modifiers;
    const hasJetpackMk2 = colonyState.unlockedTechs.includes('tech-jetpack');
    const isSprinting = this.physicsBody.isGrounded && jetpackHeld;
    const baseSpeedMult = (hasJetpackMk2 ? 1.18 : 1.0) * roleMods.moveSpeedMultiplier;
    const jetpackCapMult = (hasJetpackMk2 ? 1.45 : 1.0) * roleMods.jetpackCapacityMultiplier;

    this.activeCraters = colonyState.craters || [];
    let jumpedAny = false;
    let landedAny = false;
    let remDt = dt;
    let firstJump = jumpJustPressed;
    while (remDt > 0.0001) {
      const subDt = Math.min(remDt, 0.05);
      remDt -= subDt;
      const subRes = stepAstronautPhysics(
        this.physicsBody,
        {
          moveX: worldMoveX,
          moveZ: worldMoveZ,
          jumpJustPressed: firstJump,
          jumpHeld,
          jetpackHeld,
        },
        subDt,
        obstacles,
        {
          speedMultiplier: isSprinting ? baseSpeedMult * 1.32 : baseSpeedMult,
          jetpackCapacityMultiplier: jetpackCapMult,
        },
        this.activeCraters
      );
      firstJump = false;
      if (subRes.jumped) jumpedAny = true;
      if (subRes.landed) landedAny = true;
    }
    const stepResult = { jumped: jumpedAny, landed: landedAny };

    const speedHoriz = Math.hypot(this.physicsBody.vx, this.physicsBody.vz);
    const isMoving = speedHoriz > 0.35;

    if (stepResult.jumped || stepResult.landed) {
      this.emitFootstepDust(true);
    } else if (isMoving && this.physicsBody.isGrounded && Math.random() < (isSprinting ? 0.45 : 0.25)) {
      this.emitFootstepDust(false);
    } else if (this.physicsBody.isJetpacking && Math.random() < 0.5) {
      this.emitFootstepDust(false);
    }

    this.syncBodyToVisuals(totalTime, isMoving);
    this.updateCamera(dt);
    return stepResult;
  }

  private syncBodyToVisuals(totalTime: number, forceMoving?: boolean) {
    this.playerPos.set(this.physicsBody.x, this.physicsBody.y, this.physicsBody.z);
    this.isGrounded = this.physicsBody.isGrounded;
    this.jetpackFuel = this.physicsBody.jetpackFuel;

    this.astronaut.rootGroup.position.copy(this.playerPos);
    this.astronaut.rootGroup.rotation.y = this.physicsBody.yaw;

    const speedHoriz = Math.hypot(this.physicsBody.vx, this.physicsBody.vz);
    const isMoving = forceMoving !== undefined ? forceMoving : speedHoriz > 0.35;
    const groundY = groundHeightAt(this.physicsBody.x, this.physicsBody.z, this.activeCraters);

    this.astronaut.updateAnimation({
      isMoving,
      isGrounded: this.physicsBody.isGrounded,
      isJetpacking: this.physicsBody.isJetpacking,
      distanceTraveled: this.physicsBody.distanceTraveled,
      squashY: this.physicsBody.squashY,
      groundY,
      timeSec: totalTime,
    });
  }

  private updateCamera(dt: number) {
    const horizDist = Math.cos(this.cameraPitch) * this.cameraDistance;
    const height = Math.sin(this.cameraPitch) * this.cameraDistance + 1.4;

    const targetX = this.playerPos.x + Math.sin(this.cameraYaw) * horizDist;
    const targetZ = this.playerPos.z + Math.cos(this.cameraYaw) * horizDist;
    const targetY = Math.max(
      groundHeightAt(targetX, targetZ, this.activeCraters) + 1.4,
      this.playerPos.y + height
    );

    this.cameraDesiredPos.set(targetX, targetY, targetZ);
    this.cameraLookTarget.set(this.playerPos.x, this.playerPos.y + 1.35, this.playerPos.z);

    const lambda = 9.0;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.cameraDesiredPos.x, lambda, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.cameraDesiredPos.y, lambda, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.cameraDesiredPos.z, lambda, dt);
    this.camera.lookAt(this.cameraLookTarget);

    this.checkCameraOcclusion();
  }

  private checkCameraOcclusion() {
    const camPos = this.camera.position;
    const pPos = this.playerPos;
    const distCam = Math.hypot(camPos.x, camPos.z);
    const distPlayer = Math.hypot(pPos.x, pPos.z);
    const dot = (camPos.x * pPos.x + camPos.z * pPos.z) / (distCam * distPlayer || 1);
    const isOccluded = dot < 0.18 && distCam > 4.0 && distPlayer > 2.0;

    const targetOpacity = isOccluded ? 0.35 : 1.0;
    this.structures.landerMaterials.forEach((mat) => {
      mat.transparent = isOccluded || mat.opacity < 0.99;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.25);
    });
  }

  public syncRemotePlayers(players: RemotePlayerState[], selfId: string | null) {
    const incomingIds = new Set<string>();

    players.forEach((p) => {
      if (p.id === selfId) return;
      incomingIds.add(p.id);

      const existing = this.remoteAvatars.get(p.id);
      if (existing && existing.roleId === p.roleId) {
        existing.targetPos.set(p.x, p.y, p.z);
        existing.targetYaw = p.yaw;
        existing.isMoving = p.isMoving;
        existing.isGrounded = p.isGrounded;
        existing.isJetpacking = p.isJetpacking;
      } else {
        if (existing) {
          this.scene.remove(existing.character.rootGroup);
        }
        const roleShort = getAstronautRole(p.roleId).shortLabel;
        const char = createAstronaut({
          accentColorHex: p.suitColorHex,
          labelName: `${p.name} · ${roleShort}`,
          showGuideArrow: false,
        });
        char.rootGroup.position.set(p.x, p.y, p.z);
        char.rootGroup.rotation.y = p.yaw;
        this.scene.add(char.rootGroup);
        this.remoteAvatars.set(p.id, {
          character: char,
          roleId: p.roleId,
          targetPos: new THREE.Vector3(p.x, p.y, p.z),
          targetYaw: p.yaw,
          isMoving: p.isMoving,
          isGrounded: p.isGrounded,
          isJetpacking: p.isJetpacking,
          distanceTraveled: existing?.distanceTraveled || 0,
          lastX: p.x,
          lastZ: p.z,
        });
      }
    });

    for (const [id, entry] of this.remoteAvatars.entries()) {
      if (!incomingIds.has(id)) {
        this.scene.remove(entry.character.rootGroup);
        this.remoteAvatars.delete(id);
      }
    }
  }

  public updateRemotePlayers(dt: number, totalTime: number) {
    this.remoteAvatars.forEach((entry) => {
      const root = entry.character.rootGroup;
      const dampLambda = 14.0;
      root.position.x = THREE.MathUtils.damp(root.position.x, entry.targetPos.x, dampLambda, dt);
      root.position.y = THREE.MathUtils.damp(root.position.y, entry.targetPos.y, dampLambda, dt);
      root.position.z = THREE.MathUtils.damp(root.position.z, entry.targetPos.z, dampLambda, dt);

      let diff = entry.targetYaw - root.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      root.rotation.y += diff * Math.min(1.0, 14.0 * dt);

      const stepDist = Math.hypot(root.position.x - entry.lastX, root.position.z - entry.lastZ);
      entry.lastX = root.position.x;
      entry.lastZ = root.position.z;
      if (entry.isGrounded) {
        entry.distanceTraveled += stepDist;
      }

      entry.character.updateAnimation({
        isMoving: entry.isMoving || stepDist > 0.01,
        isGrounded: entry.isGrounded,
        isJetpacking: entry.isJetpacking,
        distanceTraveled: entry.distanceTraveled,
        squashY: 1.0,
        groundY: groundHeightAt(root.position.x, root.position.z),
        timeSec: totalTime,
      });
    });
  }

  /**
   * Creates composite 3D mesh for all 4 upgraded Martian threat archetypes
   */
  private buildEnemyVisual(enemy: MarsEnemy): EnemyVisualEntry {
    const group = new THREE.Group();
    const isBrute = enemy.kind === 'brute';
    const isDrone = enemy.kind === 'drone';
    const isStalker = enemy.kind === 'stalker';

    const bodyColor = isBrute
      ? 0x451a03
      : isDrone
      ? 0x1e293b
      : isStalker
      ? 0x14532d
      : 0x7f1d1d;
    const baseEmissive = isBrute
      ? 0xea580c
      : isDrone
      ? 0xef4444
      : isStalker
      ? 0x84cc16
      : 0xdc2626;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      emissive: baseEmissive,
      emissiveIntensity: 0.45,
      metalness: isDrone ? 0.85 : isStalker ? 0.48 : 0.35,
      roughness: isDrone ? 0.22 : isStalker ? 0.42 : 0.65,
    });

    if (isDrone) {
      const hull = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 1), bodyMat);
      hull.scale.set(1.25, 0.7, 1.25);
      hull.position.y = 0.2;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.88, 0.06, 8, 20),
        new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.2 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.2;
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff2222 })
      );
      eye.position.set(0, 0.2, 0.58);
      const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.32), bodyMat);
      wingL.position.set(-0.82, 0.28, 0);
      const wingR = wingL.clone();
      wingR.position.x = 0.82;
      group.add(hull, ring, eye, wingL, wingR);
    } else if (isBrute) {
      const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(1.08, 0), bodyMat);
      torso.position.y = 1.38;
      const shoulderL = new THREE.Mesh(new THREE.DodecahedronGeometry(0.52, 0), bodyMat);
      shoulderL.position.set(-0.98, 1.75, 0.1);
      const shoulderR = shoulderL.clone();
      shoulderR.position.x = 0.98;
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xf97316 })
      );
      core.position.set(0, 1.38, 0.8);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.8 });
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.92, 0.54), legMat);
      legL.position.set(-0.54, 0.46, 0);
      const legR = legL.clone();
      legR.position.x = 0.54;
      group.add(torso, shoulderL, shoulderR, core, legL, legR);
    } else if (isStalker) {
      // Acid Stalker: predatory Martian mantis-stalker with glowing bio-sac & 4 articulated blades
      const thorax = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.25, 7), bodyMat);
      thorax.rotation.x = Math.PI / 2.2;
      thorax.position.set(0, 0.9, 0.15);
      const acidSac = new THREE.Mesh(
        new THREE.SphereGeometry(0.36, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xa3e635 })
      );
      acidSac.position.set(0, 0.95, -0.58);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.52, 6), bodyMat);
      head.rotation.x = Math.PI / 2;
      head.position.set(0, 1.15, 0.78);
      const eyeL = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xd9f99d })
      );
      eyeL.position.set(-0.14, 1.22, 0.92);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.14;
      group.add(thorax, acidSac, head, eyeL, eyeR);
      for (let i = 0; i < 4; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const zOff = i < 2 ? 0.25 : -0.25;
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.05, 0.14), bodyMat);
        leg.position.set(side * 0.56, 0.5, zOff);
        leg.rotation.z = side * 0.32;
        group.add(leg);
      }
    } else {
      // Upgraded Silica Crawler with dorsal crystal spines
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.56, 10, 8), bodyMat);
      shell.scale.set(1.18, 0.65, 1.38);
      shell.position.y = 0.48;
      const spine = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.58, 5),
        new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.6 })
      );
      spine.position.set(0, 0.88, -0.1);
      const eyeL = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      );
      eyeL.position.set(-0.2, 0.55, 0.65);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.2;
      group.add(shell, spine, eyeL, eyeR);
      for (let i = 0; i < 6; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const zRow = i < 2 ? 0.36 : i < 4 ? 0 : -0.36;
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.13, 0.13), bodyMat);
        leg.position.set(side * 0.58, 0.28, zRow);
        leg.rotation.z = side * -0.35;
        group.add(leg);
      }
    }

    // Floating HP bar
    const hpBg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.14),
      new THREE.MeshBasicMaterial({ color: 0x0f172a, side: THREE.DoubleSide })
    );
    hpBg.position.y = isBrute ? 2.85 : isStalker ? 1.85 : isDrone ? 1.25 : 1.45;
    const hpFill = new THREE.Mesh(
      new THREE.PlaneGeometry(1.22, 0.09),
      new THREE.MeshBasicMaterial({ color: isStalker ? 0x84cc16 : 0xef4444, side: THREE.DoubleSide })
    );
    hpFill.position.set(0, hpBg.position.y, 0.01);
    group.add(hpBg, hpFill);

    return { group, hpBg, hpBarFill: hpFill, bodyMat, baseEmissive, kind: enemy.kind };
  }

  private getBoltMaterial(bolt: PlasmaBolt): THREE.MeshBasicMaterial {
    if (bolt.fromEnemy) return this.enemyBoltMat;
    if (bolt.fromTurret) return this.turretBoltMat;
    if (bolt.colorHex) {
      let cached = this.boltColorMats.get(bolt.colorHex);
      if (!cached) {
        cached = new THREE.MeshBasicMaterial({ color: new THREE.Color(bolt.colorHex) });
        this.boltColorMats.set(bolt.colorHex, cached);
      }
      return cached;
    }
    return this.playerBoltMat;
  }

  /**
   * Syncs 3D Enemies, Weapon Projectiles, Enemy Acid Bolts, and Turret Laser Beam (zero per-frame Set allocations)
   */
  public syncCombatEntities(
    enemies: MarsEnemy[],
    bolts: PlasmaBolt[],
    turretFiredAt: { x: number; y: number; z: number } | null,
    dt: number,
    totalTime: number
  ) {
    // 1. Enemies
    this.activeEnemyIds.clear();
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      this.activeEnemyIds.add(enemy.id);
      let entry = this.enemyMeshes.get(enemy.id);
      if (!entry) {
        entry = this.buildEnemyVisual(enemy);
        this.scene.add(entry.group);
        this.enemyMeshes.set(enemy.id, entry);
      }
      const bob =
        enemy.kind === 'drone'
          ? Math.sin(totalTime * 5 + enemy.x) * 0.22
          : enemy.kind === 'stalker'
          ? Math.abs(Math.sin(totalTime * 9 + enemy.z)) * 0.14
          : Math.abs(Math.sin(totalTime * 7 + enemy.x)) * 0.06;
      entry.group.position.set(enemy.x, enemy.y + bob, enemy.z);
      entry.group.rotation.y = enemy.yaw;

      const hpRatio = Math.max(0.02, enemy.hp / enemy.maxHp);
      entry.hpBarFill.scale.x = hpRatio;
      entry.hpBarFill.position.x = -(1 - hpRatio) * 0.61;
      const billboardYaw = this.cameraYaw - enemy.yaw;
      entry.hpBg.rotation.y = billboardYaw;
      entry.hpBarFill.rotation.y = billboardYaw;

      entry.bodyMat.emissiveIntensity = enemy.hitFlashTimer > 0 ? 1.9 : 0.45;
    }

    for (const [id, entry] of this.enemyMeshes.entries()) {
      if (!this.activeEnemyIds.has(id)) {
        this.scene.remove(entry.group);
        entry.bodyMat.dispose();
        this.enemyMeshes.delete(id);
      }
    }

    // 2. Weapon & Enemy Projectiles
    this.activeBoltIds.clear();
    for (let i = 0; i < bolts.length; i++) {
      const bolt = bolts[i];
      this.activeBoltIds.add(bolt.id);
      let mesh = this.boltMeshes.get(bolt.id);
      if (!mesh) {
        const geo =
          bolt.weaponId === 'titanium-railgun' ? this.railgunBoltGeo : this.playerBoltGeo;
        mesh = new THREE.Mesh(geo, this.getBoltMaterial(bolt));
        if (bolt.weaponId === 'titanium-railgun') {
          mesh.rotation.y = Math.atan2(bolt.vx, bolt.vz);
        }
        this.scene.add(mesh);
        this.boltMeshes.set(bolt.id, mesh);
      }
      mesh.position.set(bolt.x, bolt.y, bolt.z);
    }

    for (const [id, mesh] of this.boltMeshes.entries()) {
      if (!this.activeBoltIds.has(id)) {
        this.scene.remove(mesh);
        this.boltMeshes.delete(id);
      }
    }

    // 3. Turret laser beam flash + turret rotation
    if (turretFiredAt) {
      const ty = groundHeightAt(10, -2) + 2.4;
      const posAttr = this.turretLaserLine.geometry.getAttribute('position') as THREE.BufferAttribute;
      posAttr.setXYZ(0, 10, ty, -2);
      posAttr.setXYZ(1, turretFiredAt.x, turretFiredAt.y, turretFiredAt.z);
      posAttr.needsUpdate = true;
      this.turretLaserLine.visible = true;
      this.turretLaserTimer = 0.12;
      this.structures.turretHead.rotation.y = Math.atan2(turretFiredAt.x - 10, turretFiredAt.z + 2);
    } else if (this.turretLaserTimer > 0) {
      this.turretLaserTimer -= dt;
      if (this.turretLaserTimer <= 0) {
        this.turretLaserLine.visible = false;
      }
    } else if (enemies.length > 0) {
      const first = enemies[0];
      this.structures.turretHead.rotation.y = Math.atan2(first.x - 10, first.z + 2);
    } else {
      this.structures.turretHead.rotation.y = Math.sin(totalTime * 0.9) * 1.1;
    }
  }

  public updateInteractiveSystems(
    colonyState: ColonyState,
    plantedPlots: number[],
    isSoloMode: boolean,
    dt: number,
    totalTime: number,
    roleId: AstronautRoleId = 'engineer'
  ) {
    const pPos = this.playerPos;
    const pickupMult = getAstronautRole(roleId).modifiers.pickupRadiusMultiplier;
    const magnetRadius = (colonyState.unlockedTechs.includes('tech-magnet') ? 8.5 : 4.2) * pickupMult;

    // 1. MAGNET RESOURCE COLLECTION (+ Solo respawn)
    this.structures.resources.forEach((res) => {
      if (res.collected) {
        if (isSoloMode) {
          res.respawnTimer += dt;
          if (res.respawnTimer >= 28.0) {
            res.collected = false;
            res.isMagnetized = false;
            res.respawnTimer = 0;
            res.mesh.position.copy(res.spawnPos);
            res.mesh.visible = true;
          }
        }
        return;
      }

      const mesh = res.mesh;
      const dx = pPos.x - mesh.position.x;
      const dy = pPos.y + 0.9 - mesh.position.y;
      const dz = pPos.z - mesh.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist < magnetRadius) {
        res.isMagnetized = true;
      }

      if (res.isMagnetized) {
        const pullSpeed = Math.max(11.0, 18.0 - dist * 1.6);
        const denom = dist || 1;
        mesh.position.x += (dx / denom) * pullSpeed * dt;
        mesh.position.y += (dy / denom) * pullSpeed * dt;
        mesh.position.z += (dz / denom) * pullSpeed * dt;
        mesh.rotation.x += dt * 8.0;
        mesh.rotation.y += dt * 10.0;

        if (dist < 0.9) {
          res.collected = true;
          res.isMagnetized = false;
          res.respawnTimer = 0;
          mesh.visible = false;
          this.emitPickupSparks(mesh.position);
          this.onResourceCollected?.(res.id, res.type, mesh.position.clone());
        }
      } else {
        const baseY = res.mesh.userData.baseY || 0.45;
        const seed = res.mesh.userData.seed || 0;
        mesh.position.y = baseY + Math.sin(totalTime * 2.8 + seed) * 0.08;
        mesh.rotation.y += dt * 1.25;
      }
    });

    // 2. PROXIMITY TRIGGER ZONES
    const activeZone = this.detectNearbyTriggerZone(colonyState, plantedPlots);
    if (activeZone) {
      if (this.lastTriggerId === activeZone.id) {
        if (
          activeZone.hasRequirements &&
          !activeZone.isInfoOnly &&
          !activeZone.isConstructionActive
        ) {
          this.triggerTimer += dt;
          activeZone.progressRatio = Math.min(1.0, this.triggerTimer / this.triggerHoldDuration);
          if (this.triggerTimer >= this.triggerHoldDuration) {
            this.triggerTimer = 0;
            if (activeZone.id === 'trigger-open-tech') {
              this.onOpenTechModal?.();
            } else if (activeZone.id === 'trigger-open-mission-control') {
              this.onOpenMissionControl?.();
            } else if (activeZone.id === 'trigger-open-workshop') {
              this.onOpenWorkshop?.();
            } else if (activeZone.id === 'trigger-open-orbit') {
              this.onOpenOrbital?.();
            } else {
              this.onTriggerCompleted?.(activeZone.id);
            }
          }
        } else {
          this.triggerTimer = 0;
        }
      } else {
        this.lastTriggerId = activeZone.id;
        this.triggerTimer = 0;
      }
    } else {
      this.lastTriggerId = null;
      this.triggerTimer = 0;
    }

    this.currentTrigger = activeZone;

    // 3. DIRECTIONAL GUIDE ARROW
    const targetCoords = this.computeGuideTarget(colonyState, plantedPlots);
    this.astronaut.updateGuideArrow(this.playerPos.x, this.playerPos.z, targetCoords, totalTime);
  }

  private isProjectSlotAvailable(
    triggerId: string,
    state: ColonyState,
    plantedPlots: number[]
  ): boolean {
    switch (triggerId) {
      case 'trigger-moxie':
        return !state.buildings.moxie;
      case 'trigger-solar':
        return state.buildings.moxie && !state.buildings.solarPanels;
      case 'trigger-water':
        return state.buildings.solarPanels && !state.buildings.waterExtractor;
      case 'trigger-miner':
        return state.buildings.waterExtractor && !state.buildings.autoMiner;
      case 'trigger-lab':
        return state.buildings.autoMiner && !state.buildings.researchLab;
      case 'trigger-turret':
        return state.buildings.researchLab && !state.buildings.defenseTurret;
      case 'trigger-biodome':
        return state.buildings.defenseTurret && !state.buildings.bioDome;
      case 'trigger-plant-0':
      case 'trigger-plant-1':
      case 'trigger-plant-2': {
        const idx = Number(triggerId.replace('trigger-plant-', ''));
        return state.buildings.bioDome && !plantedPlots.includes(idx);
      }
      case 'trigger-habitat':
        return state.buildings.bioDome && state.cropsPlantedCount >= 3 && !state.buildings.habitat;
      case 'trigger-comms':
        return state.buildings.habitat && !state.buildings.commsArray;
      case 'trigger-geothermal':
        return state.buildings.commsArray && !state.buildings.geothermalPlant;
      case 'trigger-terraform':
        return state.buildings.geothermalPlant && !state.buildings.terraformer;
      default:
        return false;
    }
  }

  private detectNearbyTriggerZone(
    state: ColonyState,
    plantedPlots: number[]
  ): InteractiveTriggerZone | null {
    const p = this.playerPos;

    // 0. Priority: Damaged Module Repair
    const repairable = findRepairableBuildingNear(p, state);
    if (repairable) {
      return {
        id: `trigger-repair-${repairable.key}`,
        name: `Reparar ${repairable.label}`,
        actionText: `Integridade: ${Math.round(repairable.health)}% · Reparando...`,
        requirementText: 'Pressione [E] ou permaneça perto para restaurar',
        hasRequirements: true,
        isRepair: true,
        progressRatio: 0,
        worldPos: new THREE.Vector3(
          repairable.x,
          groundHeightAt(repairable.x, repairable.z) + 2.8,
          repairable.z
        ),
      };
    }

    // 1. Check all 14 Construction/Planting Zones (Active Construction OR New Project)
    for (const [id, coord] of Object.entries(TRIGGER_COORDS)) {
      if (Math.hypot(p.x - coord.x, p.z - coord.z) >= coord.radius) continue;

      const activeJob = state.activeConstructions.find((c) => c.id === id);
      if (activeJob) {
        const pct = Math.min(1, activeJob.elapsedSec / activeJob.durationSec);
        const techMult = state.unlockedTechs.includes('tech-robotics') ? 1.45 : 1.0;
        const estRate = techMult * 2.2;
        const remaining = Math.max(0, (activeJob.durationSec - activeJob.elapsedSec) / estRate);
        return {
          id,
          name: activeJob.name,
          actionText: `Construindo (${Math.round(pct * 100)}%) · ${remaining.toFixed(1)}s`,
          requirementText: `Complexidade: ${activeJob.complexity} · [E] Acelerar Obra`,
          hasRequirements: true,
          isConstructionActive: true,
          complexity: activeJob.complexity,
          remainingSec: remaining,
          progressRatio: pct,
          worldPos: new THREE.Vector3(coord.x, groundHeightAt(coord.x, coord.z) + coord.labelHeight, coord.z),
        };
      }

      if (this.isProjectSlotAvailable(id, state, plantedPlots)) {
        const cfg = CONSTRUCTION_CONFIGS[id];
        const check = canStartConstruction(id, state, plantedPlots);
        const costParts: string[] = [];
        if (cfg.cost.regolith > 0) costParts.push(`${state.regolith}/${cfg.cost.regolith} Reg`);
        if (cfg.cost.waterIce > 0) costParts.push(`${state.waterIce}/${cfg.cost.waterIce} Gelo`);
        if (cfg.cost.water > 0) costParts.push(`${state.water}/${cfg.cost.water} Água`);
        if (cfg.cost.biomass > 0) costParts.push(`${state.biomass}/${cfg.cost.biomass} Bio`);

        return {
          id,
          name: cfg.name,
          actionText: check.ok
            ? `Iniciar Obra (${cfg.complexity} · ${cfg.durationSec}s)`
            : check.reason || 'Requisitos Pendentes',
          requirementText:
            check.ok
              ? costParts.length > 0
                ? `Custo: ${costParts.join(' · ')}`
                : `Pronto para iniciar (${cfg.durationSec}s)`
              : costParts.length > 0
              ? `${check.reason} (${costParts.join(' · ')})`
              : check.reason || '',
          hasRequirements: check.ok,
          complexity: cfg.complexity,
          progressRatio: 0,
          worldPos: new THREE.Vector3(coord.x, groundHeightAt(coord.x, coord.z) + coord.labelHeight, coord.z),
        };
      }
    }

    // 2. Built Research Lab Terminal [T]
    if (state.buildings.researchLab && Math.hypot(p.x + 12, p.z + 6) < 4.0) {
      return {
        id: 'trigger-open-tech',
        name: 'Terminal Científico do Lab',
        actionText: 'Pesquisar Tecnologias [T]',
        requirementText: 'Pressione [T] ou [E] para abrir Árvore Tecnológica (8 Techs)',
        hasRequirements: true,
        isInfoOnly: true,
        progressRatio: 0,
        worldPos: new THREE.Vector3(-12, groundHeightAt(-12, -6) + 3.2, -6),
      };
    }

    // 3. Built Habitat Mission Control Terminal [C]
    if (state.buildings.habitat && Math.hypot(p.x + 11, p.z - 12) < 4.5) {
      return {
        id: 'trigger-open-mission-control',
        name: 'Mission Control Terminal',
        actionText: 'Objetivos Diários do Habitat [C]',
        requirementText: 'Pressione [C] ou [E] para abrir 3 Objetivos Diários e Bônus',
        hasRequirements: true,
        isInfoOnly: true,
        progressRatio: 0,
        worldPos: new THREE.Vector3(-11, groundHeightAt(-11, 12, this.activeCraters) + 3.4, 12),
      };
    }

    // 4. Glass Food Greenhouse & Chemical Refinery / Weapons Workshop [B]
    if (Math.hypot(p.x + 6.5, p.z + 5.5) < 4.6) {
      return {
        id: 'trigger-open-workshop',
        name: 'Redoma de Vidro & Refinaria',
        actionText: 'Abrir Redoma Agrícola, Refinaria & Arsenal [B]',
        requirementText: 'Pressione [B] ou [E] para plantar alimentos, extrair elementos e criar armas',
        hasRequirements: true,
        isInfoOnly: true,
        progressRatio: 0,
        worldPos: new THREE.Vector3(-6.5, groundHeightAt(-6.5, -5.5, this.activeCraters) + 3.5, -5.5),
      };
    }

    // 5. Starship Lander Orbital Flight Mode [V]
    if (Math.hypot(p.x, p.z) < 4.8) {
      return {
        id: 'trigger-open-orbit',
        name: 'Nave Starship · Exploração Planetária',
        actionText: 'Decolar para Órbita de Marte [V]',
        requirementText: 'Pressione [V] ou [E] para voar ao redor de Marte e escanear anomalias',
        hasRequirements: true,
        isInfoOnly: true,
        progressRatio: 0,
        worldPos: new THREE.Vector3(0, groundHeightAt(0, 0, this.activeCraters) + 4.4, 0),
      };
    }

    return null;
  }

  private computeGuideTarget(
    state: ColonyState,
    plantedPlots: number[]
  ): { x: number; z: number } | null {
    // 0. If any active construction is ongoing, guide back to it
    if (state.activeConstructions.length > 0) {
      const firstId = state.activeConstructions[0].id;
      const coord = TRIGGER_COORDS[firstId];
      if (coord) return { x: coord.x, z: coord.z };
    }

    // 1. Damaged building alert
    const damagedKey = (Object.keys(state.buildings) as BuildingKey[]).find(
      (k) => state.buildings[k] && state.buildingHealth[k] < 60
    );
    if (damagedKey) {
      const c = BUILDING_COORDS[damagedKey];
      return { x: c.x, z: c.z };
    }

    if (!state.buildings.moxie) return { x: -7, z: 4 };

    if (!state.buildings.solarPanels) {
      if (state.regolith < 4) {
        const near = this.findNearestResource('regolith');
        if (near) return { x: near.mesh.position.x, z: near.mesh.position.z };
      }
      return { x: 8, z: 4 };
    }

    if (!state.buildings.waterExtractor) {
      if (state.waterIce < 5) {
        const near = this.findNearestResource('ice');
        if (near) return { x: near.mesh.position.x, z: near.mesh.position.z };
      }
      if (state.regolith < 2) {
        const near = this.findNearestResource('regolith');
        if (near) return { x: near.mesh.position.x, z: near.mesh.position.z };
      }
      return { x: 14, z: -10 };
    }

    if (!state.buildings.autoMiner) {
      if (state.regolith < 4) {
        const near = this.findNearestResource('regolith');
        if (near) return { x: near.mesh.position.x, z: near.mesh.position.z };
      }
      return { x: 18, z: 7 };
    }

    if (!state.buildings.researchLab) {
      if (state.regolith < 5) {
        const near = this.findNearestResource('regolith');
        if (near) return { x: near.mesh.position.x, z: near.mesh.position.z };
      }
      return { x: -12, z: -6 };
    }

    if (state.unlockedTechs.length === 0) return { x: -12, z: -6 };

    if (!state.buildings.defenseTurret) {
      if (state.regolith < 4) {
        const near = this.findNearestResource('regolith');
        if (near) return { x: near.mesh.position.x, z: near.mesh.position.z };
      }
      return { x: 10, z: -2 };
    }

    if (!state.buildings.bioDome) {
      if (state.regolith < 5) {
        const near = this.findNearestResource('regolith');
        if (near) return { x: near.mesh.position.x, z: near.mesh.position.z };
      }
      return { x: 0, z: -19 };
    }

    if (state.cropsPlantedCount < 3) {
      const nextIdx = [0, 1, 2].find((idx) => !plantedPlots.includes(idx));
      if (nextIdx !== undefined) return PLANTING_PLOT_COORDS[nextIdx];
    }

    if (!state.buildings.habitat) {
      if (state.regolith < 6) {
        const near = this.findNearestResource('regolith');
        if (near) return { x: near.mesh.position.x, z: near.mesh.position.z };
      }
      return { x: -11, z: 12 };
    }

    if (!state.buildings.commsArray) {
      if (state.regolith < 5) {
        const near = this.findNearestResource('regolith');
        if (near) return { x: near.mesh.position.x, z: near.mesh.position.z };
      }
      return { x: 12, z: 14 };
    }

    if (!state.buildings.geothermalPlant) {
      if (state.regolith < 6) {
        const near = this.findNearestResource('regolith');
        if (near) return { x: near.mesh.position.x, z: near.mesh.position.z };
      }
      return { x: -20, z: -4 };
    }

    if (!state.buildings.terraformer) {
      if (state.regolith < 8) {
        const near = this.findNearestResource('regolith');
        if (near) return { x: near.mesh.position.x, z: near.mesh.position.z };
      }
      return { x: -14, z: -18 };
    }

    return null;
  }

  private findNearestResource(type: 'regolith' | 'ice'): CollectableResource | null {
    let nearest: CollectableResource | null = null;
    let minDist = Infinity;
    this.structures.resources.forEach((r) => {
      if (!r.collected && r.type === type) {
        const d = Math.hypot(this.playerPos.x - r.mesh.position.x, this.playerPos.z - r.mesh.position.z);
        if (d < minDist) {
          minDist = d;
          nearest = r;
        }
      }
    });
    return nearest;
  }

  /**
   * Syncs 11 3D structures, holographic scaffolding, damage rings, sky/fog, lakes, and flora
   */
  public syncColonyStructures(state: ColonyState, plantedPlots: number[], timeSec: number) {
    // 1. MOXIE
    this.structures.moxieSlotRing.visible = !state.buildings.moxie;
    if (state.buildings.moxie) {
      this.structures.moxieLightBeamMat.color.setHex(0x10b981);
      this.structures.moxieLightBeamMat.opacity = 0.72;
      this.structures.moxieAuraMat.opacity = 0.1 + Math.sin(timeSec * 2.5) * 0.035;
    } else {
      this.structures.moxieLightBeamMat.color.setHex(0x0284c7);
      this.structures.moxieAuraMat.opacity = 0.0;
    }

    // 2. Solar
    this.structures.solarGroup.visible = state.buildings.solarPanels;
    this.structures.solarSlotRing.visible = state.buildings.moxie && !state.buildings.solarPanels;

    // 3. Water Extractor
    this.structures.waterExtractorGroup.visible = state.buildings.waterExtractor;
    this.structures.waterSlotRing.visible = state.buildings.solarPanels && !state.buildings.waterExtractor;
    if (state.buildings.waterExtractor) {
      this.structures.waterRotor.rotation.y = timeSec * 3.5;
    }

    // 4. Auto Miner
    this.structures.autoMinerGroup.visible = state.buildings.autoMiner;
    this.structures.autoMinerSlotRing.visible = state.buildings.waterExtractor && !state.buildings.autoMiner;
    if (state.buildings.autoMiner) {
      this.structures.autoMinerDrill.rotation.y = timeSec * 6.5;
      this.structures.autoMinerDrill.position.y = 1.65 + Math.sin(timeSec * 4) * 0.18;
    }

    // 5. Research Lab
    this.structures.labGroup.visible = state.buildings.researchLab;
    this.structures.labSlotRing.visible = state.buildings.autoMiner && !state.buildings.researchLab;
    if (state.buildings.researchLab) {
      this.structures.labRadar.rotation.y = Math.sin(timeSec * 0.9) * 0.8;
    }

    // 6. Defense Turret
    this.structures.defenseTurretGroup.visible = state.buildings.defenseTurret;
    this.structures.defenseTurretSlotRing.visible = state.buildings.researchLab && !state.buildings.defenseTurret;

    // 7. BioDome
    this.structures.bioDomeGroup.visible = state.buildings.bioDome;
    this.structures.bioDomeSlotRing.visible = state.buildings.defenseTurret && !state.buildings.bioDome;

    // 8. 3 Planting Plots
    this.structures.plantingPlots.forEach((plot) => {
      const isPlanted = plantedPlots.includes(plot.index);
      plot.ring.visible = state.buildings.bioDome && !isPlanted;
      plot.cropsGroup.visible = isPlanted;
      if (isPlanted) {
        plot.cropsGroup.rotation.z = Math.sin(timeSec * 2.2 + plot.index) * 0.03;
      }
    });

    // 9. Habitat
    this.structures.habitatGroup.visible = state.buildings.habitat;
    this.structures.habitatSlotRing.visible =
      state.buildings.bioDome && state.cropsPlantedCount >= 3 && !state.buildings.habitat;

    // 10. Comms Array
    this.structures.commsGroup.visible = state.buildings.commsArray;
    this.structures.commsSlotRing.visible = state.buildings.habitat && !state.buildings.commsArray;
    if (state.buildings.commsArray) {
      this.structures.commsDish.rotation.y = timeSec * 0.65;
    }

    // 11. Geothermal Plant
    this.structures.geothermalGroup.visible = state.buildings.geothermalPlant;
    this.structures.geothermalSlotRing.visible =
      state.buildings.commsArray && !state.buildings.geothermalPlant;
    if (state.buildings.geothermalPlant) {
      this.structures.geothermalCore.rotation.z = timeSec * 2.2;
    }

    // 12. Terraformer
    this.structures.terraformerGroup.visible = state.buildings.terraformer;
    this.structures.terraformerSlotRing.visible =
      state.buildings.geothermalPlant && !state.buildings.terraformer;
    if (state.buildings.terraformer) {
      this.structures.terraformerTurbine.rotation.y = timeSec * 4.5;
    }

    // 13. Holographic Scaffolding Rigs (zero per-frame Map allocation)
    const activeList = state.activeConstructions;
    for (const id in this.structures.scaffoldingRigs) {
      const rig = this.structures.scaffoldingRigs[id];
      let job = null;
      for (let j = 0; j < activeList.length; j++) {
        if (activeList[j].id === id) {
          job = activeList[j];
          break;
        }
      }
      if (job) {
        rig.group.visible = true;
        const pct = Math.max(0.08, Math.min(1, job.elapsedSec / job.durationSec));
        rig.coreBar.scale.y = pct;
        rig.wireCage.rotation.y = timeSec * 0.4;
      } else {
        rig.group.visible = false;
      }
    }

    // 14. Building Damage Warning Rings
    for (const key in this.structures.damageRings) {
      const bKey = key as BuildingKey;
      const ring = this.structures.damageRings[bKey];
      const isDamaged = state.buildings[bKey] && state.buildingHealth[bKey] < 100;
      ring.visible = isDamaged;
      if (isDamaged) {
        const s = 0.95 + Math.sin(timeSec * 8) * 0.08;
        ring.scale.set(s, s, 1);
      }
    }

    // 15. Dynamic Planet Sky, Dust Storm Atmosphere, Crater Lakes & Flora Terraforming
    const terraFactor = Math.max(0, Math.min(1, (state.habitability - 50) / 50));
    const stormTarget = state.dustStorm?.isActive ? 1 : 0;
    this.stormBlend += (stormTarget - this.stormBlend) * 0.06;

    TEMP_SKY_COLOR.copy(MARS_SKY_COLOR)
      .lerp(TERRA_SKY_COLOR, terraFactor)
      .lerp(STORM_SKY_COLOR, this.stormBlend * 0.85);
    (this.scene.background as THREE.Color).copy(TEMP_SKY_COLOR);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(TEMP_SKY_COLOR);
      const clearDensity = THREE.MathUtils.lerp(0.0068, 0.0038, terraFactor);
      this.scene.fog.density = THREE.MathUtils.lerp(clearDensity, 0.0175, this.stormBlend);
    }

    if (this.stormBlend > 0.12) {
      this.emitStormWindDust(timeSec);
    }

    this.terrain.updateTerraformingVisuals(
      state.habitability,
      state.buildings.waterExtractor,
      timeSec
    );

    // 16. Apply live 3D excavated craters to terrain mesh whenever count changes
    const craters = state.craters || [];
    if (craters.length !== this.lastCraterCount) {
      this.lastCraterCount = craters.length;
      this.activeCraters = craters;
      this.terrain.applyCraters(craters);
    }

    // 17. Slowly orbit Martian moons (Phobos & Deimos) across the sky
    this.terrain.skyGroup.rotation.y = timeSec * 0.004;

    // 18. Live 3D Glass-Dome Food Crop Beds (zero per-frame THREE.Color allocations)
    const domeCrops = state.domeCrops || [];
    for (let idx = 0; idx < this.structures.domeCropBedGroups.length; idx++) {
      const plantsHolder = this.structures.domeCropBedGroups[idx];
      const bed = domeCrops[idx];
      if (!bed || !bed.cropId) {
        plantsHolder.visible = false;
        this.lastDomeCropIds[idx] = null;
        continue;
      }
      plantsHolder.visible = true;
      const pct = Math.max(0.15, Math.min(1, bed.elapsedSec / Math.max(1, bed.durationSec)));
      const growthScale = 0.25 + pct * 0.9;
      plantsHolder.scale.set(0.75 + pct * 0.35, growthScale, 0.75 + pct * 0.35);
      plantsHolder.rotation.z = bed.readyToHarvest ? Math.sin(timeSec * 3.0 + idx) * 0.04 : 0;

      const cropChanged = this.lastDomeCropIds[idx] !== bed.cropId;
      if (cropChanged) {
        this.lastDomeCropIds[idx] = bed.cropId;
        const cropDef = getCropDef(bed.cropId);
        TEMP_CROP_COLOR.set(cropDef.colorHex);
      }
      const targetEmissive = bed.readyToHarvest ? 0.35 : 0.08;
      for (let c = 0; c < plantsHolder.children.length; c++) {
        const child = plantsHolder.children[c];
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          if (cropChanged) {
            child.material.color.copy(TEMP_CROP_COLOR);
            child.material.emissive.copy(TEMP_CROP_COLOR);
          }
          if (child.material.emissiveIntensity !== targetEmissive) {
            child.material.emissiveIntensity = targetEmissive;
          }
        }
      }
    }
  }

  public emitExcavationBurst(x: number, z: number) {
    const gy = groundHeightAt(x, z, this.activeCraters);
    const count = Math.max(8, Math.round(22 * this.dustScaleFactor));
    for (let i = 0; i < count; i++) {
      const idx = (this.dustIndex % this.maxDust) * 3;
      this.dustIndex++;
      const a = Math.random() * Math.PI * 2;
      const r = 0.4 + Math.random() * 2.8;
      this.dustPositions[idx] = x + Math.cos(a) * r;
      this.dustPositions[idx + 1] = gy + 0.3 + Math.random() * 2.1;
      this.dustPositions[idx + 2] = z + Math.sin(a) * r;
    }
    (this.dustPoints.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  private emitStormWindDust(timeSec: number) {
    const burst = Math.max(1, Math.round(5 * this.stormBlend * this.dustScaleFactor));
    const windDriftX = Math.cos(timeSec * 0.35) * 4.5;
    for (let i = 0; i < burst; i++) {
      const idx = (this.dustIndex % this.maxDust) * 3;
      this.dustIndex++;
      this.dustPositions[idx] = this.playerPos.x + (Math.random() - 0.5) * 26 + windDriftX;
      this.dustPositions[idx + 1] = this.playerPos.y + 0.3 + Math.random() * 5.2;
      this.dustPositions[idx + 2] = this.playerPos.z + (Math.random() - 0.5) * 26;
    }
    (this.dustPoints.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  private emitFootstepDust(isHighBurst: boolean = false) {
    const count = Math.max(1, Math.round((isHighBurst ? 6 : 2) * this.dustScaleFactor));
    for (let i = 0; i < count; i++) {
      const idx = (this.dustIndex % this.maxDust) * 3;
      this.dustIndex++;
      this.dustPositions[idx] = this.playerPos.x + (Math.random() - 0.5) * 0.45;
      this.dustPositions[idx + 1] = this.playerPos.y + (isHighBurst ? 0.25 + Math.random() * 0.4 : 0.08);
      this.dustPositions[idx + 2] = this.playerPos.z + (Math.random() - 0.5) * 0.45;
    }
    (this.dustPoints.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  private emitLandingDust() {
    const count = Math.max(2, Math.round(6 * this.dustScaleFactor));
    for (let i = 0; i < count; i++) {
      const idx = (this.dustIndex % this.maxDust) * 3;
      this.dustIndex++;
      const angle = Math.random() * Math.PI * 2;
      const r = 2.5 + Math.random() * 6;
      this.dustPositions[idx] = Math.cos(angle) * r;
      this.dustPositions[idx + 1] = Math.random() * 1.8;
      this.dustPositions[idx + 2] = Math.sin(angle) * r;
    }
    (this.dustPoints.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  private emitPickupSparks(pos: THREE.Vector3) {
    const count = Math.max(2, Math.round(5 * this.dustScaleFactor));
    for (let i = 0; i < count; i++) {
      const idx = (this.dustIndex % this.maxDust) * 3;
      this.dustIndex++;
      this.dustPositions[idx] = pos.x + (Math.random() - 0.5) * 0.6;
      this.dustPositions[idx + 1] = pos.y + Math.random() * 0.7;
      this.dustPositions[idx + 2] = pos.z + (Math.random() - 0.5) * 0.6;
    }
    (this.dustPoints.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  public scheduleNextFrame(cb: (time: number) => void): number {
    if (this.isDisposed) return 0;
    if (this.isSoftwareGl) {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.isDisposed) return;
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 6);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(() => {
            cb(performance.now());
          }, 75);
        }
      };
      this.frameId = window.setTimeout(poll, 6);
      return this.frameId;
    } else {
      this.frameId = requestAnimationFrame(cb);
      return this.frameId;
    }
  }

  public render() {
    if (this.isDisposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  public dispose() {
    this.isDisposed = true;
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    dom.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('resize', this.onResize);
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.envMapTexture?.dispose();
    this.boltColorMats.forEach((m) => m.dispose());
    this.enemyMeshes.forEach((e) => e.bodyMat.dispose());
    this.renderer.dispose();
  }
}
