/**
 * Mars Surface 3D Master Scene Manager
 * Features:
 * - High-angle semi-isometric camera with dynamic anti-occlusion transparency
 * - Agile astronaut physics (+35% speed, 0.38g floaty jumps, dust & thruster puffs)
 * - Magnet resource collection (cubes fly towards astronaut)
 * - Proximity trigger zones with 1.5s automatic fill & instant action trigger
 * - 3D Directional Guide Arrow pointing to active mission target
 * - Software WebGL safe loop & PMREM studio lighting
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createMarsTerrain } from './marsTerrain';
import { createAstronaut, AstronautCharacter } from './astronautModel';
import { createColonyStructures, ColonyStructures, CollectableResource } from './colonyStructures';
import { ColonyState } from '../sim/marsColonyLogic';

export interface InteractiveTriggerZone {
  id: string;
  name: string;
  actionText: string;
  requirementText: string;
  hasRequirements: boolean;
  progressRatio: number; // 0.0 to 1.0
  worldPos: THREE.Vector3;
}

export interface MarsSceneOptions {
  container: HTMLDivElement;
  onCutsceneEnd?: () => void;
  onResourceCollected?: (type: 'regolith' | 'ice', worldPos: THREE.Vector3) => void;
  onTriggerCompleted?: (triggerId: string) => void;
}

export class MarsSurfaceScene {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public isSoftwareGl: boolean;

  public astronaut: AstronautCharacter;
  public structures: ColonyStructures;

  // Cutscene State
  public isCutscene: boolean = true;
  private cutsceneTime: number = 0;
  private cutsceneDuration: number = 5.5;

  // Agile Low-gravity Player Physics (+35% faster: 8.8 m/s)
  public playerPos = new THREE.Vector3(0, 0, 6.0);
  public playerVel = new THREE.Vector3();
  public playerYaw: number = Math.PI;
  public isGrounded: boolean = true;
  private moveSpeed = 8.8; // 35% faster than 6.5
  private jumpForce = 5.6; // 0.38g floaty Martian jump

  // Semi-isometric elevated third-person camera
  private cameraLookTarget = new THREE.Vector3();
  private cameraDesiredPos = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();

  // Particle systems
  private dustPoints: THREE.Points;
  private dustPositions: Float32Array;
  private maxDust = 250;
  private dustIndex = 0;

  // Proximity Triggers & Auto-interact Progress
  public currentTrigger: InteractiveTriggerZone | null = null;
  private triggerTimer: number = 0;
  private triggerHoldDuration = 1.4; // 1.4s auto-fill
  private lastTriggerId: string | null = null;

  // Callbacks
  private onCutsceneEnd?: () => void;
  private onResourceCollected?: (type: 'regolith' | 'ice', worldPos: THREE.Vector3) => void;
  private onTriggerCompleted?: (triggerId: string) => void;

  private frameId: number = 0;
  private isDisposed: boolean = false;
  private container: HTMLDivElement;

  constructor(options: MarsSceneOptions) {
    this.container = options.container;
    this.onCutsceneEnd = options.onCutsceneEnd;
    this.onResourceCollected = options.onResourceCollected;
    this.onTriggerCompleted = options.onTriggerCompleted;
    (window as unknown as { __marsScene: MarsSurfaceScene }).__marsScene = this;

    // 1. Software WebGL probe
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Renderer
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));

    this.container.appendChild(this.renderer.domElement);

    // 3. Scene & Mars Atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xb44a28); // Martian amber-red sky
    this.scene.fog = new THREE.FogExp2(0xb44a28, 0.007);

    // Elevated semi-isometric camera (dist = 6.8, height = 4.2)
    this.camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 800);
    this.camera.position.set(0, 12, 28);

    // 4. Studio Environment Reflection
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 5. Lighting: Warm Mars Directional Sun + Soft Atmospheric Fill
    const marsSun = new THREE.DirectionalLight(0xffecd2, 2.4);
    marsSun.position.set(40, 60, 30);
    this.scene.add(marsSun);

    const hemiLight = new THREE.HemisphereLight(0xf97316, 0x431407, 0.75);
    this.scene.add(hemiLight);

    // 6. Terrain
    const terrain = createMarsTerrain();
    this.scene.add(terrain.terrainMesh, terrain.rocksGroup, terrain.decorationsGroup);

    // 7. Colony Structures & Landed Starship
    this.structures = createColonyStructures();
    this.scene.add(
      this.structures.landerGroup,
      this.structures.moxieGroup,
      this.structures.moxieAuraDome,
      this.structures.solarSlotRing,
      this.structures.solarGroup,
      this.structures.bioDomeSlotRing,
      this.structures.bioDomeGroup,
      this.structures.habitatSlotRing,
      this.structures.habitatGroup
    );

    // Add scattered collectable resource cubes
    this.structures.resources.forEach((res) => {
      this.scene.add(res.mesh);
    });

    // 8. Astronaut Hero Character with Guide Arrow
    this.astronaut = createAstronaut();
    this.astronaut.rootGroup.position.copy(this.playerPos);
    this.astronaut.rootGroup.rotation.y = this.playerYaw;
    this.scene.add(this.astronaut.rootGroup);

    // 9. Dust Particle Ring Buffer
    const dGeo = new THREE.BufferGeometry();
    this.dustPositions = new Float32Array(this.maxDust * 3);
    dGeo.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));
    const dMat = new THREE.PointsMaterial({
      color: 0xd97706,
      size: 0.45,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    this.dustPoints = new THREE.Points(dGeo, dMat);
    this.scene.add(this.dustPoints);

    window.addEventListener('resize', this.onResize);
  }

  private onResize = () => {
    if (!this.container || this.isDisposed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  /**
   * Updates Opening Cinematic Descent Cutscene
   */
  public updateCutscene(dt: number) {
    this.cutsceneTime += dt;
    const progress = Math.min(1.0, this.cutsceneTime / this.cutsceneDuration);

    if (progress < 0.75) {
      // Ship descending through Martian atmosphere
      const descentProgress = progress / 0.75;
      const curY = 32 * Math.pow(1.0 - descentProgress, 1.8);
      this.structures.landerGroup.position.set(0, curY, 0);

      (this.structures.landerPlume.material as THREE.MeshBasicMaterial).opacity = 0.85;
      this.structures.landerPlume.scale.set(1.2, 1.0 + Math.random() * 0.4, 1.2);

      this.camera.position.set(18, 6 + curY * 0.25, 24);
      this.cameraLookTarget.set(0, curY + 3.5, 0);
      this.camera.lookAt(this.cameraLookTarget);

      if (curY < 8) {
        this.emitLandingDust();
      }
    } else if (progress < 1.0) {
      // Touchdown settled! Thruster shuts down, astronaut emerges
      this.structures.landerGroup.position.set(0, 0, 0);
      (this.structures.landerPlume.material as THREE.MeshBasicMaterial).opacity = 0;

      this.astronaut.rootGroup.visible = true;
      const walkOutProgress = (progress - 0.75) / 0.25;
      this.playerPos.set(0, 0, 2.0 + walkOutProgress * 4.0);
      this.playerYaw = Math.PI;
      this.astronaut.rootGroup.position.copy(this.playerPos);
      this.astronaut.rootGroup.rotation.y = this.playerYaw;
      this.astronaut.updateAnimation(true, false, this.cutsceneTime);

      this.camera.position.set(0, 4.2, 13.5);
      this.cameraLookTarget.set(0, 1.2, this.playerPos.z - 2);
      this.camera.lookAt(this.cameraLookTarget);
    } else {
      // Cutscene finishes! Transition to full player control
      this.isCutscene = false;
      this.structures.landerGroup.position.set(0, 0, 0);
      (this.structures.landerPlume.material as THREE.MeshBasicMaterial).opacity = 0;
      this.astronaut.rootGroup.visible = true;
      this.playerPos.set(0, 0, 6.0);
      this.playerYaw = Math.PI;
      this.astronaut.rootGroup.position.copy(this.playerPos);
      this.astronaut.rootGroup.rotation.y = this.playerYaw;
      this.snapCameraToPlayer();
      if (this.onCutsceneEnd) {
        this.onCutsceneEnd();
      }
    }
  }

  public snapCameraToPlayer() {
    const dist = 6.8;
    const height = 4.2;
    const targetX = this.playerPos.x - Math.sin(this.playerYaw) * dist;
    const targetZ = this.playerPos.z - Math.cos(this.playerYaw) * dist;
    const targetY = this.playerPos.y + height;
    this.camera.position.set(targetX, targetY, targetZ);
    this.cameraLookTarget.set(this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z);
    this.camera.lookAt(this.cameraLookTarget);
  }

  public skipCutscene() {
    this.cutsceneTime = this.cutsceneDuration;
    this.isCutscene = false;
    this.structures.landerGroup.position.set(0, 0, 0);
    (this.structures.landerPlume.material as THREE.MeshBasicMaterial).opacity = 0;
    this.astronaut.rootGroup.visible = true;
    this.playerPos.set(0, 0, 6.0);
    this.playerYaw = Math.PI;
    this.astronaut.rootGroup.position.copy(this.playerPos);
    this.astronaut.rootGroup.rotation.y = this.playerYaw;
    this.snapCameraToPlayer();
    if (this.onCutsceneEnd) {
      this.onCutsceneEnd();
    }
  }

  /**
   * Updates player movement with agile Martian low-gravity physics.
   * Supports Desktop Keyboard, Touch Virtual Joystick, and Smart TV Gamepad.
   */
  public updatePlayerPhysics(
    moveInput: { x: number; y: number },
    isJumpRequested: boolean,
    dt: number,
    totalTime: number
  ) {
    if (this.isCutscene) return;

    const moveX = moveInput.x;
    const moveZ = moveInput.y;
    const isMoving = Math.abs(moveX) > 0.08 || Math.abs(moveZ) > 0.08;

    if (isMoving) {
      // Calculate target yaw angle
      const targetAngle = Math.atan2(moveX, moveZ);

      // Shortest angle difference interpolation
      let angleDiff = targetAngle - this.playerYaw;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      this.playerYaw += angleDiff * Math.min(1.0, 14.0 * dt);
      this.astronaut.rootGroup.rotation.y = this.playerYaw;

      // Agile Martian low-gravity stride (scaled by joystick deflection magnitude)
      const inputMagnitude = Math.min(1.0, Math.sqrt(moveX * moveX + moveZ * moveZ));
      const speed = this.moveSpeed * inputMagnitude * dt;
      this.playerPos.x += Math.sin(this.playerYaw) * speed;
      this.playerPos.z += Math.cos(this.playerYaw) * speed;

      // Emit footstep dust puff
      if (this.isGrounded && Math.random() < 0.3) {
        this.emitFootstepDust();
      }
    }

    // Martian Low-Gravity Jump (0.38g)
    if (isJumpRequested && this.isGrounded) {
      this.playerVel.y = this.jumpForce;
      this.isGrounded = false;
      this.emitFootstepDust(true);
    }

    // Apply Mars gravity: ~3.72 m/s^2 scaled
    if (!this.isGrounded) {
      this.playerVel.y -= 9.8 * 0.38 * dt; // 0.38g
      this.playerPos.y += this.playerVel.y * dt;

      if (this.playerPos.y <= 0) {
        this.playerPos.y = 0;
        this.playerVel.y = 0;
        this.isGrounded = true;
        this.emitFootstepDust();
      }
    }

    this.astronaut.rootGroup.position.copy(this.playerPos);
    this.astronaut.updateAnimation(isMoving, !this.isGrounded, totalTime);

    // Semi-isometric camera follow with anti-occlusion
    this.updateCamera(dt);
  }

  /**
   * Semi-isometric higher camera follow and Anti-Occlusion Transparency
   */
  private updateCamera(dt: number) {
    const dist = 6.8;
    const height = 4.2;

    const targetX = this.playerPos.x - Math.sin(this.playerYaw) * dist;
    const targetZ = this.playerPos.z - Math.cos(this.playerYaw) * dist;
    const targetY = this.playerPos.y + height;

    this.cameraDesiredPos.set(targetX, targetY, targetZ);
    this.cameraLookTarget.set(this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z);

    const lambda = 7.5;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.cameraDesiredPos.x, lambda, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.cameraDesiredPos.y, lambda, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.cameraDesiredPos.z, lambda, dt);
    this.camera.lookAt(this.cameraLookTarget);

    // Anti-Occlusion Check:
    // If the Starship or large structure is between camera and player, fade its material
    this.checkCameraOcclusion();
  }

  private checkCameraOcclusion() {
    const camPos = this.camera.position;
    const pPos = this.playerPos;

    // Check if lander (at 0, 0, 0, radius ~3.2) is directly between camera and player
    const distCamToLander = Math.sqrt(camPos.x * camPos.x + camPos.z * camPos.z);
    const distPlayerToLander = Math.sqrt(pPos.x * pPos.x + pPos.z * pPos.z);

    // If player is on opposite side of lander from camera
    const dot = (camPos.x * pPos.x + camPos.z * pPos.z) / (distCamToLander * distPlayerToLander || 1);
    const isOccluded = dot < 0.2 && distCamToLander > 4.0 && distPlayerToLander > 2.0;

    const targetOpacity = isOccluded ? 0.35 : 1.0;
    this.structures.landerMaterials.forEach((mat) => {
      mat.transparent = isOccluded;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.25);
    });
  }

  /**
   * Magnet Resource Collection & Proximity Interaction Updates
   */
  public updateInteractiveSystems(colonyState: ColonyState, dt: number, totalTime: number) {
    const pPos = this.playerPos;

    // 1. MAGNET RESOURCE COLLECTION
    this.structures.resources.forEach((res) => {
      if (res.collected) return;

      const mesh = res.mesh;
      const dx = pPos.x - mesh.position.x;
      const dy = (pPos.y + 0.9) - mesh.position.y;
      const dz = pPos.z - mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Magnet attraction radius (3.8 meters)
      if (dist < 3.8) {
        res.isMagnetized = true;
      }

      if (res.isMagnetized) {
        // Accelerate and lerp rapidly towards astronaut's chest
        const pullSpeed = Math.max(10.0, 16.0 - dist * 2.0);
        mesh.position.x += (dx / dist) * pullSpeed * dt;
        mesh.position.y += (dy / (dist || 1)) * pullSpeed * dt;
        mesh.position.z += (dz / dist) * pullSpeed * dt;

        mesh.rotation.x += dt * 8.0;
        mesh.rotation.y += dt * 10.0;

        // Pickup threshold reached!
        if (dist < 0.85) {
          res.collected = true;
          mesh.visible = false;
          this.emitPickupSparks(mesh.position, res.type);

          if (this.onResourceCollected) {
            this.onResourceCollected(res.type, mesh.position.clone());
          }
        }
      } else {
        // Gentle bobbing and rotating in place
        const baseY = res.mesh.userData.baseY || 0.4;
        const seed = res.mesh.userData.seed || 0;
        mesh.position.y = baseY + Math.sin(totalTime * 3.0 + seed) * 0.08;
        mesh.rotation.y += dt * 1.2;
      }
    });

    // 2. PROXIMITY TRIGGER ZONES & 1.5s AUTO-INTERACT
    const activeZone = this.detectNearbyTriggerZone(colonyState);
    if (activeZone) {
      if (this.lastTriggerId === activeZone.id) {
        // Accumulate hold timer if requirements are satisfied
        if (activeZone.hasRequirements) {
          this.triggerTimer += dt;
          activeZone.progressRatio = Math.min(1.0, this.triggerTimer / this.triggerHoldDuration);

          // Auto-trigger completion on full fill!
          if (this.triggerTimer >= this.triggerHoldDuration) {
            this.triggerTimer = 0;
            if (this.onTriggerCompleted) {
              this.onTriggerCompleted(activeZone.id);
            }
          }
        } else {
          this.triggerTimer = 0;
          activeZone.progressRatio = 0;
        }
      } else {
        this.lastTriggerId = activeZone.id;
        this.triggerTimer = 0;
        activeZone.progressRatio = 0;
      }
    } else {
      this.lastTriggerId = null;
      this.triggerTimer = 0;
    }

    this.currentTrigger = activeZone;

    // 3. UPDATE DIRECTIONAL GUIDE ARROW
    let targetCoords: { x: number; z: number } | null = null;
    if (colonyState.stage === 0 && !colonyState.buildings.moxie) {
      targetCoords = { x: -6, z: 4 }; // MOXIE
    } else if (colonyState.stage === 1) {
      // Find nearest uncollected Regolith
      const nearRegolith = this.findNearestResource('regolith');
      targetCoords = nearRegolith ? { x: nearRegolith.mesh.position.x, z: nearRegolith.mesh.position.z } : { x: 7, z: 3 };
    } else if (colonyState.stage === 2) {
      targetCoords = { x: 7, z: 3 }; // Solar Array Zone
    } else if (colonyState.stage === 3) {
      if (colonyState.waterIce < 5) {
        const nearIce = this.findNearestResource('ice');
        targetCoords = nearIce ? { x: nearIce.mesh.position.x, z: nearIce.mesh.position.z } : { x: 0, z: -18 };
      } else {
        targetCoords = { x: 0, z: -18 }; // Biodome Zone
      }
    } else if (colonyState.stage === 4) {
      targetCoords = { x: -10, z: -10 }; // Habitat Zone
    }

    this.astronaut.updateGuideArrow(this.playerPos, targetCoords, totalTime);
  }

  private findNearestResource(type: 'regolith' | 'ice'): CollectableResource | null {
    let nearest: CollectableResource | null = null;
    let minDist = Infinity;
    this.structures.resources.forEach((r) => {
      if (!r.collected && r.type === type) {
        const d = Math.sqrt(
          Math.pow(this.playerPos.x - r.mesh.position.x, 2) + Math.pow(this.playerPos.z - r.mesh.position.z, 2)
        );
        if (d < minDist) {
          minDist = d;
          nearest = r;
        }
      }
    });
    return nearest;
  }

  /**
   * Detects if the player is inside an interactive trigger zone
   */
  private detectNearbyTriggerZone(state: ColonyState): InteractiveTriggerZone | null {
    const p = this.playerPos;

    // 1. MOXIE Zone at (-6, 4)
    const distMoxie = Math.sqrt(Math.pow(p.x - -6, 2) + Math.pow(p.z - 4, 2));
    if (distMoxie < 3.2 && !state.buildings.moxie) {
      return {
        id: 'trigger-moxie',
        name: 'Extrator de Oxigênio (MOXIE)',
        actionText: 'Ativando MOXIE...',
        requirementText: 'Permaneça na área para ativar',
        hasRequirements: true,
        progressRatio: 0,
        worldPos: new THREE.Vector3(-6, 1.8, 4),
      };
    }

    // 2. Solar Array Slot at (7, 3)
    const distSolar = Math.sqrt(Math.pow(p.x - 7, 2) + Math.pow(p.z - 3, 2));
    if (distSolar < 3.2 && !state.buildings.solarPanels && state.buildings.moxie) {
      const hasReg = state.regolith >= 5;
      return {
        id: 'trigger-solar',
        name: 'Zona de Construção: Matriz Solar',
        actionText: hasReg ? 'Construindo Placa Solar...' : 'Regolito Insuficiente',
        requirementText: hasReg ? 'Depósito: 5 Regolitos (+20 kW)' : `Requer 5 Regolitos (Você tem: ${state.regolith}/5)`,
        hasRequirements: hasReg,
        progressRatio: 0,
        worldPos: new THREE.Vector3(7, 1.6, 3),
      };
    }

    // 3. Biodome / Water Extractor Slot at (0, -18)
    const distDome = Math.sqrt(Math.pow(p.x - 0, 2) + Math.pow(p.z - -18, 2));
    if (distDome < 4.8 && !state.buildings.bioDome && state.buildings.solarPanels) {
      const hasIce = state.waterIce >= 5;
      return {
        id: 'trigger-biodome',
        name: 'Zona de Construção: Biodomo',
        actionText: hasIce ? 'Construindo Biodomo...' : 'Gelo Insuficiente',
        requirementText: hasIce ? 'Depósito: 5 Gelos (Estufa & Água)' : `Requer 5 Gelos (Você tem: ${state.waterIce}/5)`,
        hasRequirements: hasIce,
        progressRatio: 0,
        worldPos: new THREE.Vector3(0, 2.2, -18),
      };
    }

    // 4. Pressurized Habitat Slot at (-10, -10)
    const distHab = Math.sqrt(Math.pow(p.x - -10, 2) + Math.pow(p.z - -10, 2));
    if (distHab < 4.2 && !state.buildings.habitat && state.buildings.bioDome) {
      return {
        id: 'trigger-habitat',
        name: 'Zona de Construção: Habitat Pressurizado',
        actionText: 'Construindo Habitat...',
        requirementText: 'Módulo Final · Habitabilidade 100%',
        hasRequirements: true,
        progressRatio: 0,
        worldPos: new THREE.Vector3(-10, 2.2, -10),
      };
    }

    return null;
  }

  /**
   * Syncs visual structure states with game logic
   */
  public syncColonyStructures(state: ColonyState, timeSec: number) {
    // 1. MOXIE Beam & Aura Dome
    if (state.buildings.moxie) {
      this.structures.moxieLightBeamMat.color.setHex(0x10b981); // Bright Emerald Green
      this.structures.moxieLightBeamMat.opacity = 0.75;
      this.structures.moxieAuraMat.opacity = 0.12 + Math.sin(timeSec * 2.5) * 0.04;
    } else {
      this.structures.moxieLightBeamMat.color.setHex(0x0284c7); // Blue beacon
      this.structures.moxieAuraMat.opacity = 0.0;
    }

    // 2. Solar Panels & Ring
    this.structures.solarGroup.visible = state.buildings.solarPanels;
    this.structures.solarSlotRing.visible = !state.buildings.solarPanels;
    if (!state.buildings.solarPanels) {
      const ringPulse = 0.6 + Math.sin(timeSec * 3.5) * 0.25;
      (this.structures.solarSlotRing.material as THREE.MeshBasicMaterial).opacity = ringPulse;
    }

    // 3. Biodome & Ring
    this.structures.bioDomeGroup.visible = state.buildings.bioDome;
    this.structures.bioDomeSlotRing.visible = !state.buildings.bioDome;
    if (!state.buildings.bioDome) {
      const domePulse = 0.6 + Math.sin(timeSec * 3.0) * 0.25;
      (this.structures.bioDomeSlotRing.material as THREE.MeshBasicMaterial).opacity = domePulse;
    }

    // 4. Habitat & Ring
    this.structures.habitatGroup.visible = state.buildings.habitat;
    this.structures.habitatSlotRing.visible = !state.buildings.habitat;
    if (!state.buildings.habitat) {
      const habPulse = 0.6 + Math.sin(timeSec * 4.0) * 0.25;
      (this.structures.habitatSlotRing.material as THREE.MeshBasicMaterial).opacity = habPulse;
    }
  }

  private emitFootstepDust(isHighBurst: boolean = false) {
    const count = isHighBurst ? 8 : 2;
    for (let i = 0; i < count; i++) {
      const idx = (this.dustIndex % this.maxDust) * 3;
      this.dustIndex++;
      this.dustPositions[idx] = this.playerPos.x + (Math.random() - 0.5) * 0.4;
      this.dustPositions[idx + 1] = isHighBurst ? 0.25 + Math.random() * 0.5 : 0.08;
      this.dustPositions[idx + 2] = this.playerPos.z + (Math.random() - 0.5) * 0.4;
    }
    (this.dustPoints.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  private emitLandingDust() {
    for (let i = 0; i < 6; i++) {
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

  private emitPickupSparks(pos: THREE.Vector3, type: 'regolith' | 'ice') {
    for (let i = 0; i < 5; i++) {
      const idx = (this.dustIndex % this.maxDust) * 3;
      this.dustIndex++;
      this.dustPositions[idx] = pos.x + (Math.random() - 0.5) * 0.6;
      this.dustPositions[idx + 1] = pos.y + Math.random() * 0.8;
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
          }, 80);
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
    window.removeEventListener('resize', this.onResize);
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.renderer.dispose();
  }
}
