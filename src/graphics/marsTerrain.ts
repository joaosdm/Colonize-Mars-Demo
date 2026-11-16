/**
 * Procedural Mars Surface Terrain & Environment
 * Generates red oxide dunes, scattered impact rocks, landing pad scorch marks,
 * and distant crater rims with authentic Martian color temperature.
 */

import * as THREE from 'three';

export interface MarsTerrainEnvironment {
  terrainMesh: THREE.Mesh;
  rocksGroup: THREE.Group;
  decorationsGroup: THREE.Group;
}

export function createMarsTerrain(): MarsTerrainEnvironment {
  // 1. Procedural Mars Ground Texture
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base red oxide ground
  ctx.fillStyle = '#b44a28';
  ctx.fillRect(0, 0, 512, 512);

  // Noise patches of darker basalt and lighter dust
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 4 + Math.random() * 20;
    const isDark = Math.random() > 0.5;
    ctx.fillStyle = isDark ? 'rgba(105, 35, 18, 0.25)' : 'rgba(215, 105, 65, 0.25)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const groundTex = new THREE.CanvasTexture(canvas);
  groundTex.wrapS = THREE.RepeatWrapping;
  groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(24, 24);
  groundTex.colorSpace = THREE.SRGBColorSpace;

  // 2. Terrain Geometry with dune undulations
  const size = 320;
  const segments = 64;
  const terrainGeo = new THREE.PlaneGeometry(size, size, segments, segments);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);

    // Flat landing zone in center (radius < 18m)
    const distCenter = Math.sqrt(x * x + z * z);
    if (distCenter > 14) {
      const dune = Math.sin(x * 0.04) * Math.cos(z * 0.04) * 2.2 + Math.sin(x * 0.09 + z * 0.06) * 1.1;
      posAttr.setY(i, dune);
    } else {
      posAttr.setY(i, 0);
    }
  }
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    roughness: 0.88,
    metalness: 0.12,
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;

  // 3. Scattered Rocks and Martian Boulders
  const rocksGroup = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x8b3a1e,
    roughness: 0.9,
    metalness: 0.15,
  });

  for (let i = 0; i < 75; i++) {
    const rGeo = new THREE.DodecahedronGeometry(0.5 + Math.random() * 1.2, 1);
    const rock = new THREE.Mesh(rGeo, rockMat);
    const angle = Math.random() * Math.PI * 2;
    const dist = 16 + Math.random() * 110;
    const rx = Math.cos(angle) * dist;
    const rz = Math.sin(angle) * dist;
    rock.position.set(rx, 0.4, rz);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.scale.set(1 + Math.random() * 0.5, 0.6 + Math.random() * 0.6, 1 + Math.random() * 0.5);
    rocksGroup.add(rock);
  }

  // 4. Scorch Landing Pad Mark under spacecraft
  const scorchCanvas = document.createElement('canvas');
  scorchCanvas.width = 256;
  scorchCanvas.height = 256;
  const sCtx = scorchCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(128, 128, 10, 128, 128, 120);
  grad.addColorStop(0, 'rgba(40, 20, 15, 0.85)');
  grad.addColorStop(0.5, 'rgba(70, 30, 20, 0.4)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 256, 256);

  const scorchTex = new THREE.CanvasTexture(scorchCanvas);
  const scorchGeo = new THREE.PlaneGeometry(16, 16);
  scorchGeo.rotateX(-Math.PI / 2);
  const scorchMat = new THREE.MeshBasicMaterial({
    map: scorchTex,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const scorchMesh = new THREE.Mesh(scorchGeo, scorchMat);
  scorchMesh.position.set(0, 0.02, 0);

  const decorGroup = new THREE.Group();
  decorGroup.add(scorchMesh);

  return {
    terrainMesh,
    rocksGroup,
    decorationsGroup: decorGroup,
  };
}
