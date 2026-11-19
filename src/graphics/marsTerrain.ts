/**
 * Realistic Procedural Mars Biome Terrain, Live 3D Excavated Craters,
 * Crater Lakes, Phobos/Deimos Sky Moons, Geothermal Vents, Flora & Biome Boulders.
 */

import * as THREE from 'three';
import { groundHeightAt, ObstacleCircle } from '../sim/marsPhysics';
import { ExcavatedCrater, getMarsBiomeAt } from '../sim/marsWorld';

export interface TerrainQualityOptions {
  maxAnisotropy?: number;
  segments?: number;
  textureSize?: number;
  rockCount?: number;
  floraCount?: number;
  enableBumpMap?: boolean;
}

export interface MarsTerrainEnvironment {
  terrainMesh: THREE.Mesh;
  terrainMat: THREE.MeshStandardMaterial;
  bumpTex: THREE.CanvasTexture;
  rocksInstanced: THREE.InstancedMesh;
  rockObstacles: ObstacleCircle[];
  decorationsGroup: THREE.Group;
  skyGroup: THREE.Group;
  lakeEast: THREE.Mesh;
  lakeWest: THREE.Mesh;
  floraInstanced: THREE.InstancedMesh;
  floraTransforms: Array<{ x: number; y: number; z: number; scale: number; rotY: number }>;
  setBumpEnabled: (enabled: boolean) => void;
  applyCraters: (craters: ExcavatedCrater[]) => void;
  updateTerraformingVisuals: (habitability: number, hasWaterExtractor: boolean, timeSec: number) => void;
}

export function createMarsTerrain(
  optionsOrAniso: number | TerrainQualityOptions = 4
): MarsTerrainEnvironment {
  const opts: TerrainQualityOptions =
    typeof optionsOrAniso === 'number' ? { maxAnisotropy: optionsOrAniso } : optionsOrAniso;
  const maxAnisotropy = opts.maxAnisotropy ?? 4;
  const texSize = opts.textureSize ?? 512;
  const segments = opts.segments ?? 128;
  const rockCount = opts.rockCount ?? 140;
  const floraCount = opts.floraCount ?? 120;
  const enableBumpMap = opts.enableBumpMap ?? true;

  // 1. Procedural Martian Soil Albedo & Bump Maps (scaled by quality tier for fast portal load)
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = texSize;
  colorCanvas.height = texSize;
  const ctx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = texSize;
  bumpCanvas.height = texSize;
  const bCtx = bumpCanvas.getContext('2d')!;

  // Neutral-warm base (vertex colors tint each biome accurately)
  ctx.fillStyle = '#cf8c68';
  ctx.fillRect(0, 0, texSize, texSize);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, texSize, texSize);

  const scaleRatio = texSize / 512;
  const stepY = Math.max(3, Math.round(5 * scaleRatio));
  // Wind-carved aeolian sand ripples
  for (let y = 0; y < texSize; y += stepY) {
    const wave = Math.sin((y / scaleRatio) * 0.13) * 12 * scaleRatio;
    ctx.strokeStyle = y % (stepY * 2) === 0 ? 'rgba(92, 42, 22, 0.22)' : 'rgba(248, 200, 165, 0.16)';
    ctx.lineWidth = Math.max(1.4, 2.6 * scaleRatio);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(texSize * 0.33, y + wave, texSize * 0.66, y - wave, texSize, y);
    ctx.stroke();

    bCtx.strokeStyle = y % (stepY * 2) === 0 ? 'rgba(78,78,78,0.42)' : 'rgba(182,182,182,0.42)';
    bCtx.lineWidth = Math.max(1.2, 2.4 * scaleRatio);
    bCtx.beginPath();
    bCtx.moveTo(0, y);
    bCtx.bezierCurveTo(texSize * 0.33, y + wave, texSize * 0.66, y - wave, texSize, y);
    bCtx.stroke();
  }

  // Sedimentary pebble & basalt grit grain (scaled by area)
  const grainCount = Math.round(3000 * scaleRatio * scaleRatio);
  for (let i = 0; i < grainCount; i++) {
    const x = Math.random() * texSize;
    const y = Math.random() * texSize;
    const sz = Math.max(1, (1 + Math.random() * 2.8) * scaleRatio);
    const dark = Math.random() > 0.45;
    ctx.fillStyle = dark ? 'rgba(56, 26, 16, 0.26)' : 'rgba(250, 214, 184, 0.22)';
    ctx.fillRect(x, y, sz, sz);
    bCtx.fillStyle = dark ? 'rgba(52, 52, 52, 0.34)' : 'rgba(208, 208, 208, 0.34)';
    bCtx.fillRect(x, y, sz, sz);
  }

  const groundTex = new THREE.CanvasTexture(colorCanvas);
  groundTex.wrapS = THREE.RepeatWrapping;
  groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(36, 36);
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.anisotropy = maxAnisotropy;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.repeat.set(36, 36);
  bumpTex.anisotropy = maxAnisotropy;

  // 2. Expanded 300x300m Explorable Terrain Geometry with Biome Vertex Colors
  const size = 300;
  const terrainGeo = new THREE.PlaneGeometry(size, size, segments, segments);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.getAttribute('position') as THREE.BufferAttribute;
  const vertexCount = posAttr.count;
  const baseColors = new Float32Array(vertexCount * 3);
  const liveColors = new Float32Array(vertexCount * 3);

  const computeBiomeColorAt = (x: number, z: number): [number, number, number] => {
    // Smoothly blend biome tint using 4 neighborhood samples to eliminate hard seams
    const b0 = getMarsBiomeAt(x, z).tintRgb;
    const b1 = getMarsBiomeAt(x + 7, z).tintRgb;
    const b2 = getMarsBiomeAt(x - 7, z).tintRgb;
    const b3 = getMarsBiomeAt(x, z + 7).tintRgb;
    const b4 = getMarsBiomeAt(x, z - 7).tintRgb;
    const r = (b0[0] * 2 + b1[0] + b2[0] + b3[0] + b4[0]) / 6;
    const g = (b0[1] * 2 + b1[1] + b2[1] + b3[1] + b4[1]) / 6;
    const b = (b0[2] * 2 + b1[2] + b2[2] + b3[2] + b4[2]) / 6;
    return [r, g, b];
  };

  for (let i = 0; i < vertexCount; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const y = groundHeightAt(x, z);
    posAttr.setY(i, y);

    const [r, g, b] = computeBiomeColorAt(x, z);
    // Subtle height strata shading
    const elevFactor = Math.max(0.84, Math.min(1.14, 1.0 + y * 0.025));
    baseColors[i * 3] = Math.min(1, r * elevFactor);
    baseColors[i * 3 + 1] = Math.min(1, g * elevFactor);
    baseColors[i * 3 + 2] = Math.min(1, b * elevFactor);
    liveColors[i * 3] = baseColors[i * 3];
    liveColors[i * 3 + 1] = baseColors[i * 3 + 1];
    liveColors[i * 3 + 2] = baseColors[i * 3 + 2];
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(liveColors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    bumpMap: enableBumpMap ? bumpTex : null,
    bumpScale: 0.34,
    vertexColors: true,
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.06,
  });

  const setBumpEnabled = (enabled: boolean) => {
    const desired = enabled ? bumpTex : null;
    if (terrainMat.bumpMap !== desired) {
      terrainMat.bumpMap = desired;
      terrainMat.needsUpdate = true;
    }
  };

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;

  // Dynamic live terrain crater excavation deformation (uses fast squared-distance check)
  let appliedCraterSig = '';
  const applyCraters = (craters: ExcavatedCrater[]) => {
    const sig = craters.map((c) => c.id).join('|');
    if (sig === appliedCraterSig) return;
    appliedCraterSig = sig;

    const colorAttr = terrainGeo.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < vertexCount; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const y = groundHeightAt(x, z, craters);
      posAttr.setY(i, y);

      let darken = 1.0;
      for (let cIdx = 0; cIdx < craters.length; cIdx++) {
        const c = craters[cIdx];
        const dx = x - c.x;
        const dz = z - c.z;
        const limit = c.radius * 1.25;
        const dSq = dx * dx + dz * dz;
        if (dSq < limit * limit) {
          const factor = 1 - Math.sqrt(dSq) / limit;
          darken = Math.min(darken, 1.0 - factor * 0.42);
        }
      }
      colorAttr.setXYZ(
        i,
        baseColors[i * 3] * darken,
        baseColors[i * 3 + 1] * darken,
        baseColors[i * 3 + 2] * darken
      );
    }
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    terrainGeo.computeVertexNormals();
  };

  // 3. Instanced Biome-Tinted Martian Boulders & Mesa Outcrops
  const rockGeo = new THREE.DodecahedronGeometry(1.0, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.14,
  });
  const rocksInstanced = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rocksInstanced.castShadow = true;
  rocksInstanced.receiveShadow = true;

  const rockObstacles: ObstacleCircle[] = [];
  const dummy = new THREE.Object3D();
  const rockColor = new THREE.Color();

  let placed = 0;
  let seed = 42;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  while (placed < rockCount) {
    const angle = nextRand() * Math.PI * 2;
    const dist = 19 + nextRand() * 88;
    const rx = Math.cos(angle) * dist;
    const rz = Math.sin(angle) * dist;

    // Keep clear of core structures and lakes
    const nearLake1 = Math.hypot(rx - 22, rz + 16) < 12.5;
    const nearLake2 = Math.hypot(rx + 24, rz + 18) < 11.5;
    const nearDome = Math.hypot(rx, rz + 19) < 10.5;
    const nearTerraform = Math.hypot(rx + 14, rz + 18) < 6.5;
    const nearWaterExt = Math.hypot(rx - 14, rz + 10) < 5.5;
    if (nearLake1 || nearLake2 || nearDome || nearTerraform || nearWaterExt) continue;

    const ry = groundHeightAt(rx, rz);
    const biome = getMarsBiomeAt(rx, rz);
    const scale =
      biome.id === 'basalt-canyon'
        ? 0.9 + nextRand() * 1.9
        : biome.id === 'tharsis-fissure'
        ? 0.85 + nextRand() * 1.6
        : 0.65 + nextRand() * 1.15;
    const scaleY = scale * (biome.id === 'basalt-canyon' ? 0.75 + nextRand() * 0.65 : 0.52 + nextRand() * 0.45);

    dummy.position.set(rx, ry + scaleY * 0.42, rz);
    dummy.rotation.set(nextRand() * 0.4, nextRand() * Math.PI * 2, nextRand() * 0.4);
    dummy.scale.set(scale, scaleY, scale * (0.82 + nextRand() * 0.35));
    dummy.updateMatrix();

    rocksInstanced.setMatrixAt(placed, dummy.matrix);

    if (biome.id === 'polar-frost') {
      rockColor.setHSL(0.56, 0.28, 0.56 + nextRand() * 0.18);
    } else if (biome.id === 'tharsis-fissure') {
      rockColor.setHSL(0.03, 0.32, 0.16 + nextRand() * 0.1);
    } else if (biome.id === 'basalt-canyon') {
      rockColor.setHSL(0.05, 0.46, 0.2 + nextRand() * 0.12);
    } else {
      rockColor.setHSL(0.04 + nextRand() * 0.03, 0.58, 0.25 + nextRand() * 0.14);
    }
    rocksInstanced.setColorAt(placed, rockColor);

    if (scale > 0.95) {
      rockObstacles.push({ id: `rock-${placed}`, x: rx, z: rz, radius: scale * 0.85 });
    }
    placed++;
  }
  rocksInstanced.instanceMatrix.needsUpdate = true;
  if (rocksInstanced.instanceColor) rocksInstanced.instanceColor.needsUpdate = true;
  rocksInstanced.computeBoundingSphere();

  // 4. Landing Pad Scorch Mark + Volcanic Geothermal Fumaroles + Polar Ice Spires
  const decorGroup = new THREE.Group();
  const scorchCanvas = document.createElement('canvas');
  scorchCanvas.width = 256;
  scorchCanvas.height = 256;
  const sCtx = scorchCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(128, 128, 12, 128, 128, 120);
  grad.addColorStop(0, 'rgba(30, 15, 10, 0.88)');
  grad.addColorStop(0.55, 'rgba(70, 30, 20, 0.45)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 256, 256);

  const scorchTex = new THREE.CanvasTexture(scorchCanvas);
  const scorchGeo = new THREE.PlaneGeometry(16, 16);
  scorchGeo.rotateX(-Math.PI / 2);
  const scorchMat = new THREE.MeshBasicMaterial({
    map: scorchTex,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const scorchMesh = new THREE.Mesh(scorchGeo, scorchMat);
  scorchMesh.position.set(0, 0.025, 0);
  decorGroup.add(scorchMesh);

  // Geothermal volcanic vents in Tharsis Fissure (West/South)
  const ventCoords = [
    { x: -46, z: 18 },
    { x: -58, z: -12 },
    { x: -38, z: 48 },
    { x: -64, z: 36 },
  ];
  const ventRockMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.92, metalness: 0.15 });
  const ventGlowMat = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.82 });
  ventCoords.forEach((vc) => {
    const gy = groundHeightAt(vc.x, vc.z);
    const ventGroup = new THREE.Group();
    ventGroup.position.set(vc.x, gy, vc.z);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2.3, 1.4, 9, 1, true), ventRockMat);
    cone.position.y = 0.6;
    const magma = new THREE.Mesh(new THREE.CircleGeometry(1.0, 12), ventGlowMat);
    magma.rotation.x = -Math.PI / 2;
    magma.position.y = 0.9;
    ventGroup.add(cone, magma);
    decorGroup.add(ventGroup);
  });

  // Polar ice ridges in North Polar Frost
  const glacierMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    emissive: 0x0284c7,
    emissiveIntensity: 0.18,
    roughness: 0.22,
    metalness: 0.2,
  });
  const glacierCoords = [
    { x: -18, z: -56, s: 2.2 },
    { x: 14, z: -62, s: 2.8 },
    { x: 0, z: -74, s: 3.2 },
    { x: -32, z: -68, s: 2.4 },
    { x: 30, z: -54, s: 2.0 },
  ];
  glacierCoords.forEach((gc) => {
    const gy = groundHeightAt(gc.x, gc.z);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(gc.s, gc.s * 2.1, 6), glacierMat);
    spire.position.set(gc.x, gy + gc.s * 0.85, gc.z);
    spire.rotation.y = gc.x * 0.3;
    decorGroup.add(spire);
  });

  // 5. Realistic Martian Sky Bodies: Distant Pale Sun + Phobos & Deimos Moons
  const skyGroup = new THREE.Group();
  const sunDisk = new THREE.Mesh(
    new THREE.SphereGeometry(5.5, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffedd5, fog: false })
  );
  sunDisk.position.set(110, 145, 85);
  const phobos = new THREE.Mesh(
    new THREE.DodecahedronGeometry(3.2, 1),
    new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.9, fog: false })
  );
  phobos.scale.set(1.25, 0.85, 1.0);
  phobos.position.set(-95, 92, -120);
  const deimos = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1.5, 1),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.85, fog: false })
  );
  deimos.position.set(78, 118, -145);
  skyGroup.add(sunDisk, phobos, deimos);

  // 6. Crater Lakes (Fill during Water Extractor & Terraforming — lightweight PBR for mobile GPUs)
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    roughness: 0.14,
    metalness: 0.25,
    transparent: true,
    opacity: 0.84,
  });

  const lakeEast = new THREE.Mesh(new THREE.CircleGeometry(10.2, 24), waterMat);
  lakeEast.rotation.x = -Math.PI / 2;
  lakeEast.position.set(22, -2.5, -16);
  lakeEast.visible = false;

  const lakeWest = new THREE.Mesh(new THREE.CircleGeometry(8.8, 24), waterMat);
  lakeWest.rotation.x = -Math.PI / 2;
  lakeWest.position.set(-24, -2.5, -18);
  lakeWest.visible = false;

  // 7. Terraform Flora (Instanced Grass/Shrubs that sprout as Habitability grows!)
  const floraGeo = new THREE.ConeGeometry(0.42, 1.35, 6);
  floraGeo.translate(0, 0.65, 0);
  const floraMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.05,
  });
  const floraInstanced = new THREE.InstancedMesh(floraGeo, floraMat, floraCount);
  floraInstanced.frustumCulled = false;
  floraInstanced.visible = false;

  const floraTransforms: MarsTerrainEnvironment['floraTransforms'] = [];
  const floraColor = new THREE.Color();

  for (let i = 0; i < floraCount; i++) {
    const a = nextRand() * Math.PI * 2;
    const r = 8 + nextRand() * 48;
    const fx = Math.cos(a) * r;
    const fz = Math.sin(a) * r;
    const fy = groundHeightAt(fx, fz);

    if (fy < -0.6) {
      floraTransforms.push({
        x: fx + 9,
        y: groundHeightAt(fx + 9, fz),
        z: fz,
        scale: 0.8 + nextRand() * 0.7,
        rotY: nextRand() * Math.PI * 2,
      });
    } else {
      floraTransforms.push({
        x: fx,
        y: fy,
        z: fz,
        scale: 0.7 + nextRand() * 0.85,
        rotY: nextRand() * Math.PI * 2,
      });
    }

    dummy.position.set(0, -10, 0);
    dummy.scale.set(0.001, 0.001, 0.001);
    dummy.updateMatrix();
    floraInstanced.setMatrixAt(i, dummy.matrix);

    floraColor.setHSL(0.32 + nextRand() * 0.08, 0.68, 0.34 + nextRand() * 0.16);
    floraInstanced.setColorAt(i, floraColor);
  }
  floraInstanced.instanceMatrix.needsUpdate = true;
  if (floraInstanced.instanceColor) floraInstanced.instanceColor.needsUpdate = true;

  let lastFloraHab = -1;
  let lastMossShift = -1;

  const updateTerraformingVisuals = (
    habitability: number,
    hasWaterExtractor: boolean,
    timeSec: number
  ) => {
    // Slowly orbit Phobos & Deimos
    phobos.rotation.y = timeSec * 0.12;
    deimos.rotation.y = -timeSec * 0.08;

    if (hasWaterExtractor || habitability >= 40) {
      lakeEast.visible = true;
      lakeWest.visible = true;
      const targetLevel = habitability >= 95 ? -0.45 : -0.95;
      const shimmer = Math.sin(timeSec * 2.2) * 0.03;
      lakeEast.position.y = THREE.MathUtils.lerp(lakeEast.position.y, targetLevel + shimmer, 0.06);
      lakeWest.position.y = THREE.MathUtils.lerp(lakeWest.position.y, targetLevel - shimmer, 0.06);
    } else {
      lakeEast.visible = false;
      lakeWest.visible = false;
    }

    // Dirty-checked flora GPU upload: only recompute instance matrices when habitability changes
    if (Math.abs(habitability - lastFloraHab) >= 0.5) {
      lastFloraHab = habitability;
      const floraRatio = Math.max(0, Math.min(1, (habitability - 55) / 45));
      const visibleCount = Math.floor(floraRatio * floraCount);
      floraInstanced.visible = visibleCount > 0;

      if (visibleCount > 0) {
        for (let i = 0; i < floraCount; i++) {
          const ft = floraTransforms[i];
          if (i < visibleCount) {
            const s = ft.scale * (0.4 + 0.6 * floraRatio);
            dummy.position.set(ft.x, ft.y, ft.z);
            dummy.rotation.set(0, ft.rotY, 0);
            dummy.scale.set(s, s, s);
          } else {
            dummy.position.set(0, -20, 0);
            dummy.scale.set(0.001, 0.001, 0.001);
          }
          dummy.updateMatrix();
          floraInstanced.setMatrixAt(i, dummy.matrix);
        }
        floraInstanced.instanceMatrix.needsUpdate = true;
      }
    }

    const mossShift = Math.max(0, (habitability - 65) / 35);
    if (Math.abs(mossShift - lastMossShift) >= 0.005) {
      lastMossShift = mossShift;
      terrainMat.color.setRGB(1.0 - mossShift * 0.16, 1.0 + mossShift * 0.06, 1.0 - mossShift * 0.12);
    }
  };

  return {
    terrainMesh,
    terrainMat,
    bumpTex,
    rocksInstanced,
    rockObstacles,
    decorationsGroup: decorGroup,
    skyGroup,
    lakeEast,
    lakeWest,
    floraInstanced,
    floraTransforms,
    setBumpEnabled,
    applyCraters,
    updateTerraformingVisuals,
  };
}
