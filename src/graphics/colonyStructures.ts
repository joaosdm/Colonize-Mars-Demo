/**
 * Procedural 3D Colony Structures, Scaffolding Holograms & Collectable Resources for Mars
 * Includes all 11 colony modules + 3 exterior planting plots across 6 Eras:
 * - Starship Lander (Hub)
 * - MOXIE O2 Extractor + Oxygen Dome Aura (-7, 4)
 * - Solar Array Wings (8, 4)
 * - Water Extractor & Liquid Storage Tank (14, -10)
 * - Auto Miner Rig (18, 7)
 * - Research & Tech Lab (-12, -6)
 * - Automated Laser Defense Turret (10, -2)
 * - Hydroponic BioDome (0, -19) + 3 Exterior Planting Plots
 * - Pressurized Habitat & Medbay (-11, 12)
 * - Orbital Comms Array (12, 14)
 * - Deep Geothermal Power Plant (-20, -4)
 * - Atmospheric Terraformer Processor (-14, -18)
 */

import * as THREE from 'three';
import type { BuildingKey } from '../sim/marsColonyLogic';
import { BUILDING_COORDS } from '../sim/marsEnemies';
import { groundHeightAt, ObstacleCircle } from '../sim/marsPhysics';

export type ResourceNodeKind =
  | 'regolith'
  | 'ice'
  | 'iron'
  | 'titanium'
  | 'silicon'
  | 'sulfur';

export interface CollectableResource {
  id: string;
  type: ResourceNodeKind;
  mesh: THREE.Group;
  collected: boolean;
  isMagnetized: boolean;
  spawnPos: THREE.Vector3;
  respawnTimer: number;
}

export interface PlantingPlot {
  index: number;
  x: number;
  z: number;
  ring: THREE.Mesh;
  cropsGroup: THREE.Group;
}

export interface ScaffoldingRig {
  group: THREE.Group;
  coreBar: THREE.Mesh;
  wireCage: THREE.Mesh;
}

export interface BuildingFireRig {
  group: THREE.Group;
  flames: THREE.Mesh[];
  smokePuffs: THREE.Mesh[];
}

export interface ExplosionDebrisPiece {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
}

export interface ExplosionBurstRig {
  group: THREE.Group;
  flashSphere: THREE.Mesh;
  shockRing: THREE.Mesh;
  debris: ExplosionDebrisPiece[];
  activeTimer: number;
  durationSec: number;
}

export interface ColonyStructures {
  landerGroup: THREE.Group;
  landerPlume: THREE.Mesh;
  landerMaterials: THREE.Material[];
  miniGreenhouseGroup: THREE.Group;
  domeCropBedGroups: THREE.Group[];

  // MOXIE
  moxieGroup: THREE.Group;
  moxieSlotRing: THREE.Mesh;
  moxieLightBeam: THREE.Mesh;
  moxieLightBeamMat: THREE.MeshBasicMaterial;
  moxieAuraDome: THREE.Mesh;
  moxieAuraMat: THREE.MeshBasicMaterial;

  // Solar
  solarSlotRing: THREE.Mesh;
  solarGroup: THREE.Group;

  // Water Extractor
  waterSlotRing: THREE.Mesh;
  waterExtractorGroup: THREE.Group;
  waterRotor: THREE.Group;

  // Auto Miner
  autoMinerSlotRing: THREE.Mesh;
  autoMinerGroup: THREE.Group;
  autoMinerDrill: THREE.Group;

  // Research Lab
  labSlotRing: THREE.Mesh;
  labGroup: THREE.Group;
  labRadar: THREE.Group;

  // Defense Turret
  defenseTurretSlotRing: THREE.Mesh;
  defenseTurretGroup: THREE.Group;
  turretHead: THREE.Group;

  // BioDome & Plots
  bioDomeSlotRing: THREE.Mesh;
  bioDomeGroup: THREE.Group;
  plantingPlots: PlantingPlot[];

  // Habitat
  habitatSlotRing: THREE.Mesh;
  habitatGroup: THREE.Group;

  // Comms Array
  commsSlotRing: THREE.Mesh;
  commsGroup: THREE.Group;
  commsDish: THREE.Group;

  // Geothermal Plant
  geothermalSlotRing: THREE.Mesh;
  geothermalGroup: THREE.Group;
  geothermalCore: THREE.Mesh;

  // Atmospheric Terraformer
  terraformerSlotRing: THREE.Mesh;
  terraformerGroup: THREE.Group;
  terraformerTurbine: THREE.Group;
  terraformerBeam: THREE.Mesh;

  // Dynamic Scaffolding, Damage Rings, Fire/Smoke & Explosion VFX
  scaffoldingRigs: Record<string, ScaffoldingRig>;
  damageRings: Record<BuildingKey, THREE.Mesh>;
  fireRigs: Record<BuildingKey, BuildingFireRig>;
  explosionRig: ExplosionBurstRig;

  resources: CollectableResource[];
  getObstacles: (buildings: Record<BuildingKey, boolean>) => ObstacleCircle[];
}

export const PLANTING_PLOT_COORDS: Array<{ x: number; z: number }> = [
  { x: 5, z: -22 },
  { x: -5, z: -22 },
  { x: 0, z: -27 },
];

export function createColonyStructures(): ColonyStructures {
  const landerMaterials: THREE.Material[] = [];

  const landerMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.72,
    roughness: 0.26,
  });
  landerMaterials.push(landerMat);

  const heatShieldMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.82,
    roughness: 0.48,
  });
  landerMaterials.push(heatShieldMat);

  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.35,
    metalness: 0.85,
    roughness: 0.15,
    transparent: true,
    opacity: 0.9,
  });
  landerMaterials.push(windowMat);

  const moxieMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    metalness: 0.55,
    roughness: 0.35,
  });

  const solarPanelMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    metalness: 0.9,
    roughness: 0.15,
  });

  const domeGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xa5f3fc,
    transparent: true,
    opacity: 0.34,
    roughness: 0.08,
    metalness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    depthWrite: false,
  });

  const goldFoilMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.78,
    roughness: 0.28,
  });

  // 1. STARSHIP LANDER (HUB at 0, 0)
  const lander = new THREE.Group();
  lander.name = 'Mars_Starship_Lander';
  lander.position.set(0, groundHeightAt(0, 0), 0);

  const landerBody = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.45, 14, 20), landerMat);
  landerBody.position.y = 8.5;
  lander.add(landerBody);

  const landerCone = new THREE.Mesh(new THREE.ConeGeometry(2.3, 5.5, 20), landerMat);
  landerCone.position.y = 18.25;
  lander.add(landerCone);

  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.5), windowMat);
  cockpit.position.set(0, 16.5, 2.1);
  lander.add(cockpit);

  const landerShield = new THREE.Mesh(
    new THREE.CylinderGeometry(2.34, 2.48, 13.8, 20, 1, false, 0, Math.PI),
    heatShieldMat
  );
  landerShield.position.y = 8.5;
  lander.add(landerShield);

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const legGroup = new THREE.Group();
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 4.2, 8), heatShieldMat);
    leg.rotation.z = 0.42;
    leg.position.set(1.85, 1.8, 0);

    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.18, 8), heatShieldMat);
    pad.position.set(2.9, 0.09, 0);

    legGroup.add(leg, pad);
    legGroup.rotation.y = angle;
    lander.add(legGroup);
  }

  const plumeGeo = new THREE.ConeGeometry(1.8, 8, 16);
  plumeGeo.rotateX(Math.PI);
  const landerPlume = new THREE.Mesh(
    plumeGeo,
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    })
  );
  landerPlume.position.y = -2.5;
  lander.add(landerPlume);

  // 2. MOXIE O2 EXTRACTOR at (-7, 4)
  const moxieY = groundHeightAt(-7, 4);
  const moxieSlotRing = createBuildSlotRing(-7, moxieY, 4, 0x06b6d4, 2.4);

  const moxie = new THREE.Group();
  moxie.name = 'Structure_MOXIE';
  moxie.position.set(-7, moxieY, 4);

  const moxieBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 1.4), moxieMat);
  moxieBody.position.y = 0.9;

  const intake = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.48, 0.22, 16),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.7,
    })
  );
  intake.rotation.x = Math.PI / 2;
  intake.position.set(0, 1.1, 0.72);

  const moxieLightBeamMat = new THREE.MeshBasicMaterial({
    color: 0x0284c7,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const moxieLightBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.35, 9, 12, 1, true),
    moxieLightBeamMat
  );
  moxieLightBeam.position.y = 4.6;

  const moxieAuraMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const moxieAuraDome = new THREE.Mesh(
    new THREE.SphereGeometry(14, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    moxieAuraMat
  );
  moxieAuraDome.position.set(0, 0, 0);
  moxie.add(moxieBody, intake, moxieLightBeam);

  // 3. SOLAR ARRAY WINGS at (8, 4)
  const solarY = groundHeightAt(8, 4);
  const solarSlotRing = createBuildSlotRing(8, solarY, 4, 0x3b82f6, 2.5);

  const solar = new THREE.Group();
  solar.name = 'Structure_SolarPanels';
  solar.position.set(8, solarY, 4);

  const solarBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.4), heatShieldMat);
  solarBase.position.y = 0.25;
  const solarMast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 3.0, 8), heatShieldMat);
  solarMast.position.y = 1.6;
  const solarWings = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.08, 2.0), solarPanelMat);
  solarWings.position.set(0, 3.1, 0);
  solarWings.rotation.x = 0.42;
  const solarFrame = new THREE.Mesh(
    new THREE.BoxGeometry(4.95, 0.05, 2.15),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.3 })
  );
  solarFrame.position.set(0, 3.07, 0);
  solarFrame.rotation.x = 0.42;
  solar.add(solarBase, solarMast, solarWings, solarFrame);
  solar.visible = false;

  // 4. WATER EXTRACTOR at (14, -10)
  const waterY = groundHeightAt(14, -10);
  const waterSlotRing = createBuildSlotRing(14, waterY, -10, 0x0ea5e9, 3.0);

  const waterExtractorGroup = new THREE.Group();
  waterExtractorGroup.name = 'Structure_WaterExtractor';
  waterExtractorGroup.position.set(14, waterY, -10);

  const waterPad = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.8, 0.3, 16), heatShieldMat);
  waterPad.position.y = 0.15;
  const waterTank = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 3.2, 16),
    new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0369a1,
      emissiveIntensity: 0.45,
      metalness: 0.35,
      roughness: 0.2,
    })
  );
  waterTank.position.set(-0.85, 1.75, 0);
  const drillRig = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 3.6, 12), landerMat);
  drillRig.position.set(0.9, 1.9, 0);

  const waterRotor = new THREE.Group();
  waterRotor.position.set(0.9, 3.8, 0);
  waterRotor.add(
    new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.25), moxieMat),
    new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 2.2), moxieMat)
  );
  const pipeBridge = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.8, 8), landerMat);
  pipeBridge.rotation.z = Math.PI / 2;
  pipeBridge.position.set(0, 2.4, 0);
  waterExtractorGroup.add(waterPad, waterTank, drillRig, waterRotor, pipeBridge);
  waterExtractorGroup.visible = false;

  // 5. AUTO MINER RIG at (18, 7)
  const minerY = groundHeightAt(18, 7);
  const autoMinerSlotRing = createBuildSlotRing(18, minerY, 7, 0xf59e0b, 2.8);
  const autoMinerGroup = new THREE.Group();
  autoMinerGroup.name = 'Structure_AutoMiner';
  autoMinerGroup.position.set(18, minerY, 7);

  const minerDeck = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.4, 2.8), heatShieldMat);
  minerDeck.position.y = 0.2;
  const minerGantry = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.2, 0.45), goldFoilMat);
  minerGantry.position.set(0, 1.8, -0.7);
  const minerHopper = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 1.5, 10), landerMat);
  minerHopper.position.set(-0.65, 1.15, 0.5);

  const autoMinerDrill = new THREE.Group();
  autoMinerDrill.position.set(0.55, 1.8, 0.45);
  const drillBit = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.5, 8), goldFoilMat);
  drillBit.rotation.x = Math.PI;
  drillBit.position.y = -0.35;
  const drillCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.6, 12), heatShieldMat);
  drillCollar.position.y = 0.95;
  autoMinerDrill.add(drillBit, drillCollar);

  autoMinerGroup.add(minerDeck, minerGantry, minerHopper, autoMinerDrill);
  autoMinerGroup.visible = false;

  // 6. RESEARCH & TECH LAB at (-12, -6)
  const labY = groundHeightAt(-12, -6);
  const labSlotRing = createBuildSlotRing(-12, labY, -6, 0xa855f7, 3.2);
  const labGroup = new THREE.Group();
  labGroup.name = 'Structure_ResearchLab';
  labGroup.position.set(-12, labY, -6);

  const labHull = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 2.4, 8), landerMat);
  labHull.position.y = 1.2;
  const labRing = new THREE.Mesh(
    new THREE.CylinderGeometry(2.45, 2.45, 0.35, 8),
    new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.7,
    })
  );
  labRing.position.y = 2.0;
  const labCupola = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    windowMat
  );
  labCupola.position.y = 2.4;
  const labRadar = new THREE.Group();
  labRadar.position.set(1.2, 3.1, -0.6);
  const radarDish = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.45, 14), landerMat);
  radarDish.rotation.x = Math.PI * 0.65;
  labRadar.add(radarDish);
  labGroup.add(labHull, labRing, labCupola, labRadar);
  labGroup.visible = false;

  // 7. AUTOMATED DEFENSE TURRET at (10, -2)
  const turretY = groundHeightAt(10, -2);
  const defenseTurretSlotRing = createBuildSlotRing(10, turretY, -2, 0xef4444, 2.6);
  const defenseTurretGroup = new THREE.Group();
  defenseTurretGroup.name = 'Structure_DefenseTurret';
  defenseTurretGroup.position.set(10, turretY, -2);

  const turretPedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.45, 1.6, 10), heatShieldMat);
  turretPedestal.position.y = 0.8;
  const turretRing = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.15, 0.25, 12),
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.8,
    })
  );
  turretRing.position.y = 1.65;

  const turretHead = new THREE.Group();
  turretHead.position.y = 2.25;
  const turretPod = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 1.5), landerMat);
  const barrel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 1.8, 8), heatShieldMat);
  barrel1.rotation.x = Math.PI / 2;
  barrel1.position.set(-0.32, 0.05, 1.1);
  const barrel2 = barrel1.clone();
  barrel2.position.x = 0.32;
  const turretSensor = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  turretSensor.position.set(0, 0.55, 0.3);
  turretHead.add(turretPod, barrel1, barrel2, turretSensor);
  defenseTurretGroup.add(turretPedestal, turretRing, turretHead);
  defenseTurretGroup.visible = false;

  // 8. HYDROPONIC BIODOME (REDOMA DE VIDRO PRINCIPAL) at (0, -19)
  const domeY = groundHeightAt(0, -19);
  const bioDomeSlotRing = createBuildSlotRing(0, domeY, -19, 0x10b981, 4.4);
  const bioDome = new THREE.Group();
  bioDome.name = 'Structure_BioDome';
  bioDome.position.set(0, domeY, -19);

  const domeGeo = new THREE.SphereGeometry(6.0, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const domeGlass = new THREE.Mesh(domeGeo, domeGlassMat);
  domeGlass.renderOrder = 2;
  const domeStruts = new THREE.Mesh(
    domeGeo,
    new THREE.MeshStandardMaterial({
      color: 0x64748b,
      wireframe: true,
      transparent: true,
      opacity: 0.48,
      metalness: 0.7,
      roughness: 0.3,
    })
  );
  const domeBaseRing = new THREE.Mesh(
    new THREE.TorusGeometry(6.0, 0.28, 10, 32),
    heatShieldMat
  );
  domeBaseRing.rotation.x = Math.PI / 2;
  domeBaseRing.position.y = 0.22;

  const growLampRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.08, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xfef08a })
  );
  growLampRing.rotation.x = Math.PI / 2;
  growLampRing.position.y = 4.2;

  const planter = new THREE.Mesh(
    new THREE.CylinderGeometry(5.2, 5.2, 0.45, 20),
    new THREE.MeshStandardMaterial({ color: 0x3f2e21, roughness: 0.94 })
  );
  planter.position.y = 0.22;
  const interiorPlants = new THREE.Group();
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const r = 1.6 + (i % 3) * 0.9;
    const plant = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 1.35, 7),
      new THREE.MeshStandardMaterial({ color: i % 3 === 0 ? 0x84cc16 : 0x22c55e, roughness: 0.65 })
    );
    plant.position.set(Math.cos(angle) * r, 1.0, Math.sin(angle) * r);
    interiorPlants.add(plant);
  }
  const condenser = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 3.6, 12), landerMat);
  condenser.position.y = 1.8;
  const airlock = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 2.2), heatShieldMat);
  airlock.position.set(0, 0.9, 6.0);
  bioDome.add(domeGlass, domeStruts, domeBaseRing, growLampRing, planter, interiorPlants, condenser, airlock);
  bioDome.visible = false;

  // 8B. STARTER GLASS FOOD GREENHOUSE DOME (REDOMA AGRÍCOLA INICIAL) at (-6.5, -5.5)
  // Always deployed with the Starship survival kit so astronauts can immediately cultivate food inside glass!
  const miniDomeY = groundHeightAt(-6.5, -5.5);
  const miniGreenhouseGroup = new THREE.Group();
  miniGreenhouseGroup.name = 'Structure_MiniGreenhouseDome';
  miniGreenhouseGroup.position.set(-6.5, miniDomeY, -5.5);

  const miniBase = new THREE.Mesh(
    new THREE.CylinderGeometry(3.45, 3.7, 0.45, 24),
    heatShieldMat
  );
  miniBase.position.y = 0.22;
  const miniSoil = new THREE.Mesh(
    new THREE.CylinderGeometry(3.15, 3.15, 0.14, 20),
    new THREE.MeshStandardMaterial({ color: 0x3b281c, roughness: 0.96 })
  );
  miniSoil.position.y = 0.48;

  const miniDomeGeo = new THREE.SphereGeometry(3.35, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  const miniGlass = new THREE.Mesh(miniDomeGeo, domeGlassMat);
  miniGlass.position.y = 0.42;
  miniGlass.renderOrder = 2;
  const miniStruts = new THREE.Mesh(
    miniDomeGeo,
    new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      wireframe: true,
      transparent: true,
      opacity: 0.52,
      metalness: 0.72,
      roughness: 0.3,
    })
  );
  miniStruts.position.y = 0.42;
  const miniLamp = new THREE.Mesh(
    new THREE.TorusGeometry(1.75, 0.06, 8, 20),
    new THREE.MeshBasicMaterial({ color: 0xfde047 })
  );
  miniLamp.rotation.x = Math.PI / 2;
  miniLamp.position.y = 2.65;
  const miniAirlock = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.4, 1.25), landerMat);
  miniAirlock.position.set(0, 0.7, 3.45);
  miniGreenhouseGroup.add(miniBase, miniSoil, miniGlass, miniStruts, miniLamp, miniAirlock);

  // 4 Visible Dynamic 3D Crop Beds inside the Glass Food Dome!
  const domeCropBedOffsets = [
    { x: -1.15, z: -1.05 },
    { x: 1.15, z: -1.05 },
    { x: -1.15, z: 1.05 },
    { x: 1.15, z: 1.05 },
  ];
  const domeCropBedGroups: THREE.Group[] = domeCropBedOffsets.map((off) => {
    const bedGroup = new THREE.Group();
    bedGroup.position.set(off.x, 0.55, off.z);

    const planterTray = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 0.22, 1.35),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.45, roughness: 0.6 })
    );
    planterTray.position.y = 0.11;
    bedGroup.add(planterTray);

    const plantsHolder = new THREE.Group();
    plantsHolder.name = 'cropPlants';
    for (let k = 0; k < 6; k++) {
      const col = k % 3;
      const row = Math.floor(k / 3);
      const stalk = new THREE.Mesh(
        new THREE.ConeGeometry(0.19, 0.85, 6),
        new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.62 })
      );
      stalk.position.set(-0.46 + col * 0.46, 0.55, -0.26 + row * 0.52);
      plantsHolder.add(stalk);
    }
    plantsHolder.visible = false;
    bedGroup.add(plantsHolder);
    miniGreenhouseGroup.add(bedGroup);
    return plantsHolder;
  });

  // 9. 3 EXTERIOR PLANTING PLOTS around BioDome
  const plantingPlots: PlantingPlot[] = PLANTING_PLOT_COORDS.map((coord, idx) => {
    const py = groundHeightAt(coord.x, coord.z);
    const ring = createBuildSlotRing(coord.x, py, coord.z, 0x22c55e, 1.9);
    ring.visible = false;

    const cropsGroup = new THREE.Group();
    cropsGroup.position.set(coord.x, py, coord.z);

    const bed = new THREE.Mesh(
      new THREE.CylinderGeometry(1.55, 1.7, 0.28, 16),
      new THREE.MeshStandardMaterial({ color: 0x3f2e21, roughness: 0.95 })
    );
    bed.position.y = 0.14;
    cropsGroup.add(bed);

    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const rad = k === 0 ? 0 : 0.85;
      const sprout = new THREE.Mesh(
        new THREE.ConeGeometry(0.28, 1.15, 7),
        new THREE.MeshStandardMaterial({
          color: k % 2 === 0 ? 0x22c55e : 0x4ade80,
          emissive: 0x15803d,
          emissiveIntensity: 0.18,
          roughness: 0.6,
        })
      );
      sprout.position.set(Math.cos(a) * rad, 0.78, Math.sin(a) * rad);
      cropsGroup.add(sprout);
    }
    cropsGroup.visible = false;

    return {
      index: idx,
      x: coord.x,
      z: coord.z,
      ring,
      cropsGroup,
    };
  });

  // 10. PRESSURIZED HABITAT & MEDBAY at (-11, 12)
  const habY = groundHeightAt(-11, 12);
  const habitatSlotRing = createBuildSlotRing(-11, habY, 12, 0xf97316, 3.4);
  const habitatGroup = new THREE.Group();
  habitatGroup.name = 'Structure_Habitat';
  habitatGroup.position.set(-11, habY, 12);

  const habCore = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 2.8, 12), landerMat);
  habCore.position.y = 1.4;
  const habRoof = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    heatShieldMat
  );
  habRoof.position.y = 2.75;
  const habVisor = new THREE.Mesh(new THREE.CylinderGeometry(2.68, 2.68, 0.75, 16), windowMat);
  habVisor.position.y = 1.75;
  const habAirlock = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 1.5), heatShieldMat);
  habAirlock.position.set(2.5, 0.9, 0);

  // Mission Control Terminal kiosk at Habitat entrance
  const terminalBase = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.05, 0.7), heatShieldMat);
  terminalBase.position.set(2.85, 0.52, 1.35);
  const terminalScreenMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x0891b2,
    emissiveIntensity: 0.9,
    metalness: 0.4,
    roughness: 0.2,
  });
  const terminalScreen = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.62, 0.12), terminalScreenMat);
  terminalScreen.position.set(2.85, 1.32, 1.35);
  terminalScreen.rotation.x = -0.35;
  const terminalMast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.85, 8), landerMat);
  terminalMast.position.set(3.2, 1.45, 1.15);
  const terminalBeacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee })
  );
  terminalBeacon.position.set(3.2, 1.9, 1.15);

  habitatGroup.add(
    habCore,
    habRoof,
    habVisor,
    habAirlock,
    terminalBase,
    terminalScreen,
    terminalMast,
    terminalBeacon
  );
  habitatGroup.visible = false;

  // 11. ORBITAL COMMS ARRAY at (12, 14)
  const commsY = groundHeightAt(12, 14);
  const commsSlotRing = createBuildSlotRing(12, commsY, 14, 0x22d3ee, 3.0);
  const commsGroup = new THREE.Group();
  commsGroup.name = 'Structure_CommsArray';
  commsGroup.position.set(12, commsY, 14);

  const commsBase = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.0, 1.4, 8), heatShieldMat);
  commsBase.position.y = 0.7;
  const commsTower = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, 5.2, 8), landerMat);
  commsTower.position.y = 3.8;
  const commsDish = new THREE.Group();
  commsDish.position.set(0, 6.2, 0);
  const dishCone = new THREE.Mesh(new THREE.ConeGeometry(2.1, 0.9, 18, 1, true), landerMat);
  dishCone.rotation.x = Math.PI * 0.65;
  const dishBeacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee })
  );
  dishBeacon.position.set(0, 0.6, 0.7);
  commsDish.add(dishCone, dishBeacon);
  commsGroup.add(commsBase, commsTower, commsDish);
  commsGroup.visible = false;

  // 12. DEEP GEOTHERMAL PLANT at (-20, -4)
  const geoY = groundHeightAt(-20, -4);
  const geothermalSlotRing = createBuildSlotRing(-20, geoY, -4, 0xfb923c, 3.3);
  const geothermalGroup = new THREE.Group();
  geothermalGroup.name = 'Structure_GeothermalPlant';
  geothermalGroup.position.set(-20, geoY, -4);

  const geoBase = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.9, 1.1, 10), heatShieldMat);
  geoBase.position.y = 0.55;
  const geoTower = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.45, 4.6, 12), landerMat);
  geoTower.position.y = 3.1;
  const geothermalCore = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.25, 10, 20),
    new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.9,
    })
  );
  geothermalCore.rotation.x = Math.PI / 2;
  geothermalCore.position.y = 3.4;
  geothermalGroup.add(geoBase, geoTower, geothermalCore);
  geothermalGroup.visible = false;

  // 13. ATMOSPHERIC TERRAFORMER PROCESSOR at (-14, -18)
  const terraY = groundHeightAt(-14, -18);
  const terraformerSlotRing = createBuildSlotRing(-14, terraY, -18, 0x38bdf8, 3.4);
  const terraformerGroup = new THREE.Group();
  terraformerGroup.name = 'Structure_Terraformer';
  terraformerGroup.position.set(-14, terraY, -18);

  const terraBase = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 1.0, 12), heatShieldMat);
  terraBase.position.y = 0.5;
  const terraTower = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 7.5, 14), landerMat);
  terraTower.position.y = 4.25;
  const terraformerTurbine = new THREE.Group();
  terraformerTurbine.position.y = 6.2;
  const ringHalo = new THREE.Mesh(
    new THREE.TorusGeometry(2.1, 0.18, 10, 24),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.85,
    })
  );
  ringHalo.rotation.x = Math.PI / 2;
  terraformerTurbine.add(ringHalo);

  const terraformerBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 1.2, 42, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  terraformerBeam.position.y = 26;
  terraformerGroup.add(terraBase, terraTower, terraformerTurbine, terraformerBeam);
  terraformerGroup.visible = false;

  // 14. HOLOGRAPHIC SCAFFOLDING RIGS (shown during complexity-timed construction)
  const scaffoldingRigs: Record<string, ScaffoldingRig> = {};
  const scaffoldingDefs: Array<{ id: string; x: number; z: number; w: number; h: number }> = [
    { id: 'trigger-moxie', x: -7, z: 4, w: 2.4, h: 2.6 },
    { id: 'trigger-solar', x: 8, z: 4, w: 3.4, h: 3.2 },
    { id: 'trigger-water', x: 14, z: -10, w: 3.8, h: 3.8 },
    { id: 'trigger-miner', x: 18, z: 7, w: 3.2, h: 3.4 },
    { id: 'trigger-lab', x: -12, z: -6, w: 4.2, h: 3.5 },
    { id: 'trigger-turret', x: 10, z: -2, w: 2.6, h: 3.0 },
    { id: 'trigger-biodome', x: 0, z: -19, w: 8.5, h: 5.5 },
    { id: 'trigger-plant-0', x: 5, z: -22, w: 2.6, h: 1.8 },
    { id: 'trigger-plant-1', x: -5, z: -22, w: 2.6, h: 1.8 },
    { id: 'trigger-plant-2', x: 0, z: -27, w: 2.6, h: 1.8 },
    { id: 'trigger-habitat', x: -11, z: 12, w: 4.2, h: 3.8 },
    { id: 'trigger-comms', x: 12, z: 14, w: 3.2, h: 6.0 },
    { id: 'trigger-geothermal', x: -20, z: -4, w: 4.4, h: 4.8 },
    { id: 'trigger-terraform', x: -14, z: -18, w: 4.4, h: 7.5 },
  ];

  const scafCoreMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const scafWireMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    wireframe: true,
    transparent: true,
    opacity: 0.72,
  });

  scaffoldingDefs.forEach((def) => {
    const gy = groundHeightAt(def.x, def.z);
    const group = new THREE.Group();
    group.position.set(def.x, gy, def.z);

    const coreGeo = new THREE.BoxGeometry(def.w, def.h, def.w);
    coreGeo.translate(0, def.h / 2, 0);
    const coreBar = new THREE.Mesh(coreGeo, scafCoreMat);

    const wireGeo = new THREE.BoxGeometry(def.w + 0.15, def.h, def.w + 0.15);
    wireGeo.translate(0, def.h / 2, 0);
    const wireCage = new THREE.Mesh(wireGeo, scafWireMat);

    group.add(coreBar, wireCage);
    group.visible = false;
    scaffoldingRigs[def.id] = { group, coreBar, wireCage };
  });

  // 15. DAMAGE WARNING RINGS & CRITICAL FIRE/SMOKE RIGS
  const damageRings = {} as Record<BuildingKey, THREE.Mesh>;
  const fireRigs = {} as Record<BuildingKey, BuildingFireRig>;

  const outerFlameGeo = new THREE.ConeGeometry(0.85, 2.3, 8);
  outerFlameGeo.translate(0, 1.15, 0);
  const innerFlameGeo = new THREE.ConeGeometry(0.48, 1.65, 7);
  innerFlameGeo.translate(0, 0.82, 0);
  const smokeGeo = new THREE.DodecahedronGeometry(0.55, 0);

  const outerFlameMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const coreFlameMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const redFlameMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const smokeMat = new THREE.MeshBasicMaterial({
    color: 0x1e293b,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });

  (Object.keys(BUILDING_COORDS) as BuildingKey[]).forEach((key) => {
    const c = BUILDING_COORDS[key];
    const gy = groundHeightAt(c.x, c.z);
    const ring = createBuildSlotRing(c.x, gy + 0.08, c.z, 0xef4444, 3.2);
    ring.visible = false;
    damageRings[key] = ring;

    const fireGroup = new THREE.Group();
    fireGroup.name = `FireRig_${key}`;
    fireGroup.position.set(c.x, gy + 0.4, c.z);

    const f1 = new THREE.Mesh(outerFlameGeo, outerFlameMat);
    f1.position.set(0, 0.2, 0);
    const f2 = new THREE.Mesh(innerFlameGeo, coreFlameMat);
    f2.position.set(0.28, 0.15, 0.22);
    const f3 = new THREE.Mesh(innerFlameGeo, redFlameMat);
    f3.position.set(-0.34, 0.1, -0.25);

    const smokePuffs: THREE.Mesh[] = [];
    for (let s = 0; s < 3; s++) {
      const puff = new THREE.Mesh(smokeGeo, smokeMat);
      puff.position.set((s - 1) * 0.45, 2.2 + s * 0.9, (s % 2 === 0 ? 1 : -1) * 0.3);
      smokePuffs.push(puff);
      fireGroup.add(puff);
    }

    fireGroup.add(f1, f2, f3);
    fireGroup.visible = false;
    fireRigs[key] = {
      group: fireGroup,
      flames: [f1, f2, f3],
      smokePuffs,
    };
  });

  // 15B. POOLED 3D BUILDING EXPLOSION RIG (zero GC on detonation)
  const explosionGroup = new THREE.Group();
  explosionGroup.name = 'Building_Explosion_Burst';
  const flashSphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 14, 12),
    new THREE.MeshBasicMaterial({
      color: 0xfb923c,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  flashSphere.position.y = 1.4;

  const shockRing = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.55, 28),
    new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  shockRing.rotation.x = -Math.PI / 2;
  shockRing.position.y = 0.25;

  const debrisMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
  const debrisGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
  const debris: ExplosionDebrisPiece[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const mesh = new THREE.Mesh(debrisGeo, debrisMat);
    mesh.position.set(0, 1.0, 0);
    explosionGroup.add(mesh);
    debris.push({
      mesh,
      vx: Math.cos(a) * (4.2 + (i % 3) * 1.4),
      vy: 4.5 + (i % 4) * 1.35,
      vz: Math.sin(a) * (4.2 + (i % 3) * 1.4),
    });
  }
  explosionGroup.add(flashSphere, shockRing);
  explosionGroup.visible = false;

  const explosionRig: ExplosionBurstRig = {
    group: explosionGroup,
    flashSphere,
    shockRing,
    debris,
    activeTimer: 0,
    durationSec: 1.35,
  };

  // 16. GROUNDED COLLECTABLE RESOURCES (28 Regolith, 24 Ice) - Clear of all structure pads
  const resources: CollectableResource[] = [];

  const regolithCoords: Array<{ x: number; z: number }> = [
    { x: 4, z: 10 },
    { x: 9, z: 10 },
    { x: 14, z: 3 },
    { x: 18, z: 14 },
    { x: 6, z: 18 },
    { x: -5, z: 11 },
    { x: -7, z: 16 },
    { x: -16, z: 16 },
    { x: 22, z: 1 },
    { x: 24, z: 10 },
    { x: -16, z: 3 },
    { x: -24, z: 2 },
    { x: 3, z: 22 },
    { x: -3, z: 25 },
    { x: 24, z: 19 },
    { x: -24, z: 13 },
    { x: 15, z: 25 },
    { x: -16, z: 24 },
    { x: 28, z: -3 },
    { x: -28, z: -9 },
    { x: 14, z: -4 },
    { x: -17, z: -11 },
    { x: 9, z: -28 },
    { x: -9, z: -29 },
    { x: 31, z: 11 },
    { x: -31, z: 5 },
    { x: 0, z: 14 },
    { x: 22, z: 14 },
  ];

  const iceCoords: Array<{ x: number; z: number }> = [
    { x: 6, z: -9 },
    { x: 11, z: -15 },
    { x: 17, z: -5 },
    { x: 19, z: -14 },
    { x: 24, z: -18 },
    { x: 20, z: -23 },
    { x: 8, z: -16 },
    { x: -7, z: -14 },
    { x: -15, z: -11 },
    { x: -19, z: -15 },
    { x: -24, z: -19 },
    { x: -21, z: -25 },
    { x: 3, z: -33 },
    { x: -5, z: -34 },
    { x: 29, z: -14 },
    { x: 27, z: -24 },
    { x: -29, z: -15 },
    { x: -27, z: -26 },
    { x: 15, z: -31 },
    { x: -15, z: -31 },
    { x: 33, z: -7 },
    { x: -33, z: -6 },
    { x: 3, z: -9 },
    { x: -4, z: -3 },
  ];

  const regolithMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.45,
    metalness: 0.42,
    roughness: 0.28,
  });

  const iceCubeMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.55,
    metalness: 0.3,
    roughness: 0.15,
  });

  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  const shadowDiscGeo = new THREE.CircleGeometry(0.45, 12);
  shadowDiscGeo.rotateX(-Math.PI / 2);

  regolithCoords.forEach((pos, i) => {
    const gy = groundHeightAt(pos.x, pos.z);
    const group = new THREE.Group();
    group.position.set(pos.x, gy + 0.45, pos.z);

    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.58, 0.58), regolithMat);
    cube.rotation.set(0.4, 0.5, 0.2);
    const shadow = new THREE.Mesh(shadowDiscGeo, shadowMat);
    shadow.position.y = -0.42;
    group.add(cube, shadow);
    group.userData = { baseY: gy + 0.45, seed: i * 1.4, type: 'regolith' };

    resources.push({
      id: `regolith-${i}`,
      type: 'regolith',
      mesh: group,
      collected: false,
      isMagnetized: false,
      spawnPos: new THREE.Vector3(pos.x, gy + 0.45, pos.z),
      respawnTimer: 0,
    });
  });

  iceCoords.forEach((pos, i) => {
    const gy = groundHeightAt(pos.x, pos.z);
    const group = new THREE.Group();
    group.position.set(pos.x, gy + 0.48, pos.z);

    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), iceCubeMat);
    crystal.rotation.set(0.3, 0.4, 0.1);
    const shadow = new THREE.Mesh(shadowDiscGeo, shadowMat);
    shadow.position.y = -0.44;
    group.add(crystal, shadow);
    group.userData = { baseY: gy + 0.48, seed: i * 1.9, type: 'ice' };

    resources.push({
      id: `ice-${i}`,
      type: 'ice',
      mesh: group,
      collected: false,
      isMagnetized: false,
      spawnPos: new THREE.Vector3(pos.x, gy + 0.48, pos.z),
      respawnTimer: 0,
    });
  });

  // 17. EXPLORABLE BIOME MINERAL ORE VEINS (Iron, Titanium, Silicon, Sulfur)
  const mineralMaterials: Record<'iron' | 'titanium' | 'silicon' | 'sulfur', THREE.MeshStandardMaterial> = {
    iron: new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.35,
      metalness: 0.78,
      roughness: 0.32,
    }),
    titanium: new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      emissive: 0x3b82f6,
      emissiveIntensity: 0.45,
      metalness: 0.92,
      roughness: 0.16,
    }),
    silicon: new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.52,
      metalness: 0.42,
      roughness: 0.18,
    }),
    sulfur: new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xca8a04,
      emissiveIntensity: 0.52,
      metalness: 0.25,
      roughness: 0.38,
    }),
  };

  const mineralVeins: Array<{ type: 'iron' | 'titanium' | 'silicon' | 'sulfur'; x: number; z: number }> = [
    // Basalt Canyon (East) — Iron & Titanium
    { type: 'iron', x: 34, z: 4 },
    { type: 'iron', x: 42, z: -8 },
    { type: 'iron', x: 48, z: 14 },
    { type: 'iron', x: 38, z: 22 },
    { type: 'iron', x: 56, z: -2 },
    { type: 'iron', x: 26, z: -4 },
    { type: 'titanium', x: 46, z: 4 },
    { type: 'titanium', x: 58, z: 16 },
    { type: 'titanium', x: 64, z: -14 },
    { type: 'titanium', x: 52, z: -20 },
    // Polar Frost (North) — Silicon & Ice-border deposits
    { type: 'silicon', x: 8, z: -42 },
    { type: 'silicon', x: -12, z: -46 },
    { type: 'silicon', x: 22, z: -50 },
    { type: 'silicon', x: -24, z: -54 },
    { type: 'silicon', x: 0, z: -60 },
    { type: 'silicon', x: -6, z: -38 },
    // Tharsis Volcanic Fissure (West & South) — Sulfur & Titanium
    { type: 'sulfur', x: -34, z: 10 },
    { type: 'sulfur', x: -44, z: 24 },
    { type: 'sulfur', x: -50, z: -6 },
    { type: 'sulfur', x: -36, z: 38 },
    { type: 'sulfur', x: -22, z: 44 },
    { type: 'sulfur', x: -56, z: 18 },
    { type: 'titanium', x: -48, z: 30 },
    { type: 'titanium', x: -60, z: -18 },
    // Gale Perimeter (accessible early)
    { type: 'iron', x: 16, z: 18 },
    { type: 'silicon', x: -18, z: -18 },
    { type: 'sulfur', x: -18, z: 20 },
  ];

  mineralVeins.forEach((vein, i) => {
    const gy = groundHeightAt(vein.x, vein.z);
    const group = new THREE.Group();
    group.position.set(vein.x, gy + 0.5, vein.z);

    const mat = mineralMaterials[vein.type];
    const mainShard = new THREE.Mesh(
      vein.type === 'iron'
        ? new THREE.DodecahedronGeometry(0.46, 0)
        : vein.type === 'titanium'
        ? new THREE.OctahedronGeometry(0.5, 0)
        : new THREE.ConeGeometry(0.32, 0.95, 6),
      mat
    );
    mainShard.rotation.set(0.25, i * 0.7, 0.15);
    const sideShard = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.62, 5), mat);
    sideShard.position.set(0.28, -0.1, 0.18);
    sideShard.rotation.set(0.4, 0.6, -0.45);
    const shadow = new THREE.Mesh(shadowDiscGeo, shadowMat);
    shadow.position.y = -0.46;

    group.add(mainShard, sideShard, shadow);
    group.userData = { baseY: gy + 0.5, seed: i * 2.1, type: vein.type };

    resources.push({
      id: `${vein.type}-${i}`,
      type: vein.type,
      mesh: group,
      collected: false,
      isMagnetized: false,
      spawnPos: new THREE.Vector3(vein.x, gy + 0.5, vein.z),
      respawnTimer: 0,
    });
  });

  const getObstacles: ColonyStructures['getObstacles'] = (buildings) => {
    const list: ObstacleCircle[] = [
      { id: 'obs-lander', x: 0, z: 0, radius: 2.65 },
      { id: 'obs-moxie', x: -7, z: 4, radius: 1.15 },
      { id: 'obs-minidome', x: -6.5, z: -5.5, radius: 3.35 },
    ];
    if (buildings.waterExtractor) list.push({ id: 'obs-water', x: 14, z: -10, radius: 1.9 });
    if (buildings.autoMiner) list.push({ id: 'obs-miner', x: 18, z: 7, radius: 1.7 });
    if (buildings.researchLab) list.push({ id: 'obs-lab', x: -12, z: -6, radius: 2.4 });
    if (buildings.defenseTurret) list.push({ id: 'obs-turret', x: 10, z: -2, radius: 1.35 });
    if (buildings.bioDome) list.push({ id: 'obs-biodome', x: 0, z: -19, radius: 5.7 });
    if (buildings.habitat) list.push({ id: 'obs-habitat', x: -11, z: 12, radius: 2.5 });
    if (buildings.commsArray) list.push({ id: 'obs-comms', x: 12, z: 14, radius: 1.8 });
    if (buildings.geothermalPlant) list.push({ id: 'obs-geothermal', x: -20, z: -4, radius: 2.4 });
    if (buildings.terraformer) list.push({ id: 'obs-terraformer', x: -14, z: -18, radius: 2.3 });
    return list;
  };

  return {
    landerGroup: lander,
    landerPlume,
    landerMaterials,
    miniGreenhouseGroup,
    domeCropBedGroups,
    moxieGroup: moxie,
    moxieSlotRing,
    moxieLightBeam,
    moxieLightBeamMat,
    moxieAuraDome,
    moxieAuraMat,
    solarSlotRing,
    solarGroup: solar,
    waterSlotRing,
    waterExtractorGroup,
    waterRotor,
    autoMinerSlotRing,
    autoMinerGroup,
    autoMinerDrill,
    labSlotRing,
    labGroup,
    labRadar,
    defenseTurretSlotRing,
    defenseTurretGroup,
    turretHead,
    bioDomeSlotRing,
    bioDomeGroup: bioDome,
    plantingPlots,
    habitatSlotRing,
    habitatGroup,
    commsSlotRing,
    commsGroup,
    commsDish,
    geothermalSlotRing,
    geothermalGroup,
    geothermalCore,
    terraformerSlotRing,
    terraformerGroup,
    terraformerTurbine,
    terraformerBeam,
    scaffoldingRigs,
    damageRings,
    fireRigs,
    explosionRig,
    resources,
    getObstacles,
  };
}

function createBuildSlotRing(
  x: number,
  y: number,
  z: number,
  color: number,
  radius: number = 2.4
): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.25, radius + 0.15, 32),
    new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, y + 0.06, z);
  return ring;
}
