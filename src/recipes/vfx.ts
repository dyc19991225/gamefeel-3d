import * as THREE from 'three';
import type { RecipeDefinition } from '../core/types';
import { createTargetDummy, createWeaponRig } from './helpers';

export const vfxRecipes: RecipeDefinition[] = [
  {
    id: 'shockwave-refraction-ring',
    category: 'vfx',
    badge: 'VFX-01',
    title: {
      zh: 'GLSL 菲涅尔爆破气浪穹顶与双层地面冲击环',
      en: 'GLSL Fresnel Blast Dome & Dual Ground Shockwave',
    },
    subtitle: {
      zh: '零贴图高爆手雷：边缘高光菲涅尔膨胀球 + 地面高速气浪环 + 旋转碎石飞溅',
      en: 'Zero-texture HE detonation: additive Fresnel blast sphere, ground shock ring & tumbling shrapnel',
    },
    whyItMatters: {
      zh: '没有贴图也能做出震撼爆炸！利用视角法线点积（Fresnel `pow(1 - dot(N,V), 2.4)`）渲染膨胀火球边缘，比单调半透明球体高级十倍。',
      en: 'Fresnel rim-glow domes + fast ground rings + tumbling debris beat blurry sprite sheets without needing a single PNG.',
    },
    rawProblem: {
      zh: 'AI 写的爆炸通常只是一个变大后消失的橙色普通 Sphere，像吹气球一样假。',
      en: 'AI-coded explosions usually scale up an opaque orange SphereGeometry that looks like an inflating balloon.',
    },
    controlsHint: {
      zh: '[Space / 点击] 引爆零贴图 GLSL 菲涅尔高爆冲击波！',
      en: '[Space / Click] Detonate Zero-Texture GLSL Fresnel Shockwave!',
    },
    tags: ['explosion', 'fresnel', 'glsl', 'shockwave', 'vfx'],
    autoDemoInterval: 1.35,
    params: [
      { key: 'blastRadius', label: { zh: '气浪最大半径', en: 'Blast Radius' }, min: 1.5, max: 6.0, step: 0.25, defaultValue: 3.6, unit: 'm' },
      { key: 'shrapnel', label: { zh: '破片飞溅数量', en: 'Shrapnel Count' }, min: 10, max: 60, step: 2, defaultValue: 34 },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 2.7, 6.2), new THREE.Vector3(0, 1.0, 0), 52, true);

      const domeMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uProgress: { value: 1 },
          uCore: { value: new THREE.Color(0xfff3b0) },
          uRim: { value: new THREE.Color(0xff4d1a) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vNormalW;
          varying vec3 vViewDir;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vNormalW = normalize(mat3(modelMatrix) * normal);
            vViewDir = normalize(cameraPosition - wp.xyz);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uProgress;
          uniform vec3 uCore;
          uniform vec3 uRim;
          varying vec3 vNormalW;
          varying vec3 vViewDir;
          void main() {
            float fresnel = pow(1.0 - abs(dot(vNormalW, vViewDir)), 2.2);
            vec3 col = mix(uCore, uRim, fresnel);
            float alpha = (0.25 + fresnel * 0.95) * pow(max(0.0, 1.0 - uProgress), 1.5);
            gl_FragColor = vec4(col * 1.4, alpha);
          }
        `,
      });

      const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), domeMat);
      dome.position.y = 0.75;
      dome.visible = false;
      ctx.group.add(dome);

      let progress = 1;

      return {
        trigger() {
          const p = ctx.getParams();
          progress = 0;
          dome.visible = true;
          const center = new THREE.Vector3(0, 0.65, 0);

          if (ctx.isJuiceEnabled()) {
            ctx.audio.playExplosion(1.0);
            ctx.stage.addTrauma(0.62, 26, 1.65);
            ctx.stage.punchFov(32);
            ctx.vfx.spawnShockRing(new THREE.Vector3(0, 0.05, 0), 0xff8c24, p.blastRadius * 1.6, 0.38, true);
            ctx.vfx.spawnShockRing(center, 0xffe066, p.blastRadius * 1.2, 0.28, false);
            ctx.vfx.spawnSparks(center, {
              count: p.shrapnel,
              color: 0xff6b1a,
              coreColor: 0xfff7cc,
              speed: 11.5,
              flashIntensity: 22,
            });
            ctx.emitCallout('💥 FRESNEL BLAST DETONATION!', 'gold');
          } else {
            ctx.audio.playFlatBeep(160);
          }
        },
        update(rawDt) {
          const p = ctx.getParams();
          if (progress < 1) {
            progress = Math.min(1, progress + rawDt * 2.4);
            domeMat.uniforms.uProgress.value = progress;
            const s = 0.25 + Math.pow(progress, 0.55) * p.blastRadius;
            dome.scale.setScalar(s);
            if (progress >= 1) dome.visible = false;
          }
          ctx.setHudStat('BLAST WAVE', progress < 1 ? `${(progress * 100).toFixed(0)}% EXPANDING` : 'READY');
        },
        dispose() {
          dome.geometry.dispose();
          domeMat.dispose();
        },
      };
    },
    generateCode(p) {
      return `// Zero-Texture GLSL Fresnel Blast Dome Fragment Shader (Max Radius: ${p.blastRadius}m)
const blastFrag = /* glsl */ \`
  uniform float uProgress;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    float fresnel = pow(1.0 - abs(dot(vNormalW, vViewDir)), 2.2);
    vec3 col = mix(vec3(1.0, 0.95, 0.69), vec3(1.0, 0.30, 0.10), fresnel);
    float alpha = (0.25 + fresnel * 0.95) * pow(max(0.0, 1.0 - uProgress), 1.5);
    gl_FragColor = vec4(col * 1.4, alpha);
  }
\`;`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：创建零贴图高爆冲击波特效（基于 Fresnel 边缘发光的加色膨胀穹顶 Shader + 地面水平高速气浪环 + 34 颗重力抛射火星与低频爆炸合成音）。',
      en: 'Use gamefeel-3d skill: Create a zero-texture explosion effect using an additive GLSL Fresnel blast dome, horizontal ground shockwave ring, 34 shrapnel sparks, and sub-bass explosion synth.',
    },
  },
  {
    id: 'muzzle-tracer-casing',
    category: 'vfx',
    badge: 'VFX-02',
    title: {
      zh: '交叉星芒枪口焰、高速曳光弹与旋转黄铜弹壳',
      en: '3-Plane Star Muzzle Flash, Tracer & Spinning Brass',
    },
    subtitle: {
      zh: '仅存在 45ms 的随机旋转三平面星芒 + 瞬时亮黄弹道线 + 抛物线翻滚弹壳',
      en: '45ms randomized 3-plane additive star flash + fading ballistic tracer + tumbling brass shells',
    },
    whyItMatters: {
      zh: '枪口火光超过 60ms 就会像塑料纸片挂在枪管上；控制在 2~3 帧（45ms）并每次随机旋转 Z 角，配合右侧抛出的旋转黄铜弹壳，机械质感瞬间拉满！',
      en: 'Muzzle flashes lasting >60ms look like cardboard cutouts; 45ms randomized 3-plane stars + tumbling brass shells sell real ballistics.',
    },
    rawProblem: {
      zh: '要么完全没枪口焰和弹壳，要么挂一个静止不动的小黄球在枪口。',
      en: 'Weapons either have zero ballistic VFX or show a static yellow sphere stuck to the barrel.',
    },
    controlsHint: {
      zh: '[Space / 点击] 高速机枪点射，观察三平面星芒火光与右侧连续抛壳！',
      en: '[Space / Click] Rapid Burst — watch 45ms randomized star flash & brass shell stream!',
    },
    tags: ['muzzle-flash', 'tracer', 'shells', 'ballistics', 'vfx'],
    autoDemoInterval: 0.19,
    params: [
      { key: 'flashMs', label: { zh: '枪口焰留存帧时', en: 'Flash Duration' }, min: 20, max: 120, step: 5, defaultValue: 45, unit: 'ms' },
      { key: 'flashScale', label: { zh: '星芒火光尺寸', en: 'Star Flash Scale' }, min: 0.6, max: 2.4, step: 0.1, defaultValue: 1.35 },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(1.85, 1.75, 2.65), new THREE.Vector3(0, 1.35, -1.2), 48, true);
      const gun = createWeaponRig(false);
      gun.root.position.set(0, 1.35, 0.8);
      ctx.group.add(gun.root);

      let flashTimer = 0;
      let kickZ = 0;
      let rounds = 0;

      return {
        trigger() {
          const p = ctx.getParams();
          rounds++;
          const mPos = new THREE.Vector3();
          const ePos = new THREE.Vector3();
          gun.muzzle.getWorldPosition(mPos);
          gun.ejectPort.getWorldPosition(ePos);
          const endPos = new THREE.Vector3((Math.random() - 0.5) * 0.7, 1.35 + (Math.random() - 0.5) * 0.5, -8);

          if (ctx.isJuiceEnabled()) {
            flashTimer = p.flashMs / 1000;
            gun.flashMesh.visible = true;
            gun.flashMesh.rotation.z = Math.random() * Math.PI * 2;
            gun.flashMesh.scale.setScalar(p.flashScale * (0.85 + Math.random() * 0.35));
            kickZ = 0.09;

            ctx.audio.playGunshot('rifle', 0.85);
            ctx.vfx.spawnTracer(mPos, endPos, 0xffe484, 0.075);
            ctx.vfx.spawnShellCasing(ePos, new THREE.Vector3(1, 0.2, 0.15));
            ctx.vfx.spawnSparks(mPos, { count: 6, color: 0xffcf56, speed: 6, life: 0.12, flashIntensity: 8 });
            ctx.stage.addTrauma(0.16, 32, 2.8);
          } else {
            ctx.audio.playFlatBeep(330);
          }
          ctx.setHudStat('ROUNDS FIRED', `${rounds} RDS · ${p.flashMs}ms FLASH`);
        },
        update(rawDt) {
          if (flashTimer > 0) {
            flashTimer -= rawDt;
            if (flashTimer <= 0) gun.flashMesh.visible = false;
          }
          kickZ *= Math.exp(-22 * rawDt);
          gun.root.position.z = 0.8 + kickZ;
        },
      };
    },
    generateCode(p) {
      return `// 3-Plane Crossed Additive Muzzle Flash (${p.flashMs}ms randomized Z-spin)
export function createMuzzleStar(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffdf72, transparent: true, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, depthWrite: false,
  });
  for (let i = 0; i < 3; i++) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.38 * ${p.flashScale}, 0.12 * ${p.flashScale}), mat);
    plane.rotation.z = (i * Math.PI) / 3;
    g.add(plane);
  }
  return g; // Show for ${(p.flashMs / 1000).toFixed(3)}s & randomize g.rotation.z every shot!
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：为枪械补齐零贴图弹道视觉三件套（仅显示 45ms 且每发随机旋转角度的三平面加色星芒枪口焰、75ms 渐隐曳光弹线，以及右侧重力翻滚黄铜弹壳）。',
      en: 'Use gamefeel-3d skill: Add zero-texture ballistic VFX: a 45ms Z-randomized 3-plane additive star muzzle flash, 75ms fading tracer line, and spinning brass shell ejection.',
    },
  },
  {
    id: 'damage-pop-numbers',
    category: 'vfx',
    badge: 'VFX-03',
    title: {
      zh: '抛物线弹跳伤害跳字与暴击字号阶梯',
      en: 'Parabolic Bounce Damage Numbers & Crit Tiering',
    },
    subtitle: {
      zh: 'CanvasTexture 描边高对比数字 + 初速上抛重力回落 + 前 16% 弹性放大 Pop',
      en: 'Crisp stroked CanvasTexture sprites with parabolic arc, 16% scale-pop & crit color tiers',
    },
    whyItMatters: {
      zh: 'RPG 与刷宝射击的爽感一半来自跳字：普通白字轻巧散开，暴击金红大字先放大到 1.35x 再回弹，一眼看清输出爆发！',
      en: 'Half the dopamine in ARPGs and looter-shooters comes from crisp stroked numbers that pop to 1.35x scale and arc outward.',
    },
    rawProblem: {
      zh: 'HTML DOM 叠字跟 3D 深度脱节且卡顿；或者匀速向上飘毫无弹性。',
      en: 'DOM overlays lag behind 3D projection, while linear upward drift feels lifeless compared to parabolic pop.',
    },
    controlsHint: {
      zh: '[Space / 点击] 连续打出普通伤害与高倍暴击跳字瀑布！',
      en: '[Space / Click] Unleash Normal & Super-Crit Floating Damage Cascade!',
    },
    tags: ['damage-numbers', 'rpg', 'canvas-texture', 'crit', 'ui'],
    autoDemoInterval: 0.34,
    params: [
      { key: 'critChance', label: { zh: '暴击触发概率', en: 'Crit Probability' }, min: 0.1, max: 1.0, step: 0.05, defaultValue: 0.45 },
      { key: 'upSpeed', label: { zh: '跳字上抛初速', en: 'Pop Up Velocity' }, min: 1.5, max: 7.0, step: 0.25, defaultValue: 4.1, unit: 'm/s' },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 2.0, 4.8), new THREE.Vector3(0, 1.4, 0), 50, true);
      const dummy = createTargetDummy(0x14b8a6);
      ctx.group.add(dummy.root);

      let totalDmg = 0;

      return {
        trigger() {
          const p = ctx.getParams();
          const isCrit = Math.random() < p.critChance;
          const dmg = isCrit ? Math.floor(220 + Math.random() * 180) : Math.floor(42 + Math.random() * 35);
          totalDmg += dmg;
          const pos = new THREE.Vector3((Math.random() - 0.5) * 0.55, 1.85 + Math.random() * 0.25, 0.25);

          if (ctx.isJuiceEnabled()) {
            if (isCrit) {
              ctx.audio.playHeadshotChime(1.1);
              ctx.stage.addTrauma(0.24, 28, 2.4);
              ctx.vfx.spawnSparks(pos, { count: 16, color: 0xfacc15, speed: 7.5 });
            } else {
              ctx.audio.playWallImpact('wood', false);
            }
            ctx.vfx.spawnFloatingText(pos, isCrit ? `★ ${dmg}!` : `${dmg}`, {
              color: isCrit ? '#fde047' : '#f8fafc',
              stroke: isCrit ? '#991b1b' : '#0f172a',
              scale: isCrit ? 1.38 : 0.88,
              upSpeed: p.upSpeed * (isCrit ? 1.18 : 0.92),
              gravity: 8.8,
            });
            dummy.flash(0.07, isCrit);
            dummy.kickVel.x = isCrit ? -4.2 : -1.6;
          } else {
            ctx.audio.playFlatBeep(300);
          }
          ctx.setHudStat('DPS / LAST HIT', `${totalDmg} TOTAL · ${isCrit ? 'CRIT!' : 'HIT'}`);
        },
        update(_rawDt, scaledDt) {
          dummy.update(scaledDt);
        },
      };
    },
    generateCode(p) {
      return `// Parabolic Pop-Scale Curve for 3D Floating Damage Sprites
export function evaluateDamagePop(age: number, maxLife = 0.72): { scale: number; alpha: number } {
  const t = Math.min(1, age / maxLife);
  // First 16%: elastic snap from 0.65x -> 1.25x, then settle!
  const scale = t < 0.16 ? 0.65 + (t / 0.16) * 0.6 : 1.25 - t * 0.25;
  const alpha = t > 0.65 ? Math.max(0, 1 - (t - 0.65) / 0.35) : 1.0;
  return { scale, alpha }; // Initial vy = ${p.upSpeed} m/s, critRate = ${p.critChance}
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：添加零外部字体依赖的 CanvasTexture 3D 伤害跳字系统（粗黑描边防背景糊字、前 16% 生命周期弹性放大至 1.38x、重力抛物线散开，区分白字普攻与金红暴击）。',
      en: 'Use gamefeel-3d skill: Add zero-font CanvasTexture 3D floating damage numbers with thick dark outlines, 16% elastic scale pop, parabolic gravity arc, and normal vs gold-crit tiers.',
    },
  },
  {
    id: 'hit-flash-rim-shader',
    category: 'vfx',
    badge: 'VFX-04',
    title: {
      zh: '街机两帧纯白受击闪白与弹性受击摆锤',
      en: '2-Frame Arcade White Hit-Flash & Knockback Wobble',
    },
    subtitle: {
      zh: '受击前 55ms 强制纯白自发光 -> 35ms 余烬暗红 -> 二阶弹簧不倒翁回弹',
      en: '55ms pure-white emissive override -> 35ms crimson afterglow -> spring wobble recovery',
    },
    whyItMatters: {
      zh: '从《街霸》到《哈迪斯》，几乎所有顶级动作游戏受击瞬间都会让怪物闪白 2~3 帧——这是人类视觉皮层最快确认「我打中了」的底层信号！',
      en: 'From Street Fighter to Hades, a 2-to-3 frame pure-white emissive flash is the fastest visual hit-confirmation signal in gaming.',
    },
    rawProblem: {
      zh: '怪物挨打只扣头顶血条，模型材质颜色与姿态毫无反应，像在砍静态雕塑。',
      en: 'Enemies only decrement an HP bar while their mesh stays completely unreactive like a stone statue.',
    },
    controlsHint: {
      zh: '[Space / 点击] 打击测试靶，对比开启/关闭「55ms 纯白闪白 + 弹簧受击摆动」！',
      en: '[Space / Click] Strike Target — toggle Raw vs GameFeel to see 2-frame white flash + wobble!',
    },
    tags: ['hit-flash', 'emissive', 'wobble', 'hades', 'vfx'],
    autoDemoInterval: 0.65,
    params: [
      { key: 'whiteMs', label: { zh: '纯白闪光时长', en: 'White Flash Time' }, min: 20, max: 140, step: 5, defaultValue: 60, unit: 'ms' },
      { key: 'wobbleKick', label: { zh: '受击摆锤冲量', en: 'Wobble Impulse' }, min: 1, max: 12, step: 0.5, defaultValue: 6.5 },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 2.0, 4.3), new THREE.Vector3(0, 1.35, 0), 50, true);
      const dummy = createTargetDummy(0x3b82f6);
      ctx.group.add(dummy.root);

      let hits = 0;

      return {
        trigger() {
          const p = ctx.getParams();
          hits++;
          if (ctx.isJuiceEnabled()) {
            dummy.flash((p.whiteMs + 35) / 1000, false);
            dummy.kickVel.x = -p.wobbleKick;
            dummy.kickVel.z = (hits % 2 === 0 ? 1 : -1) * p.wobbleKick * 0.55;
            ctx.audio.playHeavyImpact(0.8);
            ctx.stage.addTrauma(0.22, 28, 2.5);
            ctx.vfx.spawnSparks(new THREE.Vector3(0, 1.4, 0.25), { count: 16, color: 0x60a5fa, speed: 7.5 });
            ctx.emitCallout(`⚡ ${p.whiteMs}ms WHITE HIT-FLASH!`, 'cyan');
          } else {
            ctx.audio.playFlatBeep(240);
          }
          ctx.setHudStat('HIT FLASH', `${p.whiteMs}ms WHITE -> 35ms RED`);
        },
        update(_rawDt, scaledDt) {
          dummy.update(scaledDt);
        },
      };
    },
    generateCode(p) {
      return `// 2-Stage Emissive Hit-Flash (${p.whiteMs}ms Pure White -> 35ms Crimson Ember)
export function updateHitFlash(mat: THREE.MeshStandardMaterial, remainingSec: number): void {
  if (remainingSec <= 0) {
    mat.emissiveIntensity = 0;
  } else if (remainingSec > 0.035) {
    mat.emissive.setHex(0xffffff);
    mat.emissiveIntensity = 1.25;
  } else {
    mat.emissive.setHex(0xff2a44);
    mat.emissiveIntensity = 0.6;
  }
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：给所有受击敌人材质加上两段式受击闪白（前 60ms 纯白高强度自发光 -> 后 35ms 暗红余晖）以及受击方向二阶弹簧摇晃回正。',
      en: 'Use gamefeel-3d skill: Add a 2-stage arcade hit-flash (60ms pure-white emissive override followed by 35ms crimson afterglow) and directional spring wobble to hit enemies.',
    },
  },
];
