import * as THREE from 'three';
import { RibbonTrail } from '../core/vfxForge';
import { damp } from '../core/math';
import type { RecipeDefinition } from '../core/types';
import { createSamuraiFighter, createTargetDummy } from './helpers';

export const meleeRecipes: RecipeDefinition[] = [
  {
    id: 'perfect-deflect-sparks',
    category: 'melee',
    badge: 'ACT-01',
    title: {
      zh: '玉钢完美弹反火星与五泛音刀鸣',
      en: 'Tamahagane Perfect Deflect Sparks & 5-Partial Ring',
    },
    subtitle: {
      zh: '只狼核心「铛！！」：34 颗切向高光火星 + 点光源爆闪 + 连弹升调刀鸣',
      en: '34 additive tangent sparks, point-light flash, shockwave ring & pitch-climbing steel harmonics',
    },
    whyItMatters: {
      zh: '冷兵器拼刀之所以让人头皮发麻，靠的是完美帧与普通格挡的剧烈反差：高亮橙金火星 + 高频泛音刀鸣 + 65ms 顿帧。',
      en: 'Sword-clash euphoria comes from extreme contrast between dull guard blocks and blinding orange-gold perfect deflects.',
    },
    rawProblem: {
      zh: '普通动作游戏格挡只播放同一个闷响且无光源爆闪，连续弹反毫无节奏高潮。',
      en: 'Generic melee blocks play a static dull clank with zero point-light burst or combo harmonic progression.',
    },
    controlsHint: {
      zh: '[Space / 点击] 完美弹反（连按体验苇名连斩升调） · [Q / 副动作] 普通闷响格挡对比',
      en: '[Space / Click] Perfect Deflect ("CLANG!") · [Q / Secondary] Dull Guard Block Compare',
    },
    hasSecondary: { zh: '普通格挡对比', en: 'Normal Block Compare' },
    tags: ['sekiro', 'deflect', 'parry', 'sparks', 'melee'],
    autoDemoInterval: 0.42,
    params: [
      { key: 'sparkCount', label: { zh: '完美火星数量', en: 'Deflect Sparks' }, min: 10, max: 60, step: 2, defaultValue: 34 },
      { key: 'hitstopMs', label: { zh: '弹反顿帧时长', en: 'Deflect Hitstop' }, min: 0, max: 120, step: 5, defaultValue: 65, unit: 'ms' },
      { key: 'harmonicPitch', label: { zh: '玉钢基频倍率', en: 'Steel Pitch Scale' }, min: 0.75, max: 1.4, step: 0.05, defaultValue: 1.0 },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(2.8, 2.05, 3.6), new THREE.Vector3(0, 1.35, 0), 48, true);
      const wolf = createSamuraiFighter(0xd97706, 1);
      wolf.root.position.set(0, 0, 1.05);
      wolf.root.rotation.y = Math.PI;
      ctx.group.add(wolf.root);

      const boss = createSamuraiFighter(0x3b82f6, 1);
      boss.root.position.set(0, 0, -1.05);
      ctx.group.add(boss.root);

      const trail = new RibbonTrail(ctx.group, 24);
      trail.setPalette(0xfff4dc, 0x60a5fa, 0.9);

      let combo = 0;
      let swingTimer = 0;
      const basePos = new THREE.Vector3();
      const tipPos = new THREE.Vector3();

      const executeClash = (perfect: boolean) => {
        const p = ctx.getParams();
        const clashPos = new THREE.Vector3((Math.random() - 0.5) * 0.28, 1.42, 0);
        swingTimer = 0.18;
        const side = combo % 2 === 0 ? 1 : -1;
        boss.swordPivot.rotation.set(0.95, 0, 0.65 * side);
        wolf.swordPivot.rotation.set(0.75, 0, -0.55 * side);
        combo++;

        if (ctx.isJuiceEnabled()) {
          ctx.audio.playKatanaDeflect(perfect, combo, p.harmonicPitch);
          ctx.vfx.spawnSparks(clashPos, {
            count: perfect ? p.sparkCount : 10,
            color: perfect ? 0xffae34 : 0x93c5fd,
            coreColor: 0xffffff,
            speed: perfect ? 10.5 : 4.8,
            flashIntensity: perfect ? 16 : 4,
          });
          if (perfect) {
            ctx.vfx.spawnShockRing(clashPos, 0xffbe44, 3.4, 0.2);
            ctx.stage.clock.triggerHitstop(p.hitstopMs / 1000);
            ctx.stage.addTrauma(0.38, 32, 2.3);
            ctx.stage.punchFov(16);
            ctx.stage.punchRoll(side * 4.5);
            ctx.emitCallout(`⚔️ 完美弹反 PERFECT DEFLECT ×${combo}`, 'gold');
          } else {
            ctx.stage.addTrauma(0.14, 22, 2.5);
            ctx.emitCallout('🛡️ 普通格挡 GUARD BLOCK', 'cyan');
          }
        } else {
          ctx.audio.playFlatBeep(perfect ? 420 : 240);
        }
        ctx.setHudStat('CLASH COMBO', `${perfect ? 'PERFECT' : 'GUARD'} #${combo}`);
      };

      return {
        trigger: () => executeClash(true),
        secondary: () => executeClash(false),
        update(_rawDt, scaledDt, elapsed) {
          if (swingTimer > 0) {
            swingTimer -= scaledDt;
            trail.setActive(ctx.isJuiceEnabled());
          } else {
            trail.setActive(false);
            boss.swordPivot.rotation.x = damp(boss.swordPivot.rotation.x, 0.25, 10, scaledDt);
            boss.swordPivot.rotation.z = damp(boss.swordPivot.rotation.z, -0.35, 10, scaledDt);
            wolf.swordPivot.rotation.x = damp(wolf.swordPivot.rotation.x, 0.3, 10, scaledDt);
            wolf.swordPivot.rotation.z = damp(wolf.swordPivot.rotation.z, 0.35, 10, scaledDt);
          }
          boss.bladeBase.getWorldPosition(basePos);
          boss.bladeTip.getWorldPosition(tipPos);
          trail.update(basePos, tipPos, scaledDt, elapsed);
        },
        dispose() {
          trail.dispose();
        },
      };
    },
    generateCode(p) {
      return `// Sekiro Tamahagane 5-Partial Katana Deflect Synth + Hitstop
export function playPerfectDeflect(ctx: AudioContext, comboIndex = 0): void {
  const now = ctx.currentTime;
  const semi = Math.pow(2, ((comboIndex % 7) * 0.65) / 12) * ${p.harmonicPitch};
  const partials = [1185, 1890, 2740, 4120, 5680];
  const decays = [0.36, 0.44, 0.28, 0.22, 0.15];
  partials.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = i % 2 === 0 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(f * semi * 1.03, now);
    osc.frequency.exponentialRampToValueAtTime(f * semi, now + 0.025);
    g.gain.setValueAtTime(0.38 / (i * 0.45 + 1), now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + decays[i]);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + decays[i] + 0.02);
  });
  // Pair with ${p.sparkCount} additive sparks + ${p.hitstopMs}ms hitstop!
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：给我的近战格斗添加只狼式完美弹反手感（五泛音玉钢刀鸣随连击半音递增、34 颗加色橙金火花 + 瞬时点光源爆闪、扩散冲击环与 65ms 顿帧）。',
      en: 'Use gamefeel-3d skill: Add Sekiro-style perfect deflect feel with 5-partial Tamahagane steel harmonics (pitch-climbing on combos), 34 additive sparks, point-light flash, shockwave ring, and 65ms hitstop.',
    },
  },
  {
    id: 'hitstop-freeze-shake',
    category: 'melee',
    badge: 'ACT-02',
    title: {
      zh: '非对称顿帧（Hitstop）与受击微震挤压',
      en: 'Asymmetric Hitstop Freeze & Target Micro-Jitter',
    },
    subtitle: {
      zh: '樱井政博核心法则：角色动作定格 90ms，但受击者高频横颤且粒子与镜头不冻结',
      en: 'Sakurai rule: freeze limb animation on contact while victim vibrates and particles keep flying',
    },
    whyItMatters: {
      zh: '重击之所以有「砸进肉里」的吨位感，秘诀在于接触瞬间冻结攻击者与受击者骨骼，同时让受击者高频左右微抖 4 帧，结束瞬间再喷射击退！',
      en: 'Heavy cleave weight comes from freezing skeletal motion at impact while vibrating the victim horizontally before releasing knockback.',
    },
    rawProblem: {
      zh: '新手要么完全不加顿帧（刀像切空气），要么把整个 requestAnimationFrame 卡死导致画面像掉帧卡顿。',
      en: 'Beginners either skip hitstop (slicing air) or freeze the entire render loop (feeling like frame-drop lag).',
    },
    controlsHint: {
      zh: '[Space / 点击] 挥出重劈斩击，观察接触瞬间的顿帧蓄力与击飞释放',
      en: '[Space / Click] Heavy Cleave — watch contact freeze + victim jitter before knockback release',
    },
    tags: ['hitstop', 'sakurai', 'knockback', 'squash', 'melee'],
    autoDemoInterval: 1.25,
    params: [
      { key: 'freezeMs', label: { zh: '接触顿帧时长', en: 'Hitstop Freeze' }, min: 0, max: 200, step: 10, defaultValue: 95, unit: 'ms' },
      { key: 'victimJitter', label: { zh: '顿帧期受击振幅', en: 'Freeze Vibration' }, min: 0, max: 0.25, step: 0.01, defaultValue: 0.11, unit: 'm' },
      { key: 'knockback', label: { zh: '出帧击退冲量', en: 'Knockback Impulse' }, min: 2, max: 14, step: 0.5, defaultValue: 8.5 },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 2.2, 5.2), new THREE.Vector3(0, 1.25, 0), 50, true);
      const attacker = createSamuraiFighter(0xf43f5e, 1);
      attacker.root.position.set(-1.15, 0, 0);
      attacker.root.rotation.y = Math.PI / 2;
      ctx.group.add(attacker.root);

      const dummy = createTargetDummy(0x6366f1);
      dummy.root.position.set(0.85, 0, 0);
      ctx.group.add(dummy.root);

      let state: 'idle' | 'windup' | 'cleave' | 'hitfreeze' | 'follow' = 'idle';
      let timer = 0;
      let dummyVelX = 0;
      const baseDummyX = 0.85;

      return {
        trigger() {
          state = 'windup';
          timer = 0.18;
          if (ctx.isJuiceEnabled()) ctx.audio.playBladeSlash(true, false);
        },
        update(rawDt, scaledDt) {
          const p = ctx.getParams();
          const juice = ctx.isJuiceEnabled();

          if (state === 'windup') {
            timer -= rawDt;
            attacker.swordPivot.rotation.x = damp(attacker.swordPivot.rotation.x, -1.1, 18, rawDt);
            if (timer <= 0) {
              state = 'cleave';
              timer = 0.07;
            }
          } else if (state === 'cleave') {
            timer -= rawDt;
            attacker.swordPivot.rotation.x = damp(attacker.swordPivot.rotation.x, 1.25, 42, rawDt);
            if (timer <= 0) {
              const hitPos = new THREE.Vector3(baseDummyX - 0.25, 1.45, 0);
              if (juice && p.freezeMs > 0) {
                state = 'hitfreeze';
                timer = p.freezeMs / 1000;
                ctx.stage.clock.triggerHitstop(timer);
                ctx.audio.playHeavyImpact(1.25);
                ctx.stage.addTrauma(0.46, 30, 2.0);
                ctx.stage.punchFov(22);
                dummy.flash(timer + 0.06, false);
                ctx.vfx.spawnSparks(hitPos, { count: 28, color: 0xf43f5e, coreColor: 0xffffff, speed: 10 });
                ctx.vfx.spawnShockRing(hitPos, 0xfb7185, 3.6, 0.24);
                ctx.emitCallout(`🛑 ${p.freezeMs}ms ASYMMETRIC HITSTOP!`, 'crimson');
              } else {
                if (!juice) ctx.audio.playFlatBeep(200);
                dummyVelX = juice ? p.knockback : 2.0;
                state = 'follow';
                timer = 0.35;
              }
            }
          } else if (state === 'hitfreeze') {
            // Attacker stays frozen in contact pose, while victim vibrates on rawDt!
            timer -= rawDt;
            dummy.root.position.x = baseDummyX + Math.sin(timer * 190) * p.victimJitter;
            dummy.root.scale.set(0.86, 1.14, 1.08); // Squash on contact
            if (timer <= 0) {
              dummy.root.scale.set(1.15, 0.88, 1);
              dummyVelX = p.knockback;
              ctx.vfx.spawnFloatingText(new THREE.Vector3(baseDummyX + 0.4, 2.25, 0), 'HEAVY 285!', {
                color: '#fb7185',
                scale: 1.2,
              });
              state = 'follow';
              timer = 0.4;
            }
          } else if (state === 'follow') {
            timer -= rawDt;
            attacker.swordPivot.rotation.x = damp(attacker.swordPivot.rotation.x, 1.65, 14, rawDt);
            if (timer <= 0) state = 'idle';
          } else {
            attacker.swordPivot.rotation.x = damp(attacker.swordPivot.rotation.x, 0.15, 9, rawDt);
          }

          if (state !== 'hitfreeze') {
            dummy.root.position.x += dummyVelX * rawDt;
            dummyVelX = (dummyVelX + (baseDummyX - dummy.root.position.x) * 95 * rawDt) * Math.exp(-8.5 * rawDt);
            dummy.root.scale.lerp(new THREE.Vector3(1, 1, 1), 1 - Math.exp(-14 * rawDt));
          }
          dummy.update(scaledDt);
          ctx.setHudStat('STATE / TIMESCALE', `${state.toUpperCase()} · ${ctx.stage.clock.timeScale.toFixed(2)}x`);
        },
      };
    },
    generateCode(p) {
      return `// Asymmetric Hitstop: Freeze animation, vibrate victim, release knockback after freeze!
export class HitstopController {
  private timer = 0;
  private pendingKnockback = 0;

  onHeavyHit(): void {
    this.timer = ${(p.freezeMs / 1000).toFixed(3)};
    this.pendingKnockback = ${p.knockback};
  }

  update(rawDt: number, victim: THREE.Object3D, baseX: number): { animDt: number; releaseVel: number } {
    if (this.timer > 0) {
      this.timer -= rawDt;
      victim.position.x = baseX + Math.sin(this.timer * 190) * ${p.victimJitter};
      if (this.timer <= 0) {
        const out = this.pendingKnockback;
        this.pendingKnockback = 0;
        return { animDt: rawDt, releaseVel: out };
      }
      return { animDt: 0, releaseVel: 0 }; // Freeze skeletal anim, keep VFX/camera running!
    }
    return { animDt: rawDt, releaseVel: 0 };
  }
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：实现樱井政博式非对称顿帧（命中瞬间冻结攻击骨骼 95ms、受击目标以 0.11m 振幅高频抖动挤压、粒子与镜头照常播放，顿帧结束瞬间才释放击飞冲量）。',
      en: 'Use gamefeel-3d skill: Implement Sakurai-style asymmetric hitstop (freeze skeletal animation for 95ms on hit while vibrating victim mesh and keeping VFX/camera ticking on rawDt, then release knockback impulse).',
    },
  },
  {
    id: 'katana-ribbon-trail',
    category: 'melee',
    badge: 'ACT-03',
    title: {
      zh: '子步插值 GLSL 刀光弧带（不死斩/巴之雷/烈火）',
      en: 'Sub-Stepped GLSL Blade Ribbon Trail (5 Elemental Styles)',
    },
    subtitle: {
      zh: '高速挥刀自动补采样防折角 + 刀尖高亮锋刃渐变 Shader',
      en: 'Velocity sub-sampling eliminates polygonal kinks + custom GLSL razor-tip glow',
    },
    whyItMatters: {
      zh: '60Hz 下高速挥刀每帧跨度极大，直接连顶点会变成生硬折线；自动子步插值 + 刀锋 UV 能量流 Shader 才能画出丝滑满月刀弧。',
      en: 'Fast swings at 60fps create ugly jagged polygons unless you sub-step hilt/tip positions and shade razor-tip falloff in GLSL.',
    },
    rawProblem: {
      zh: 'AI 写的刀光常见毛病是放个半透明扇形贴片或折线拖尾，毫无流体光泽。',
      en: 'AI-generated weapon trails usually attach a static semi-transparent ring or jagged un-interpolated line strip.',
    },
    controlsHint: {
      zh: '[Space / 点击] 连续旋风斩 · [Q / 副动作] 切换刀光流派（不死斩/巴之雷/寒冰/烈火/苇名钢）',
      en: '[Space / Click] Whirlwind Slash · [Q / Secondary] Cycle Style (Mortal / Lightning / Frost / Fire / Steel)',
    },
    hasSecondary: { zh: '切换刀光元素流派', en: 'Cycle Blade Style' },
    tags: ['shader', 'glsl', 'trail', 'katana', 'vfx'],
    autoDemoInterval: 0.65,
    params: [
      { key: 'trailLife', label: { zh: '刀光留存时间', en: 'Trail Lifetime' }, min: 0.06, max: 0.4, step: 0.02, defaultValue: 0.19, unit: 's' },
      { key: 'swingSpeed', label: { zh: '挥砍角速度', en: 'Slash Speed' }, min: 8, max: 28, step: 1, defaultValue: 18, unit: 'rad/s' },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 2.65, 4.6), new THREE.Vector3(0, 1.3, 0), 50, true);
      const fighter = createSamuraiFighter(0x1e293b, 1);
      ctx.group.add(fighter.root);

      const palettes = [
        { name: '不死斩 MORTAL', core: 0xff384c, edge: 0x6e0514, spark: 0xff2a44, eerie: true },
        { name: '巴之雷 LIGHTNING', core: 0xfffbe0, edge: 0xffb418, spark: 0xffe066, eerie: false },
        { name: '神之飞雪 FROST', core: 0xffffff, edge: 0x38bdf8, spark: 0x7dd3fc, eerie: false },
        { name: '琉璃净火 FLAME', core: 0xffe08a, edge: 0xff4a12, spark: 0xf97316, eerie: false },
        { name: '苇名玉钢 STEEL', core: 0xf0f8ff, edge: 0x68a8eb, spark: 0xbfdbfe, eerie: false },
      ];
      let styleIdx = 0;
      const trail = new RibbonTrail(ctx.group, 34);
      trail.setPalette(palettes[0].core, palettes[0].edge, 0.98);

      let slashRemaining = 0;
      let spinDir = 1;
      const basePos = new THREE.Vector3();
      const tipPos = new THREE.Vector3();

      return {
        trigger() {
          const pal = palettes[styleIdx];
          slashRemaining = 0.34;
          spinDir *= -1;
          fighter.swordPivot.rotation.set(Math.PI * 0.48, 0, 0.25 * spinDir);
          if (ctx.isJuiceEnabled()) {
            ctx.audio.playBladeSlash(true, pal.eerie);
            ctx.stage.addTrauma(0.2, 24, 2.2);
            ctx.vfx.spawnSparks(new THREE.Vector3(0, 1.35, 1.1), {
              count: 16,
              color: pal.spark,
              speed: 7.5,
            });
          } else {
            ctx.audio.playFlatBeep(320);
          }
          ctx.setHudStat('TRAIL STYLE', pal.name);
        },
        secondary() {
          styleIdx = (styleIdx + 1) % palettes.length;
          const pal = palettes[styleIdx];
          trail.setPalette(pal.core, pal.edge, 0.98);
          ctx.emitCallout(`✨ 刀光切换：${pal.name}`, 'gold');
          ctx.setHudStat('TRAIL STYLE', pal.name);
        },
        update(rawDt, _scaledDt, elapsed) {
          const p = ctx.getParams();
          trail.maxAge = p.trailLife;
          if (slashRemaining > 0) {
            slashRemaining -= rawDt;
            fighter.root.rotation.y += rawDt * p.swingSpeed * spinDir;
            trail.setActive(ctx.isJuiceEnabled());
          } else {
            trail.setActive(false);
            fighter.swordPivot.rotation.x = damp(fighter.swordPivot.rotation.x, 0.25, 8, rawDt);
          }
          fighter.bladeBase.getWorldPosition(basePos);
          fighter.bladeTip.getWorldPosition(tipPos);
          trail.update(basePos, tipPos, rawDt, elapsed);
        },
        dispose() {
          trail.dispose();
        },
      };
    },
    generateCode(p) {
      return `// Sub-Stepped Blade Ribbon GLSL Fragment Shader
const bladeTrailFrag = /* glsl */ \`
  uniform vec3 uCore;
  uniform vec3 uEdge;
  uniform float uTime;
  varying vec2 vUv; // x: 0(head)..1(tail over ${p.trailLife}s), y: 0(hilt)..1(tip)
  void main() {
    float fade = pow(max(0.0, 1.0 - vUv.x), 1.6);
    float body = smoothstep(0.04, 0.42, vUv.y);
    float razor = smoothstep(0.70, 0.99, vUv.y);
    float streak = 0.8 + 0.2 * sin(vUv.y * 26.0 - vUv.x * 13.0 + uTime * 20.0);
    vec3 col = mix(uEdge, uCore, razor * 0.85 + (1.0 - vUv.x) * 0.32);
    gl_FragColor = vec4(col * (1.18 + razor * 0.85), fade * body * streak);
  }
\`;`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：给我的 3D 武器绑定子步插值 GLSL 刀光拖尾（高速挥砍自动补点消除多边形折角，刀尖高光渐晕，支持不死斩暗红与雷电金配色切换）。',
      en: 'Use gamefeel-3d skill: Attach a sub-stepped GLSL weapon ribbon trail that interpolates hilt/tip positions on fast swings and renders a glowing razor-tip streak shader.',
    },
  },
  {
    id: 'posture-break-deathblow',
    category: 'melee',
    badge: 'ACT-04',
    title: {
      zh: '架势槽崩解张力与「忍杀」梵钟处决',
      en: 'Posture Break Tension & Shinobi Deathblow Gong',
    },
    subtitle: {
      zh: '架势条非线性蓄满 -> 慢动作推镜 -> 猩红忍杀大字与寺院青铜梵钟长鸣',
      en: 'Posture buildup -> slow-mo zoom lock -> crimson Deathblow kanji & Buddhist bronze gong',
    },
    whyItMatters: {
      zh: '把血条消耗改成「越压迫越快崩解的架势条 + 处决慢动作梵钟释放」，能让每一次进攻和弹反都指向同一个史诗级宣泄点。',
      en: 'Replacing chip-damage grinding with a glowing posture gauge culminating in a slow-mo bronze-gong Deathblow creates unmatched climax.',
    },
    rawProblem: {
      zh: '普通 Boss 战打空最后一滴血直接播倒地动画，毫无处决仪式感。',
      en: 'Standard boss fights abruptly ragdoll at 0 HP with zero ceremonial climax or audio-visual release.',
    },
    controlsHint: {
      zh: '[Space / 点击] 累积架势槽，满槽自动触发「忍杀」慢镜处决！',
      en: '[Space / Click] Build Enemy Posture — triggers Shinobi Deathblow at 100%!',
    },
    tags: ['posture', 'deathblow', 'slow-mo', 'gong', 'boss'],
    autoDemoInterval: 0.65,
    params: [
      { key: 'postureGain', label: { zh: '单次架势冲击', en: 'Posture Per Clash' }, min: 20, max: 55, step: 5, defaultValue: 35, unit: '%' },
      { key: 'slowMoScale', label: { zh: '处决慢放倍率', en: 'Deathblow Slow-Mo' }, min: 0.08, max: 0.5, step: 0.02, defaultValue: 0.16 },
    ],
    mount(ctx) {
      const baseCam = new THREE.Vector3(0, 2.05, 4.8);
      ctx.stage.setCameraPose(baseCam, new THREE.Vector3(0, 1.35, 0), 50, true);
      const dummy = createTargetDummy(0x991b1b);
      ctx.group.add(dummy.root);

      // 3D Floating Posture Bar above enemy
      const barBg = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 0.14),
        new THREE.MeshBasicMaterial({ color: 0x1e293b })
      );
      barBg.position.set(0, 2.65, 0);
      ctx.group.add(barBg);

      const barFillMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      const barFill = new THREE.Mesh(new THREE.PlaneGeometry(2.16, 0.1), barFillMat);
      barFill.position.set(0, 2.65, 0.01);
      ctx.group.add(barFill);

      let posture = 0;
      let zoomTimer = 0;

      return {
        trigger() {
          const p = ctx.getParams();
          const juice = ctx.isJuiceEnabled();
          posture = Math.min(100, posture + p.postureGain);

          if (posture >= 100) {
            posture = 0;
            zoomTimer = 0.65;
            if (juice) {
              ctx.audio.playDeathblowGong();
              ctx.stage.clock.triggerSlowMo(p.slowMoScale, 0.55);
              ctx.stage.setCameraPose(new THREE.Vector3(0.4, 1.75, 2.9), new THREE.Vector3(0, 1.5, 0), 40);
              ctx.stage.addTrauma(0.55, 26, 1.6);
              ctx.stage.vignetteIntensity = 0.85;
              ctx.vfx.spawnSparks(new THREE.Vector3(0, 1.45, 0.2), {
                count: 46,
                color: 0xdc2626,
                coreColor: 0xffedd5,
                speed: 12,
                flashIntensity: 20,
              });
              ctx.vfx.spawnShockRing(new THREE.Vector3(0, 1.45, 0.2), 0xef4444, 5.2, 0.42);
              ctx.vfx.spawnFloatingText(new THREE.Vector3(0, 2.15, 0.3), '忍 杀', {
                color: '#ef4444',
                stroke: '#ffffff',
                scale: 1.85,
                life: 1.15,
                upSpeed: 1.2,
                gravity: 1.5,
              });
              dummy.flash(0.35, true);
              dummy.kickVel.x = -9.5;
              ctx.emitCallout('🩸 忍杀 SHINOBI EXECUTION!', 'crimson');
            } else {
              ctx.audio.playFlatBeep(190);
            }
          } else {
            if (juice) {
              ctx.audio.playKatanaDeflect(true, Math.floor(posture / 20), 1);
              ctx.stage.addTrauma(0.24, 28, 2.4);
              ctx.vfx.spawnSparks(new THREE.Vector3(0, 1.5, 0.25), { count: 20, color: 0xfbbf24, speed: 8 });
              dummy.flash(0.08, false);
              dummy.kickVel.z = (Math.random() - 0.5) * 4;
            } else {
              ctx.audio.playFlatBeep(330);
            }
          }
          ctx.setHudStat('POSTURE GAUGE', `${posture.toFixed(0)}%`);
        },
        update(rawDt, scaledDt) {
          if (zoomTimer > 0) {
            zoomTimer -= rawDt;
            if (zoomTimer <= 0) {
              ctx.stage.setCameraPose(baseCam, new THREE.Vector3(0, 1.35, 0), 50);
            }
          } else {
            posture = Math.max(0, posture - scaledDt * 6.5);
          }
          const ratio = Math.max(0.01, posture / 100);
          barFill.scale.x = ratio;
          barFillMat.color.setHex(posture > 70 ? 0xef4444 : 0xf59e0b);
          dummy.update(scaledDt);
        },
      };
    },
    generateCode(p) {
      return `// Non-Linear Posture Recovery + Deathblow Slow-Mo Trigger
export function stepPosture(posture: number, hpRatio: number, dt: number): number {
  // Lower HP = much slower posture recovery (builds relentless pressure!)
  const recoveryRate = 12.0 * Math.pow(hpRatio, 1.6);
  return Math.max(0, posture - recoveryRate * dt);
}
// On posture >= 100: triggerSlowMo(${p.slowMoScale}, 0.55) + bronze bell harmonics [112, 224, 342, 518, 785] Hz`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：加入架势槽崩解与处决系统（3D 双向对称橙红架势条、随血量降低减缓恢复，满槽触发 0.16x 慢动作推镜、猩红忍杀大字与五泛音青铜梵钟合成音）。',
      en: 'Use gamefeel-3d skill: Add a symmetric posture gauge and Deathblow finisher (slower posture recovery at low HP, 0.16x slow-mo camera push-in at 100%, crimson Deathblow glyph, and 5-harmonic bronze temple gong synth).',
    },
  },
  {
    id: 'perilous-kanji-mikiri',
    category: 'melee',
    badge: 'ACT-05',
    title: {
      zh: '「危」字不协和预警与看破踩刀反制',
      en: 'Perilous "危" Warning Sting & Mikiri Blade Stomp',
    },
    subtitle: {
      zh: '三频不协和琵琶刺鸣预警 -> 0.5s 突刺窗口 -> 垫步踩刃重低音震波',
      en: 'Dissonant warning chime + crimson "危" glyph -> thrust window -> forward blade-stomp shockwave',
    },
    whyItMatters: {
      zh: '不可防御重招如果只靠动作前摇，玩家在混战中极易漏看；高辨识度「危」字视听警报把挫败感变成了高风险高回报的「看破踩刀」爽点！',
      en: 'Unblockable attacks feel cheap without unmistakable audio-visual telegraphing; pairing "危" with Mikiri stomp turns danger into pure rush.',
    },
    rawProblem: {
      zh: 'Boss 突刺毫无预警直接秒人，或者反制成功时和普通闪避没有任何视听区别。',
      en: 'Boss thrusts hit unannounced, or successful counters lack heavy ground-stomp authority.',
    },
    controlsHint: {
      zh: '[Space / 点击] Boss 发起「危」突刺 · 亮起瞬间按 [Q / 副动作] 触发看破踩刀！（自动演示会完整演绎）',
      en: '[Space / Click] Boss Perilous Thrust · Press [Q / Secondary] during window for Mikiri Stomp!',
    },
    hasSecondary: { zh: '看破踩刀 MIKIRI!', en: 'Mikiri Stomp!' },
    tags: ['perilous', 'mikiri', 'telegraph', 'counter', 'boss'],
    autoDemoInterval: 1.55,
    params: [
      { key: 'windowSec', label: { zh: '看破判定窗口', en: 'Mikiri Window' }, min: 0.25, max: 0.9, step: 0.05, defaultValue: 0.52, unit: 's' },
      { key: 'stompShock', label: { zh: '踩刃震屏强度', en: 'Stomp Trauma' }, min: 0.2, max: 0.85, step: 0.05, defaultValue: 0.54 },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(2.9, 2.0, 3.8), new THREE.Vector3(0, 1.2, 0), 48, true);
      const boss = createSamuraiFighter(0xef4444, 1);
      boss.root.position.set(0, 0, -1.6);
      ctx.group.add(boss.root);

      const player = createSamuraiFighter(0xf59e0b, 1);
      player.root.position.set(0, 0, 1.5);
      player.root.rotation.y = Math.PI;
      ctx.group.add(player.root);

      let phase: 'idle' | 'telegraph' | 'stomp' = 'idle';
      let timer = 0;

      const performMikiri = () => {
        const p = ctx.getParams();
        phase = 'stomp';
        timer = 0.45;
        boss.root.position.z = -0.35;
        player.root.position.z = 0.45;
        boss.swordPivot.rotation.x = 1.52;

        if (ctx.isJuiceEnabled()) {
          ctx.audio.playMikiriStomp();
          ctx.stage.clock.triggerHitstop(0.085);
          ctx.stage.addTrauma(p.stompShock, 28, 1.8);
          ctx.stage.punchFov(24);
          const stompPos = new THREE.Vector3(0, 0.15, 0.05);
          ctx.vfx.spawnShockRing(stompPos, 0xfbbf24, 5.0, 0.32, true);
          ctx.vfx.spawnSparks(stompPos, { count: 36, color: 0xfde047, speed: 10.5 });
          ctx.vfx.spawnFloatingText(new THREE.Vector3(0, 2.1, 0), '看破 MIKIRI!', {
            color: '#fde047',
            scale: 1.4,
          });
          ctx.emitCallout('⚡ 看破踩刀 MIKIRI COUNTER!', 'gold');
        } else {
          ctx.audio.playFlatBeep(360);
        }
      };

      return {
        trigger() {
          const p = ctx.getParams();
          phase = 'telegraph';
          timer = p.windowSec;
          boss.swordPivot.rotation.x = 1.38;
          if (ctx.isJuiceEnabled()) {
            ctx.audio.playPerilousKanji();
            ctx.stage.vignetteIntensity = 0.5;
            ctx.vfx.spawnFloatingText(new THREE.Vector3(0, 2.45, -1.5), '危', {
              color: '#dc2626',
              stroke: '#fde047',
              scale: 1.85,
              life: p.windowSec + 0.15,
              upSpeed: 0.4,
              gravity: 0,
            });
            ctx.emitCallout('⚠️ 「危」不可防御突刺预警！', 'crimson');
          } else {
            ctx.audio.playFlatBeep(480);
          }
        },
        secondary: performMikiri,
        update(rawDt) {
          if (phase === 'telegraph') {
            timer -= rawDt;
            boss.root.position.z = damp(boss.root.position.z, -0.5, 5, rawDt);
            if (timer <= 0.12) {
              // Auto-demonstrate Mikiri stomp at climax of thrust!
              performMikiri();
            }
          } else if (phase === 'stomp') {
            timer -= rawDt;
            if (timer <= 0) phase = 'idle';
          } else {
            boss.root.position.z = damp(boss.root.position.z, -1.6, 8, rawDt);
            player.root.position.z = damp(player.root.position.z, 1.5, 8, rawDt);
            boss.swordPivot.rotation.x = damp(boss.swordPivot.rotation.x, 0.3, 8, rawDt);
          }
          ctx.setHudStat('COUNTER STATE', phase.toUpperCase());
        },
      };
    },
    generateCode(p) {
      return `// Perilous "危" Telegraph -> ${p.windowSec}s Mikiri Counter Window
export class PerilousAttackState {
  public windowRemaining = 0;
  startTelegraph(): void {
    this.windowRemaining = ${p.windowSec};
  }
  tryMikiriCounter(dashForwardPressed: boolean): boolean {
    if (this.windowRemaining > 0 && dashForwardPressed) {
      this.windowRemaining = 0;
      return true; // Trigger 85ms hitstop + ground shockwave + ${p.stompShock} trauma!
    }
    return false;
  }
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：为 Boss 重招加入只狼式「危」字不协和音预警与 0.52s 看破踩刀判定窗口，反制成功触发 85ms 顿帧、地面扩散气浪环与低频轰鸣。',
      en: 'Use gamefeel-3d skill: Add a Perilous "危" dissonant audio-visual telegraph and 0.52s Mikiri blade-stomp counter window with 85ms hitstop and ground shockwave ring.',
    },
  },
];
