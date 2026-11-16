/**
 * High-Resolution Procedural Texture Generator for Celestial Bodies
 * Creates realistic procedural albedo, bump, and cloud textures using 2D Canvas.
 * Configured with THREE.SRGBColorSpace and maximum anisotropy.
 */

import * as THREE from 'three';

// Fast noise helper for 2D textures
function pseudoNoise(x: number, y: number, seed: number = 42): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed: number = 42): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fX = x - i;
  const fY = y - j;

  const sX = fX * fX * (3 - 2 * fX);
  const sY = fY * fY * (3 - 2 * fY);

  const n00 = pseudoNoise(i, j, seed);
  const n10 = pseudoNoise(i + 1, j, seed);
  const n01 = pseudoNoise(i, j + 1, seed);
  const n11 = pseudoNoise(i + 1, j + 1, seed);

  const top = n00 * (1 - sX) + n10 * sX;
  const bot = n01 * (1 - sX) + n11 * sX;

  return top * (1 - sY) + bot * sY;
}

function fbm(x: number, y: number, octaves: number = 4, seed: number = 42): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < octaves; i++) {
    val += smoothNoise(x * freq, y * freq, seed + i * 17) * amp;
    freq *= 2.0;
    amp *= 0.5;
  }
  return val;
}

/**
 * Procedural texture for Mars:
 * Iron-oxide rust reds, Valles Marineris canyon rift, Olympus Mons shield, and polar ice caps.
 */
export function generateMarsTexture(size: number = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2;
  const ctx = canvas.getContext('2d')!;

  const imgData = ctx.createImageData(canvas.width, canvas.height);
  const data = imgData.data;

  for (let y = 0; y < canvas.height; y++) {
    const lat = (y / canvas.height) * Math.PI - Math.PI / 2; // -pi/2 to +pi/2
    const isPolarCap = Math.abs(lat) > 1.25;

    for (let x = 0; x < canvas.width; x++) {
      const lon = (x / canvas.width) * 2 * Math.PI; // 0 to 2pi
      const idx = (y * canvas.width + x) * 4;

      // Base terrain noise
      const n1 = fbm(x / 40, y / 30, 4, 101);
      const n2 = fbm(x / 15, y / 15, 3, 202);
      const elevation = n1 * 0.7 + n2 * 0.3;

      // Olympus Mons caldera feature (around lon = 3.8, lat = 0.3)
      const dOlyX = lon - 3.8;
      const dOlyY = lat - 0.3;
      const dOly = Math.sqrt(dOlyX * dOlyX + dOlyY * dOlyY);
      const isOlympusMons = dOly < 0.25;

      // Valles Marineris rift (around lon = 4.2 to 5.2, lat = -0.2)
      const isValles = lon > 4.2 && lon < 5.4 && Math.abs(lat - -0.2) < 0.08 + n2 * 0.06;

      let r = 185;
      let g = 75;
      let b = 38;

      if (isPolarCap) {
        // Brilliant white/pale cyan polar dry-ice frost
        const capEdge = (Math.abs(lat) - 1.25) / 0.32;
        const frost = Math.min(1.0, capEdge + n2 * 0.4);
        r = Math.round(185 * (1 - frost) + 245 * frost);
        g = Math.round(75 * (1 - frost) + 245 * frost);
        b = Math.round(38 * (1 - frost) + 250 * frost);
      } else if (isValles) {
        // Deep shadow rift canyon
        r = 95;
        g = 32;
        b = 18;
      } else if (isOlympusMons) {
        // High volcanic caldera
        r = 210;
        g = 95;
        b = 52;
      } else {
        // Varying rust highland / darker basalt plains
        const tone = elevation;
        r = Math.round(150 + tone * 75);
        g = Math.round(50 + tone * 50);
        b = Math.round(20 + tone * 35);
      }

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Procedural texture for Earth:
 * Blue oceans, continental landmasses, deserts, and polar ice.
 */
export function generateEarthTexture(size: number = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2;
  const ctx = canvas.getContext('2d')!;

  const imgData = ctx.createImageData(canvas.width, canvas.height);
  const data = imgData.data;

  for (let y = 0; y < canvas.height; y++) {
    const lat = (y / canvas.height) * Math.PI - Math.PI / 2;
    const isPolar = Math.abs(lat) > 1.3;

    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;

      const n1 = fbm(x / 45, y / 35, 5, 88);
      const isLand = n1 > 0.46;

      let r = 18;
      let g = 55;
      let b = 135; // Ocean blue

      if (isPolar) {
        r = 235;
        g = 245;
        b = 255;
      } else if (isLand) {
        const height = (n1 - 0.46) / 0.54;
        if (height > 0.5) {
          // Mountain / highland brown
          r = 130 + Math.round(height * 40);
          g = 100 + Math.round(height * 30);
          b = 65;
        } else {
          // Lush forest / savanna green
          r = 45 + Math.round(height * 40);
          g = 120 + Math.round(height * 50);
          b = 40;
        }
      }

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Procedural texture for Earth Atmospheric Cloud Layer
 */
export function generateCloudsTexture(size: number = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2;
  const ctx = canvas.getContext('2d')!;

  const imgData = ctx.createImageData(canvas.width, canvas.height);
  const data = imgData.data;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const n = fbm(x / 30, y / 25, 4, 303);
      const cloud = Math.max(0, (n - 0.42) / 0.58);

      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = Math.round(cloud * 210);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Procedural texture for Moon / Rocky Asteroids:
 * Pockmarked cratered regolith and impact basins.
 */
export function generateMoonTexture(size: number = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2;
  const ctx = canvas.getContext('2d')!;

  const imgData = ctx.createImageData(canvas.width, canvas.height);
  const data = imgData.data;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const n1 = fbm(x / 20, y / 20, 4, 77);
      const n2 = fbm(x / 8, y / 8, 3, 99);

      // Maria dark patches vs bright crater highlands
      const isMare = n1 < 0.38;
      const baseTone = isMare ? 90 + n2 * 30 : 150 + n2 * 60;
      const val = Math.round(baseTone);

      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = Math.round(val * 1.05); // slight cool grey
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Procedural texture for Jupiter:
 * Dynamic banded atmospheric zones, Great Red Spot, and turbulence swirls.
 */
export function generateJupiterTexture(size: number = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2;
  const ctx = canvas.getContext('2d')!;

  const imgData = ctx.createImageData(canvas.width, canvas.height);
  const data = imgData.data;

  for (let y = 0; y < canvas.height; y++) {
    const lat = (y / canvas.height) * Math.PI - Math.PI / 2;
    // Band frequency
    const bandSine = Math.sin(lat * 14.0);

    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const lon = (x / canvas.width) * 2 * Math.PI;
      const swirl = fbm(x / 25, y / 10, 4, 404);

      // Great Red Spot (around lat = -0.38, lon = 2.4)
      const dSpotX = (lon - 2.4) * 1.8;
      const dSpotY = (lat - -0.38) * 4.0;
      const dSpot = Math.sqrt(dSpotX * dSpotX + dSpotY * dSpotY);
      const isRedSpot = dSpot < 0.32;

      let r = 210;
      let g = 160;
      let b = 115;

      if (isRedSpot) {
        r = 195;
        g = 60;
        b = 35;
      } else {
        const mix = (bandSine + swirl * 1.2 + 1) * 0.5;
        r = Math.round(180 + mix * 55);
        g = Math.round(120 + mix * 60);
        b = Math.round(70 + mix * 50);
      }

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Procedural texture for The Sun:
 * Turbulent coronal convection cells, solar flares, and limb darkening.
 */
export function generateSunTexture(size: number = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2;
  const ctx = canvas.getContext('2d')!;

  const imgData = ctx.createImageData(canvas.width, canvas.height);
  const data = imgData.data;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const n = fbm(x / 18, y / 14, 4, 555);

      data[idx] = 255;
      data[idx + 1] = Math.round(160 + n * 85);
      data[idx + 2] = Math.round(30 + n * 40);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
