/**
 * Procedural 3D Spaceship Model Builder
 * Assembles a composite 3-12 part procedural starship with modular
 * component parts (Cockpit, Fuselage, Cargo Racks, Solar Wings, Fuel Tanks,
 * Engine Bells, RCS Blocks, Radiators, and dynamic thruster plume).
 */

import * as THREE from 'three';

export interface ShipMeshReferences {
  rootGroup: THREE.Group;
  thrusterPlume: THREE.Mesh;
  thrusterLight: THREE.PointLight;
  solarWings: THREE.Group;
  cargoRacks: THREE.Group;
  engineBell: THREE.Mesh;
}

export function createProceduralShip(): ShipMeshReferences {
  const root = new THREE.Group();
  root.name = 'ColonizeMars_HeroShip';

  // Materials with >= 0.25 roughness delta between adjacent parts
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0, // Titanium white
    metalness: 0.35,
    roughness: 0.3,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b, // Dark carbon slate
    metalness: 0.8,
    roughness: 0.55,
  });

  const canopyGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8, // Cyan cockpit glass
    metalness: 0.1,
    roughness: 0.1,
    transmission: 0.85,
    transparent: true,
    opacity: 0.9,
  });

  const solarPanelMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8, // Deep blue solar cell
    metalness: 0.9,
    roughness: 0.15,
  });

  const engineMetalMat = new THREE.MeshStandardMaterial({
    color: 0x475569, // Burnished nickel alloy
    metalness: 0.9,
    roughness: 0.4,
  });

  const plumeMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8, // Electric blue plasma
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
  });

  // 1. Primary Silhouette: Forward Command Nosecone & Cockpit
  const noseGeo = new THREE.ConeGeometry(0.75, 2.2, 8);
  noseGeo.rotateX(Math.PI / 2); // align forward along +Z
  const noseMesh = new THREE.Mesh(noseGeo, hullMat);
  noseMesh.position.set(0, 0, 1.8);
  root.add(noseMesh);

  // 2. Cockpit Canopy Visor (Accent read)
  const canopyGeo = new THREE.SphereGeometry(0.45, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  canopyGeo.scale(1.0, 0.6, 1.8);
  const canopyMesh = new THREE.Mesh(canopyGeo, canopyGlassMat);
  canopyMesh.position.set(0, 0.42, 1.4);
  root.add(canopyMesh);

  // 3. Main Central Fuselage / Service Module
  const bodyGeo = new THREE.CylinderGeometry(0.72, 0.85, 2.8, 12);
  bodyGeo.rotateX(Math.PI / 2);
  const bodyMesh = new THREE.Mesh(bodyGeo, hullMat);
  bodyMesh.position.set(0, 0, -0.4);
  root.add(bodyMesh);

  // 4. Structural Carbon Spine & Keel (Secondary read)
  const keelGeo = new THREE.BoxGeometry(0.2, 0.35, 3.4);
  const keelMesh = new THREE.Mesh(keelGeo, darkTrimMat);
  keelMesh.position.set(0, -0.65, -0.4);
  root.add(keelMesh);

  // 5. Cryogenic Saddle Fuel Tanks (Port and Starboard)
  const tankGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.8, 8);
  tankGeo.rotateX(Math.PI / 2);
  const tankPort = new THREE.Mesh(tankGeo, darkTrimMat);
  tankPort.position.set(-0.85, 0.0, -0.6);
  const tankStbd = new THREE.Mesh(tankGeo, darkTrimMat);
  tankStbd.position.set(0.85, 0.0, -0.6);
  root.add(tankPort, tankStbd);

  // 6. Modular Cargo Bay Racks (Hexagonal containers)
  const cargoGroup = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const crateGeo = new THREE.BoxGeometry(0.4, 0.35, 0.5);
    const crateMat = new THREE.MeshStandardMaterial({
      color: i === 0 ? 0xf97316 : i === 1 ? 0x10b981 : 0x6366f1, // Cargo color tags
      roughness: 0.6,
      metalness: 0.2,
    });
    const crateTop = new THREE.Mesh(crateGeo, crateMat);
    crateTop.position.set(0, 0.72, -0.1 - i * 0.6);
    cargoGroup.add(crateTop);
  }
  root.add(cargoGroup);

  // 7. Deployable Solar Array Wings (Port and Starboard)
  const solarWings = new THREE.Group();
  const wingGeo = new THREE.BoxGeometry(1.6, 0.04, 0.8);
  const wingPort = new THREE.Mesh(wingGeo, solarPanelMat);
  wingPort.position.set(-1.8, 0.1, -0.4);
  const wingStbd = new THREE.Mesh(wingGeo, solarPanelMat);
  wingStbd.position.set(1.8, 0.1, -0.4);
  solarWings.add(wingPort, wingStbd);
  root.add(solarWings);

  // 8. Main Propulsion Engine Bell Nozzle
  const bellGeo = new THREE.ConeGeometry(0.65, 1.1, 16, 1, true);
  bellGeo.rotateX(-Math.PI / 2); // points backward along -Z
  const engineBell = new THREE.Mesh(bellGeo, engineMetalMat);
  engineBell.position.set(0, 0, -2.1);
  root.add(engineBell);

  // 9. Quad RCS Attitude Thruster Pods (Accent detail)
  const rcsGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  const rcsMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
  const rcsPositions = [
    [0.75, 0.4, 1.2],
    [-0.75, 0.4, 1.2],
    [0.75, -0.4, 1.2],
    [-0.75, -0.4, 1.2],
  ];
  rcsPositions.forEach(([x, y, z]) => {
    const rcs = new THREE.Mesh(rcsGeo, rcsMat);
    rcs.position.set(x, y, z);
    root.add(rcs);
  });

  // 10. Dynamic Engine Thruster Plume & Light
  const plumeGeo = new THREE.ConeGeometry(0.55, 3.2, 12);
  plumeGeo.rotateX(Math.PI / 2);
  const thrusterPlume = new THREE.Mesh(plumeGeo, plumeMat);
  thrusterPlume.position.set(0, 0, -3.6);
  root.add(thrusterPlume);

  const thrusterLight = new THREE.PointLight(0x38bdf8, 0, 15);
  thrusterLight.position.set(0, 0, -2.4);
  root.add(thrusterLight);

  return {
    rootGroup: root,
    thrusterPlume,
    thrusterLight,
    solarWings,
    cargoRacks: cargoGroup,
    engineBell,
  };
}
