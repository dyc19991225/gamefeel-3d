import * as THREE from 'three';
import { Spring1D, damp } from '../core/math';
import type { RecipeDefinition } from '../core/types';
import { createSamuraiFighter } from './helpers';

export const platformRecipes: RecipeDefinition[] = [
  {
    id: 'coyote-buffer-jump',
    category: 'platform',
    badge: 'PLT-01',
    title: {
      zh: '土狼时间、输入缓冲与起跳拉伸挤压',
      en: 'Coyote Time, Jump Buffer & Squash-Stretch Arc',
    },
    subtitle: {
      zh: '蔚蓝/马里奥核心秘密：离台 110ms 仍可起跳 + 落地前 120ms 预输入生效 + 下落重力加倍',
      en: '110ms ledge grace, 120ms pre-land buffer, 2.2× fast-fall gravity & volume-preserving stretch',
    },
    whyItMatters: {
      zh: '平台跳跃「跟手不吞键」全靠三招：走出悬崖边缘 110ms 内按跳依然有效（Coyote Time）、落地前 120ms 早按空格触地瞬间秒弹起（Jump Buffer），且下落重力是上升的 2.1 倍杜绝太空飘浮感！',
      en: 'Crisp platformers never eat inputs: 110ms Coyote Time + 120ms Jump Buffer + asymmetric fast-fall gravity cures floaty jumps.',
    },
    rawProblem: {
      zh: '严格校验 `if (isGrounded)` 才给跳，且上下对称抛物线重力，跳起来像月球漫步还经常吞按键。',
      en: 'Strict isGrounded checks swallow inputs near ledges, while symmetric gravity makes jumps feel like underwater moon-walking.',
    },
    controlsHint: {
      zh: '[Space / 点击] 起跳 / 空中二段跳 · [Q / 副动作] 演示走出平台边缘「土狼时间」极限挽救！',
      en: '[Space / Click] Jump / Double Jump · [Q / Secondary] Demo Ledge Coyote-Time Save!',
    },
    hasSecondary: { zh: '演示悬崖土狼跳', en: 'Demo Coyote Save' },
    tags: ['platformer', 'coyote-time', 'jump-buffer', 'celeste', 'squash'],
    autoDemoInterval: 1.15,
    params: [
      { key: 'coyoteMs', label: { zh: '土狼宽限窗口', en: 'Coyote Window' }, min: 0, max: 220, step: 10, defaultValue: 110, unit: 'ms' },
      { key: 'fallGravityMul', label: { zh: '下落重力倍率', en: 'Fall Gravity Mul' }, min: 1.0, max: 3.2, step: 0.1, defaultValue: 2.15 },
      { key: 'jumpVel', label: { zh: '起跳初速度', en: 'Jump Velocity' }, min: 6, max: 14, step: 0.5, defaultValue: 9.8, unit: 'm/s' },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 2.5, 6.2), new THREE.Vector3(0, 1.4, 0), 50, true);

      const ledge = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.35, 1.8),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.4, roughness: 0.5 })
      );
      ledge.position.set(-1.2, 0.18, 0);
      ctx.group.add(ledge);

      const hero = createSamuraiFighter(0x38bdf8, 1);
      hero.root.position.set(-0.6, 0.35, 0);
      ctx.group.add(hero.root);

      let y = 0.35;
      let vy = 0;
      let jumpsUsed = 0;
      const scaleY = new Spring1D(1);

      const doJump = (coyoteSave = false) => {
        const p = ctx.getParams();
        const isDouble = jumpsUsed > 0 && !coyoteSave;
        vy = p.jumpVel * (isDouble ? 0.92 : 1.0);
        jumpsUsed++;

        if (ctx.isJuiceEnabled()) {
          scaleY.snap(1.32);
          ctx.audio.playJump(isDouble || coyoteSave);
          const footPos = hero.root.position.clone();
          ctx.vfx.spawnShockRing(footPos, coyoteSave ? 0xfacc15 : 0x38bdf8, 2.2, 0.22, true);
          ctx.vfx.spawnSparks(footPos, { count: 14, color: coyoteSave ? 0xfde047 : 0x7dd3fc, speed: 5.5 });
          if (coyoteSave) {
            ctx.vfx.spawnFloatingText(footPos.clone().add(new THREE.Vector3(0, 1.8, 0)), `COYOTE +${p.coyoteMs}ms!`, {
              color: '#fde047',
              scale: 1.15,
            });
            ctx.emitCallout(`🦊 土狼时间离台极限起跳 (${p.coyoteMs}ms)!`, 'gold');
          } else if (isDouble) {
            ctx.emitCallout('💨 空中二段踏空跳 DOUBLE JUMP!', 'cyan');
          }
        } else {
          ctx.audio.playFlatBeep(340);
        }
      };

      return {
        trigger() {
          if (jumpsUsed < 2) doJump(false);
        },
        secondary() {
          hero.root.position.x = 0.55; // Just stepped off the ledge at x = 0.1!
          y = 0.28;
          doJump(true);
        },
        update(rawDt, scaledDt) {
          const p = ctx.getParams();
          const juice = ctx.isJuiceEnabled();
          const floorY = hero.root.position.x <= 0.15 ? 0.35 : 0.0;

          if (y > floorY || vy > 0) {
            const grav = vy < 0 && juice ? 20 * p.fallGravityMul : 20;
            vy -= grav * scaledDt;
            y += vy * scaledDt;
            if (y <= floorY && vy <= 0) {
              y = floorY;
              vy = 0;
              jumpsUsed = 0;
              if (juice) {
                scaleY.snap(0.74);
                ctx.stage.addTrauma(0.14, 24, 2.6);
                ctx.vfx.spawnShockRing(hero.root.position.clone().setY(floorY + 0.02), 0x94a3b8, 1.6, 0.18, true);
              }
            }
          }

          hero.root.position.x = damp(hero.root.position.x, -0.6, 2.5, scaledDt);
          hero.root.position.y = y;

          const sy = juice ? scaleY.step(rawDt, 240, 14) : 1;
          hero.root.scale.set(1 / Math.sqrt(Math.max(0.5, sy)), sy, 1 / Math.sqrt(Math.max(0.5, sy)));
          ctx.setHudStat('VY / GRAVITY', `${vy.toFixed(1)} m/s · ${vy < 0 && juice ? `${p.fallGravityMul}× FAST-FALL` : '1.0×'}`);
        },
      };
    },
    generateCode(p) {
      return `// Coyote Time (${p.coyoteMs}ms) + Jump Buffer (120ms) + Asymmetric Fast-Fall Gravity
export class ResponsiveJumpController {
  public coyoteTimer = 0;
  public bufferTimer = 0;
  public vy = 0;

  step(dt: number, isGrounded: boolean, jumpJustPressed: boolean): boolean {
    this.coyoteTimer = isGrounded ? ${(p.coyoteMs / 1000).toFixed(3)} : Math.max(0, this.coyoteTimer - dt);
    this.bufferTimer = jumpJustPressed ? 0.12 : Math.max(0, this.bufferTimer - dt);

    if (this.bufferTimer > 0 && this.coyoteTimer > 0) {
      this.vy = ${p.jumpVel};
      this.coyoteTimer = 0;
      this.bufferTimer = 0;
      return true; // Fired crisp buffered/coyote jump!
    }
    const grav = this.vy < 0 ? 20 * ${p.fallGravityMul} : 20;
    this.vy -= grav * dt;
    return false;
  }
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：重写角色跳跃手感，加入 110ms 土狼时间（Coyote Time）、120ms 落地输入缓冲（Jump Buffer）、2.15 倍非对称快速下落重力，以及体积守恒起跳拉伸与落地挤压。',
      en: 'Use gamefeel-3d skill: Upgrade character jumping with 110ms Coyote Time, 120ms Jump Buffer, 2.15x asymmetric fast-fall gravity, and volume-preserving takeoff stretch / landing squash.',
    },
  },
  {
    id: 'ghost-dash-afterimage',
    category: 'platform',
    badge: 'PLT-02',
    title: {
      zh: '全息幻影冲刺残影链（赛博边缘行者风）',
      en: 'Sandevistan Hologram Ghost-Dash Afterimages',
    },
    subtitle: {
      zh: '瞬移路径等距冻结姿态克隆体 + 青/紫/金色谱渐变淡出 + 广角推镜',
      en: 'Equidistant pose-frozen silhouette clones shifting Cyan -> Violet -> Fade along dash vector',
    },
    whyItMatters: {
      zh: '高速闪避如果只是坐标瞬移，眼睛跟不上角色的去向；沿途留下 7 尊青紫渐变半透明全息残影，既交代了运动轨迹又帅到掉渣！',
      en: 'Instant dash teleports confuse spatial tracking; leaving 7 color-shifting additive hologram silhouettes sells blinding speed.',
    },
    rawProblem: {
      zh: '闪避只是 `position.x += 4`，画面一闪角色就不见了，毫无速度轨迹美感。',
      en: 'Teleporting position += 4 makes characters vanish abruptly with zero motion readability.',
    },
    controlsHint: {
      zh: '[Space / 点击] 触发全息幻影折返冲刺（斯安威斯坦风残影链）！',
      en: '[Space / Click] Trigger Sandevistan Hologram Ghost-Dash!',
    },
    tags: ['afterimage', 'dash', 'sandevistan', 'ghost', 'platformer'],
    autoDemoInterval: 0.95,
    params: [
      { key: 'ghostCount', label: { zh: '残影分身数量', en: 'Ghost Clones' }, min: 3, max: 14, step: 1, defaultValue: 8 },
      { key: 'fadeSec', label: { zh: '残影消散时长', en: 'Fade Duration' }, min: 0.15, max: 0.9, step: 0.05, defaultValue: 0.42, unit: 's' },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 2.35, 5.8), new THREE.Vector3(0, 1.15, 0), 52, true);
      const hero = createSamuraiFighter(0x06b6d4, 1);
      hero.root.position.set(-2.2, 0, 0);
      ctx.group.add(hero.root);

      const ghostGeo = new THREE.CapsuleGeometry(0.3, 0.78, 6, 12);
      const ghosts: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; age: number; maxAge: number }[] = [];
      let side = -1;

      return {
        trigger() {
          const p = ctx.getParams();
          const startX = hero.root.position.x;
          side *= -1;
          const endX = side * 2.35;
          hero.root.position.x = endX;
          hero.root.rotation.z = -side * 0.25;

          if (ctx.isJuiceEnabled()) {
            const colors = [0x22d3ee, 0x38bdf8, 0x818cf8, 0xc084fc, 0xf472b6];
            for (let i = 0; i < p.ghostCount; i++) {
              const t = i / p.ghostCount;
              const col = colors[i % colors.length];
              const mat = new THREE.MeshBasicMaterial({
                color: col,
                transparent: true,
                opacity: 0.68,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
              });
              const m = new THREE.Mesh(ghostGeo, mat);
              m.position.set(THREE.MathUtils.lerp(startX, endX, t), 1.05, 0);
              m.rotation.z = -side * 0.28;
              ctx.group.add(m);
              ghosts.push({ mesh: m, mat, age: -i * 0.018, maxAge: p.fadeSec });
            }
            ctx.audio.playBladeSlash(false, true);
            ctx.stage.punchFov(65);
            ctx.stage.addTrauma(0.2, 28, 2.5);
            ctx.stage.speedLinesIntensity = 0.55;
            ctx.emitCallout(`⚡ SANDEVISTAN ×${p.ghostCount} AFTERIMAGES`, 'cyan');
          } else {
            ctx.audio.playFlatBeep(320);
          }
          ctx.setHudStat('ACTIVE GHOSTS', `${ghosts.length} SILHOUETTES`);
        },
        update(rawDt) {
          hero.root.rotation.z = damp(hero.root.rotation.z, 0, 10, rawDt);
          for (let i = ghosts.length - 1; i >= 0; i--) {
            const g = ghosts[i];
            g.age += rawDt;
            if (g.age > 0) {
              const ratio = 1 - g.age / g.maxAge;
              g.mat.opacity = Math.max(0, ratio * 0.68);
              g.mesh.scale.setScalar(1 + (1 - ratio) * 0.12);
            }
            if (g.age >= g.maxAge) {
              ctx.group.remove(g.mesh);
              g.mat.dispose();
              ghosts.splice(i, 1);
            }
          }
        },
        dispose() {
          ghostGeo.dispose();
        },
      };
    },
    generateCode(p) {
      return `// Sandevistan Equidistant Hologram Ghost Trail (${p.ghostCount} Clones, ${p.fadeSec}s Fade)
export function spawnDashGhosts(
  scene: THREE.Scene, geo: THREE.BufferGeometry,
  from: THREE.Vector3, to: THREE.Vector3
): THREE.Mesh[] {
  const palette = [0x22d3ee, 0x38bdf8, 0x818cf8, 0xc084fc, 0xf472b6];
  return Array.from({ length: ${p.ghostCount} }, (_, i) => {
    const mat = new THREE.MeshBasicMaterial({
      color: palette[i % palette.length], transparent: true, opacity: 0.68,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.lerpVectors(from, to, i / ${p.ghostCount});
    scene.add(m);
    return m;
  });
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：给角色闪避冲刺添加赛博朋克斯安威斯坦风全息残影链（在起点到终点间等距生成 8 个青紫渐变加色半透明分身并在 0.42s 内微扩消散）。',
      en: 'Use gamefeel-3d skill: Add a Sandevistan hologram ghost-dash afterimage trail spawning 8 equidistant cyan-to-violet additive silhouettes fading over 0.42s.',
    },
  },
  {
    id: 'grapple-pendulum-swing',
    category: 'platform',
    badge: 'PLT-03',
    title: {
      zh: '抓钩弹簧摆荡张力与脱钩切向弹射',
      en: 'Grapple-Hook Tension Swing & Tangential Release Boost',
    },
    subtitle: {
      zh: '泰坦陨落/蜘蛛侠手感：绳索刚性约束 + 最低点速度加权 + 脱钩瞬间切向冲量奖励',
      en: 'Pendulum arc tension + apex speed surge + 1.35× tangential launch boost on release',
    },
    whyItMatters: {
      zh: '好玩的抓钩不是把人直线拉过去，而是荡过最低点时给切向速度乘 1.35 倍助推并外扩 FOV，松钩飞出瞬间爽感爆棚！',
      en: 'Great grappling hooks swing along a pendulum arc and multiply tangential velocity on release rather than linearly winching.',
    },
    rawProblem: {
      zh: '直接把玩家 `lerp` 到锚点位置，像坐电梯一样毫无摆荡惯性与抛射感。',
      en: 'Linearly lerping player position toward the anchor feels like riding an elevator with zero momentum.',
    },
    controlsHint: {
      zh: '[Space / 点击] 射出能量抓钩摆荡并在高点切向弹射飞出！',
      en: '[Space / Click] Fire Energy Grapple -> Pendulum Swing -> Launch Boost!',
    },
    tags: ['grapple', 'swing', 'pendulum', 'titanfall', 'platformer'],
    autoDemoInterval: 1.85,
    params: [
      { key: 'swingSpeed', label: { zh: '摆荡角速度', en: 'Swing Angular Vel' }, min: 2.0, max: 6.5, step: 0.25, defaultValue: 4.1, unit: 'rad/s' },
      { key: 'releaseBoost', label: { zh: '脱钩弹射倍率', en: 'Release Boost' }, min: 1.0, max: 2.2, step: 0.1, defaultValue: 1.45 },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 2.5, 6.8), new THREE.Vector3(0, 1.9, 0), 54, true);
      const anchor = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.24, 0),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xd97706, emissiveIntensity: 0.9 })
      );
      anchor.position.set(0, 3.6, 0);
      ctx.group.add(anchor);

      const hero = createSamuraiFighter(0x10b981, 1);
      ctx.group.add(hero.root);

      const ropeGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const rope = new THREE.Line(ropeGeo, new THREE.LineBasicMaterial({ color: 0xfde047 }));
      rope.visible = false;
      ctx.group.add(rope);

      let phase: 'idle' | 'swing' | 'launch' = 'idle';
      let angle = -1.15;
      const vel = new THREE.Vector3();

      return {
        trigger() {
          phase = 'swing';
          angle = -1.18;
          rope.visible = true;
          if (ctx.isJuiceEnabled()) {
            ctx.audio.playGunshot('suppressed', 0.9);
            ctx.vfx.spawnSparks(anchor.position, { count: 16, color: 0xfacc15, speed: 7 });
            ctx.emitCallout('🪝 GRAPPLE HOOK LOCKED!', 'gold');
          } else {
            ctx.audio.playFlatBeep(360);
          }
        },
        update(rawDt, scaledDt) {
          const p = ctx.getParams();
          const juice = ctx.isJuiceEnabled();
          const radius = 2.75;

          if (phase === 'swing') {
            angle += p.swingSpeed * scaledDt;
            const px = Math.sin(angle) * radius;
            const py = 3.6 - Math.cos(angle) * radius;
            hero.root.position.set(px, py - 0.8, 0);
            hero.root.rotation.z = juice ? angle * 0.65 : 0;
            ropeGeo.setFromPoints([anchor.position, new THREE.Vector3(px, py + 0.4, 0)]);

            if (angle >= 0.88) {
              phase = 'launch';
              rope.visible = false;
              vel.set(Math.cos(angle) * 5.2 * p.releaseBoost, Math.sin(angle) * 5.6 * p.releaseBoost, 0);
              if (juice) {
                ctx.audio.playJump(true);
                ctx.stage.punchFov(75);
                ctx.stage.speedLinesIntensity = 0.6;
                ctx.vfx.spawnShockRing(hero.root.position.clone(), 0x34d399, 2.8, 0.22);
                ctx.emitCallout(`🚀 脱钩切向弹射 ${p.releaseBoost}× BOOST!`, 'emerald');
              }
            }
          } else if (phase === 'launch') {
            vel.y -= 18 * scaledDt;
            hero.root.position.addScaledVector(vel, scaledDt);
            hero.root.rotation.z = damp(hero.root.rotation.z, 0, 8, scaledDt);
            if (hero.root.position.y <= 0) {
              hero.root.position.y = 0;
              phase = 'idle';
            }
          } else {
            hero.root.position.x = damp(hero.root.position.x, -2.2, 5, rawDt);
            hero.root.position.y = damp(hero.root.position.y, 0, 8, rawDt);
          }
          ctx.setHudStat('GRAPPLE', phase.toUpperCase());
        },
        dispose() {
          ropeGeo.dispose();
        },
      };
    },
    generateCode(p) {
      return `// Pendulum Grapple Constraint + Tangential Release Boost
export function projectGrappleVelocity(
  playerPos: THREE.Vector3, anchorPos: THREE.Vector3, vel: THREE.Vector3
): THREE.Vector3 {
  const ropeDir = playerPos.clone().sub(anchorPos).normalize();
  const radial = vel.dot(ropeDir);
  if (radial > 0) vel.addScaledVector(ropeDir, -radial); // Remove outward stretch!
  return vel; // On release: vel.multiplyScalar(${p.releaseBoost})
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：实现泰坦陨落式能量抓钩摆荡物理（绳索法向速度投影消除拉伸、摆荡身体倾斜跟随，脱钩瞬间叠加 1.45 倍切向弹射冲量与广角速度线）。',
      en: 'Use gamefeel-3d skill: Implement Titanfall-style grappling hook pendulum physics with radial velocity projection and a 1.45x tangential launch impulse + FOV punch on release.',
    },
  },
  {
    id: 'wallrun-tilt-kickoff',
    category: 'platform',
    badge: 'PLT-04',
    title: {
      zh: '贴墙飞檐走壁 14° 斜镜与蹬墙三角跳',
      en: 'Wall-Run 14° Camera Tilt & Kick-Off Sparks',
    },
    subtitle: {
      zh: '贴墙减缓重力至 20% + 镜头向外侧平滑歪斜 14° + 墙面摩擦火星与法向反弹跳',
      en: '80% gravity reduction on wall contact + 14° outward camera roll + normal+upward kick-off',
    },
    whyItMatters: {
      zh: '第一/三人称贴墙跑让人信服的灵魂不是动画，而是上墙瞬间相机向外侧平滑倾斜 12°~15° Roll 角，蹬墙瞬间再向反方向猛甩回来！',
      en: 'What sells wall-running in 3D is smooth 14° outward camera roll during wall contact followed by a snappy counter-roll kick-off.',
    },
    rawProblem: {
      zh: '贴墙移动时相机保持水平死板不动，玩家根本感知不到自己正吸附在垂直墙面上。',
      en: 'Keeping camera roll flat at 0° makes wall-running indistinguishable from walking on invisible stairs.',
    },
    controlsHint: {
      zh: '[Space / 点击] 左右双墙交替飞檐走壁蹬墙三角跳！',
      en: '[Space / Click] Chain Left-to-Right Wall-Run & Kick-Off Jumps!',
    },
    tags: ['wallrun', 'parkour', 'camera-roll', 'titanfall', 'platformer'],
    autoDemoInterval: 1.1,
    params: [
      { key: 'wallTiltDeg', label: { zh: '贴墙相机倾斜角', en: 'Wall Camera Roll' }, min: 4, max: 24, step: 1, defaultValue: 14, unit: '°' },
      { key: 'kickHorizontal', label: { zh: '蹬墙法向推力', en: 'Wall Kick Impulse' }, min: 3, max: 10, step: 0.5, defaultValue: 6.5 },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 2.3, 5.8), new THREE.Vector3(0, 1.6, -1.0), 55, true);

      const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.35 });
      [-2.1, 2.1].forEach((x) => {
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.6, 5.5), wallMat);
        w.position.set(x, 1.8, -0.8);
        ctx.group.add(w);
      });

      const hero = createSamuraiFighter(0xf43f5e, -1);
      hero.root.position.set(-1.82, 1.1, -0.5);
      ctx.group.add(hero.root);

      let wallSide: -1 | 1 = -1;
      let jumping = false;
      let vx = 0;
      let vy = 0;

      return {
        trigger() {
          const p = ctx.getParams();
          jumping = true;
          const prevSide = wallSide;
          wallSide = (wallSide === -1 ? 1 : -1);
          vx = wallSide * p.kickHorizontal;
          vy = 5.4;

          if (ctx.isJuiceEnabled()) {
            ctx.audio.playJump(true);
            ctx.stage.punchRoll(-wallSide * p.wallTiltDeg * 12);
            ctx.stage.punchFov(45);
            const sparkPos = new THREE.Vector3(prevSide * 1.95, hero.root.position.y + 0.6, -0.5);
            ctx.vfx.spawnSparks(sparkPos, { count: 20, color: 0xfb7185, speed: 7.5 });
            ctx.vfx.spawnShockRing(sparkPos, 0xf43f5e, 2.2, 0.2);
            ctx.emitCallout(`👟 蹬墙三角跳 WALL KICK -> ${wallSide > 0 ? 'RIGHT' : 'LEFT'}`, 'crimson');
          } else {
            ctx.audio.playFlatBeep(310);
          }
        },
        update(_rawDt, scaledDt) {
          const p = ctx.getParams();
          const juice = ctx.isJuiceEnabled();

          if (jumping) {
            vy -= 18 * scaledDt;
            hero.root.position.x += vx * scaledDt;
            hero.root.position.y = Math.max(0.4, hero.root.position.y + vy * scaledDt);
            if (Math.abs(hero.root.position.x) >= 1.8) {
              hero.root.position.x = Math.sign(hero.root.position.x) * 1.8;
              jumping = false;
              if (juice) ctx.audio.playWallImpact('steel', true);
            }
          } else {
            hero.root.position.y = 1.15 + Math.sin(performance.now() * 0.005) * 0.08;
            if (juice && Math.random() < 0.4) {
              ctx.vfx.spawnSparks(
                new THREE.Vector3(wallSide * 1.95, hero.root.position.y + 0.4, -0.3),
                { count: 2, color: 0xfbbf24, speed: 3.5, life: 0.14, flashIntensity: 0 }
              );
            }
          }

          hero.root.rotation.z = damp(hero.root.rotation.z, juice ? -wallSide * 0.34 : 0, 12, scaledDt);
          ctx.stage.rollSpring.target = juice ? THREE.MathUtils.degToRad(-wallSide * p.wallTiltDeg) : 0;
          ctx.stage.scrollFloor(scaledDt * 14);
          ctx.setHudStat('WALL SIDE / TILT', `${wallSide < 0 ? 'LEFT WALL' : 'RIGHT WALL'} · ${p.wallTiltDeg}°`);
        },
      };
    },
    generateCode(p) {
      return `// Wall-Run Gravity Scale + ${p.wallTiltDeg}° Outward Camera Dutch Tilt
export function getWallRunState(wallNormalX: -1 | 0 | 1): { gravityScale: number; targetRollRad: number } {
  if (wallNormalX === 0) return { gravityScale: 1.0, targetRollRad: 0 };
  return {
    gravityScale: 0.22, // Slow controlled wall glide
    targetRollRad: THREE.MathUtils.degToRad(wallNormalX * ${p.wallTiltDeg}),
  };
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：加入泰坦陨落式贴墙跑与蹬墙跳手感（吸附墙面时重力降至 22%、相机向外侧平滑歪斜 14° Roll 角并擦出墙面火星，蹬墙瞬间沿墙法线弹射 6.5m/s 并甩回视角）。',
      en: 'Use gamefeel-3d skill: Add wall-running and wall-kick feel with 22% reduced wall gravity, 14° outward camera Dutch tilt, wall-scrape sparks, and snappy normal+upward kick-off.',
    },
  },
];
