/**
 * Interactive 3D Mars Planetary Orbital Explorer [V]
 * Lets astronauts pilot the Starship around a procedural 3D globe of Mars,
 * detect orbital anomaly beacons (Olympus Mons, Valles Marineris, Planum Boreum,
 * Cydonia, Hellas Planitia, Cratera Jezero), spend H₂ fuel to scan & retrieve rare resources,
 * and land back at Gale Crater Base.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Rocket,
  Compass,
  Radar,
  CheckCircle2,
  Fuel,
  ArrowDownToLine,
  Navigation,
} from 'lucide-react';
import type { ColonyState } from '../sim/marsColonyLogic';
import { PLANETARY_SITES, PlanetarySite } from '../sim/marsWorld';
import type { QualityConfig } from '../sim/devicePerformance';

interface OrbitalExplorerModalProps {
  colonyState: ColonyState;
  qualityConfig?: QualityConfig;
  isMobileLayout?: boolean;
  onScanSite: (siteId: string) => void;
  onLandAtBase: () => void;
}

const MARS_RADIUS = 3.2;
const ORBIT_ALTITUDE = 4.35;

function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const cosLat = Math.cos(lat);
  return new THREE.Vector3(
    radius * cosLat * Math.sin(lon),
    radius * Math.sin(lat),
    radius * cosLat * Math.cos(lon)
  );
}

function createMarsGlobeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Rich Martian ochre/rust base gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#e2e8f0'); // North Polar Cap
    grad.addColorStop(0.11, '#b85a35');
    grad.addColorStop(0.35, '#c65a30');
    grad.addColorStop(0.55, '#a84422');
    grad.addColorStop(0.84, '#b44d2a');
    grad.addColorStop(0.92, '#cbd5e1'); // South Polar Cap
    grad.addColorStop(1.0, '#f1f5f9');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    // Basalt dark maria (Syrtis Major, Acidalia, etc.) wrapped horizontally for a seamless 360° globe
    for (let i = 0; i < 42; i++) {
      const x = (Math.sin(i * 19.7) * 0.5 + 0.5) * 512;
      const y = 36 + (Math.cos(i * 11.3) * 0.5 + 0.5) * 184;
      const rx = 18 + (i % 7) * 11;
      const ry = 10 + (i % 5) * 7;
      const rot = (i % 4) * 0.4;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(82, 32, 18, 0.34)' : 'rgba(218, 120, 68, 0.25)';
      for (const ox of [-512, 0, 512]) {
        ctx.beginPath();
        ctx.ellipse(x + ox, y, rx, ry, rot, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Valles Marineris equatorial canyon scar
    ctx.strokeStyle = 'rgba(62, 20, 12, 0.72)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(235, 138);
    ctx.quadraticCurveTo(285, 148, 336, 134);
    ctx.stroke();

    // Olympus Mons caldera dome
    ctx.fillStyle = 'rgba(130, 52, 28, 0.75)';
    ctx.beginPath();
    ctx.arc(166, 98, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(245, 168, 118, 0.45)';
    ctx.beginPath();
    ctx.arc(166, 98, 7, 0, Math.PI * 2);
    ctx.fill();

    // Impact craters across surface (horizontally wrapped to avoid meridian seam)
    for (let i = 0; i < 65; i++) {
      const x = (Math.sin(i * 47.3) * 0.5 + 0.5) * 512;
      const y = 28 + (Math.cos(i * 29.1) * 0.5 + 0.5) * 200;
      const r = 2 + (i % 5) * 1.8;
      ctx.strokeStyle = 'rgba(72, 24, 14, 0.45)';
      ctx.lineWidth = 1.2;
      for (const ox of [-512, 0, 512]) {
        ctx.beginPath();
        ctx.arc(x + ox, y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export const OrbitalExplorerModal: React.FC<OrbitalExplorerModalProps> = ({
  colonyState,
  qualityConfig,
  isMobileLayout = false,
  onScanSite,
  onLandAtBase,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const shipLatRef = useRef<number>(0.18);
  const shipLonRef = useRef<number>(0.15);
  const autopilotTargetRef = useRef<{ lat: number; lon: number } | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const qualityConfigRef = useRef<QualityConfig | undefined>(qualityConfig);
  qualityConfigRef.current = qualityConfig;
  const discoveredIdsRef = useRef<string[]>(colonyState.discoveredSites);
  discoveredIdsRef.current = colonyState.discoveredSites;

  const [telemetry, setTelemetry] = useState<{
    latDeg: number;
    lonDeg: number;
    nearestSite: PlanetarySite;
    angularDist: number;
  }>({
    latDeg: 10,
    lonDeg: 9,
    nearestSite: PLANETARY_SITES[0],
    angularDist: 1.0,
  });

  const [selectedSiteId, setSelectedSiteId] = useState<string>(PLANETARY_SITES[0].id);

  const flyToSite = useCallback((site: PlanetarySite) => {
    setSelectedSiteId(site.id);
    autopilotTargetRef.current = { lat: site.lat, lon: site.lon };
  }, []);

  const nudgeOrbit = useCallback((dLat: number, dLon: number) => {
    autopilotTargetRef.current = null;
    shipLatRef.current = Math.max(-1.25, Math.min(1.25, shipLatRef.current + dLat));
    shipLonRef.current += dLon;
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyV') {
        e.preventDefault();
        onLandAtBase();
        return;
      }
      if (
        e.code === 'KeyW' ||
        e.code === 'KeyS' ||
        e.code === 'KeyA' ||
        e.code === 'KeyD' ||
        e.code.startsWith('Arrow')
      ) {
        autopilotTargetRef.current = null;
        keysRef.current.add(e.code);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onLandAtBase]);

  // Mount interactive 3D Mars Globe + Flying Starship
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
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

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const q = qualityConfigRef.current;

    const renderer = new THREE.WebGLRenderer({
      antialias: q ? q.antialias && !isSoftwareGl : !isSoftwareGl,
      powerPreference: 'high-performance',
      stencil: false,
    });
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(
      isSoftwareGl ? 0.75 : Math.min(window.devicePixelRatio || 1, q?.pixelRatioCap ?? 1.6)
    );
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040712);

    if (q?.enableEnvMap !== false) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }

    const aspect = width / Math.max(1, height);
    const camera = new THREE.PerspectiveCamera(aspect < 0.85 ? 56 : 48, aspect, 0.1, 200);
    camera.position.set(0, 3.2, aspect < 0.85 ? 11.4 : 10.2);

    // Sun & bounce lighting
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.5);
    sun.position.set(16, 8, 12);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0x475569, 0.55));

    // Deep-space starfield (scaled by quality tier)
    const starCount = q?.enableStarfieldCount ?? 500;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 45 + (i % 17) * 2.5;
      const theta = i * 2.39996;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / starCount);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xe2e8f0, size: 0.24 })
    );
    scene.add(stars);

    // Pointer / Touch Drag Steering directly on the 3D Mars globe
    let draggingGlobe = false;
    let lastDragX = 0;
    let lastDragY = 0;
    const onGlobePointerDown = (e: PointerEvent) => {
      if (e.target !== renderer.domElement) return;
      draggingGlobe = true;
      lastDragX = e.clientX;
      lastDragY = e.clientY;
    };
    const onGlobePointerMove = (e: PointerEvent) => {
      if (!draggingGlobe) return;
      const dx = e.clientX - lastDragX;
      const dy = e.clientY - lastDragY;
      lastDragX = e.clientX;
      lastDragY = e.clientY;
      autopilotTargetRef.current = null;
      shipLonRef.current -= dx * 0.0065;
      shipLatRef.current = Math.max(-1.35, Math.min(1.35, shipLatRef.current + dy * 0.0055));
    };
    const onGlobePointerUp = () => {
      draggingGlobe = false;
    };
    renderer.domElement.addEventListener('pointerdown', onGlobePointerDown);
    window.addEventListener('pointermove', onGlobePointerMove);
    window.addEventListener('pointerup', onGlobePointerUp);
    window.addEventListener('pointercancel', onGlobePointerUp);

    // Mars Globe + Atmosphere Halo
    const marsTex = createMarsGlobeTexture();
    const marsMat = new THREE.MeshStandardMaterial({
      map: marsTex,
      roughness: 0.88,
      metalness: 0.04,
    });
    const marsGlobe = new THREE.Mesh(new THREE.SphereGeometry(MARS_RADIUS, 44, 32), marsMat);
    scene.add(marsGlobe);

    const atmoMesh = new THREE.Mesh(
      new THREE.SphereGeometry(MARS_RADIUS * 1.055, 32, 24),
      new THREE.MeshBasicMaterial({
        color: 0xea7a42,
        transparent: true,
        opacity: 0.16,
        side: THREE.BackSide,
      })
    );
    scene.add(atmoMesh);

    // Phobos & Deimos orbiting Mars
    const phobos = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.24, 0),
      new THREE.MeshStandardMaterial({ color: 0x94897f, roughness: 0.92 })
    );
    const deimos = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.14, 0),
      new THREE.MeshStandardMaterial({ color: 0xa89f94, roughness: 0.92 })
    );
    scene.add(phobos, deimos);

    // 6 Planetary Anomaly Beacons anchored to Mars's surface
    const siteBeacons = PLANETARY_SITES.map((site) => {
      const pos = latLonToVec3(site.lat, site.lon, MARS_RADIUS + 0.06);
      const normal = pos.clone().normalize();
      const group = new THREE.Group();
      group.position.copy(pos);
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

      const pinMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(site.accentHex) });
      const pin = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 8), pinMat);
      pin.position.y = 0.22;
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(site.accentHex),
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.28, 20), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      group.add(pin, ring);
      scene.add(group);
      return { site, group, pinMat, ringMat, ring };
    });

    // Gale Crater Home Base Marker
    const basePos = latLonToVec3(0.05, 0.0, MARS_RADIUS + 0.05);
    const baseBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    baseBeacon.position.copy(basePos);
    scene.add(baseBeacon);

    // Player 3D Starship Spacecraft orbiting Mars
    const shipGroup = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.85,
      roughness: 0.2,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.65,
      roughness: 0.4,
    });
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.68, 12), hullMat);
    fuselage.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 12), hullMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 0.47;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.03, 0.22), darkMat);
    wing.position.z = -0.18;
    const thruster = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.34, 8),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 })
    );
    thruster.rotation.x = -Math.PI / 2;
    thruster.position.z = -0.5;
    shipGroup.add(fuselage, nose, wing, thruster);
    scene.add(shipGroup);

    let disposed = false;
    let frameId = 0;
    let lastTime = performance.now();
    let totalTime = 0;
    let lastTelemetryMs = 0;
    const prevShipPos = latLonToVec3(shipLatRef.current, shipLonRef.current, ORBIT_ALTITUDE);

    const onResize = () => {
      if (disposed || !container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const scheduleNext = (cb: (t: number) => void) => {
      if (disposed) return;
      if (isSoftwareGl) {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const st = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (st === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 8);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(() => cb(performance.now()), 75);
          }
        };
        frameId = window.setTimeout(poll, 8);
      } else {
        frameId = requestAnimationFrame(cb);
      }
    };

    const tick = (now: number) => {
      if (disposed) return;
      const dt = Math.min(Math.max((now - lastTime) / 1000, 0.001), 0.12);
      lastTime = now;
      totalTime += dt;

      // Manual steering or Autopilot flight around Mars
      const keys = keysRef.current;
      const steerSpeed = 1.15;
      if (keys.has('KeyW') || keys.has('ArrowUp')) {
        shipLatRef.current = Math.min(1.25, shipLatRef.current + steerSpeed * dt);
      }
      if (keys.has('KeyS') || keys.has('ArrowDown')) {
        shipLatRef.current = Math.max(-1.25, shipLatRef.current - steerSpeed * dt);
      }
      if (keys.has('KeyA') || keys.has('ArrowLeft')) {
        shipLonRef.current -= steerSpeed * dt;
      }
      if (keys.has('KeyD') || keys.has('ArrowRight')) {
        shipLonRef.current += steerSpeed * dt;
      }

      const target = autopilotTargetRef.current;
      if (target) {
        const dLat = target.lat - shipLatRef.current;
        let dLon = target.lon - shipLonRef.current;
        while (dLon > Math.PI) dLon -= Math.PI * 2;
        while (dLon < -Math.PI) dLon += Math.PI * 2;
        shipLatRef.current += dLat * Math.min(1, dt * 3.8);
        shipLonRef.current += dLon * Math.min(1, dt * 3.8);
        if (Math.hypot(dLat, dLon) < 0.03) {
          autopilotTargetRef.current = null;
        }
      }

      // Position Starship & orient nose along flight path
      const shipPos = latLonToVec3(shipLatRef.current, shipLonRef.current, ORBIT_ALTITUDE);
      const delta = shipPos.clone().sub(prevShipPos);
      shipGroup.position.copy(shipPos);
      if (delta.lengthSq() > 0.00001) {
        shipGroup.lookAt(shipPos.clone().add(delta));
      } else {
        const tangent = latLonToVec3(shipLatRef.current, shipLonRef.current + 0.12, ORBIT_ALTITUDE);
        shipGroup.lookAt(tangent);
      }
      prevShipPos.copy(shipPos);

      thruster.scale.set(1, 0.8 + Math.sin(totalTime * 20) * 0.25, 1);

      // Orbit camera smoothly behind Starship looking at Mars
      const camPos = latLonToVec3(
        shipLatRef.current * 0.85 + 0.14,
        shipLonRef.current - 0.18,
        9.4
      );
      camera.position.lerp(camPos, Math.min(1, dt * 4.5));
      camera.lookAt(0, 0, 0);

      // Orbit Phobos & Deimos
      phobos.position.set(Math.cos(totalTime * 0.4) * 6.2, 0.9, Math.sin(totalTime * 0.4) * 6.2);
      deimos.position.set(
        Math.cos(-totalTime * 0.22 + 1.4) * 8.1,
        -1.2,
        Math.sin(-totalTime * 0.22 + 1.4) * 8.1
      );

      // Pulse planetary beacons & color discovered sites emerald
      const discoveredSet = new Set(discoveredIdsRef.current);
      let nearest = PLANETARY_SITES[0];
      let bestDist = Infinity;

      for (const b of siteBeacons) {
        const isDone = discoveredSet.has(b.site.id);
        const col = isDone ? 0x10b981 : new THREE.Color(b.site.accentHex).getHex();
        b.pinMat.color.setHex(col);
        b.ringMat.color.setHex(col);
        const pulse = isDone ? 1.0 : 0.88 + Math.sin(totalTime * 4 + b.site.lon) * 0.24;
        b.ring.scale.set(pulse, pulse, 1);

        const d = shipPos.clone().normalize().angleTo(b.group.position.clone().normalize());
        if (d < bestDist) {
          bestDist = d;
          nearest = b.site;
        }
      }

      if (now - lastTelemetryMs >= 140) {
        lastTelemetryMs = now;
        const normLon = ((((shipLonRef.current * 180) / Math.PI) % 360) + 540) % 360 - 180;
        setTelemetry({
          latDeg: Math.round((shipLatRef.current * 180) / Math.PI),
          lonDeg: Math.round(normLon),
          nearestSite: nearest,
          angularDist: bestDist,
        });
      }

      if (!document.hidden) {
        renderer.render(scene, camera);
      }
      scheduleNext(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onGlobePointerDown);
      window.removeEventListener('pointermove', onGlobePointerMove);
      window.removeEventListener('pointerup', onGlobePointerUp);
      window.removeEventListener('pointercancel', onGlobePointerUp);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      marsTex.dispose();
      marsMat.dispose();
      starGeo.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const focusedSite =
    PLANETARY_SITES.find((s) => s.id === selectedSiteId) || telemetry.nearestSite;
  const isLocked = telemetry.angularDist < 0.36;
  const activeCardSite = isLocked ? telemetry.nearestSite : focusedSite;
  const isAlreadyDiscovered = colonyState.discoveredSites.includes(activeCardSite.id);
  const canScanNow =
    !isAlreadyDiscovered && colonyState.fuel >= activeCardSite.fuelCost;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modo de Exploração Orbital de Marte"
      data-testid="orbital-explorer-modal"
      className="fixed inset-0 z-50 bg-slate-950 select-none overflow-hidden"
    >
      {/* 3D Mars Globe & Starship Canvas */}
      <div ref={mountRef} className="absolute inset-0 z-0" />

      {/* Top Flight HUD Bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-start justify-between gap-3 pointer-events-none">
        <div className="bg-slate-950/90 border border-cyan-500/45 rounded-xl px-4 py-2.5 shadow-xl pointer-events-auto">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-cyan-400">
            <Rocket className="w-3.5 h-3.5" />
            MODO DE VOO ORBITAL · STARSHIP EXPLORER
          </div>
          <h2 className="text-base font-black text-white mt-0.5">
            Órbita de Marte · {colonyState.discoveredSites.length}/{PLANETARY_SITES.length} Sítios
            Descobertos
          </h2>
          <div className="flex items-center gap-4 mt-1 text-xs font-mono text-slate-300 tabular-nums">
            <span className="flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              LAT {telemetry.latDeg}° · LON {telemetry.lonDeg}°
            </span>
            <span className="flex items-center gap-1 text-pink-300 font-bold">
              <Fuel className="w-3.5 h-3.5" />
              Combustível H₂: {colonyState.fuel}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onLandAtBase}
          className="pointer-events-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-xl cursor-pointer transition-colors"
        >
          <ArrowDownToLine className="w-4 h-4" />
          Pousar na Base Gale [ESC]
        </button>
      </div>

      {/* Left Panel: Orbital Anomaly Waypoints */}
      <div className="absolute left-4 top-28 bottom-20 z-10 w-72 hidden md:flex flex-col bg-slate-950/88 border border-slate-700/80 rounded-2xl p-3 shadow-2xl overflow-hidden">
        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1 pb-2 flex items-center gap-1.5">
          <Radar className="w-3.5 h-3.5 text-cyan-400" />
          Sinais Planetários Detectados
        </div>
        <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
          {PLANETARY_SITES.map((site) => {
            const done = colonyState.discoveredSites.includes(site.id);
            const isSelected = activeCardSite.id === site.id;
            return (
              <button
                key={site.id}
                type="button"
                onClick={() => flyToSite(site)}
                className={`w-full text-left p-2.5 rounded-xl border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 border-cyan-400/80'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-white truncate">{site.name}</span>
                  {done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
                  <span>{site.region}</span>
                  <span style={{ color: done ? '#34d399' : site.accentHex }}>
                    {done ? 'Escaneado' : site.signalLabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right / Bottom Target Scanner, Mobile Waypoint Strip & Flight Controls */}
      <div
        className="absolute right-3 bottom-3 left-3 md:right-4 md:bottom-4 md:left-auto z-10 md:w-96 flex flex-col gap-2"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Mobile-Only Horizontal Anomaly Waypoint Selector */}
        <div
          data-testid="orbital-mobile-sites"
          className="flex md:hidden items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
        >
          {PLANETARY_SITES.map((site) => {
            const done = colonyState.discoveredSites.includes(site.id);
            const isSelected = activeCardSite.id === site.id;
            return (
              <button
                key={site.id}
                type="button"
                onClick={() => flyToSite(site)}
                className={`shrink-0 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 border-cyan-400 text-white'
                    : 'bg-slate-950/90 border-slate-700 text-slate-300'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: done ? '#34d399' : site.accentHex }}
                />
                <span>{site.name.split(' · ')[0]}</span>
                {done && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              </button>
            );
          })}
        </div>

        {/* Manual Steering Pad (plus WASD / Touch Drag hint) */}
        <div className="bg-slate-950/88 border border-slate-700/80 rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-300">
          <span className="flex items-center gap-1.5 font-bold truncate">
            <Navigation className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            {isMobileLayout ? 'Arraste Marte ou use:' : 'Pilotar Nave:'}{' '}
            {!isMobileLayout && <strong className="text-white">WASD / Setas</strong>}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => nudgeOrbit(0.24, 0)}
              aria-label="Voar para Norte"
              className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
            >
              N
            </button>
            <button
              type="button"
              onClick={() => nudgeOrbit(-0.24, 0)}
              aria-label="Voar para Sul"
              className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
            >
              S
            </button>
            <button
              type="button"
              onClick={() => nudgeOrbit(0, -0.35)}
              aria-label="Voar para Oeste"
              className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
            >
              O
            </button>
            <button
              type="button"
              onClick={() => nudgeOrbit(0, 0.35)}
              aria-label="Voar para Leste"
              className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
            >
              L
            </button>
          </div>
        </div>

        {/* Active Site Scan & Extraction Card */}
        <div className="bg-slate-950/94 border border-cyan-500/50 rounded-2xl p-3 sm:p-4 shadow-2xl space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-[10px] font-black uppercase tracking-wider"
              style={{ color: isAlreadyDiscovered ? '#34d399' : activeCardSite.accentHex }}
            >
              {isAlreadyDiscovered
                ? 'SÍTIO CATALOGADO'
                : isLocked
                ? 'ALVO TRAVADO NO RADAR'
                : 'ROTA ORBITAL SELECIONADA'}
            </span>
            <span className="text-[10px] font-mono text-slate-400">{activeCardSite.region}</span>
          </div>

          <h3 className="text-sm sm:text-base font-black text-white">{activeCardSite.name}</h3>
          <p className="text-xs text-slate-300 leading-relaxed">{activeCardSite.discoveryLore}</p>

          <div className="text-xs font-bold text-emerald-300 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
            Recompensa: {activeCardSite.rewardText}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => flyToSite(activeCardSite)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
            >
              Voar Até Alvo
            </button>
            <button
              type="button"
              disabled={!canScanNow}
              onClick={() => {
                flyToSite(activeCardSite);
                onScanSite(activeCardSite.id);
              }}
              data-testid="orbital-scan-site-btn"
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black cursor-pointer transition-colors ${
                isAlreadyDiscovered
                  ? 'bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 cursor-default'
                  : canScanNow
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isAlreadyDiscovered
                ? 'Recursos Já Extraídos'
                : canScanNow
                ? `Escanear Anomalia (-${activeCardSite.fuelCost} H₂)`
                : 'Sem Combustível H₂ (Refinar em [B])'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
