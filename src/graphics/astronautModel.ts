/**
 * Procedural 3D Astronaut Model in EVA Spacesuit
 * Assembles a composite character with:
 * - Pressurized suit, gold visor, life support backpack (PLSS)
 * - Articulated arms and legs with low-gravity stride animation
 * - 3D Directional Guide Arrow hovering at astronaut's feet pointing to active mission target
 */

import * as THREE from 'three';

export interface AstronautCharacter {
  rootGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  backpack: THREE.Mesh;
  helmetLight: THREE.PointLight;
  guideArrowGroup: THREE.Group;
  updateAnimation: (isMoving: boolean, isJumping: boolean, timeSec: number) => void;
  updateGuideArrow: (astronautPos: THREE.Vector3, targetPos: { x: number; z: number } | null, timeSec: number) => void;
}

export function createAstronaut(): AstronautCharacter {
  const root = new THREE.Group();
  root.name = 'Mars_Astronaut';

  // Materials
  const suitWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc, // Pressurized clean white suit fabric
    roughness: 0.6,
    metalness: 0.1,
  });

  const suitDarkMat = new THREE.MeshStandardMaterial({
    color: 0x334155, // Joint gaskets and boots
    roughness: 0.8,
    metalness: 0.3,
  });

  const goldVisorMat = new THREE.MeshPhysicalMaterial({
    color: 0xf59e0b, // Gold radiation-reflective visor
    metalness: 0.95,
    roughness: 0.1,
    clearcoat: 1.0,
  });

  const backpackMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.4,
    roughness: 0.4,
  });

  // 1. Torso
  const torsoGeo = new THREE.BoxGeometry(0.7, 0.9, 0.45);
  const torso = new THREE.Mesh(torsoGeo, suitWhiteMat);
  torso.position.set(0, 1.25, 0);
  torso.castShadow = true;
  root.add(torso);

  // Chest console badge
  const chestGeo = new THREE.BoxGeometry(0.35, 0.3, 0.08);
  const chest = new THREE.Mesh(chestGeo, suitDarkMat);
  chest.position.set(0, 1.35, 0.24);
  root.add(chest);

  // 2. Helmet & Gold Visor
  const helmetGeo = new THREE.SphereGeometry(0.36, 16, 16);
  const helmet = new THREE.Mesh(helmetGeo, suitWhiteMat);
  helmet.position.set(0, 1.95, 0);
  root.add(helmet);

  const visorGeo = new THREE.SphereGeometry(0.28, 16, 12, 0, Math.PI, 0, Math.PI / 1.5);
  visorGeo.rotateX(Math.PI / 4);
  const visor = new THREE.Mesh(visorGeo, goldVisorMat);
  visor.position.set(0, 1.95, 0.16);
  root.add(visor);

  // Headlight
  const helmetLight = new THREE.PointLight(0xffffff, 0.8, 12);
  helmetLight.position.set(0, 2.0, 0.4);
  root.add(helmetLight);

  // 3. Life Support Backpack (PLSS)
  const packGeo = new THREE.BoxGeometry(0.6, 0.85, 0.3);
  const backpack = new THREE.Mesh(packGeo, backpackMat);
  backpack.position.set(0, 1.3, -0.35);
  root.add(backpack);

  // Backpack Status LED
  const ledGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.position.set(0.2, 1.6, -0.5);
  root.add(led);

  // 4. Arms
  const armGeo = new THREE.CylinderGeometry(0.12, 0.11, 0.65, 8);
  armGeo.translate(0, -0.3, 0);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.48, 1.6, 0);
  const leftArmMesh = new THREE.Mesh(armGeo, suitWhiteMat);
  const leftGloveGeo = new THREE.SphereGeometry(0.12, 8, 8);
  const leftGlove = new THREE.Mesh(leftGloveGeo, suitDarkMat);
  leftGlove.position.set(0, -0.65, 0);
  leftArm.add(leftArmMesh, leftGlove);
  root.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.48, 1.6, 0);
  const rightArmMesh = new THREE.Mesh(armGeo, suitWhiteMat);
  const rightGlove = new THREE.Mesh(leftGloveGeo, suitDarkMat);
  rightGlove.position.set(0, -0.65, 0);
  rightArm.add(rightArmMesh, rightGlove);
  root.add(rightArm);

  // 5. Legs
  const legGeo = new THREE.CylinderGeometry(0.14, 0.13, 0.75, 8);
  legGeo.translate(0, -0.35, 0);

  const bootGeo = new THREE.BoxGeometry(0.22, 0.18, 0.36);
  bootGeo.translate(0, -0.75, 0.06);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.22, 0.8, 0);
  const leftLegMesh = new THREE.Mesh(legGeo, suitWhiteMat);
  const leftBoot = new THREE.Mesh(bootGeo, suitDarkMat);
  leftLeg.add(leftLegMesh, leftBoot);
  root.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.22, 0.8, 0);
  const rightLegMesh = new THREE.Mesh(legGeo, suitWhiteMat);
  const rightBoot = new THREE.Mesh(bootGeo, suitDarkMat);
  rightLeg.add(rightLegMesh, rightBoot);
  root.add(rightLeg);

  // 6. 3D DIRECTIONAL GUIDE ARROW HOVERING AT FEET
  const guideArrowGroup = new THREE.Group();
  guideArrowGroup.name = 'Objective_Guide_Arrow';

  // Chevron Arrow Shape (points towards +Z in local space)
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, 1.4); // Arrow tip
  arrowShape.lineTo(0.5, 0.4);
  arrowShape.lineTo(0.25, 0.4);
  arrowShape.lineTo(0.25, -0.6);
  arrowShape.lineTo(-0.25, -0.6);
  arrowShape.lineTo(-0.25, 0.4);
  arrowShape.lineTo(-0.5, 0.4);
  arrowShape.closePath();

  const arrowExtrudeSettings = {
    depth: 0.06,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.03,
    bevelThickness: 0.03,
  };

  const arrowGeo = new THREE.ExtrudeGeometry(arrowShape, arrowExtrudeSettings);
  arrowGeo.rotateX(-Math.PI / 2); // Flat on ground plane

  const arrowMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8, // Electric cyan glow
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });

  const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
  arrowMesh.position.set(0, 0.08, 0);
  guideArrowGroup.add(arrowMesh);

  // Ground pulse ring beneath arrow
  const ringGeo = new THREE.RingGeometry(0.8, 0.95, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x0284c7,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const groundRing = new THREE.Mesh(ringGeo, ringMat);
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = 0.04;
  guideArrowGroup.add(groundRing);

  root.add(guideArrowGroup);

  // Animation Update Function
  const updateAnimation = (isMoving: boolean, isJumping: boolean, timeSec: number) => {
    if (isJumping) {
      // Floaty Martian leap posture
      leftArm.rotation.x = -0.7;
      rightArm.rotation.x = -0.7;
      leftLeg.rotation.x = 0.4;
      rightLeg.rotation.x = -0.3;
    } else if (isMoving) {
      // Stride cadence adapted for Martian low gravity
      const strideFreq = 7.5;
      const angle = Math.sin(timeSec * strideFreq) * 0.45;
      leftLeg.rotation.x = angle;
      rightLeg.rotation.x = -angle;

      leftArm.rotation.x = -angle * 0.8;
      rightArm.rotation.x = angle * 0.8;
    } else {
      // Resting neutral stance
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, 0.15);
      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0, 0.15);
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, 0, 0.15);
      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, 0, 0.15);
    }
  };

  // Directional Guide Arrow pointing to active target
  const updateGuideArrow = (
    astronautPos: THREE.Vector3,
    targetPos: { x: number; z: number } | null,
    timeSec: number
  ) => {
    if (!targetPos) {
      guideArrowGroup.visible = false;
      return;
    }

    guideArrowGroup.visible = true;
    // Calculate world delta from astronaut to objective target
    const dx = targetPos.x - astronautPos.x;
    const dz = targetPos.z - astronautPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 1.2) {
      // Already arrived inside target zone
      guideArrowGroup.visible = false;
      return;
    }

    // In local space of astronaut (which is rotated by playerYaw),
    // we want arrow to point in world direction (dx, dz):
    // World target angle:
    const worldAngle = Math.atan2(dx, dz);
    // Relative to astronaut root orientation:
    guideArrowGroup.rotation.y = worldAngle - root.rotation.y;

    // Gentle pulsing float
    const pulse = 1.0 + Math.sin(timeSec * 5.0) * 0.08;
    guideArrowGroup.scale.set(pulse, 1.0, pulse);
  };

  return {
    rootGroup: root,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    backpack,
    helmetLight,
    guideArrowGroup,
    updateAnimation,
    updateGuideArrow,
  };
}
