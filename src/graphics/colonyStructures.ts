/**
 * Procedural 3D Colony Structures & Mineable / Collectable Resources for Mars
 * Features:
 * - Starship Lander (central hub)
 * - MOXIE O2 Extractor with dynamic light beam (Blue -> Green) & glowing base O2 aura
 * - Construction Trigger Rings (circular zones for Solar, Biodome, Habitat)
 * - Solar Arrays (unfolds on construction)
 * - Pressurized Geodesic Bio-Dome with green plants & water condenser
 * - Pressurized Habitat Module with observation cupola
 * - Scattered Collectable Resource Cubes (Regolith & Water Ice) with magnet physics support
 */

import * as THREE from 'three';

export interface CollectableResource {
  id: string;
  type: 'regolith' | 'ice';
  mesh: THREE.Group;
  collected: boolean;
  isMagnetized: boolean;
  spawnPos: THREE.Vector3;
}

export interface ColonyStructures {
  landerGroup: THREE.Group;
  landerPlume: THREE.Mesh;
  landerMaterials: THREE.Material[]; // For anti-occlusion transparency

  // MOXIE
  moxieGroup: THREE.Group;
  moxieLightBeam: THREE.Mesh;
  moxieLightBeamMat: THREE.MeshBasicMaterial;
  moxieAuraDome: THREE.Mesh;
  moxieAuraMat: THREE.MeshBasicMaterial;

  // Build Slots & Trigger Rings
  solarSlotRing: THREE.Mesh;
  solarGroup: THREE.Group;

  bioDomeSlotRing: THREE.Mesh;
  bioDomeGroup: THREE.Group;

  habitatSlotRing: THREE.Mesh;
  habitatGroup: THREE.Group;

  // Collectable resource blocks
  resources: CollectableResource[];
}

export function createColonyStructures(): ColonyStructures {
  const landerMaterials: THREE.Material[] = [];

  // PBR Materials
  const landerMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.7,
    roughness: 0.25,
  });
  landerMaterials.push(landerMat);

  const heatShieldMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.5,
  });
  landerMaterials.push(heatShieldMat);

  const windowMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    metalness: 0.9,
    roughness: 0.1,
    transmission: 0.8,
    transparent: true,
    opacity: 0.85,
  });
  landerMaterials.push(windowMat);

  const moxieMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7, // Cyan blue extractor body
    metalness: 0.5,
    roughness: 0.35,
  });

  const solarPanelMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    metalness: 0.95,
    roughness: 0.1,
  });

  const domeGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x67e8f9,
    transmission: 0.85,
    transparent: true,
    opacity: 0.6,
    roughness: 0.12,
    metalness: 0.1,
  });

  const domeFrameMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.8,
    roughness: 0.3,
  });

  // 1. STARSHIP LANDER (HUB)
  const lander = new THREE.Group();
  lander.name = 'Mars_Starship_Lander';
  lander.position.set(0, 0, 0);

  // Main rocket fuselage
  const landerBodyGeo = new THREE.CylinderGeometry(2.4, 2.5, 14, 20);
  const landerBody = new THREE.Mesh(landerBodyGeo, landerMat);
  landerBody.position.y = 8.5;
  lander.add(landerBody);

  // Nosecone
  const coneGeo = new THREE.ConeGeometry(2.4, 5.5, 20);
  const landerCone = new THREE.Mesh(coneGeo, landerMat);
  landerCone.position.y = 18.25;
  lander.add(landerCone);

  // Cockpit viewing windows
  const cockpitGeo = new THREE.BoxGeometry(1.6, 0.7, 0.5);
  const cockpit = new THREE.Mesh(cockpitGeo, windowMat);
  cockpit.position.set(0, 16.5, 2.2);
  lander.add(cockpit);

  // Black heat shield tiles on windward flank
  const tileGeo = new THREE.CylinderGeometry(2.42, 2.52, 13.8, 20, 1, false, 0, Math.PI);
  const landerShield = new THREE.Mesh(tileGeo, heatShieldMat);
  landerShield.position.y = 8.5;
  lander.add(landerShield);

  // 4 Quad Landing Struts rotated diagonally (45, 135, 225, 315 deg)
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const legGroup = new THREE.Group();
    const legGeo = new THREE.CylinderGeometry(0.16, 0.2, 4.2, 8);
    const leg = new THREE.Mesh(legGeo, heatShieldMat);
    leg.rotation.z = 0.42;
    leg.position.set(1.9, 1.8, 0);

    const padGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.18, 8);
    const pad = new THREE.Mesh(padGeo, heatShieldMat);
    pad.position.set(3.0, 0.09, 0);

    legGroup.add(leg, pad);
    legGroup.rotation.y = angle;
    lander.add(legGroup);
  }

  // Descent Engine Plume (for cutscene)
  const plumeGeo = new THREE.ConeGeometry(1.8, 8, 16);
  plumeGeo.rotateX(Math.PI);
  const plumeMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });
  const landerPlume = new THREE.Mesh(plumeGeo, plumeMat);
  landerPlume.position.y = -2.5;
  lander.add(landerPlume);

  // 2. MOXIE O2 EXTRACTOR WITH DYNAMIC BEAM & O2 AURA
  const moxie = new THREE.Group();
  moxie.name = 'Structure_MOXIE';
  moxie.position.set(-6, 0, 4);

  const moxieBoxGeo = new THREE.BoxGeometry(1.6, 1.8, 1.4);
  const moxieBody = new THREE.Mesh(moxieBoxGeo, moxieMat);
  moxieBody.position.y = 0.9;

  const intakeGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.2, 16);
  intakeGeo.rotateX(Math.PI / 2);
  const intakeMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x0284c7,
    emissiveIntensity: 0.6,
  });
  const intake = new THREE.Mesh(intakeGeo, intakeMat);
  intake.position.set(0, 1.1, 0.72);

  // Vertical light beacon beam (Blue initially -> Green when active)
  const beamGeo = new THREE.CylinderGeometry(0.08, 0.35, 10, 12, 1, true);
  const moxieLightBeamMat = new THREE.MeshBasicMaterial({
    color: 0x0284c7, // Blue before active
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const moxieLightBeam = new THREE.Mesh(beamGeo, moxieLightBeamMat);
  moxieLightBeam.position.y = 5.0;

  // Oxygen Aura Dome (visible around base when active)
  const auraGeo = new THREE.SphereGeometry(12, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const moxieAuraMat = new THREE.MeshBasicMaterial({
    color: 0x10b981, // Emerald green oxygen aura
    transparent: true,
    opacity: 0.0, // starts invisible until active
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const moxieAuraDome = new THREE.Mesh(auraGeo, moxieAuraMat);
  moxieAuraDome.position.set(0, 0, 0); // centered on base hub

  moxie.add(moxieBody, intake, moxieLightBeam);

  // 3. SOLAR ARRAY WINGS & BUILD SLOT RING
  const solarSlotRing = createBuildSlotRing(7, 3, 0x0284c7);

  const solar = new THREE.Group();
  solar.name = 'Structure_SolarPanels';
  solar.position.set(7, 0, 3);

  const solarMastGeo = new THREE.CylinderGeometry(0.14, 0.16, 3.2, 8);
  const solarMast = new THREE.Mesh(solarMastGeo, heatShieldMat);
  solarMast.position.y = 1.6;

  // Dual Photovoltaic Wings
  const panelWingGeo = new THREE.BoxGeometry(4.2, 0.08, 1.6);
  const solarWings = new THREE.Mesh(panelWingGeo, solarPanelMat);
  solarWings.position.set(0, 3.2, 0);
  solarWings.rotation.x = 0.38; // angled to sun
  solarWings.castShadow = true;

  solar.add(solarMast, solarWings);
  solar.visible = false; // Built in Mission 3

  // 4. PRESSURIZED GEODESIC BIO-DOME & BUILD SLOT RING
  const bioDomeSlotRing = createBuildSlotRing(0, -18, 0x10b981, 4.2);

  const bioDome = new THREE.Group();
  bioDome.name = 'Structure_BioDome';
  bioDome.position.set(0, 0, -18);

  // Glass Greenhouse Dome
  const domeGeo = new THREE.SphereGeometry(6.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const domeGlass = new THREE.Mesh(domeGeo, domeGlassMat);

  // Dome structural struts
  const domeStruts = new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({
    color: 0x475569,
    wireframe: true,
    transparent: true,
    opacity: 0.4,
  }));

  // Hydroponics Planter Beds & Crops
  const planterGeo = new THREE.CylinderGeometry(5.2, 5.2, 0.4, 20);
  const planterMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
  const planter = new THREE.Mesh(planterGeo, planterMat);
  planter.position.y = 0.2;

  const plantsGroup = new THREE.Group();
  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI * 2;
    const r = 1.8 + Math.random() * 2.5;
    const plantGeo = new THREE.SphereGeometry(0.35 + Math.random() * 0.25, 8, 8);
    const plantMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.6 });
    const plant = new THREE.Mesh(plantGeo, plantMat);
    plant.position.set(Math.cos(angle) * r, 0.55, Math.sin(angle) * r);
    plant.scale.set(1, 1.4, 1);
    plantsGroup.add(plant);
  }

  // Water condenser column in center
  const condenserGeo = new THREE.CylinderGeometry(0.5, 0.6, 3.8, 12);
  const condenser = new THREE.Mesh(condenserGeo, landerMat);
  condenser.position.y = 1.9;

  // Airlock entry tunnel
  const airlockGeo = new THREE.BoxGeometry(1.8, 1.8, 2.4);
  const airlock = new THREE.Mesh(airlockGeo, heatShieldMat);
  airlock.position.set(0, 0.9, 6.5);

  bioDome.add(domeGlass, domeStruts, planter, plantsGroup, condenser, airlock);
  bioDome.visible = false; // Built in Mission 4

  // 5. PRESSURIZED HABITAT MODULE & BUILD SLOT RING
  const habitatSlotRing = createBuildSlotRing(-10, -10, 0xa855f7, 3.8);

  const habitat = new THREE.Group();
  habitat.name = 'Structure_Habitat';
  habitat.position.set(-10, 0, -10);

  // Cylindrical living module
  const habHullGeo = new THREE.CylinderGeometry(2.8, 2.8, 4.0, 16);
  habHullGeo.rotateZ(Math.PI / 2);
  const habHull = new THREE.Mesh(habHullGeo, landerMat);
  habHull.position.y = 1.6;

  // Observation Cupola on roof
  const cupolaGeo = new THREE.SphereGeometry(1.2, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const cupola = new THREE.Mesh(cupolaGeo, windowMat);
  cupola.position.set(0, 3.2, 0);

  // Comms Dish on side
  const dishGeo = new THREE.SphereGeometry(1.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 3);
  dishGeo.rotateX(-Math.PI / 2);
  const dish = new THREE.Mesh(dishGeo, landerMat);
  dish.position.set(0, 4.2, -1.2);
  dish.rotation.x = -0.5;

  habitat.add(habHull, cupola, dish);
  habitat.visible = false; // Built in Mission 5

  // 6. SCATTERED COLLECTABLE RESOURCE CUBES (REGOLITH & ICE)
  const resources: CollectableResource[] = [];

  // Regolith positions (Amber minerals scattered around base)
  const regolithCoords = [
    { x: 5, z: 8 },
    { x: 9, z: 12 },
    { x: 12, z: 6 },
    { x: 14, z: 14 },
    { x: 7, z: 16 },
    { x: -5, z: 12 },
    { x: -8, z: 9 },
    { x: -12, z: 15 },
    { x: 16, z: 2 },
    { x: 18, z: 9 },
  ];

  // Ice positions (Cyan crystals scattered around crater)
  const iceCoords = [
    { x: 6, z: -10 },
    { x: 10, z: -14 },
    { x: 14, z: -8 },
    { x: 8, z: -20 },
    { x: 13, z: -22 },
    { x: -6, z: -16 },
    { x: -14, z: -8 },
    { x: -16, z: -14 },
    { x: 4, z: -24 },
    { x: -8, z: -22 },
  ];

  // Resource materials
  const regolithMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b, // Amber / golden yellow
    emissive: 0xd97706,
    emissiveIntensity: 0.5,
    metalness: 0.4,
    roughness: 0.3,
  });

  const iceCubeMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8, // Vibrant crystal cyan
    emissive: 0x0284c7,
    emissiveIntensity: 0.6,
    metalness: 0.3,
    roughness: 0.15,
  });

  regolithCoords.forEach((pos, i) => {
    const group = new THREE.Group();
    group.position.set(pos.x, 0.4, pos.z);

    const cubeGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    const cube = new THREE.Mesh(cubeGeo, regolithMat);
    cube.rotation.set(0.4, 0.5, 0.2);
    group.add(cube);

    // Subtle floating bob
    group.userData = {
      baseY: 0.4,
      seed: i * 1.5,
      type: 'regolith',
    };

    resources.push({
      id: `regolith-${i}`,
      type: 'regolith',
      mesh: group,
      collected: false,
      isMagnetized: false,
      spawnPos: new THREE.Vector3(pos.x, 0.4, pos.z),
    });
  });

  iceCoords.forEach((pos, i) => {
    const group = new THREE.Group();
    group.position.set(pos.x, 0.4, pos.z);

    const cubeGeo = new THREE.OctahedronGeometry(0.42, 0);
    const cube = new THREE.Mesh(cubeGeo, iceCubeMat);
    cube.rotation.set(0.3, 0.4, 0.1);
    group.add(cube);

    group.userData = {
      baseY: 0.4,
      seed: i * 2.1,
      type: 'ice',
    };

    resources.push({
      id: `ice-${i}`,
      type: 'ice',
      mesh: group,
      collected: false,
      isMagnetized: false,
      spawnPos: new THREE.Vector3(pos.x, 0.4, pos.z),
    });
  });

  return {
    landerGroup: lander,
    landerPlume,
    landerMaterials,
    moxieGroup: moxie,
    moxieLightBeam,
    moxieLightBeamMat,
    moxieAuraDome,
    moxieAuraMat,
    solarSlotRing,
    solarGroup: solar,
    bioDomeSlotRing,
    bioDomeGroup: bioDome,
    habitatSlotRing,
    habitatGroup: habitat,
    resources,
  };
}

/**
 * Creates a glowing circular trigger ring on the ground to mark construction slots
 */
function createBuildSlotRing(x: number, z: number, color: number, radius: number = 2.4): THREE.Mesh {
  const ringGeo = new THREE.RingGeometry(radius - 0.25, radius + 0.15, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.05, z);
  return ring;
}
