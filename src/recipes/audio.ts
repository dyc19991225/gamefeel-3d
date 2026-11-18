import * as THREE from 'three';
import type { RecipeDefinition } from '../core/types';

function create3DSpectrumRing(group: THREE.Group, colorHex: number): {
  bars: THREE.Mesh[];
  energize: (power?: number) => void;
  update: (dt: number, elapsed: number) => void;
} {
  const bars: THREE.Mesh[] = [];
  const count = 24;
  const geo = new THREE.BoxGeometry(0.14, 1, 0.14);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.45,
      metalness: 0.5,
      roughness: 0.25,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(Math.cos(a) * 1.65, 0.5, Math.sin(a) * 1.65);
    m.lookAt(0, 0.5, 0);
    group.add(m);
    bars.push(m);
  }
  let energy = 0.15;
  return {
    bars,
    energize(p = 1) {
      energy = Math.min(2.2, energy + p);
    },
    update(dt, elapsed) {
      energy = Math.max(0.12, energy * Math.exp(-5.2 * dt));
      bars.forEach((b, i) => {
        const wave = 0.55 + 0.45 * Math.sin(elapsed * 14 + i * 0.75);
        const h = Math.max(0.14, energy * wave * 1.65);
        b.scale.y = h;
        b.position.y = h * 0.5;
      });
    },
  };
}

export const audioRecipes: RecipeDefinition[] = [
  {
    id: 'webaudio-gun-forge',
    category: 'audio',
    badge: 'SFX-01',
    title: {
      zh: '零音频文件 WebAudio 枪炮声学合成器',
      en: 'Zero-MP3 WebAudio Firearm & Cannon Synthesizer',
    },
    subtitle: {
      zh: '噪声瞬态爆裂 + 锯齿波频率下潜 + 动态压缩防爆音 + 船舱脉冲混响',
      en: 'Noise transient + pitch-swept sawtooth punch + DynamicsCompressor + procedural hull reverb',
    },
    whyItMatters: {
      zh: '纯代码游戏不引任何 MP3 也能打出炸裂枪感：高频白噪负责子弹出膛脆响，指数下潜锯齿波负责胸口冲击力，压缩器兜底绝不破音！',
      en: 'Zero-asset games can still sound thunderous by layering bandpass noise crack, exponential pitch-drop body, and a 6:1 compressor.',
    },
    rawProblem: {
      zh: 'AI 默认写的音效只有一个单调 `OscillatorNode` 哔哔声，像 80 年代电子表。',
      en: 'AI-generated WebAudio usually plays a bare sine/square oscillator beep that sounds like a microwave timer.',
    },
    controlsHint: {
      zh: '[Space / 点击] 鸣枪试听 · [Q / 副动作] 切换 4 种枪械预设（AK步枪 / M4消音 / AWM狙击 / 巴雷特重炮）',
      en: '[Space / Click] Fire Synth · [Q / Secondary] Cycle Preset (AK Rifle / M4-S / AWM / .50 Cannon)',
    },
    hasSecondary: { zh: '切换枪炮声学预设', en: 'Cycle Weapon Preset' },
    tags: ['webaudio', 'synth', 'gunshot', 'reverb', 'zero-asset'],
    autoDemoInterval: 0.95,
    params: [
      { key: 'punchScale', label: { zh: '低频冲击增益', en: 'Sub-Punch Gain' }, min: 0.4, max: 1.4, step: 0.1, defaultValue: 1.0 },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 2.55, 4.9), new THREE.Vector3(0, 0.85, 0), 50, true);
      const presets: ('rifle' | 'suppressed' | 'sniper' | 'cannon')[] = ['rifle', 'suppressed', 'sniper', 'cannon'];
      const labels = ['AK-47 RIFLE', 'M4A1-S SUPPRESSED', 'AWM .338 SNIPER', 'BARRETT .50 CANNON'];
      let idx = 0;
      const ring = create3DSpectrumRing(ctx.group, 0xf59e0b);

      return {
        trigger() {
          const p = ctx.getParams();
          const cur = presets[idx];
          if (ctx.isJuiceEnabled()) {
            ctx.audio.playGunshot(cur, p.punchScale);
            if (cur === 'sniper' || cur === 'cannon') ctx.audio.playBoltCycle();
            ring.energize(cur === 'cannon' ? 2.1 : cur === 'sniper' ? 1.6 : 1.15);
            ctx.stage.addTrauma(cur === 'cannon' ? 0.48 : 0.22, 28, 2.2);
            ctx.vfx.spawnShockRing(new THREE.Vector3(0, 0.1, 0), 0xfbbf24, cur === 'cannon' ? 4.8 : 2.8, 0.25, true);
            ctx.emitCallout(`🔊 SYNTH: ${labels[idx]}`, 'gold');
          } else {
            ctx.audio.playFlatBeep(280);
            ring.energize(0.35);
          }
          ctx.setHudStat('SYNTH PRESET', labels[idx]);
        },
        secondary() {
          idx = (idx + 1) % presets.length;
          ctx.emitCallout(`切换声学模型：${labels[idx]}`, 'cyan');
          ctx.setHudStat('SYNTH PRESET', labels[idx]);
        },
        update(rawDt, _scaledDt, elapsed) {
          ring.update(rawDt, elapsed);
        },
      };
    },
    generateCode(p) {
      return `// 3-Layer Zero-Asset Gunshot Synth (Crack + Body Punch + Compressor)
export function playProceduralRifle(ctx: AudioContext, noiseBuffer: AudioBuffer): void {
  const t = ctx.currentTime;
  // 1. Bandpass noise crack
  const n = ctx.createBufferSource(); n.buffer = noiseBuffer;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 980;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.95 * ${p.punchScale}, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  n.connect(bp).connect(ng).connect(ctx.destination);
  n.start(t); n.stop(t + 0.17);

  // 2. Pitch-swept chest thump (190Hz -> 46Hz)
  const osc = ctx.createOscillator(); osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(190, t);
  osc.frequency.exponentialRampToValueAtTime(46, t + 0.11);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.72 * ${p.punchScale}, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
  osc.connect(og).connect(ctx.destination);
  osc.start(t); osc.stop(t + 0.12);
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：编写零外部音频文件的 WebAudio 枪械合成器（包含带通白噪火药爆裂层、190Hz→46Hz 指数扫频锯齿波胸腔冲击层、机械拉栓脆响与 DynamicsCompressor 防削波）。',
      en: 'Use gamefeel-3d skill: Build a zero-asset WebAudio firearm synthesizer combining a bandpass noise crack, 190Hz->46Hz exponential pitch-drop punch oscillator, bolt clicks, and a DynamicsCompressor.',
    },
  },
  {
    id: 'webaudio-blade-forge',
    category: 'audio',
    badge: 'SFX-02',
    title: {
      zh: '战国冷兵器泛音锻造台（刀鸣/危/看破/忍杀钟）',
      en: 'Sengoku Metallic Harmonics Synth (Deflect / Perilous / Gong)',
    },
    subtitle: {
      zh: '非整数倍金属泛音列模拟玉钢共振与青铜寺院大钟长余韵',
      en: 'Inharmonic metallic partial arrays model forged katana ring & Buddhist bronze bell',
    },
    whyItMatters: {
      zh: '金属与钟磬之所以悦耳真实，是因为它们的泛音不是死板的整数倍（1x, 2x, 3x），而是略微错开的金属非谐泛音列（如 1185, 1890, 2740, 4120Hz）！',
      en: 'Real steel and bronze ring with inharmonic partial ratios ([1185, 1890, 2740, 4120] Hz), each decaying at its own rate.',
    },
    rawProblem: {
      zh: '用单个正弦波模拟刀剑碰撞，听起来像电梯到达提示音而不是钢铁交锋。',
      en: 'A single sine wave sounds like an elevator ding rather than forged steel clashing.',
    },
    controlsHint: {
      zh: '[Space / 点击] 播放当前冷兵器音效 · [Q / 副动作] 切换（完美弹反 / 危字警报 / 看破踩刀 / 忍杀梵钟）',
      en: '[Space / Click] Play Sound · [Q / Secondary] Cycle (Deflect / Perilous "危" / Mikiri / Deathblow Gong)',
    },
    hasSecondary: { zh: '切换冷兵器声学模型', en: 'Cycle Sengoku Sound' },
    tags: ['webaudio', 'katana', 'harmonics', 'sekiro', 'bell'],
    autoDemoInterval: 1.25,
    params: [
      { key: 'pitchMul', label: { zh: '金属共振音高', en: 'Resonance Pitch' }, min: 0.7, max: 1.4, step: 0.05, defaultValue: 1.0 },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 2.55, 4.9), new THREE.Vector3(0, 0.85, 0), 50, true);
      const ring = create3DSpectrumRing(ctx.group, 0x38bdf8);
      const names = ['完美弹反 DEFLECT', '危字警报 PERILOUS', '看破踩刀 MIKIRI', '忍杀梵钟 DEATHBLOW GONG'];
      let mode = 0;
      let combo = 0;

      return {
        trigger() {
          const p = ctx.getParams();
          if (ctx.isJuiceEnabled()) {
            if (mode === 0) ctx.audio.playKatanaDeflect(true, combo++, p.pitchMul);
            else if (mode === 1) ctx.audio.playPerilousKanji();
            else if (mode === 2) ctx.audio.playMikiriStomp();
            else ctx.audio.playDeathblowGong();

            ring.energize(mode === 3 ? 2.0 : 1.4);
            ctx.stage.addTrauma(0.28, 28, 2.2);
            ctx.vfx.spawnSparks(new THREE.Vector3(0, 1.0, 0), {
              count: 24,
              color: mode === 1 || mode === 3 ? 0xef4444 : 0x38bdf8,
              speed: 8.5,
            });
            ctx.emitCallout(`🔔 ${names[mode]}`, mode === 1 || mode === 3 ? 'crimson' : 'cyan');
          } else {
            ctx.audio.playFlatBeep(380);
            ring.energize(0.3);
          }
          ctx.setHudStat('METALLIC SYNTH', names[mode]);
        },
        secondary() {
          mode = (mode + 1) % names.length;
          ctx.emitCallout(`切换冷兵器声学：${names[mode]}`, 'gold');
          ctx.setHudStat('METALLIC SYNTH', names[mode]);
        },
        update(rawDt, _scaledDt, elapsed) {
          ring.update(rawDt, elapsed);
        },
      };
    },
    generateCode(p) {
      return `// Inharmonic Buddhist Bronze Temple Gong Synth ([112, 224, 342, 518, 785] Hz)
export function playBronzeGong(ctx: AudioContext): void {
  const t = ctx.currentTime;
  [112, 224, 342, 518, 785].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * ${p.pitchMul}, t);
    g.gain.setValueAtTime(0.36 / (i * 0.65 + 1), t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 1.85);
    osc.connect(g).connect(ctx.destination);
    osc.start(t); osc.stop(t + 1.9);
  });
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：编写冷兵器非谐泛音 WebAudio 合成器，包含五泛音玉钢弹反刀鸣、不协和三音「危」字警报、看破低频踩刃声以及寺院青铜梵钟长余韵。',
      en: 'Use gamefeel-3d skill: Implement an inharmonic metallic WebAudio synthesizer for katana deflects, perilous warning stings, heavy blade stomps, and Buddhist bronze temple gongs.',
    },
  },
  {
    id: 'webaudio-engine-boost',
    category: 'audio',
    badge: 'SFX-03',
    title: {
      zh: '五挡转速连续引擎声浪、胎啸与涡轮喷射',
      en: 'Continuous 5-Gear RPM Engine, Tire Screech & Turbine Synth',
    },
    subtitle: {
      zh: '双振荡器模拟换挡齿比跌落 + 带通滤波漂移胎叫 + 指数上扬氮气涡轮',
      en: 'Dual-oscillator gear-shift sawtooth RPM + bandpass tire screech + rising N2O turbine sweep',
    },
    whyItMatters: {
      zh: '连续引擎声最忌讳用 `frequency.value = x` 直接硬改产生咔哒爆音；必须用 `setTargetAtTime` 平滑追踪车速取模换挡曲线！',
      en: 'Continuous engine synths click violently if you assign frequency directly; smooth setTargetAtTime + gear modulo creates silky shifting.',
    },
    rawProblem: {
      zh: '很多 Web 赛车静音裸奔，或者循环播放一段 1 秒音频接缝咔哒作响。',
      en: 'Browser racers either run completely silent or loop a 1-second WAV with audible seam clicks.',
    },
    controlsHint: {
      zh: '拖动右侧「实时车速」滑块听五挡自动换挡声浪 · [Space] 氮气涡轮 · [Q] 开关漂移轮胎啸叫',
      en: 'Drag Speed slider to hear 5-gear shifts · [Space] N2O Turbine · [Q] Toggle Tire Screech',
    },
    hasSecondary: { zh: '开关漂移胎啸', en: 'Toggle Tire Screech' },
    tags: ['webaudio', 'engine', 'rpm', 'racing', 'continuous'],
    autoDemoInterval: 1.4,
    params: [
      { key: 'speedKmh', label: { zh: '模拟实时车速', en: 'Simulated Speed' }, min: 40, max: 310, step: 5, defaultValue: 195, unit: 'km/h' },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 2.55, 4.9), new THREE.Vector3(0, 0.85, 0), 50, true);
      const ring = create3DSpectrumRing(ctx.group, 0x10b981);
      let screech = false;
      let boostTimer = 0;

      return {
        trigger() {
          boostTimer = 0.75;
          if (ctx.isJuiceEnabled()) {
            ctx.audio.playNitroBoost('cww');
            ring.energize(1.85);
            ctx.stage.addTrauma(0.24, 28, 2.2);
            ctx.vfx.spawnShockRing(new THREE.Vector3(0, 0.1, 0), 0x34d399, 3.8, 0.25, true);
            ctx.emitCallout('🚀 TURBINE N2O IGNITION!', 'emerald');
          } else {
            ctx.audio.playFlatBeep(340);
          }
        },
        secondary() {
          screech = !screech;
          ctx.emitCallout(screech ? '开启：1950Hz 带通轮胎啸叫' : '关闭：漂移轮胎啸叫', 'cyan');
        },
        update(rawDt, _scaledDt, elapsed) {
          const p = ctx.getParams();
          if (boostTimer > 0) boostTimer -= rawDt;
          const spd = p.speedKmh + (boostTimer > 0 ? 65 : 0);
          if (ctx.isJuiceEnabled()) {
            ctx.audio.updateEngine(true, spd, screech, boostTimer > 0 ? 3 : 0);
          } else {
            ctx.audio.stopContinuous();
          }
          ring.update(rawDt, elapsed * (spd / 140));
          ctx.setHudStat('RPM / SCREECH', `${spd.toFixed(0)} km/h · ${screech ? 'SKID ON' : 'GRIP'}`);
        },
        dispose() {
          ctx.audio.stopContinuous();
        },
      };
    },
    generateCode(p) {
      return `// Click-Free Continuous 5-Gear Sawtooth RPM Synth (Speed: ${p.speedKmh} km/h)
export function updateEngineRpm(
  osc1: OscillatorNode, osc2: OscillatorNode, filter: BiquadFilterNode,
  ctx: AudioContext, speedKmh: number
): void {
  const t = ctx.currentTime;
  const norm = Math.min(1, speedKmh / 310);
  const gearTooth = (speedKmh % 68) / 68; // 5-speed transmission sawtooth drop!
  const rpmFreq = 56 + norm * 118 + gearTooth * 42;
  osc1.frequency.setTargetAtTime(rpmFreq, t, 0.035);
  osc2.frequency.setTargetAtTime(rpmFreq * 1.98, t, 0.035);
  filter.frequency.setTargetAtTime(340 + norm * 960, t, 0.04);
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：编写无咔哒爆音的连续赛车声学合成器（使用 setTargetAtTime 追踪五挡齿比锯齿波双振荡器声浪、1950Hz 高 Q 带通漂移胎叫与指数升频氮气涡轮喷射音）。',
      en: 'Use gamefeel-3d skill: Build a click-free continuous WebAudio racing synth using setTargetAtTime for a 5-gear dual-oscillator RPM curve, 1950Hz bandpass tire screech, and rising N2O turbine sweep.',
    },
  },
];
