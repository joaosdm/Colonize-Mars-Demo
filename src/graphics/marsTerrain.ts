/**
 * Procedural Mars Surface Terrain, Crater Lakes, Flora & Boulders
 * Matches deterministic groundHeightAt(x, z) from marsPhysics.ts so all geometry
 * aligns 100% with astronaut collision & grounding.
 */

import * as THREE from 'three';
import { groundHeightAt, ObstacleCircle } from '../sim/marsPhysics';

export interface MarsTerrainEnvironment {
  terrainMesh: THREE.Mesh;
  terrainMat: THREE.MeshStandardMaterial;
  rocksInstanced: THREE.InstancedMesh;
  rockObstacles: ObstacleCircle[];
  decorationsGroup: THREE.Group;
  lakeEast: THREE.Mesh;
  lakeWest: THREE.Mesh;
  floraInstanced: THREE.InstancedMesh;
  floraTransforms: Array<{ x: number; y: number; z: number; scale: number; rotY: number }>;
  updateTerraformingVisuals: (habitability: number, hasWaterExtractor: boolean, timeSec: number) => void;
}

export function createMarsTerrain(maxAnisotropy: number = 4): MarsTerrainEnvironment {
  // 1. Procedural Mars Regolith Albedo & Bump Textures
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = 512;
  colorCanvas.height = 512;
  const ctx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bCtx = bumpCanvas.getContext('2d')!;

  // Rich iron-oxide base
  ctx.fillStyle = '#a84726';
  ctx.fillRect(0, 0, 512, 512);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 512, 512);

  // Wind-blown Martian sand ripples
  for (let y = 0; y < 512; y += 6) {
    const wave = Math.sin(y * 0.14) * 10;
    ctx.strokeStyle = y % 12 === 0 ? 'rgba(130, 48, 22, 0.22)' : 'rgba(220, 118, 72, 0.16)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + wave, 340, y - wave, 512, y);
    ctx.stroke();

    bCtx.strokeStyle = y % 12 === 0 ? 'rgba(95,95,95,0.35)' : 'rgba(170,170,170,0.35)';
    bCtx.lineWidth = 2.5;
    bCtx.beginPath();
    bCtx.moveTo(0, y);
    bCtx.bezierCurveTo(170, y + wave, 340, y - wave, 512, y);
    bCtx.stroke();
  }

  // Fine mineral grain & basalt speckles
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const sz = 1 + Math.random() * 3.2;
    const dark = Math.random() > 0.45;
    ctx.fillStyle = dark ? 'rgba(72, 26, 14, 0.28)' : 'rgba(232, 146, 98, 0.22)';
    ctx.fillRect(x, y, sz, sz);
    bCtx.fillStyle = dark ? 'rgba(60, 60, 60, 0.3)' : 'rgba(200, 200, 200, 0.3)';
    bCtx.fillRect(x, y, sz, sz);
  }

  const groundTex = new THREE.CanvasTexture(colorCanvas);
  groundTex.wrapS = THREE.RepeatWrapping;
  groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(28, 28);
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.anisotropy = maxAnisotropy;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.repeat.set(28, 28);
  bumpTex.anisotropy = maxAnisotropy;

  // 2. Terrain Geometry matching deterministic groundHeightAt(x, z)
  const size = 220;
  const segments = 96;
  const terrainGeo = new THREE.PlaneGeometry(size, size, segments, segments);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    posAttr.setY(i, groundHeightAt(x, z));
  }
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    bumpMap: bumpTex,
    bumpScale: 0.25,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.08,
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;

  // 3. Instanced Martian Boulders (grounded on heightmap + collision circles)
  const rockCount = 72;
  const rockGeo = new THREE.DodecahedronGeometry(1.0, 1);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.12,
  });
  const rocksInstanced = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rocksInstanced.castShadow = true;
  rocksInstanced.receiveShadow = true;

  const rockObstacles: ObstacleCircle[] = [];
  const dummy = new THREE.Object3D();
  const rockColor = new THREE.Color();

  // Keep rocks outside core base paths and lake centers
  let placed = 0;
  let seed = 42;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  while (placed < rockCount) {
    const angle = nextRand() * Math.PI * 2;
    const dist = 17 + nextRand() * 52;
    const rx = Math.cos(angle) * dist;
    const rz = Math.sin(angle) * dist;

    // Avoid blocking BioDome (-19), Lab (-12,-6), Water (14,-10), Terraformer (-14,-18), and lakes
    const nearLake1 = Math.hypot(rx - 22, rz + 16) < 12;
    const nearLake2 = Math.hypot(rx + 24, rz + 18) < 11;
    const nearDome = Math.hypot(rx, rz + 19) < 10;
    const nearTerraform = Math.hypot(rx + 14, rz + 18) < 6;
    const nearWaterExt = Math.hypot(rx - 14, rz + 10) < 5;
    if (nearLake1 || nearLake2 || nearDome || nearTerraform || nearWaterExt) continue;

    const ry = groundHeightAt(rx, rz);
    const scale = 0.65 + nextRand() * 1.1;
    const scaleY = scale * (0.55 + nextRand() * 0.4);

    dummy.position.set(rx, ry + scaleY * 0.45, rz);
    dummy.rotation.set(nextRand() * 0.4, nextRand() * Math.PI * 2, nextRand() * 0.4);
    dummy.scale.set(scale, scaleY, scale * (0.85 + nextRand() * 0.3));
    dummy.updateMatrix();

    rocksInstanced.setMatrixAt(placed, dummy.matrix);
    rockColor.setHSL(0.04 + nextRand() * 0.03, 0.55, 0.25 + nextRand() * 0.14);
    rocksInstanced.setColorAt(placed, rockColor);

    if (scale > 0.95) {
      rockObstacles.push({ id: `rock-${placed}`, x: rx, z: rz, radius: scale * 0.85 });
    }
    placed++;
  }
  rocksInstanced.instanceMatrix.needsUpdate = true;
  if (rocksInstanced.instanceColor) rocksInstanced.instanceColor.needsUpdate = true;
  rocksInstanced.computeBoundingSphere();

  // 4. Landing Pad Scorch Mark & Marking Ring under Starship
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

  // 5. Crater Lakes (Fill during Water Extractor & Terraforming!)
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x0ea5e9,
    roughness: 0.08,
    metalness: 0.15,
    transparent: true,
    opacity: 0.82,
    clearcoat: 1.0,
  });

  const lakeEast = new THREE.Mesh(new THREE.CircleGeometry(10.2, 32), waterMat);
  lakeEast.rotation.x = -Math.PI / 2;
  lakeEast.position.set(22, -2.5, -16);
  lakeEast.visible = false;

  const lakeWest = new THREE.Mesh(new THREE.CircleGeometry(8.8, 32), waterMat);
  lakeWest.rotation.x = -Math.PI / 2;
  lakeWest.position.set(-24, -2.5, -18);
  lakeWest.visible = false;

  // 6. Terraform Flora (Instanced Grass/Shrubs that sprout as Habitability grows!)
  const floraCount = 140;
  const floraGeo = new THREE.ConeGeometry(0.42, 1.35, 7);
  floraGeo.translate(0, 0.65, 0);
  const floraMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.05,
  });
  const floraInstanced = new THREE.InstancedMesh(floraGeo, floraMat, floraCount);
  floraInstanced.frustumCulled = false;

  const floraTransforms: MarsTerrainEnvironment['floraTransforms'] = [];
  const floraColor = new THREE.Color();

  for (let i = 0; i < floraCount; i++) {
    const a = nextRand() * Math.PI * 2;
    const r = 8 + nextRand() * 40;
    const fx = Math.cos(a) * r;
    const fz = Math.sin(a) * r;
    const fy = groundHeightAt(fx, fz);

    // Avoid underwater lake centers
    if (fy < -0.6) {
      floraTransforms.push({ x: fx + 9, y: groundHeightAt(fx + 9, fz), z: fz, scale: 0.8 + nextRand() * 0.7, rotY: nextRand() * Math.PI * 2 });
    } else {
      floraTransforms.push({ x: fx, y: fy, z: fz, scale: 0.7 + nextRand() * 0.85, rotY: nextRand() * Math.PI * 2 });
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

  // Dynamic visual update as Mars transforms from Red Desert to Living Blue-Green World
  const updateTerraformingVisuals = (
    habitability: number,
    hasWaterExtractor: boolean,
    timeSec: number
  ) => {
    // Crater Lake Water Level
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

    // Flora Sprouting Factor (starts sprouting around lakes/biodome at 65%, full bloom at 100%)
    const floraRatio = Math.max(0, Math.min(1, (habitability - 55) / 45));
    const visibleCount = Math.floor(floraRatio * floraCount);

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

    // Ground subtle green-moss tint shift as planet turns habitable
    const mossShift = Math.max(0, (habitability - 65) / 35);
    terrainMat.color.setRGB(1.0 - mossShift * 0.16, 1.0 + mossShift * 0.06, 1.0 - mossShift * 0.12);
  };

  return {
    terrainMesh,
    terrainMat,
    rocksInstanced,
    rockObstacles,
    decorationsGroup: decorGroup,
    lakeEast,
    lakeWest,
    floraInstanced,
    floraTransforms,
    updateTerraformingVisuals,
  };
}
