import * as THREE from 'three';

export interface TargetDummy {
  root: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  headMat: THREE.MeshStandardMaterial;
  headMesh: THREE.Mesh;
  flash: (duration?: number, headshot?: boolean) => void;
  update: (dt: number) => void;
  kickVel: THREE.Vector3;
}

/** Crisp zero-asset tactical humanoid target with head/chest hitzones & 2-frame white hit-flash */
export function createTargetDummy(accentHex = 0x3b82f6): TargetDummy {
  const root = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.62, 0.12, 20),
    new THREE.MeshStandardMaterial({ color: 0x1e2533, metalness: 0.5, roughness: 0.4 })
  );
  base.position.y = 0.06;
  root.add(base);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.9, 10),
    new THREE.MeshStandardMaterial({ color: 0x394559, metalness: 0.6, roughness: 0.35 })
  );
  pole.position.y = 0.52;
  root.add(pole);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    roughness: 0.38,
    metalness: 0.25,
  });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.96, 0.38), bodyMat);
  torso.position.y = 1.25;
  root.add(torso);

  const chestPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.46, 0.41),
    new THREE.MeshStandardMaterial({ color: 0x161d29, roughness: 0.5 })
  );
  chestPlate.position.y = 1.32;
  root.add(chestPlate);

  const headMat = new THREE.MeshStandardMaterial({
    color: 0xf5b942,
    roughness: 0.28,
    metalness: 0.45,
  });
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 16), headMat);
  headMesh.position.y = 2.02;
  root.add(headMesh);

  let flashTimer = 0;
  let headFlash = false;
  const kickVel = new THREE.Vector3();
  const baseBodyColor = new THREE.Color(accentHex);
  const baseHeadColor = new THREE.Color(0xf5b942);

  return {
    root,
    bodyMat,
    headMat,
    headMesh,
    kickVel,
    flash(duration = 0.085, headshot = false) {
      flashTimer = duration;
      headFlash = headshot;
      bodyMat.emissive.setHex(0xffffff);
      bodyMat.emissiveIntensity = headshot ? 0.5 : 1.1;
      headMat.emissive.setHex(headshot ? 0xffe46b : 0xffffff);
      headMat.emissiveIntensity = headshot ? 1.8 : 0.8;
    },
    update(dt: number) {
      if (flashTimer > 0) {
        flashTimer -= dt;
        if (flashTimer <= 0) {
          bodyMat.color.copy(baseBodyColor);
          headMat.color.copy(baseHeadColor);
          bodyMat.emissiveIntensity = 0;
          headMat.emissiveIntensity = 0;
        } else if (flashTimer < 0.035) {
          bodyMat.emissive.setHex(headFlash ? 0xff9922 : 0xff3344);
          bodyMat.emissiveIntensity = 0.55;
        }
      }
      // Spring wobble recovery
      root.rotation.x += kickVel.x * dt;
      root.rotation.z += kickVel.z * dt;
      kickVel.x = (kickVel.x - root.rotation.x * 165 * dt) * Math.exp(-11 * dt);
      kickVel.z = (kickVel.z - root.rotation.z * 165 * dt) * Math.exp(-11 * dt);
    },
  };
}

/** Stylized zero-asset FPS weapon rig (rifle / sniper + muzzle anchor + scope) */
export function createWeaponRig(sniper = false): {
  root: THREE.Group;
  muzzle: THREE.Object3D;
  ejectPort: THREE.Object3D;
  flashMesh: THREE.Group;
} {
  const root = new THREE.Group();
  const gunMetal = new THREE.MeshStandardMaterial({ color: 0x242b38, metalness: 0.78, roughness: 0.28 });
  const accent = new THREE.MeshStandardMaterial({
    color: sniper ? 0x3d6b47 : 0xd95338,
    metalness: 0.45,
    roughness: 0.36,
  });

  const receiver = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.17, sniper ? 0.88 : 0.68),
    accent
  );
  root.add(receiver);

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.028, sniper ? 0.92 : 0.56, 10),
    gunMetal
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.035, sniper ? -0.82 : -0.56);
  root.add(barrel);

  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.14), gunMetal);
  mag.position.set(0, -0.18, -0.08);
  mag.rotation.x = 0.24;
  root.add(mag);

  if (sniper) {
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.44, 14), gunMetal);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.15, -0.1);
    root.add(scope);
  }

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.035, sniper ? -1.32 : -0.88);
  root.add(muzzle);

  const ejectPort = new THREE.Object3D();
  ejectPort.position.set(0.09, 0.06, -0.05);
  root.add(ejectPort);

  const flashMesh = new THREE.Group();
  const fMat = new THREE.MeshBasicMaterial({
    color: 0xffdf72,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (let i = 0; i < 3; i++) {
    const star = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.12), fMat);
    star.rotation.z = (i * Math.PI) / 3;
    flashMesh.add(star);
  }
  flashMesh.position.copy(muzzle.position);
  flashMesh.visible = false;
  root.add(flashMesh);

  return { root, muzzle, ejectPort, flashMesh };
}

/** Stylized zero-asset Samurai duelist with katana hilt & tip anchors */
export function createSamuraiFighter(bodyHex: number, facingZ: 1 | -1): {
  root: THREE.Group;
  swordPivot: THREE.Group;
  bladeBase: THREE.Object3D;
  bladeTip: THREE.Object3D;
  bodyMat: THREE.MeshStandardMaterial;
} {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyHex, roughness: 0.42, metalness: 0.3 });
  const armorMat = new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.5, metalness: 0.5 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.72, 8, 14), bodyMat);
  torso.position.y = 1.05;
  root.add(torso);

  const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.2, 0.42), armorMat);
  shoulder.position.y = 1.42;
  root.add(shoulder);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35 })
  );
  head.position.y = 1.78;
  root.add(head);

  const kasa = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.16, 16), armorMat);
  kasa.position.y = 1.94;
  root.add(kasa);

  const swordPivot = new THREE.Group();
  swordPivot.position.set(0.28 * facingZ, 1.28, 0.18 * facingZ);
  root.add(swordPivot);

  const hilt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.32, 8),
    new THREE.MeshStandardMaterial({ color: 0x1f242d })
  );
  swordPivot.add(hilt);

  const tsuba = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.02, 12),
    new THREE.MeshStandardMaterial({ color: 0xd4a437, metalness: 0.85, roughness: 0.2 })
  );
  tsuba.position.y = 0.16;
  swordPivot.add(tsuba);

  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.018, 1.28, 0.052),
    new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.92, roughness: 0.12 })
  );
  blade.position.y = 0.82;
  swordPivot.add(blade);

  const bladeBase = new THREE.Object3D();
  bladeBase.position.set(0, 0.18, 0);
  swordPivot.add(bladeBase);

  const bladeTip = new THREE.Object3D();
  bladeTip.position.set(0, 1.48, 0);
  swordPivot.add(bladeTip);

  if (facingZ < 0) root.rotation.y = Math.PI;
  return { root, swordPivot, bladeBase, bladeTip, bodyMat };
}

/** Stylized zero-asset Arcade Aero Kart with chassis tilt & dual afterburner flames */
export function createAeroKart(paintHex = 0xf43f5e): {
  root: THREE.Group;
  chassis: THREE.Group;
  wheels: THREE.Mesh[];
  flames: THREE.Mesh[];
  rearLeft: THREE.Object3D;
  rearRight: THREE.Object3D;
} {
  const root = new THREE.Group();
  const chassis = new THREE.Group();
  root.add(chassis);

  const paint = new THREE.MeshStandardMaterial({ color: paintHex, metalness: 0.58, roughness: 0.24 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x181e29, metalness: 0.5, roughness: 0.45 });
  const cockpitMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.85, roughness: 0.12 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.34, 2.15), paint);
  body.position.y = 0.36;
  chassis.add(body);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.22, 0.65), paint);
  nose.position.set(0, 0.28, -1.22);
  chassis.add(nose);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 10), cockpitMat);
  canopy.scale.set(1, 0.68, 1.45);
  canopy.position.set(0, 0.58, -0.05);
  chassis.add(canopy);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.07, 0.36), dark);
  wing.position.set(0, 0.74, 0.96);
  chassis.add(wing);

  const wheels: THREE.Mesh[] = [];
  const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.24, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 0.7 });
  [
    [-0.68, 0.28, -0.74],
    [0.68, 0.28, -0.74],
    [-0.72, 0.28, 0.76],
    [0.72, 0.28, 0.76],
  ].forEach(([x, y, z]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, y, z);
    root.add(w);
    wheels.push(w);
  });

  const flames: THREE.Mesh[] = [];
  const flameGeo = new THREE.ConeGeometry(0.14, 0.95, 10);
  flameGeo.rotateX(Math.PI / 2);
  [-0.28, 0.28].forEach((x) => {
    const fMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const f = new THREE.Mesh(flameGeo, fMat);
    f.position.set(x, 0.38, 1.52);
    f.visible = false;
    chassis.add(f);
    flames.push(f);
  });

  const rearLeft = new THREE.Object3D();
  rearLeft.position.set(-0.68, 0.05, 0.78);
  root.add(rearLeft);

  const rearRight = new THREE.Object3D();
  rearRight.position.set(0.68, 0.05, 0.78);
  root.add(rearRight);

  return { root, chassis, wheels, flames, rearLeft, rearRight };
}
