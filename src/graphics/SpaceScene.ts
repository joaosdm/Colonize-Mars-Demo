/**
 * Three.js Space Simulation Graphics Engine
 * Handles celestial bodies, procedural textures, orbit paths,
 * camera tracking, particle thruster plumes, and software-WebGL pacing.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  generateMarsTexture,
  generateEarthTexture,
  generateCloudsTexture,
  generateMoonTexture,
  generateJupiterTexture,
  generateSunTexture,
} from './textureGenerator';
import { createProceduralShip, ShipMeshReferences } from './shipModel';
import { CelestialBodyData, Vector3D, StarSystem } from '../types/game';
import { computeBodyPosition } from '../sim/orbitalMath';

export interface SpaceSceneOptions {
  container: HTMLDivElement;
  onLanded?: (bodyId: string) => void;
}

export class SpaceScene {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public shipRefs: ShipMeshReferences;
  public isSoftwareGl: boolean;

  private bodiesMap = new Map<string, { mesh: THREE.Mesh; data: CelestialBodyData; cloudMesh?: THREE.Mesh }>();
  private orbitLinesMap = new Map<string, THREE.Line>();
  private trajectoryLine: THREE.Line;
  private particlePoints: THREE.Points;
  private particlePositions: Float32Array;
  private particleAlphas: Float32Array;
  private maxParticles = 300;
  private particleIndex = 0;

  private frameId: number = 0;
  private isDisposed: boolean = false;
  private container: HTMLDivElement;

  // Camera follow parameters
  public cameraMode: 'chase' | 'orbit' | 'cockpit' | 'system' = 'chase';
  public targetBodyId: string = 'mars';
  private cameraLookTarget = new THREE.Vector3();
  private cameraDesiredPos = new THREE.Vector3();

  // Scratch reusable vectors for zero-GC render loop
  private _scratchV1 = new THREE.Vector3();
  private _scratchV2 = new THREE.Vector3();

  constructor(options: SpaceSceneOptions) {
    this.container = options.container;

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

    // 2. WebGL Renderer
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));

    this.container.appendChild(this.renderer.domElement);

    // 3. Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030712); // Deep cosmic void
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 5000);
    this.camera.position.set(0, 15, 35);

    // 4. Mandatory Studio Environment Reflection
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 5. Lighting: Warm Sol Key Light + Cool Cosmic Fill
    const sunLight = new THREE.PointLight(0xfffaed, 2.5, 2500, 0.2);
    sunLight.position.set(0, 0, 0);
    this.scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x1e1b4b, 0.6);
    this.scene.add(hemiLight);

    const ambientFill = new THREE.AmbientLight(0xffffff, 0.2);
    this.scene.add(ambientFill);

    // 6. Starfield Background
    this.createStarfield();

    // 7. Hero Spaceship
    this.shipRefs = createProceduralShip();
    this.shipRefs.rootGroup.position.set(110, 0, 8); // Start in high Earth orbit
    this.scene.add(this.shipRefs.rootGroup);

    // 8. Projected Trajectory Line
    const trajGeo = new THREE.BufferGeometry();
    const maxTrajPoints = 120;
    const trajPositions = new Float32Array(maxTrajPoints * 3);
    trajGeo.setAttribute('position', new THREE.BufferAttribute(trajPositions, 3));
    const trajMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    this.trajectoryLine = new THREE.Line(trajGeo, trajMat);
    this.trajectoryLine.frustumCulled = false;
    this.scene.add(this.trajectoryLine);

    // 9. Thruster Particle Ring Buffer
    const pGeo = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(this.maxParticles * 3);
    this.particleAlphas = new Float32Array(this.maxParticles);
    pGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.6,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    this.particlePoints = new THREE.Points(pGeo, pMat);
    this.particlePoints.frustumCulled = false;
    this.scene.add(this.particlePoints);

    // Handle resize
    window.addEventListener('resize', this.onResize);
  }

  private createStarfield() {
    const starCount = 1800;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const radius = 1200 + Math.random() * 800;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      starPos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = radius * Math.cos(phi);

      // Star temperature tinting (blue-white to amber)
      const t = Math.random();
      if (t < 0.6) {
        starColors[i * 3] = 0.9;
        starColors[i * 3 + 1] = 0.95;
        starColors[i * 3 + 2] = 1.0;
      } else if (t < 0.85) {
        starColors[i * 3] = 0.6;
        starColors[i * 3 + 1] = 0.8;
        starColors[i * 3 + 2] = 1.0;
      } else {
        starColors[i * 3] = 1.0;
        starColors[i * 3 + 1] = 0.8;
        starColors[i * 3 + 2] = 0.5;
      }
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
    });
    const starMesh = new THREE.Points(starGeo, starMat);
    this.scene.add(starMesh);
  }

  public populateSystem(system: StarSystem) {
    // Clear old bodies
    this.bodiesMap.forEach((entry) => {
      this.scene.remove(entry.mesh);
      if (entry.cloudMesh) this.scene.remove(entry.cloudMesh);
    });
    this.bodiesMap.clear();

    this.orbitLinesMap.forEach((line) => {
      this.scene.remove(line);
    });
    this.orbitLinesMap.clear();

    // Cache textures
    const marsTex = generateMarsTexture(512);
    const earthTex = generateEarthTexture(512);
    const cloudsTex = generateCloudsTexture(512);
    const moonTex = generateMoonTexture(256);
    const jupiterTex = generateJupiterTexture(512);
    const sunTex = generateSunTexture(256);

    for (const body of system.bodies) {
      let mat: THREE.Material;
      const sphereGeo = new THREE.SphereGeometry(body.radius, 32, 24);

      if (body.type === 'star') {
        mat = new THREE.MeshBasicMaterial({
          map: sunTex,
          color: 0xfff0aa,
        });
      } else if (body.id === 'earth') {
        mat = new THREE.MeshStandardMaterial({
          map: earthTex,
          roughness: 0.45,
          metalness: 0.1,
        });
      } else if (body.id === 'mars') {
        mat = new THREE.MeshStandardMaterial({
          map: marsTex,
          roughness: 0.75,
          metalness: 0.15,
        });
      } else if (body.id === 'jupiter') {
        mat = new THREE.MeshStandardMaterial({
          map: jupiterTex,
          roughness: 0.6,
          metalness: 0.05,
        });
      } else if (body.type === 'moon' || body.type === 'asteroid') {
        mat = new THREE.MeshStandardMaterial({
          map: moonTex,
          roughness: 0.85,
          metalness: 0.2,
        });
      } else {
        mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(body.color),
          roughness: 0.65,
          metalness: 0.2,
        });
      }

      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.name = `Body_${body.id}`;
      this.scene.add(mesh);

      let cloudMesh: THREE.Mesh | undefined;
      if (body.id === 'earth') {
        const cloudGeo = new THREE.SphereGeometry(body.radius * 1.025, 32, 24);
        const cloudMat = new THREE.MeshStandardMaterial({
          map: cloudsTex,
          transparent: true,
          opacity: 0.65,
          blending: THREE.NormalBlending,
        });
        cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
        this.scene.add(cloudMesh);
      }

      this.bodiesMap.set(body.id, { mesh, data: body, cloudMesh });

      // Build orbital path ring line
      if (body.semiMajorAxis > 0) {
        const segs = 96;
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= segs; i++) {
          const angle = (i / segs) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(angle) * body.semiMajorAxis, 0, Math.sin(angle) * body.semiMajorAxis));
        }
        const orbitGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const orbitMat = new THREE.LineBasicMaterial({
          color: body.id === 'mars' ? 0xea580c : 0x475569,
          transparent: true,
          opacity: body.id === 'mars' ? 0.6 : 0.25,
        });
        const orbitLine = new THREE.Line(orbitGeo, orbitMat);
        this.scene.add(orbitLine);
        this.orbitLinesMap.set(body.id, orbitLine);
      }
    }
  }

  public updateBodies(timeSeconds: number) {
    this.bodiesMap.forEach((entry) => {
      let parentPos: Vector3D = { x: 0, y: 0, z: 0 };
      if (entry.data.parentBodyId && this.bodiesMap.has(entry.data.parentBodyId)) {
        const pMesh = this.bodiesMap.get(entry.data.parentBodyId)!.mesh;
        parentPos = { x: pMesh.position.x, y: pMesh.position.y, z: pMesh.position.z };
      }

      const pos = computeBodyPosition(entry.data, timeSeconds, parentPos);
      entry.mesh.position.set(pos.x, pos.y, pos.z);
      // Axial spin rotation
      entry.mesh.rotation.y += 0.002;

      if (entry.cloudMesh) {
        entry.cloudMesh.position.copy(entry.mesh.position);
        entry.cloudMesh.rotation.y += 0.0025;
      }

      // If body has parent (like Moon around Earth), shift orbit line
      if (entry.data.parentBodyId && this.orbitLinesMap.has(entry.data.id)) {
        this.orbitLinesMap.get(entry.data.id)!.position.set(parentPos.x, parentPos.y, parentPos.z);
      }
    });
  }

  public updateShip(
    pos: Vector3D,
    vel: Vector3D,
    throttle: number,
    headingPitch: number,
    headingYaw: number,
    deltaSec: number
  ) {
    this.shipRefs.rootGroup.position.set(pos.x, pos.y, pos.z);
    this.shipRefs.rootGroup.rotation.set(headingPitch, headingYaw, 0, 'YXZ');

    // Thruster plume & dynamic light
    if (throttle > 0.01) {
      this.shipRefs.thrusterPlume.scale.set(1, throttle * 1.4, 1);
      (this.shipRefs.thrusterPlume.material as THREE.MeshBasicMaterial).opacity = Math.min(1.0, throttle * 0.95);
      this.shipRefs.thrusterLight.intensity = throttle * 12;

      // Emit thruster particle
      this.emitThrusterParticle(pos, vel, headingPitch, headingYaw);
    } else {
      (this.shipRefs.thrusterPlume.material as THREE.MeshBasicMaterial).opacity = 0;
      this.shipRefs.thrusterLight.intensity = 0;
    }

    // Update particle positions
    const posAttr = this.particlePoints.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < this.maxParticles; i++) {
      this.particlePositions[i * 3 + 1] += 0.01; // subtle drift
    }
    posAttr.needsUpdate = true;
  }

  private emitThrusterParticle(pos: Vector3D, vel: Vector3D, pitch: number, yaw: number) {
    const idx = (this.particleIndex % this.maxParticles) * 3;
    this.particleIndex++;

    // Calculate backward vector
    const backX = -Math.sin(yaw) * Math.cos(pitch);
    const backY = Math.sin(pitch);
    const backZ = -Math.cos(yaw) * Math.cos(pitch);

    this.particlePositions[idx] = pos.x + backX * 2.2 + (Math.random() - 0.5) * 0.3;
    this.particlePositions[idx + 1] = pos.y + backY * 2.2 + (Math.random() - 0.5) * 0.3;
    this.particlePositions[idx + 2] = pos.z + backZ * 2.2 + (Math.random() - 0.5) * 0.3;

    (this.particlePoints.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  public updateTrajectory(points: Vector3D[]) {
    const posAttr = this.trajectoryLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;

    for (let i = 0; i < points.length && i * 3 < array.length; i++) {
      array[i * 3] = points[i].x;
      array[i * 3 + 1] = points[i].y;
      array[i * 3 + 2] = points[i].z;
    }
    posAttr.needsUpdate = true;
    this.trajectoryLine.geometry.setDrawRange(0, points.length);
  }

  public updateCamera(deltaSec: number) {
    const shipPos = this.shipRefs.rootGroup.position;

    if (this.cameraMode === 'chase') {
      // Third-person chase camera closer behind hero ship
      const shipRotY = this.shipRefs.rootGroup.rotation.y;
      const dist = 6.5;
      const height = 2.2;

      const targetX = shipPos.x - Math.sin(shipRotY) * dist;
      const targetZ = shipPos.z - Math.cos(shipRotY) * dist;
      const targetY = shipPos.y + height;

      this.cameraDesiredPos.set(targetX, targetY, targetZ);
      this.cameraLookTarget.set(shipPos.x, shipPos.y + 0.3, shipPos.z);

      // Frame-rate independent exponential damping
      const lambda = 8.0;
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.cameraDesiredPos.x, lambda, deltaSec);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.cameraDesiredPos.y, lambda, deltaSec);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.cameraDesiredPos.z, lambda, deltaSec);
      this.camera.lookAt(this.cameraLookTarget);
    } else if (this.cameraMode === 'system') {
      // Top-down tactical solar system view
      this.cameraDesiredPos.set(0, 380, 50);
      this.cameraLookTarget.set(0, 0, 0);

      this.camera.position.lerp(this.cameraDesiredPos, 0.05);
      this.camera.lookAt(this.cameraLookTarget);
    } else if (this.cameraMode === 'orbit') {
      // Focus on targeted celestial body (e.g. Mars)
      const target = this.bodiesMap.get(this.targetBodyId);
      if (target) {
        const bodyPos = target.mesh.position;
        const viewDist = target.data.radius * 3.5;
        this.cameraDesiredPos.set(bodyPos.x + viewDist * 0.8, bodyPos.y + viewDist * 0.4, bodyPos.z + viewDist);
        this.cameraLookTarget.copy(bodyPos);

        this.camera.position.lerp(this.cameraDesiredPos, 0.08);
        this.camera.lookAt(this.cameraLookTarget);
      }
    }
  }

  /**
   * Title screen scenic Mars orbital flyover camera pan
   */
  public updateTitleFlyby(timeSec: number) {
    const mars = this.bodiesMap.get('mars');
    if (mars) {
      const pos = mars.mesh.position;
      const camRadius = mars.data.radius * 3.4;
      const angle = timeSec * 0.12;

      // Frame Mars slightly to the right of the screen
      this.camera.position.set(pos.x + Math.cos(angle) * camRadius + 4.5, pos.y + 2.8, pos.z + Math.sin(angle) * camRadius);
      // Look slightly to the left of Mars to center Mars in the right 2/3 of viewport
      this._scratchV1.set(pos.x - 2.5, pos.y, pos.z);
      this.camera.lookAt(this._scratchV1);

      // Place ship gracefully cruising near Mars on the far right flank
      this.shipRefs.rootGroup.position.set(
        pos.x + 8.2 + Math.cos(angle) * 2.5,
        pos.y + 1.2,
        pos.z + Math.sin(angle) * 2.5
      );
      this.shipRefs.rootGroup.rotation.set(0.1, -Math.PI / 3, 0.1);
    }
  }

  public scheduleNextFrame(cb: (time: number) => void): number {
    if (this.isDisposed) return 0;
    if (this.isSoftwareGl) {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(() => cb(performance.now()), 60);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
      return this.frameId;
    } else {
      this.frameId = requestAnimationFrame(cb);
      return this.frameId;
    }
  }

  public render() {
    this.renderer.render(this.scene, this.camera);
  }

  private onResize = () => {
    if (this.isDisposed || !this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public dispose() {
    this.isDisposed = true;
    window.removeEventListener('resize', this.onResize);
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    // Dispose renderer
    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
