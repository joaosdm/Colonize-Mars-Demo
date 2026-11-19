/**
 * Procedural 3D Astronaut Model in EVA Spacesuit (Composite 12-Part Group)
 * Supports local & remote co-op players with:
 * - Distinct suit accent trim colors (Orange P1, Cyan P2, Emerald P3)
 * - Soft radial contact shadow disc grounded underneath
 * - Twin Jetpack Thruster Flame Cones
 * - Distance-synced walk stride + squash-and-stretch jump/land kinetics
 * - Floating player nameplate sprite (for co-op teammates)
 * - 3D Directional Guide Arrow (local player only)
 */

import * as THREE from 'three';
import { getWeaponDef, WeaponId } from '../sim/marsChemistry';

export interface SciFiWeaponVisual {
  group: THREE.Group;
  muzzleFlash: THREE.Mesh;
}

/**
 * Builds a composite multi-part 3D sci-fi weapon mesh tailored to each WeaponId.
 * Shared across holstered backpack mount, third-person hand, and first-person FPS viewmodel.
 */
export function createSciFiWeaponMesh(weaponId: WeaponId): SciFiWeaponVisual {
  const def = getWeaponDef(weaponId);
  const accentColor = new THREE.Color(def.boltColorHex);
  const group = new THREE.Group();
  group.name = `Weapon_${weaponId}`;

  const receiverMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.72,
    roughness: 0.32,
  });
  const alloyMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.85,
    roughness: 0.22,
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: accentColor,
  });

  const isPistol = weaponId === 'pulse-pistol';
  const isShotgun = weaponId === 'ion-shotgun';
  const isRailgun = weaponId === 'titanium-railgun';

  const bodyLen = isPistol ? 0.34 : isRailgun ? 0.86 : isShotgun ? 0.68 : 0.72;
  const bodyHeight = isPistol ? 0.13 : isShotgun ? 0.18 : 0.15;
  const bodyWidth = isShotgun ? 0.14 : 0.105;

  // Main receiver
  const receiver = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyLen),
    receiverMat
  );
  receiver.position.set(0, 0, bodyLen * 0.22);
  group.add(receiver);

  // Upper titanium rail / shroud
  const shroud = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.82, 0.055, bodyLen * 0.86),
    alloyMat
  );
  shroud.position.set(0, bodyHeight * 0.56, bodyLen * 0.28);
  group.add(shroud);

  // Glowing plasma energy cell along both sides
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth + 0.022, 0.048, bodyLen * 0.44),
    coreMat
  );
  core.position.set(0, 0.01, bodyLen * 0.3);
  group.add(core);

  // Barrel(s)
  const barrelLen = isPistol ? 0.18 : isRailgun ? 0.52 : isShotgun ? 0.34 : 0.32;
  const barrelRadius = isShotgun ? 0.044 : isRailgun ? 0.024 : 0.026;
  const barrelGeo = new THREE.CylinderGeometry(barrelRadius, barrelRadius * 1.15, barrelLen, 8);
  barrelGeo.rotateX(Math.PI / 2);

  if (isRailgun) {
    // Twin parallel accelerator rails + glowing magnetic channel
    const railL = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.065, barrelLen), alloyMat);
    railL.position.set(-0.042, 0.015, bodyLen * 0.7 + barrelLen * 0.35);
    const railR = railL.clone();
    railR.position.x = 0.042;
    const beamCore = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.026, barrelLen * 0.92),
      coreMat
    );
    beamCore.position.set(0, 0.015, bodyLen * 0.7 + barrelLen * 0.35);
    group.add(railL, railR, beamCore);
  } else if (isShotgun) {
    const b1 = new THREE.Mesh(barrelGeo, alloyMat);
    b1.position.set(-0.032, 0.02, bodyLen * 0.65 + barrelLen * 0.3);
    const b2 = new THREE.Mesh(barrelGeo, alloyMat);
    b2.position.set(0.032, 0.02, bodyLen * 0.65 + barrelLen * 0.3);
    group.add(b1, b2);
  } else {
    const barrel = new THREE.Mesh(barrelGeo, alloyMat);
    barrel.position.set(0, 0.02, bodyLen * 0.64 + barrelLen * 0.32);
    group.add(barrel);
  }

  // Ergonomic grip + stock (for rifles/shotguns/railgun)
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.18, 0.095), receiverMat);
  grip.position.set(0, -0.12, -0.02);
  grip.rotation.x = 0.28;
  group.add(grip);

  if (!isPistol) {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.14, 0.24), receiverMat);
    stock.position.set(0, -0.02, -bodyLen * 0.32);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.18, 8), alloyMat);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, bodyHeight * 0.95, 0.1);
    const scopeLens = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 8), coreMat);
    scopeLens.rotation.x = Math.PI / 2;
    scopeLens.position.set(0, bodyHeight * 0.95, 0.19);
    group.add(stock, scope, scopeLens);
  }

  // Muzzle flash cone (toggled on fire)
  const flashGeo = new THREE.ConeGeometry(isShotgun ? 0.18 : 0.12, isRailgun ? 0.55 : 0.34, 7);
  flashGeo.rotateX(Math.PI / 2);
  const flashMat = new THREE.MeshBasicMaterial({
    color: accentColor,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
  muzzleFlash.position.set(0, 0.02, bodyLen * 0.72 + barrelLen * 0.85);
  muzzleFlash.visible = false;
  group.add(muzzleFlash);

  return { group, muzzleFlash };
}

export interface AstronautCharacter {
  rootGroup: THREE.Group;
  bodyMeshGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  jetpackFlames: THREE.Group;
  contactShadow: THREE.Mesh;
  guideArrowGroup: THREE.Group;
  backWeaponAnchor: THREE.Group;
  handWeaponAnchor: THREE.Group;
  setEquippedWeapon: (weaponId: WeaponId) => void;
  updateAnimation: (params: {
    isMoving: boolean;
    isGrounded: boolean;
    isJetpacking: boolean;
    distanceTraveled: number;
    squashY: number;
    groundY: number;
    timeSec: number;
    weaponDrawBlend?: number; // 0 = holstered on back, 1 = drawn & aimed forward
    weaponRecoil?: number; // 0..1 kickback pulse
    muzzleFlashActive?: boolean;
  }) => void;
  updateGuideArrow: (
    astronautX: number,
    astronautZ: number,
    targetPos: { x: number; z: number } | null,
    timeSec: number
  ) => void;
}

export interface CreateAstronautOptions {
  accentColorHex?: string;
  labelName?: string;
  showGuideArrow?: boolean;
  initialWeaponId?: WeaponId;
}

export function createAstronaut(options: CreateAstronautOptions = {}): AstronautCharacter {
  const accentHex = options.accentColorHex || '#f97316';
  const accentColor = new THREE.Color(accentHex);

  const root = new THREE.Group();
  root.name = options.labelName ? `Astronaut_${options.labelName}` : 'Mars_Astronaut';

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Materials with calibrated roughness/metalness contrast
  const suitWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.68,
    metalness: 0.08,
  });

  const suitAccentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.45,
    metalness: 0.25,
  });

  const suitDarkMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.78,
    metalness: 0.3,
  });

  const goldVisorMat = new THREE.MeshPhysicalMaterial({
    color: 0xf59e0b,
    metalness: 0.95,
    roughness: 0.08,
    clearcoat: 1.0,
  });

  const backpackMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.55,
    roughness: 0.35,
  });

  // 1. Torso & Waist Belt
  const torsoGeo = new THREE.CylinderGeometry(0.32, 0.28, 0.78, 12);
  const torso = new THREE.Mesh(torsoGeo, suitWhiteMat);
  torso.position.set(0, 1.24, 0);
  torso.castShadow = true;
  bodyGroup.add(torso);

  const beltGeo = new THREE.CylinderGeometry(0.30, 0.30, 0.12, 12);
  const belt = new THREE.Mesh(beltGeo, suitAccentMat);
  belt.position.set(0, 0.9, 0);
  bodyGroup.add(belt);

  // Chest Telemetry Pack
  const chestGeo = new THREE.BoxGeometry(0.34, 0.28, 0.12);
  const chest = new THREE.Mesh(chestGeo, suitDarkMat);
  chest.position.set(0, 1.32, 0.27);
  bodyGroup.add(chest);

  const chestLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.05, 0.03),
    new THREE.MeshBasicMaterial({ color: accentColor })
  );
  chestLed.position.set(0, 1.36, 0.33);
  bodyGroup.add(chestLed);

  // 2. Helmet, Neck Collar & Reflective Gold Visor
  const collarGeo = new THREE.TorusGeometry(0.24, 0.05, 8, 16);
  collarGeo.rotateX(Math.PI / 2);
  const collar = new THREE.Mesh(collarGeo, suitAccentMat);
  collar.position.set(0, 1.66, 0);
  bodyGroup.add(collar);

  const helmetGeo = new THREE.SphereGeometry(0.33, 18, 16);
  const helmet = new THREE.Mesh(helmetGeo, suitWhiteMat);
  helmet.position.set(0, 1.93, 0);
  helmet.castShadow = true;
  bodyGroup.add(helmet);

  const visorGeo = new THREE.SphereGeometry(0.27, 16, 12, 0, Math.PI, 0, Math.PI / 1.45);
  visorGeo.rotateX(Math.PI / 4);
  const visor = new THREE.Mesh(visorGeo, goldVisorMat);
  visor.position.set(0, 1.93, 0.14);
  bodyGroup.add(visor);

  // 3. PLSS Backpack + Twin Thruster Nozzles + Jetpack Flames + Magnetic Weapon Holster
  const packGeo = new THREE.BoxGeometry(0.52, 0.76, 0.28);
  const backpack = new THREE.Mesh(packGeo, backpackMat);
  backpack.position.set(0, 1.28, -0.34);
  backpack.castShadow = true;
  bodyGroup.add(backpack);

  const stripeGeo = new THREE.BoxGeometry(0.54, 0.1, 0.3);
  const packStripe = new THREE.Mesh(stripeGeo, suitAccentMat);
  packStripe.position.set(0, 1.5, -0.34);
  bodyGroup.add(packStripe);

  // Magnetic back holster clamp + diagonal weapon anchor on the rear of the backpack
  const holsterClamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, 0.08),
    suitDarkMat
  );
  holsterClamp.position.set(0.02, 1.32, -0.49);
  bodyGroup.add(holsterClamp);

  const backWeaponAnchor = new THREE.Group();
  backWeaponAnchor.name = 'Holstered_Back_Weapon';
  backWeaponAnchor.position.set(0.02, 1.34, -0.57);
  // Slung diagonally across the PLSS backpack (barrel tilted up-right over shoulder)
  backWeaponAnchor.rotation.set(0.56, Math.PI / 2, 0.08);
  backWeaponAnchor.scale.setScalar(1.08);
  bodyGroup.add(backWeaponAnchor);

  // Whip antenna
  const antGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.5, 6);
  const ant = new THREE.Mesh(antGeo, suitDarkMat);
  ant.position.set(-0.2, 1.88, -0.4);
  bodyGroup.add(ant);

  // Twin Jetpack Thruster Flame Cones
  const jetpackFlames = new THREE.Group();
  const flameGeo = new THREE.ConeGeometry(0.11, 0.65, 10);
  flameGeo.rotateX(Math.PI);
  flameGeo.translate(0, -0.32, 0);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
  });
  const flameL = new THREE.Mesh(flameGeo, flameMat);
  flameL.position.set(-0.16, 0.88, -0.42);
  const flameR = new THREE.Mesh(flameGeo, flameMat);
  flameR.position.set(0.16, 0.88, -0.42);
  jetpackFlames.add(flameL, flameR);
  jetpackFlames.visible = false;
  bodyGroup.add(jetpackFlames);

  // 4. Articulated Arms with Accent Shoulder Pads + Drawn Hand Weapon Anchor
  const armGeo = new THREE.CylinderGeometry(0.10, 0.09, 0.56, 10);
  armGeo.translate(0, -0.28, 0);
  const shoulderGeo = new THREE.SphereGeometry(0.125, 10, 10);
  const gloveGeo = new THREE.SphereGeometry(0.105, 10, 10);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.42, 1.54, 0);
  const leftShoulder = new THREE.Mesh(shoulderGeo, suitAccentMat);
  const leftArmMesh = new THREE.Mesh(armGeo, suitWhiteMat);
  const leftGlove = new THREE.Mesh(gloveGeo, suitDarkMat);
  leftGlove.position.set(0, -0.58, 0);
  leftArm.add(leftShoulder, leftArmMesh, leftGlove);
  bodyGroup.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.42, 1.54, 0);
  const rightShoulder = new THREE.Mesh(shoulderGeo, suitAccentMat);
  const rightArmMesh = new THREE.Mesh(armGeo, suitWhiteMat);
  const rightGlove = new THREE.Mesh(gloveGeo, suitDarkMat);
  rightGlove.position.set(0, -0.58, 0);
  rightArm.add(rightShoulder, rightArmMesh, rightGlove);

  // Drawn weapon anchored to right glove, pointing forward when rightArm.rotation.x = -PI/2
  const handWeaponAnchor = new THREE.Group();
  handWeaponAnchor.name = 'Drawn_Hand_Weapon';
  handWeaponAnchor.position.set(0, -0.62, 0.12);
  handWeaponAnchor.rotation.set(Math.PI / 2, 0, 0);
  handWeaponAnchor.visible = false;
  rightArm.add(handWeaponAnchor);
  bodyGroup.add(rightArm);

  // Build initial back & hand weapon meshes
  let currentWeaponId: WeaponId | null = null;
  let handWeaponVisual: SciFiWeaponVisual | null = null;

  const setEquippedWeapon = (weaponId: WeaponId) => {
    if (currentWeaponId === weaponId) return;
    currentWeaponId = weaponId;

    while (backWeaponAnchor.children.length > 0) {
      backWeaponAnchor.remove(backWeaponAnchor.children[0]);
    }
    while (handWeaponAnchor.children.length > 0) {
      handWeaponAnchor.remove(handWeaponAnchor.children[0]);
    }

    const backVis = createSciFiWeaponMesh(weaponId);
    backWeaponAnchor.add(backVis.group);

    handWeaponVisual = createSciFiWeaponMesh(weaponId);
    handWeaponAnchor.add(handWeaponVisual.group);
  };

  setEquippedWeapon(options.initialWeaponId || 'pulse-pistol');

  // 5. Articulated Legs & Weighted EVA Boots
  const legGeo = new THREE.CylinderGeometry(0.125, 0.11, 0.68, 10);
  legGeo.translate(0, -0.34, 0);
  const bootGeo = new THREE.BoxGeometry(0.21, 0.17, 0.34);
  bootGeo.translate(0, -0.74, 0.06);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.17, 0.82, 0);
  const leftLegMesh = new THREE.Mesh(legGeo, suitWhiteMat);
  const leftBoot = new THREE.Mesh(bootGeo, suitDarkMat);
  leftLeg.add(leftLegMesh, leftBoot);
  bodyGroup.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.17, 0.82, 0);
  const rightLegMesh = new THREE.Mesh(legGeo, suitWhiteMat);
  const rightBoot = new THREE.Mesh(bootGeo, suitDarkMat);
  rightLeg.add(rightLegMesh, rightBoot);
  bodyGroup.add(rightLeg);

  // 6. Soft Contact Shadow Disc beneath boots
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 64;
  shadowCanvas.height = 64;
  const shCtx = shadowCanvas.getContext('2d')!;
  const shGrad = shCtx.createRadialGradient(32, 32, 4, 32, 32, 30);
  shGrad.addColorStop(0, 'rgba(0,0,0,0.52)');
  shGrad.addColorStop(1, 'rgba(0,0,0,0)');
  shCtx.fillStyle = shGrad;
  shCtx.fillRect(0, 0, 64, 64);

  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadowGeo = new THREE.PlaneGeometry(1.3, 1.3);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.position.set(0, 0.03, 0);
  root.add(contactShadow);

  // 7. Floating Nameplate Sprite for Co-op Teammates
  if (options.labelName) {
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256;
    labelCanvas.height = 64;
    const lCtx = labelCanvas.getContext('2d')!;
    lCtx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    lCtx.beginPath();
    lCtx.roundRect(16, 10, 224, 44, 14);
    lCtx.fill();
    lCtx.strokeStyle = accentHex;
    lCtx.lineWidth = 3;
    lCtx.stroke();

    lCtx.fillStyle = '#ffffff';
    lCtx.font = 'bold 22px sans-serif';
    lCtx.textAlign = 'center';
    lCtx.textBaseline = 'middle';
    lCtx.fillText(options.labelName, 128, 32);

    const labelTex = new THREE.CanvasTexture(labelCanvas);
    labelTex.colorSpace = THREE.SRGBColorSpace;
    const spriteMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(0, 2.7, 0);
    sprite.scale.set(2.2, 0.55, 1);
    root.add(sprite);
  }

  // 8. 3D Directional Guide Arrow Hovering at Local Player Feet
  const guideArrowGroup = new THREE.Group();
  guideArrowGroup.name = 'Objective_Guide_Arrow';

  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, 1.45);
  arrowShape.lineTo(0.45, 0.65);
  arrowShape.lineTo(0.2, 0.65);
  arrowShape.lineTo(0.2, -0.35);
  arrowShape.lineTo(-0.2, -0.35);
  arrowShape.lineTo(-0.2, 0.65);
  arrowShape.lineTo(-0.45, 0.65);
  arrowShape.closePath();

  const arrowGeo = new THREE.ExtrudeGeometry(arrowShape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.02,
    bevelThickness: 0.02,
  });
  // Rotate +PI/2 around X so Shape +Y tip aligns with +Z matching atan2(dx, dz)
  arrowGeo.rotateX(Math.PI / 2);

  const arrowMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
  arrowMesh.position.set(0, 0.1, 0);
  guideArrowGroup.add(arrowMesh);

  guideArrowGroup.visible = Boolean(options.showGuideArrow);
  root.add(guideArrowGroup);

  const updateAnimation: AstronautCharacter['updateAnimation'] = ({
    isMoving,
    isGrounded,
    isJetpacking,
    distanceTraveled,
    squashY,
    groundY,
    timeSec,
    weaponDrawBlend = 0,
    weaponRecoil = 0,
    muzzleFlashActive = false,
  }) => {
    // Squash-and-stretch preserving volume
    const invXZ = 1 / Math.sqrt(Math.max(0.6, squashY));
    bodyGroup.scale.set(invXZ, squashY, invXZ);

    // Contact shadow stays pinned to ground height beneath actor
    const altitude = Math.max(0, root.position.y - groundY);
    contactShadow.position.y = -altitude + 0.035;
    const shadowScale = Math.max(0.45, 1.0 - altitude * 0.12);
    contactShadow.scale.set(shadowScale, shadowScale, 1);
    (contactShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.15, 0.75 - altitude * 0.15);

    // Jetpack flames
    jetpackFlames.visible = isJetpacking;
    if (isJetpacking) {
      const flicker = 0.85 + Math.sin(timeSec * 45) * 0.25;
      jetpackFlames.scale.set(1, flicker, 1);
    }

    // Subtle idle breathing bob on holstered back weapon
    const clampedDraw = Math.max(0, Math.min(1, weaponDrawBlend));
    const isHandDrawn = clampedDraw >= 0.48;
    backWeaponAnchor.visible = !isHandDrawn;
    handWeaponAnchor.visible = isHandDrawn;

    if (!isHandDrawn) {
      const holsteredBob = isMoving
        ? Math.sin(distanceTraveled * 2.9) * 0.025
        : Math.sin(timeSec * 2.2) * 0.01;
      backWeaponAnchor.position.y = 1.33 + holsteredBob;
      backWeaponAnchor.rotation.z = 0.62 + clampedDraw * 0.28;
    }

    if (handWeaponVisual) {
      handWeaponVisual.muzzleFlash.visible = isHandDrawn && muzzleFlashActive;
    }

    // Leg & base arm kinematics
    let baseRightArmX = 0;
    if (!isGrounded) {
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, -0.75, 0.2);
      baseRightArmX = THREE.MathUtils.lerp(rightArm.rotation.x, -0.75, 0.2);
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0.35, 0.2);
      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, -0.25, 0.2);
    } else if (isMoving) {
      const phase = distanceTraveled * 1.45;
      const angle = Math.sin(phase) * 0.55;
      leftLeg.rotation.x = angle;
      rightLeg.rotation.x = -angle;
      leftArm.rotation.x = -angle * 0.75;
      baseRightArmX = angle * 0.75;
    } else {
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, 0.18);
      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0, 0.18);
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, 0, 0.18);
      baseRightArmX = THREE.MathUtils.lerp(rightArm.rotation.x, 0, 0.18);
    }

    // Over-the-shoulder draw animation (0..0.48 reaches behind shoulder -> 0.48..1.0 levels weapon forward)
    if (clampedDraw > 0.02) {
      if (clampedDraw < 0.48) {
        const reachT = clampedDraw / 0.48;
        rightArm.rotation.x = THREE.MathUtils.lerp(baseRightArmX, -2.55, reachT);
        rightArm.rotation.z = THREE.MathUtils.lerp(0, -0.45, reachT);
      } else {
        const aimT = (clampedDraw - 0.48) / 0.52;
        const recoilKick = weaponRecoil * 0.32;
        rightArm.rotation.x = THREE.MathUtils.lerp(-2.55, -1.52 - recoilKick, aimT);
        rightArm.rotation.z = THREE.MathUtils.lerp(-0.45, -0.06, aimT);
      }
    } else {
      rightArm.rotation.x = baseRightArmX;
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, 0, 0.2);
    }
  };

  const updateGuideArrow: AstronautCharacter['updateGuideArrow'] = (
    astronautX,
    astronautZ,
    targetPos,
    timeSec
  ) => {
    if (!options.showGuideArrow || !targetPos) {
      guideArrowGroup.visible = false;
      return;
    }

    const dx = targetPos.x - astronautX;
    const dz = targetPos.z - astronautZ;
    const dist = Math.hypot(dx, dz);

    if (dist < 2.2) {
      guideArrowGroup.visible = false;
      return;
    }

    guideArrowGroup.visible = true;
    const worldAngle = Math.atan2(dx, dz);
    guideArrowGroup.rotation.y = worldAngle - root.rotation.y;
    const pulse = 1.0 + Math.sin(timeSec * 5.0) * 0.08;
    guideArrowGroup.scale.set(pulse, 1.0, pulse);
  };

  return {
    rootGroup: root,
    bodyMeshGroup: bodyGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    jetpackFlames,
    contactShadow,
    guideArrowGroup,
    backWeaponAnchor,
    handWeaponAnchor,
    setEquippedWeapon,
    updateAnimation,
    updateGuideArrow,
  };
}
