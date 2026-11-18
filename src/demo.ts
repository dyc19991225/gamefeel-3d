import * as THREE from 'three';
import { AudioForge } from './core/audioForge';
import { Spring1D, TimeFeelClock, damp, dampVec3, smoothNoise1D } from './core/math';
import { RibbonTrail, VfxForge } from './core/vfxForge';

// ============================================================================
// Playable Before-vs-After Survival Arena: "Vibecoded Raw vs $gamefeel-3d"
// Identical game rules, spawn rates, hitboxes, and damage numbers — ONLY the
// game-feel channels toggle on/off when you flip the switch!
// ============================================================================

const stageHost = document.getElementById('stage')!;
const hudCanvas = document.getElementById('hud2d') as HTMLCanvasElement;
const hudCtx = hudCanvas.getContext('2d')!;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080b12);
scene.fog = new THREE.FogExp2(0x080b12, 0.036);

const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 120);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
stageHost.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xcbd5e1, 0x111827, 1.0));
const dirLight = new THREE.DirectionalLight(0xfff1dc, 1.9);
dirLight.position.set(6, 12, 8);
scene.add(dirLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: 0x0e131f, roughness: 0.85, metalness: 0.15 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
scene.add(new THREE.GridHelper(44, 44, 0x2a3954, 0x161f30));

const audio = new AudioForge();
const vfx = new VfxForge(scene);
const clock = new TimeFeelClock();

// Fresnel Explosion Dome Pool for Boss/Drone Kills
const blastMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uProgress: { value: 1 },
    uCore: { value: new THREE.Color(0xfff3b0) },
    uRim: { value: new THREE.Color(0xff4d1a) },
  },
  vertexShader: /* glsl */ `
    varying vec3 vN; varying vec3 vV;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix) * normal);
      vV = normalize(cameraPosition - wp.xyz);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uProgress; uniform vec3 uCore; uniform vec3 uRim;
    varying vec3 vN; varying vec3 vV;
    void main() {
      float f = pow(1.0 - abs(dot(vN, vV)), 2.2);
      float a = (0.22 + f * 0.95) * pow(max(0.0, 1.0 - uProgress), 1.5);
      gl_FragColor = vec4(mix(uCore, uRim, f) * 1.4, a);
    }
  `,
});
const blastDome = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), blastMat);
blastDome.visible = false;
scene.add(blastDome);
let blastProg = 1;

// Hero: Cyber Shinobi Gunner
const player = new THREE.Group();
scene.add(player);
const heroBody = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.32, 0.72, 8, 14),
  new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3, metalness: 0.5 })
);
heroBody.position.y = 0.85;
player.add(heroBody);

const kasa = new THREE.Mesh(
  new THREE.ConeGeometry(0.52, 0.18, 16),
  new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.3 })
);
kasa.position.y = 1.55;
player.add(kasa);

const gunMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.12, 0.14, 0.72),
  new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.6, roughness: 0.3 })
);
gunMesh.position.set(0.42, 0.98, -0.35);
player.add(gunMesh);

const swordPivot = new THREE.Group();
swordPivot.position.set(-0.35, 1.0, 0);
player.add(swordPivot);
const katana = new THREE.Mesh(
  new THREE.BoxGeometry(0.03, 0.05, 1.45),
  new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0x38bdf8, emissiveIntensity: 0.35 })
);
katana.position.z = -0.72;
swordPivot.add(katana);
const bladeBase = new THREE.Object3D();
bladeBase.position.set(0, 0, -0.1);
swordPivot.add(bladeBase);
const bladeTip = new THREE.Object3D();
bladeTip.position.set(0, 0, -1.48);
swordPivot.add(bladeTip);

const swordTrail = new RibbonTrail(scene, 30);
swordTrail.setPalette(0xfffbeb, 0xf59e0b, 0.96);

// State
let juice = true;
let autoPilot = true;
let kills = 0;
let combo = 0;
let trauma = 0;
let shakeClock = 0;
let speedLines = 0;
let vignette = 0;
const fovSpring = new Spring1D(0);
const gunRecoil = new Spring1D(0);
let slashTimer = 0;
let fireCooldown = 0;
let dashCooldown = 0;
let witchTimer = 0;

const playerVel = new THREE.Vector3();
const camPos = new THREE.Vector3(0, 9.5, 10.5);
const camLook = new THREE.Vector3(0, 0.8, 0);
const aimWorld = new THREE.Vector3(0, 0.9, -4);

// Recipe HUD tag highlight timers
const tagTimers: Record<string, number> = {};
function pulseTag(id: string): void {
  if (!juice) return;
  tagTimers[id] = 0.42;
}

interface Enemy {
  group: THREE.Group;
  mat: THREE.MeshStandardMaterial;
  hp: number;
  maxHp: number;
  isBoss: boolean;
  flashTimer: number;
  hitFreezeJit: number;
  wobbleVel: number;
  shootTimer: number;
}

interface Orb {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  deflected: boolean;
  life: number;
}

const enemies: Enemy[] = [];
const orbs: Orb[] = [];
const orbGeo = new THREE.SphereGeometry(0.22, 12, 10);

function spawnEnemy(isBoss = false): void {
  const angle = Math.random() * Math.PI * 2;
  const dist = 10.5 + Math.random() * 3.5;
  const g = new THREE.Group();
  g.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

  const mat = new THREE.MeshStandardMaterial({
    color: isBoss ? 0xdc2626 : 0xec4899,
    roughness: 0.35,
    metalness: 0.4,
  });
  const mesh = new THREE.Mesh(
    isBoss ? new THREE.BoxGeometry(1.15, 1.55, 1.15) : new THREE.OctahedronGeometry(0.55, 0),
    mat
  );
  mesh.position.y = isBoss ? 0.85 : 0.78;
  g.add(mesh);
  scene.add(g);

  enemies.push({
    group: g,
    mat,
    hp: isBoss ? 180 : 60,
    maxHp: isBoss ? 180 : 60,
    isBoss,
    flashTimer: 0,
    hitFreezeJit: 0,
    wobbleVel: 0,
    shootTimer: 1.1 + Math.random() * 1.4,
  });
}

for (let i = 0; i < 6; i++) spawnEnemy(i === 0);

function fireRifle(): void {
  fireCooldown = 0.14;
  const muzzle = new THREE.Vector3();
  gunMesh.getWorldPosition(muzzle);
  const dir = aimWorld.clone().sub(player.position).setY(0).normalize();
  if (dir.lengthSq() < 0.01) dir.set(0, 0, -1);

  // Find closest enemy along ray
  let bestEnemy: Enemy | null = null;
  let bestDist = 18;
  for (const e of enemies) {
    const toE = e.group.position.clone().sub(player.position).setY(0);
    const proj = toE.dot(dir);
    if (proj > 0 && proj < bestDist) {
      const perp = toE.clone().addScaledVector(dir, -proj).length();
      if (perp < (e.isBoss ? 1.1 : 0.85)) {
        bestDist = proj;
        bestEnemy = e;
      }
    }
  }

  const endPt = bestEnemy
    ? bestEnemy.group.position.clone().add(new THREE.Vector3(0, 0.9, 0))
    : muzzle.clone().addScaledVector(dir, 15);

  if (juice) {
    pulseTag('tag-fps');
    gunRecoil.impulse(4.2);
    audio.playGunshot('rifle', 0.8);
    vfx.spawnTracer(muzzle, endPt, 0xffe484, 0.075);
    vfx.spawnShellCasing(muzzle, new THREE.Vector3(dir.z, 0.3, -dir.x));
    trauma = Math.min(1, trauma + 0.14);
    pulseTag('tag-shake');
  } else {
    audio.playFlatBeep(320);
    vfx.spawnTracer(muzzle, endPt, 0x64748b, 0.045);
  }

  if (bestEnemy) damageEnemy(bestEnemy, 32, Math.random() < 0.35);
}

function performKatanaSlash(): void {
  slashTimer = 0.24;
  swordPivot.rotation.y = -2.1;
  if (juice) {
    pulseTag('tag-trail');
    audio.playBladeSlash(true, false);
  } else {
    audio.playFlatBeep(240);
  }

  // Deflect any nearby enemy plasma orbs!
  let deflectedCount = 0;
  for (const o of orbs) {
    if (!o.deflected && o.mesh.position.distanceTo(player.position) < 3.4) {
      o.deflected = true;
      o.vel.multiplyScalar(-2.8);
      o.life = 2.0;
      (o.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xfacc15);
      deflectedCount++;

      if (juice) {
        pulseTag('tag-deflect');
        pulseTag('tag-hitstop');
        pulseTag('tag-shake');
        audio.playKatanaDeflect(true, combo++, 1.0);
        clock.triggerHitstop(0.075);
        fovSpring.impulse(-145);
        trauma = Math.min(1, trauma + 0.45);
        vfx.spawnSparks(o.mesh.position, { count: 34, color: 0xffae34, coreColor: 0xffffff, speed: 11, flashIntensity: 18 });
        vfx.spawnShockRing(o.mesh.position, 0xfbbf24, 3.8, 0.24);
        vfx.spawnFloatingText(o.mesh.position.clone().add(new THREE.Vector3(0, 0.6, 0)), '完美弹反 DEFLECT!', {
          color: '#fde047',
          scale: 1.25,
        });
      }
    }
  }

  // Also cleave nearby enemies
  for (const e of [...enemies]) {
    if (e.group.position.distanceTo(player.position) < 3.1) {
      damageEnemy(e, deflectedCount > 0 ? 120 : 65, true);
    }
  }
}

function performDash(moveDir: THREE.Vector3): void {
  dashCooldown = 0.85;
  const d = moveDir.lengthSq() > 0.01 ? moveDir.clone().normalize() : new THREE.Vector3(1, 0, 0);
  playerVel.addScaledVector(d, 15);

  // Check if dodging close to an orb -> Witch Time!
  const nearOrb = orbs.some((o) => !o.deflected && o.mesh.position.distanceTo(player.position) < 3.6);
  if (juice) {
    fovSpring.impulse(120);
    speedLines = 0.85;
    vfx.spawnSparks(player.position.clone().add(new THREE.Vector3(0, 0.4, 0)), { count: 18, color: 0x38bdf8, speed: 7 });
    if (nearOrb) {
      pulseTag('tag-witch');
      witchTimer = 0.75;
      clock.triggerSlowMo(0.18, 0.75);
      audio.playTimeWarp(true);
      audio.setBulletTimeMuffle(0.85);
      vignette = 0.9;
      vfx.spawnFloatingText(player.position.clone().add(new THREE.Vector3(0, 1.9, 0)), '⏳ WITCH TIME!', {
        color: '#c084fc',
        scale: 1.25,
      });
    } else {
      audio.playNitroBoost('mini');
    }
  }
}

function damageEnemy(e: Enemy, dmg: number, crit: boolean): void {
  e.hp -= dmg;
  combo++;

  if (juice) {
    pulseTag('tag-blast');
    e.flashTimer = 0.09;
    e.mat.emissive.setHex(0xffffff);
    e.mat.emissiveIntensity = 1.3;
    e.wobbleVel = -8.5;
    e.hitFreezeJit = 0.08;
    if (crit) {
      audio.playHeadshotChime(Math.pow(2, ((combo % 6) * 1.1) / 12));
      pulseTag('tag-fps');
    }
    vfx.spawnSparks(e.group.position.clone().add(new THREE.Vector3(0, 0.9, 0)), {
      count: crit ? 18 : 9,
      color: crit ? 0xfacc15 : 0xf472b6,
      speed: 8,
    });
    vfx.spawnFloatingText(
      e.group.position.clone().add(new THREE.Vector3(0, 1.55, 0)),
      crit ? `★ ${dmg}!` : `${dmg}`,
      { color: crit ? '#fde047' : '#f8fafc', scale: crit ? 1.18 : 0.85 }
    );
  }

  if (e.hp <= 0) {
    kills++;
    const pos = e.group.position.clone();
    scene.remove(e.group);
    enemies.splice(enemies.indexOf(e), 1);

    if (juice) {
      pulseTag('tag-blast');
      pulseTag('tag-shake');
      if (e.isBoss) {
        pulseTag('tag-hitstop');
        clock.triggerHitstop(0.085);
        audio.playExplosion(1.0);
        blastDome.position.copy(pos).setY(0.7);
        blastDome.visible = true;
        blastProg = 0;
        trauma = Math.min(1, trauma + 0.65);
        fovSpring.impulse(85);
        vfx.spawnShockRing(pos.clone().setY(0.05), 0xff8c24, 5.2, 0.36, true);
      } else {
        audio.playHeavyImpact(0.9);
        trauma = Math.min(1, trauma + 0.28);
        vfx.spawnShockRing(pos.clone().setY(0.05), 0xf43f5e, 3.0, 0.24, true);
      }
      vfx.spawnSparks(pos.clone().setY(0.8), {
        count: e.isBoss ? 42 : 22,
        color: e.isBoss ? 0xff6b1a : 0xf43f5e,
        speed: 10.5,
        flashIntensity: 18,
      });
    } else {
      audio.playFlatBeep(180);
    }

    spawnEnemy(kills % 5 === 0);
  }

  document.getElementById('score-readout')!.textContent = `KILLS: ${kills} · COMBO: ${combo}×`;
}

// Input & UI Wiring
const keys = new Set<string>();
const btnRaw = document.getElementById('btn-raw')!;
const btnGf = document.getElementById('btn-gf')!;
const btnPilot = document.getElementById('btn-pilot')!;

function setMode(enableGf: boolean): void {
  juice = enableGf;
  btnRaw.className = `mode-btn ${!juice ? 'on-raw' : ''}`;
  btnGf.className = `mode-btn ${juice ? 'on-gf' : ''}`;
  if (!juice) {
    audio.setBulletTimeMuffle(0);
    clock.reset();
    swordTrail.setActive(false);
  }
}

function setPilot(on: boolean): void {
  autoPilot = on;
  btnPilot.textContent = on
    ? '🤖 自动战斗演示中 (点此或按 WASD 亲自接管)'
    : '🎮 手动操控中 (点此切回 AI 自动演示)';
  btnPilot.className = `auto-pill ${on ? '' : 'manual'}`;
}

btnRaw.onclick = () => { audio.unlock(); setMode(false); };
btnGf.onclick = () => { audio.unlock(); setMode(true); };
btnPilot.onclick = () => { audio.unlock(); setPilot(!autoPilot); };

window.addEventListener('keydown', (e) => {
  audio.unlock();
  if (e.code === 'Tab') {
    e.preventDefault();
    setMode(!juice);
    return;
  }
  keys.add(e.code);
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) setPilot(false);
  if (e.code === 'Space' || e.code === 'KeyK') performKatanaSlash();
  if (e.code === 'ShiftLeft' && dashCooldown <= 0) performDash(playerVel);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
window.addEventListener('pointermove', (e) => {
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  raycaster.ray.intersectPlane(groundPlane, aimWorld);
});
window.addEventListener('pointerdown', (e) => {
  if ((e.target as HTMLElement).closest('button, a')) return;
  audio.unlock();
  if (e.button === 2) performKatanaSlash();
  else if (fireCooldown <= 0) fireRifle();
});
window.addEventListener('contextmenu', (e) => e.preventDefault());

function syncResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  hudCanvas.width = window.innerWidth;
  hudCanvas.height = window.innerHeight;
}
syncResize();
window.addEventListener('resize', syncResize);

// Main Loop
let lastNow = performance.now();
let elapsed = 0;

function tick(now: number): void {
  const rawDt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
  lastNow = now;
  elapsed += rawDt;

  const { scaledDt, inHitstop } = clock.step(rawDt);
  if (fireCooldown > 0) fireCooldown -= rawDt;
  if (dashCooldown > 0) dashCooldown -= rawDt;
  if (witchTimer > 0) {
    witchTimer -= rawDt;
    if (witchTimer <= 0) audio.setBulletTimeMuffle(0);
  }

  // 1. Player or Auto-Pilot AI Control
  const move = new THREE.Vector3();
  if (autoPilot) {
    // Orbit smoothly, aim at nearest enemy, auto-deflect incoming orbs!
    move.set(Math.cos(elapsed * 1.1), 0, Math.sin(elapsed * 1.4));
    if (player.position.length() > 6.5) {
      move.lerp(player.position.clone().negate().normalize(), 0.65);
    }
    const incoming = orbs.find((o) => !o.deflected && o.mesh.position.distanceTo(player.position) < 2.8);
    if (incoming && slashTimer <= 0) {
      performKatanaSlash();
    } else if (enemies.length > 0) {
      let nearest = enemies[0];
      let minD = 999;
      for (const e of enemies) {
        const d = e.group.position.distanceTo(player.position);
        if (d < minD) { minD = d; nearest = e; }
      }
      aimWorld.copy(nearest.group.position);
      if (minD < 2.6 && slashTimer <= 0) performKatanaSlash();
      else if (fireCooldown <= 0) fireRifle();
      if (dashCooldown <= 0 && Math.random() < 0.015) performDash(move);
    }
  } else {
    if (keys.has('KeyW')) move.z -= 1;
    if (keys.has('KeyS')) move.z += 1;
    if (keys.has('KeyA')) move.x -= 1;
    if (keys.has('KeyD')) move.x += 1;
  }

  if (move.lengthSq() > 0.01) move.normalize();
  playerVel.lerp(move.multiplyScalar(7.2), 1 - Math.exp(-12 * scaledDt));
  player.position.addScaledVector(playerVel, scaledDt);
  player.position.x = THREE.MathUtils.clamp(player.position.x, -16, 16);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -16, 16);

  const faceDir = aimWorld.clone().sub(player.position).setY(0);
  if (faceDir.lengthSq() > 0.01) {
    player.rotation.y = Math.atan2(-faceDir.x, -faceDir.z);
  }

  // Katana swing & trail
  if (slashTimer > 0) {
    slashTimer -= scaledDt;
    swordPivot.rotation.y = damp(swordPivot.rotation.y, 2.2, 24, scaledDt);
    swordTrail.setActive(juice);
  } else {
    swordPivot.rotation.y = damp(swordPivot.rotation.y, 0.35, 10, scaledDt);
    swordTrail.setActive(false);
  }
  const bPos = new THREE.Vector3();
  const tPos = new THREE.Vector3();
  bladeBase.getWorldPosition(bPos);
  bladeTip.getWorldPosition(tPos);
  swordTrail.update(bPos, tPos, scaledDt, elapsed);

  const gOff = gunRecoil.step(rawDt, 220, 15);
  gunMesh.position.z = -0.35 + (juice ? gOff * 0.08 : 0);

  // 2. Enemies & Plasma Orbs
  for (const e of enemies) {
    if (inHitstop && e.hitFreezeJit > 0) {
      e.group.position.x += Math.sin(elapsed * 220) * 0.04;
      continue;
    }
    e.hitFreezeJit = Math.max(0, e.hitFreezeJit - rawDt);

    const toHero = player.position.clone().sub(e.group.position).setY(0);
    const d = toHero.length();
    if (d > 2.0) {
      e.group.position.addScaledVector(toHero.normalize(), (e.isBoss ? 2.4 : 3.5) * scaledDt);
    }
    e.group.lookAt(player.position.x, 0, player.position.z);

    if (e.flashTimer > 0) {
      e.flashTimer -= rawDt;
      if (e.flashTimer <= 0) e.mat.emissiveIntensity = 0;
      else if (e.flashTimer < 0.035) e.mat.emissive.setHex(0xff2a44);
    }

    e.group.rotation.x += e.wobbleVel * rawDt;
    e.wobbleVel = (e.wobbleVel - e.group.rotation.x * 160 * rawDt) * Math.exp(-10 * rawDt);

    e.shootTimer -= scaledDt;
    if (e.shootTimer <= 0 && orbs.length < 18) {
      e.shootTimer = e.isBoss ? 1.35 : 2.2;
      const om = new THREE.Mesh(
        orbGeo,
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      om.position.copy(e.group.position).setY(0.9);
      scene.add(om);
      orbs.push({
        mesh: om,
        vel: player.position.clone().sub(e.group.position).setY(0).normalize().multiplyScalar(8.2),
        deflected: false,
        life: 3.5,
      });
    }
  }

  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    o.life -= scaledDt;
    o.mesh.position.addScaledVector(o.vel, scaledDt);

    if (o.deflected) {
      for (const e of [...enemies]) {
        if (e.group.position.distanceTo(o.mesh.position) < 1.25) {
          damageEnemy(e, 190, true);
          o.life = 0;
          break;
        }
      }
    } else if (o.mesh.position.distanceTo(player.position) < 0.75) {
      o.life = 0;
      if (juice) {
        trauma = Math.min(1, trauma + 0.32);
        vignette = 0.65;
        audio.playHeavyImpact(0.7);
      }
    }

    if (o.life <= 0) {
      scene.remove(o.mesh);
      (o.mesh.material as THREE.Material).dispose();
      orbs.splice(i, 1);
    }
  }

  if (blastProg < 1) {
    blastProg = Math.min(1, blastProg + rawDt * 2.5);
    blastMat.uniforms.uProgress.value = blastProg;
    blastDome.scale.setScalar(0.3 + Math.pow(blastProg, 0.55) * 4.2);
    if (blastProg >= 1) blastDome.visible = false;
  }

  vfx.update(rawDt, camera);

  // 3. Camera Rig (Lookahead + Trauma² Shake + FOV Spring vs Rigid Vibecoded Lock)
  const fovOff = fovSpring.step(rawDt, 200, 16);
  if (juice) {
    const lead = playerVel.clone().multiplyScalar(0.24);
    dampVec3(camPos, player.position.clone().add(new THREE.Vector3(0, 9.2, 10.2)).addScaledVector(lead, 0.5), 8, rawDt);
    dampVec3(camLook, player.position.clone().add(new THREE.Vector3(0, 0.8, 0)).add(lead), 10, rawDt);
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    shakeClock += rawDt * 26;
    const shake = trauma * trauma;
    trauma = Math.max(0, trauma - 1.65 * rawDt);
    if (shake > 0.0001) {
      camera.rotateX(smoothNoise1D(shakeClock, 1) * 0.075 * shake);
      camera.rotateY(smoothNoise1D(shakeClock, 2) * 0.075 * shake);
      camera.rotateZ(smoothNoise1D(shakeClock, 3) * 0.11 * shake);
    }
    camera.fov = THREE.MathUtils.clamp(54 + fovOff, 32, 95);
  } else {
    trauma = 0;
    camera.position.copy(player.position).add(new THREE.Vector3(0, 9.2, 10.2));
    camera.lookAt(player.position.x, 0.8, player.position.z);
    camera.fov = 54;
  }
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);

  // 4. 2D HUD & Recipe Highlight Badges
  hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
  if (juice && speedLines > 0.02) {
    speedLines = Math.max(0, speedLines - rawDt * 2.4);
    hudCtx.save();
    hudCtx.translate(hudCanvas.width / 2, hudCanvas.height / 2);
    hudCtx.strokeStyle = `rgba(186, 230, 253, ${speedLines * 0.45})`;
    hudCtx.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + (elapsed * 7) % 0.4;
      hudCtx.beginPath();
      hudCtx.moveTo(Math.cos(a) * 220, Math.sin(a) * 220);
      hudCtx.lineTo(Math.cos(a) * 900, Math.sin(a) * 900);
      hudCtx.stroke();
    }
    hudCtx.restore();
  }
  if (juice && vignette > 0.02) {
    vignette = Math.max(0, vignette - rawDt * 1.8);
    const g = hudCtx.createRadialGradient(
      hudCanvas.width / 2, hudCanvas.height / 2, 180,
      hudCanvas.width / 2, hudCanvas.height / 2, hudCanvas.width * 0.65
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(147, 51, 234, ${vignette * 0.42})`);
    hudCtx.fillStyle = g;
    hudCtx.fillRect(0, 0, hudCanvas.width, hudCanvas.height);
  }

  for (const id of ['tag-fps', 'tag-deflect', 'tag-hitstop', 'tag-trail', 'tag-witch', 'tag-shake', 'tag-blast']) {
    const t = Math.max(0, (tagTimers[id] ?? 0) - rawDt);
    tagTimers[id] = t;
    const el = document.getElementById(id);
    if (el) el.className = t > 0 && juice ? 'rf-chip lit' : 'rf-chip';
  }

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
