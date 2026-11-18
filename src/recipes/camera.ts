import * as THREE from 'three';
import { dampVec3 } from '../core/math';
import type { RecipeDefinition } from '../core/types';
import { createSamuraiFighter, createTargetDummy } from './helpers';

export const cameraRecipes: RecipeDefinition[] = [
  {
    id: 'perlin-trauma-shake',
    category: 'camera',
    badge: 'CAM-01',
    title: {
      zh: 'GDC 经典 Trauma² 旋转平滑震屏 vs 随机抖动',
      en: 'GDC Trauma² Rotational Noise Shake vs Naive Jitter',
    },
    subtitle: {
      zh: 'Squirrel Eiserloh 核心公式：创伤线性衰减、震幅取平方、只抖三轴旋转不乱移相机坐标',
      en: 'Linear trauma decay + quadratic shake = trauma² + 3-axis smooth rotational noise',
    },
    whyItMatters: {
      zh: '`Math.random()` 改相机 XYZ 会产生刺眼高频跳变并穿模；而 `shake = trauma²` 配合平滑噪声旋转 Pitch/Yaw/Roll 既有雷霆冲击又丝滑收尾！',
      en: 'Random XYZ translation causes nauseating white-noise jitter and clipping; trauma² rotational noise feels cinematic and organic.',
    },
    rawProblem: {
      zh: '90% 的 AI 代码写震屏都是 `camera.position.x += (Math.random()-0.5)*0.5`，极其廉价且晕 3D。',
      en: '90% of vibecoded camera shakes use Math.random() on camera.position, looking cheap and causing motion sickness.',
    },
    controlsHint: {
      zh: '[Space / 点击] 叠加 Trauma 冲击 · [Q / 副动作] 切换「丝滑旋转噪声」vs「劣质随机位移」对比！',
      en: '[Space / Click] Add Trauma Impulse · [Q / Secondary] Compare Smooth Rotational vs Naive Random XYZ!',
    },
    hasSecondary: { zh: '对比劣质 Math.random 震屏', en: 'Compare Naive Random Shake' },
    tags: ['camera-shake', 'trauma', 'perlin', 'gdc', 'camera'],
    autoDemoInterval: 1.15,
    params: [
      { key: 'traumaAdd', label: { zh: '单次创伤增量', en: 'Trauma Impulse' }, min: 0.15, max: 1.0, step: 0.05, defaultValue: 0.55 },
      { key: 'freq', label: { zh: '噪声采样频率', en: 'Noise Frequency' }, min: 8, max: 48, step: 2, defaultValue: 26, unit: 'Hz' },
      { key: 'decay', label: { zh: '创伤线性衰减率', en: 'Linear Decay' }, min: 0.5, max: 3.5, step: 0.1, defaultValue: 1.5, unit: '/s' },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 2.2, 5.4), new THREE.Vector3(0, 1.2, 0), 50, true);
      const dummy = createTargetDummy(0x8b5cf6);
      ctx.group.add(dummy.root);

      // Reference pillars to make rotational vs translational shake crystal clear
      [-2.2, 2.2].forEach((x) => {
        const p = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, 2.8, 0.35),
          new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.4, roughness: 0.5 })
        );
        p.position.set(x, 1.4, -1.2);
        ctx.group.add(p);
      });

      let badNaive = false;

      return {
        trigger() {
          const p = ctx.getParams();
          if (ctx.isJuiceEnabled()) {
            ctx.stage.addTrauma(p.traumaAdd, p.freq, p.decay, badNaive);
            ctx.audio.playExplosion(0.65);
            ctx.vfx.spawnShockRing(new THREE.Vector3(0, 0.08, 0), badNaive ? 0xef4444 : 0xa855f7, 4.4, 0.3, true);
            ctx.vfx.spawnSparks(new THREE.Vector3(0, 1.2, 0), {
              count: 24,
              color: badNaive ? 0xf87171 : 0xc084fc,
              speed: 8.5,
            });
            dummy.flash(0.1, false);
            dummy.kickVel.x = -5;
            ctx.emitCallout(
              badNaive ? '❌ 劣质 Math.random() XYZ 抖动' : '✅ Trauma² 三轴旋转平滑噪声',
              badNaive ? 'crimson' : 'gold'
            );
          } else {
            ctx.audio.playFlatBeep(220);
          }
        },
        secondary() {
          badNaive = !badNaive;
          ctx.emitCallout(
            badNaive ? '切换为：反面教材 Math.random 位移抖动' : '切换为：GDC 标准 Trauma² 旋转震屏',
            badNaive ? 'crimson' : 'emerald'
          );
        },
        update(_rawDt, scaledDt) {
          dummy.update(scaledDt);
          ctx.setHudStat('SHAKE MODE', badNaive ? 'BAD RANDOM XYZ' : 'TRAUMA² ROTATIONAL');
        },
      };
    },
    generateCode(p) {
      return `// GDC Standard: Squirrel Eiserloh's Trauma² Rotational Shake
export class TraumaCameraShake {
  public trauma = 0;
  private time = 0;

  addTrauma(amount = ${p.traumaAdd}): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  apply(camera: THREE.Camera, dt: number, smoothNoise: (x: number, seed: number) => number): void {
    this.time += dt * ${p.freq};
    const shake = this.trauma * this.trauma; // Quadratic falloff!
    this.trauma = Math.max(0, this.trauma - ${p.decay} * dt);
    if (shake > 0.0001) {
      camera.rotateX(smoothNoise(this.time, 1) * 0.075 * shake);
      camera.rotateY(smoothNoise(this.time, 2) * 0.075 * shake);
      camera.rotateZ(smoothNoise(this.time, 3) * 0.110 * shake);
    }
  }
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：把粗糙的随机坐标震屏替换为 GDC 标准 Trauma² 旋转噪声震屏（trauma 线性每秒衰减 1.5，实际震幅取 trauma 的平方，用 26Hz 平滑一维噪声驱动相机 Pitch/Yaw/Roll 旋转）。',
      en: 'Use gamefeel-3d skill: Replace naive random XYZ camera shake with Squirrel Eiserloh GDC Trauma² rotational shake (linear decay 1.5/s, shake = trauma², 26Hz smooth noise driving Pitch/Yaw/Roll).',
    },
  },
  {
    id: 'bullet-time-chromatic',
    category: 'camera',
    badge: 'CAM-02',
    title: {
      zh: '魔女时间（子弹时间）变速与低通闷音联动',
      en: 'Witch-Time Dilation & Lowpass Audio Muffle',
    },
    subtitle: {
      zh: '极限闪避瞬间世界降速至 0.14x + 暗角聚焦 + 全局音频低通深潜滤波',
      en: 'Perfect dodge drops world clock to 0.14x, pulses vignette & sweeps master audio lowpass filter',
    },
    whyItMatters: {
      zh: '子弹时间只改 `dt * 0.15` 会显得像画面掉帧；必须同步把全局音频过一层 700Hz 低通滤波器 + 下潜重低音吸气声，大脑才会瞬间进入「时间凝滞」幻觉！',
      en: 'Slow-mo alone looks like lag unless paired with a synchronized WebAudio lowpass filter sweep and sub-bass time-warp drop.',
    },
    rawProblem: {
      zh: '只缩放动画时间却不联动声音频响与镜头聚焦，慢动作毫无沉浸感。',
      en: 'Scaling dt without audio frequency muffling and FOV focus fails to sell true time dilation.',
    },
    controlsHint: {
      zh: '[Space / 点击] 触发极限闪避「魔女时间」（注意听背景脉冲与低通闷音变化）',
      en: '[Space / Click] Trigger Perfect-Dodge Witch Time (listen to the lowpass audio dive!)',
    },
    tags: ['bullet-time', 'witch-time', 'slow-mo', 'audio-filter', 'camera'],
    autoDemoInterval: 2.1,
    params: [
      { key: 'timeScale', label: { zh: '子弹时间倍率', en: 'Dilated TimeScale' }, min: 0.06, max: 0.45, step: 0.02, defaultValue: 0.14 },
      { key: 'duration', label: { zh: '凝滞持续时长', en: 'Dilation Duration' }, min: 0.4, max: 2.2, step: 0.1, defaultValue: 1.05, unit: 's' },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 2.35, 5.6), new THREE.Vector3(0, 1.3, 0), 52, true);
      const hero = createSamuraiFighter(0x8b5cf6, 1);
      ctx.group.add(hero.root);

      // Orbiting projectile blades to clearly show world time dilation
      const projectiles: THREE.Mesh[] = [];
      const projGeo = new THREE.OctahedronGeometry(0.18, 0);
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(
          projGeo,
          new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 0.8,
            metalness: 0.7,
            roughness: 0.2,
          })
        );
        ctx.group.add(m);
        projectiles.push(m);
      }

      let orbitAngle = 0;
      let warpTimer = 0;

      return {
        trigger() {
          const p = ctx.getParams();
          if (ctx.isJuiceEnabled()) {
            warpTimer = p.duration;
            ctx.stage.clock.triggerSlowMo(p.timeScale, p.duration);
            ctx.audio.playTimeWarp(true);
            ctx.audio.setBulletTimeMuffle(0.88);
            ctx.stage.punchFov(-55, -8);
            ctx.stage.vignetteIntensity = 0.9;
            ctx.vfx.spawnShockRing(new THREE.Vector3(0, 1.2, 0), 0xa855f7, 5.5, 0.45);
            ctx.vfx.spawnFloatingText(new THREE.Vector3(0, 2.3, 0), 'WITCH TIME 0.14×', {
              color: '#c084fc',
              scale: 1.3,
            });
            ctx.emitCallout('⏳ 魔女时间 WITCH TIME ENGAGED!', 'cyan');
          } else {
            ctx.audio.playFlatBeep(260);
          }
        },
        update(rawDt, scaledDt) {
          orbitAngle += scaledDt * 4.6;
          projectiles.forEach((m, i) => {
            const a = orbitAngle + (i * Math.PI * 2) / projectiles.length;
            m.position.set(Math.cos(a) * 2.2, 1.25 + Math.sin(a * 2) * 0.35, Math.sin(a) * 2.2);
            m.rotation.y = -a;
            m.rotation.x += scaledDt * 8;
          });

          if (warpTimer > 0) {
            warpTimer -= rawDt;
            ctx.stage.vignetteIntensity = Math.max(ctx.stage.vignetteIntensity, 0.65);
            if (warpTimer <= 0) {
              ctx.audio.setBulletTimeMuffle(0);
              ctx.audio.playTimeWarp(false);
              ctx.stage.fovSpring.target = 0;
            }
          }
          ctx.setHudStat('WORLD CLOCK', `${ctx.stage.clock.timeScale.toFixed(2)}× SPEED`);
        },
        dispose() {
          ctx.audio.setBulletTimeMuffle(0);
        },
      };
    },
    generateCode(p) {
      return `// Synchronized Bullet-Time Clock + WebAudio Lowpass Dive
export function setBulletTime(
  active: boolean,
  masterLowpass: BiquadFilterNode,
  audioCtx: AudioContext
): number {
  const targetCutoff = active ? 680 : 20000; // Deep underwater time-freeze muffle!
  masterLowpass.frequency.setTargetAtTime(targetCutoff, audioCtx.currentTime, 0.035);
  return active ? ${p.timeScale} : 1.0; // Hold for ${p.duration}s
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：实现极限闪避「魔女时间」系统（世界时间平滑降速至 0.14x 持续 1.05s，相机收窄 FOV 8° 加紫暗角，同时联动 WebAudio 主总线低通滤波器下潜至 680Hz）。',
      en: 'Use gamefeel-3d skill: Implement Witch-Time perfect dodge dilation (smooth 0.14x world timeScale for 1.05s, -8° FOV focus + vignette, synchronized with a 680Hz WebAudio master lowpass sweep).',
    },
  },
  {
    id: 'impact-zoom-punch',
    category: 'camera',
    badge: 'CAM-03',
    title: {
      zh: '暴击瞬推变焦（Zoom-Punch）与荷兰角斜踢',
      en: 'Sub-120ms Crit Zoom-Punch & Dutch-Roll Kick',
    },
    subtitle: {
      zh: '不改相机距离，仅靠毫秒级 FOV 弹簧急缩急放 + Z 轴斜倾 6° 制造拳拳到肉感',
      en: 'Zero camera clipping: sub-120ms FOV impulse + Z-axis Dutch roll sells devastating crits',
    },
    whyItMatters: {
      zh: '在狭窄室内推拉相机极易穿墙；用二阶弹簧瞬间给 FOV 注入负速度冲量并歪斜 6° Roll 角，零穿模就能打出格斗游戏超必杀特写冲击力！',
      en: 'Moving the camera forward clips into walls; an under-damped FOV impulse + Z-roll kick delivers fighting-game super-move punch safely.',
    },
    rawProblem: {
      zh: '暴击跟普攻镜头毫无区别，只把伤害数字字号调大了一点。',
      en: 'Critical hits feel identical to normal hits except for a slightly bigger font size.',
    },
    controlsHint: {
      zh: '[Space / 点击] 触发重拳暴击 Zoom-Punch 与左右交替荷兰角斜踢！',
      en: '[Space / Click] Land Critical Blow — feel FOV Zoom-Punch + alternating Dutch Roll!',
    },
    tags: ['zoom-punch', 'dutch-angle', 'fov', 'crit', 'camera'],
    autoDemoInterval: 0.9,
    params: [
      { key: 'fovVelocity', label: { zh: 'FOV 瞬时速度冲量', en: 'FOV Velocity Kick' }, min: 40, max: 280, step: 10, defaultValue: 165 },
      { key: 'rollDeg', label: { zh: '荷兰角斜踢度数', en: 'Dutch Roll Kick' }, min: 0, max: 22, step: 1, defaultValue: 9, unit: '°' },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 1.95, 4.4), new THREE.Vector3(0, 1.4, 0), 52, true);
      const dummy = createTargetDummy(0xf97316);
      ctx.group.add(dummy.root);

      let side = 1;
      let count = 0;

      return {
        trigger() {
          const p = ctx.getParams();
          side *= -1;
          count++;
          const hitPos = new THREE.Vector3(side * 0.2, 1.55, 0.25);

          if (ctx.isJuiceEnabled()) {
            ctx.audio.playHeavyImpact(1.1);
            ctx.audio.playHeadshotChime(0.85);
            ctx.stage.punchFov(-p.fovVelocity, 0);
            ctx.stage.punchRoll(side * p.rollDeg * 14);
            ctx.stage.addTrauma(0.3, 28, 2.2);
            ctx.stage.clock.triggerHitstop(0.05);
            ctx.vfx.spawnShockRing(hitPos, 0xfb923c, 3.8, 0.24);
            ctx.vfx.spawnSparks(hitPos, { count: 26, color: 0xf97316, speed: 9.5 });
            ctx.vfx.spawnFloatingText(new THREE.Vector3(side * 0.35, 2.25, 0), 'CRIT ×3.0!', {
              color: '#fb923c',
              scale: 1.3,
            });
            dummy.flash(0.1, true);
            dummy.kickVel.z = -side * 6.5;
            dummy.kickVel.x = -4.2;
            ctx.emitCallout(`💥 ZOOM-PUNCH CRIT #${count}`, 'gold');
          } else {
            ctx.audio.playFlatBeep(270);
          }
          ctx.setHudStat('FOV / ROLL', `${ctx.camera.fov.toFixed(1)}° · ${(side * p.rollDeg).toFixed(0)}°`);
        },
        update(_rawDt, scaledDt) {
          dummy.update(scaledDt);
        },
      };
    },
    generateCode(p) {
      return `// Zero-Clipping Crit Zoom-Punch & Dutch Roll Spring
export class ZoomPunchRig {
  private fovOff = 0; private fovVel = 0;
  private rollOff = 0; private rollVel = 0;

  triggerCrit(hitSide: -1 | 1): void {
    this.fovVel -= ${p.fovVelocity}; // Rapid snap-in then spring overshoot!
    this.rollVel += THREE.MathUtils.degToRad(hitSide * ${p.rollDeg} * 14);
  }

  update(camera: THREE.PerspectiveCamera, baseFov: number, dt: number): void {
    this.fovVel = (this.fovVel - this.fovOff * 210 * dt) * Math.exp(-17 * dt);
    this.fovOff += this.fovVel * dt;
    this.rollVel = (this.rollVel - this.rollOff * 190 * dt) * Math.exp(-15 * dt);
    this.rollOff += this.rollVel * dt;
    camera.fov = baseFov + this.fovOff;
    camera.rotation.z += this.rollOff;
    camera.updateProjectionMatrix();
  }
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：为暴击命中添加零穿模的二阶弹簧 Zoom-Punch（FOV 速度冲量 -165）与左右交替 Z 轴荷兰角斜踢（9°），配合 50ms 顿帧强化重击力量感。',
      en: 'Use gamefeel-3d skill: Add a zero-clipping 2nd-order spring FOV Zoom-Punch (-165 deg/s impulse) and alternating 9° Z-axis Dutch-roll kick on critical hits.',
    },
  },
  {
    id: 'spring-follow-lookahead',
    category: 'camera',
    badge: 'CAM-04',
    title: {
      zh: '帧率无关指数阻尼跟随与速度前瞻（Lookahead）',
      en: 'Frame-Rate Independent Damp Follow & Velocity Lookahead',
    },
    subtitle: {
      zh: '镜头不盯死角色后脑勺，而是向冲刺前方预判偏移，且在 60Hz/144Hz 手感完全一致',
      en: 'Camera leads movement direction so players see threats ahead, invariant across 60Hz & 144Hz',
    },
    whyItMatters: {
      zh: '直接写 `lerp(pos, target, 0.1)` 在 144Hz 屏幕会比 60Hz 快一倍以上！且没有速度前瞻（Lookahead）会导致角色冲刺时视野里全是身后空地。',
      en: 'Raw lerp(a, b, 0.1) breaks at 144Hz, and locking lookAt behind a dashing player blinds them to obstacles ahead.',
    },
    rawProblem: {
      zh: '死死把相机作为角色子物体挂载，转向生硬眩晕；或者用固定系数 lerp 导致高刷屏手感异常。',
      en: 'Parenting camera directly to the player feels robotic, while fixed-factor lerp breaks across refresh rates.',
    },
    controlsHint: {
      zh: '[Space / 点击] 左右高速闪现冲刺，对比开启/关闭前瞻阻尼镜头的视野差异！',
      en: '[Space / Click] Dash Left/Right — toggle Raw vs GameFeel to see Lookahead framing!',
    },
    tags: ['camera-follow', 'damp', 'lookahead', '144hz', 'camera'],
    autoDemoInterval: 1.35,
    params: [
      { key: 'lookahead', label: { zh: '速度前瞻偏移量', en: 'Lookahead Lead' }, min: 0, max: 3.5, step: 0.1, defaultValue: 1.65, unit: 'm' },
      { key: 'lambda', label: { zh: '阻尼平滑速率 λ', en: 'Damp Lambda' }, min: 2, max: 24, step: 1, defaultValue: 8 },
    ],
    mount(ctx) {
      const hero = createSamuraiFighter(0x06b6d4, 1);
      ctx.group.add(hero.root);

      let targetX = -1.8;
      let heroX = -1.8;
      let dir = 1;
      const camPos = new THREE.Vector3(0, 2.7, 6.2);
      const lookPos = new THREE.Vector3(0, 1.2, 0);

      return {
        trigger() {
          dir *= -1;
          targetX = dir * 2.1;
          if (ctx.isJuiceEnabled()) {
            ctx.audio.playBladeSlash(false, false);
            ctx.vfx.spawnSparks(new THREE.Vector3(heroX, 0.8, 0), { count: 16, color: 0x22d3ee, speed: 6 });
            ctx.emitCallout(dir > 0 ? '➡ 冲刺 + 右侧视野前瞻' : '⬅ 冲刺 + 左侧视野前瞻', 'cyan');
          } else {
            ctx.audio.playFlatBeep(300);
          }
        },
        update(rawDt) {
          const p = ctx.getParams();
          const juice = ctx.isJuiceEnabled();
          const prevX = heroX;
          heroX += (targetX - heroX) * (1 - Math.exp(-14 * rawDt));
          const vx = (heroX - prevX) / Math.max(0.001, rawDt);

          hero.root.position.x = heroX;
          hero.root.rotation.z = juice ? THREE.MathUtils.clamp(-vx * 0.03, -0.28, 0.28) : 0;

          if (juice) {
            const lead = THREE.MathUtils.clamp(vx * 0.14, -1, 1) * p.lookahead + Math.sign(targetX) * p.lookahead * 0.55;
            dampVec3(camPos, new THREE.Vector3(heroX * 0.55 + lead * 0.45, 2.7, 6.2), p.lambda, rawDt);
            dampVec3(lookPos, new THREE.Vector3(heroX + lead, 1.2, 0), p.lambda * 1.25, rawDt);
            ctx.stage.setCameraPose(camPos, lookPos, 52, true);
          } else {
            // Rigid robotic lock directly on character center
            ctx.stage.setCameraPose(new THREE.Vector3(heroX, 2.7, 6.2), new THREE.Vector3(heroX, 1.2, 0), 52, true);
          }
          ctx.setHudStat('HERO X / LEAD', `${heroX.toFixed(2)}m · λ=${p.lambda}`);
        },
      };
    },
    generateCode(p) {
      return `// Frame-Rate Independent Exponential Damp + Velocity Lookahead
export function updateFollowCamera(
  camPos: THREE.Vector3,
  lookAt: THREE.Vector3,
  playerPos: THREE.Vector3,
  playerVel: THREE.Vector3,
  dt: number
): void {
  const t = 1 - Math.exp(-${p.lambda} * dt); // Identical feel on 60Hz, 120Hz, 240Hz!
  const lead = playerVel.clone().setY(0).clampLength(0, 10).multiplyScalar(${(p.lookahead / 10).toFixed(2)});
  const desiredCam = playerPos.clone().add(new THREE.Vector3(0, 2.7, 6.2)).addScaledVector(lead, 0.45);
  const desiredLook = playerPos.clone().add(new THREE.Vector3(0, 1.2, 0)).add(lead);
  camPos.lerp(desiredCam, t);
  lookAt.lerp(desiredLook, 1 - Math.exp(-${(p.lambda * 1.25).toFixed(1)} * dt));
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：重写第三人称跟随相机，采用帧率无关指数阻尼 `1 - Math.exp(-8 * dt)` 与 1.65m 速度方向前瞻偏移（Lookahead），确保 60Hz 与 144Hz 手感一致且冲刺视野开阔。',
      en: 'Use gamefeel-3d skill: Upgrade my 3rd-person follow camera to use frame-rate independent exponential damping (1 - Math.exp(-8 * dt)) with 1.65m velocity lookahead.',
    },
  },
];
