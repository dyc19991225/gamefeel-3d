import * as THREE from 'three';
import { damp } from '../core/math';
import type { RecipeDefinition } from '../core/types';
import { createSamuraiFighter } from './helpers';

export const lootRecipes: RecipeDefinition[] = [
  {
    id: 'legendary-loot-fountain',
    category: 'loot',
    badge: 'LOT-01',
    title: {
      zh: '暗黑式爆装喷泉与传奇金色冲天光柱',
      en: 'Diablo Loot Fountain & Legendary GLSL Light Pillar',
    },
    subtitle: {
      zh: '蓝/紫/金战利品高抛二次落地弹跳 + 仅传奇橙装点亮冲天光柱与竖琴六音琶音',
      en: 'Parabolic multi-bounce drops + additive GLSL sky-beam & 6-note harp arpeggio on legendaries',
    },
    whyItMatters: {
      zh: '刷宝游戏让人熬夜到凌晨三点的终极多巴胺：怪死瞬间战利品像喷泉一样高抛散落、触地弹两下，其中一颗炸出直冲云霄的橙金光柱与竖琴清音！',
      en: 'Nothing triggers looter-ARPG dopamine harder than parabolic bouncing loot culminating in a sky-piercing golden beam + harp chime.',
    },
    rawProblem: {
      zh: '装备直接刷在怪物脚底原地不动，或者只弹一行文字“获得传奇剑”，毫无开奖惊喜感。',
      en: 'Spawning static icons on the floor or printing "Got Legendary Sword" wastes the best dopamine moment in gaming.',
    },
    controlsHint: {
      zh: '[Space / 点击] 爆出战利品喷泉与传奇冲天橙光柱！',
      en: '[Space / Click] Erupt Loot Fountain & Legendary Sky Pillar!',
    },
    tags: ['loot', 'diablo', 'light-beam', 'arpg', 'dopamine'],
    autoDemoInterval: 1.85,
    params: [
      { key: 'itemCount', label: { zh: '单次爆装数量', en: 'Loot Drop Count' }, min: 4, max: 18, step: 1, defaultValue: 9 },
      { key: 'beamHeight', label: { zh: '传奇光柱高度', en: 'Beam Height' }, min: 2.0, max: 6.5, step: 0.5, defaultValue: 4.5, unit: 'm' },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 2.9, 6.2), new THREE.Vector3(0, 1.2, 0), 50, true);

      const beamMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColor: { value: new THREE.Color(0xffae19) },
          uTime: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uTime; varying vec2 vUv;
          void main() {
            float vFade = pow(max(0.0, 1.0 - vUv.y), 1.5);
            float core = 0.55 + 0.45 * sin(vUv.y * 18.0 - uTime * 8.0);
            gl_FragColor = vec4(uColor * (1.3 + core * 0.6), vFade * 0.78);
          }
        `,
      });

      interface DropItem {
        mesh: THREE.Mesh;
        beam: THREE.Mesh | null;
        vel: THREE.Vector3;
        bounces: number;
        legendary: boolean;
      }
      const drops: DropItem[] = [];
      const orbGeo = new THREE.OctahedronGeometry(0.19, 0);
      const beamGeo = new THREE.CylinderGeometry(0.06, 0.26, 1, 16, 1, true);
      beamGeo.translate(0, 0.5, 0);

      const clearDrops = () => {
        for (const d of drops) {
          ctx.group.remove(d.mesh);
          (d.mesh.material as THREE.Material).dispose();
          if (d.beam) ctx.group.remove(d.beam);
        }
        drops.length = 0;
      };

      return {
        trigger() {
          clearDrops();
          const p = ctx.getParams();
          const juice = ctx.isJuiceEnabled();

          for (let i = 0; i < p.itemCount; i++) {
            const legendary = i === 0 || (i === 1 && Math.random() < 0.35);
            const epic = !legendary && i % 3 === 0;
            const col = legendary ? 0xffae19 : epic ? 0xc084fc : 0x38bdf8;
            const m = new THREE.Mesh(
              orbGeo,
              new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: juice ? 0.85 : 0.1 })
            );
            m.position.set(0, 0.6, 0);
            ctx.group.add(m);

            const a = (i / p.itemCount) * Math.PI * 2 + Math.random() * 0.4;
            const rSpd = 1.6 + Math.random() * 1.9;
            drops.push({
              mesh: m,
              beam: null,
              vel: new THREE.Vector3(Math.cos(a) * rSpd, 6.2 + Math.random() * 2.4, Math.sin(a) * rSpd),
              bounces: 0,
              legendary,
            });
          }

          if (juice) {
            ctx.audio.playHeavyImpact(0.85);
            ctx.vfx.spawnShockRing(new THREE.Vector3(0, 0.08, 0), 0xfbbf24, 3.6, 0.25, true);
            ctx.stage.addTrauma(0.26, 26, 2.2);
          } else {
            ctx.audio.playFlatBeep(300);
          }
        },
        update(rawDt, scaledDt, elapsed) {
          const p = ctx.getParams();
          const juice = ctx.isJuiceEnabled();
          beamMat.uniforms.uTime.value = elapsed;

          for (const d of drops) {
            d.mesh.rotation.y += scaledDt * 3.5;
            if (d.bounces < 2) {
              d.vel.y -= 19 * scaledDt;
              d.mesh.position.addScaledVector(d.vel, scaledDt);
              if (d.mesh.position.y <= 0.2) {
                d.mesh.position.y = 0.2;
                d.bounces++;
                d.vel.y = d.bounces === 1 ? 3.2 : 0;
                d.vel.x *= 0.45;
                d.vel.z *= 0.45;

                if (d.bounces === 1 && d.legendary && juice && !d.beam) {
                  const b = new THREE.Mesh(beamGeo, beamMat);
                  b.position.copy(d.mesh.position);
                  b.scale.y = p.beamHeight;
                  ctx.group.add(b);
                  d.beam = b;
                  ctx.audio.playLootArpeggio(true);
                  ctx.vfx.spawnShockRing(d.mesh.position.clone().setY(0.05), 0xffae19, 2.8, 0.3, true);
                  ctx.vfx.spawnSparks(d.mesh.position, { count: 24, color: 0xffd700, speed: 8 });
                  ctx.vfx.spawnFloatingText(d.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), '★ LEGENDARY!', {
                    color: '#fbbf24',
                    scale: 1.2,
                  });
                  ctx.emitCallout('🌟 传说金光爆出 LEGENDARY DROP!', 'gold');
                }
              }
            } else if (d.beam) {
              d.beam.position.x = d.mesh.position.x;
              d.beam.position.z = d.mesh.position.z;
              d.beam.scale.y = juice ? p.beamHeight : 0.01;
            }
          }
          ctx.setHudStat('LOOT DROPS', `${drops.length} ITEMS`);
          void rawDt;
        },
        dispose() {
          clearDrops();
          orbGeo.dispose();
          beamGeo.dispose();
          beamMat.dispose();
        },
      };
    },
    generateCode(p) {
      return `// Legendary Loot Sky-Beam GLSL Fragment Shader (Height: ${p.beamHeight}m)
const rarityBeamFrag = /* glsl */ \`
  uniform vec3 uColor; uniform float uTime; varying vec2 vUv;
  void main() {
    float vFade = pow(max(0.0, 1.0 - vUv.y), 1.5);
    float shimmer = 0.55 + 0.45 * sin(vUv.y * 18.0 - uTime * 8.0);
    gl_FragColor = vec4(uColor * (1.3 + shimmer * 0.6), vFade * 0.78);
  }
\`;`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：实现暗黑破坏神式爆装喷泉手感（掉落物圆周抛物线喷出并二次触地弹跳，传说品质触地瞬间升起 4.5m 加色渐变光柱、扩散金环与六音竖琴琶音）。',
      en: 'Use gamefeel-3d skill: Add a Diablo-style parabolic multi-bounce loot fountain that ignites a 4.5m additive GLSL sky-beam and 6-note harp arpeggio when legendary items touch down.',
    },
  },
  {
    id: 'magnet-xp-vacuum',
    category: 'loot',
    badge: 'LOT-02',
    title: {
      zh: '反推蓄势磁吸经验潮与连音阶梯（幸存者风）',
      en: 'Anticipation Push-Back XP Vacuum & Pitch Cascade',
    },
    subtitle: {
      zh: '触发磁铁瞬间经验球先向外反推 0.14s 蓄力，再疯狂加速吸入角色胸口连响升调清音',
      en: '0.14s outward push-back anticipation -> exponential homing acceleration + musical pop cascade',
    },
    whyItMatters: {
      zh: '《吸血鬼幸存者》吸全屏经验球最爽的细节：不是直接直线飞过来，而是**先朝远离玩家的方向猛退一小步**再呼啸涌入，配合一串越来越高的音阶啵啵声！',
      en: 'Vampire Survivors secret sauce: gems briefly push AWAY from the player for 140ms before rocketing inward with rising pitch pops!',
    },
    rawProblem: {
      zh: '经验球匀速直线移向玩家，毫无张力缓冲，吃球音效同频刺耳。',
      en: 'Linear constant-speed homing feels robotic, and un-pitched pickup sounds become fatiguing.',
    },
    controlsHint: {
      zh: '[Space / 点击] 撒满全屏经验晶石并触发「反推蓄势磁吸风暴」！',
      en: '[Space / Click] Scatter 28 XP Gems & Trigger Push-Back Vacuum Storm!',
    },
    tags: ['vampire-survivors', 'magnet', 'anticipation', 'roguelite', 'loot'],
    autoDemoInterval: 1.95,
    params: [
      { key: 'gemCount', label: { zh: '经验晶石数量', en: 'XP Gem Count' }, min: 8, max: 45, step: 1, defaultValue: 26 },
      { key: 'pushBack', label: { zh: '反推蓄势力度', en: 'Push-Back Kick' }, min: 0, max: 8, step: 0.5, defaultValue: 4.2 },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 4.6, 6.4), new THREE.Vector3(0, 0.8, 0), 50, true);
      const hero = createSamuraiFighter(0x10b981, 1);
      ctx.group.add(hero.root);

      const gemGeo = new THREE.OctahedronGeometry(0.15, 0);
      const gems: { mesh: THREE.Mesh; vel: THREE.Vector3; age: number }[] = [];
      let chain = 0;

      return {
        trigger() {
          const p = ctx.getParams();
          const juice = ctx.isJuiceEnabled();
          chain = 0;

          for (let i = 0; i < p.gemCount; i++) {
            const a = (i / p.gemCount) * Math.PI * 2 + Math.random() * 0.35;
            const r = 1.8 + Math.random() * 2.4;
            const pos = new THREE.Vector3(Math.cos(a) * r, 0.55, Math.sin(a) * r);
            const mat = new THREE.MeshBasicMaterial({ color: i % 4 === 0 ? 0xfacc15 : 0x38bdf8 });
            const m = new THREE.Mesh(gemGeo, mat);
            m.position.copy(pos);
            ctx.group.add(m);

            // Initial outward push-back velocity!
            const outDir = pos.clone().setY(0).normalize();
            gems.push({
              mesh: m,
              vel: juice ? outDir.multiplyScalar(p.pushBack).setY(2.2) : new THREE.Vector3(),
              age: -i * 0.014,
            });
          }
          if (juice) {
            ctx.vfx.spawnShockRing(new THREE.Vector3(0, 0.1, 0), 0x38bdf8, 4.8, 0.3, true);
            ctx.emitCallout(`🧲 MAGNET VACUUM ×${p.gemCount} GEMS`, 'cyan');
          }
        },
        update(rawDt, scaledDt) {
          const juice = ctx.isJuiceEnabled();
          const target = new THREE.Vector3(0, 1.1, 0);

          for (let i = gems.length - 1; i >= 0; i--) {
            const g = gems[i];
            g.age += scaledDt;
            if (g.age < 0) continue;

            const toHero = target.clone().sub(g.mesh.position);
            const dist = toHero.length();
            if (juice) {
              // After 0.14s outward push, accelerate inward aggressively!
              const pull = g.age < 0.14 ? 6 : 24 + g.age * 55;
              g.vel.lerp(toHero.normalize().multiplyScalar(pull), 1 - Math.exp(-10 * scaledDt));
              g.mesh.position.addScaledVector(g.vel, scaledDt);
            } else {
              g.mesh.position.addScaledVector(toHero.normalize(), 7 * scaledDt);
            }

            if (dist < 0.42) {
              ctx.group.remove(g.mesh);
              (g.mesh.material as THREE.Material).dispose();
              gems.splice(i, 1);
              chain++;
              if (juice) {
                if (chain % 2 === 1) ctx.audio.playXpOrbPop(chain);
                hero.root.scale.setScalar(1.09);
                ctx.vfx.spawnSparks(target, { count: 4, color: 0x38bdf8, speed: 4.5, life: 0.14, flashIntensity: 4 });
              } else if (chain === 1) {
                ctx.audio.playFlatBeep(360);
              }
            }
          }
          hero.root.scale.lerp(new THREE.Vector3(1, 1, 1), 1 - Math.exp(-16 * rawDt));
          ctx.setHudStat('ABSORBED CHAIN', `${chain} XP GEMS`);
        },
        dispose() {
          gemGeo.dispose();
        },
      };
    },
    generateCode(p) {
      return `// Anticipation Push-Back -> Homing Vacuum Curve
export function stepMagnetGem(
  pos: THREE.Vector3, vel: THREE.Vector3, target: THREE.Vector3, age: number, dt: number
): void {
  if (age === 0) {
    // 1. Outward anticipation push!
    vel.copy(pos).sub(target).setY(0).normalize().multiplyScalar(${p.pushBack});
  }
  const pullSpeed = age < 0.14 ? 6 : 24 + age * 55;
  const desired = target.clone().sub(pos).normalize().multiplyScalar(pullSpeed);
  vel.lerp(desired, 1 - Math.exp(-10 * dt));
  pos.addScaledVector(vel, dt);
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：实现吸血鬼幸存者式磁吸经验球手感（触发拾取时先向外反推 4.2m/s 蓄势 0.14s，随后指数加速吸入角色胸口，并播放随连吃次数半音递升的清脆气泡音）。',
      en: 'Use gamefeel-3d skill: Implement Vampire-Survivors magnetized pickup feel with a 0.14s outward push-back anticipation impulse followed by accelerating homing and pitch-climbing pop audio.',
    },
  },
  {
    id: 'levelup-golden-nova',
    category: 'loot',
    badge: 'LOT-03',
    title: {
      zh: '升级圣光新星推怪震波与大九和弦庆典',
      en: 'Level-Up Golden Nova Knockback & Major-9th Fanfare',
    },
    subtitle: {
      zh: '升级瞬间全屏微慢放 + 双层黄金气浪震退周围敌群 + 六声部温暖管弦和弦',
      en: 'Brief celebratory slow-mo + dual golden shockwaves knocking back surrounding mobs + 6-voice chord',
    },
    whyItMatters: {
      zh: '肉鸽游戏每次升级都应该是玩家的「高光喘息时刻」：一圈黄金新星把贴脸小怪全部震飞，伴随温暖恢弘的大九和弦，仪式感瞬间封神！',
      en: 'Leveling up in a horde game should clear breathing room with a golden radial knockback nova and lush harmonic fanfare.',
    },
    rawProblem: {
      zh: '升级只是突兀弹出一个 HTML 选技能菜单，场面和声音毫无过渡。',
      en: 'Abruptly freezing into a plain HTML upgrade modal with zero radial nova or fanfare kills combat flow.',
    },
    controlsHint: {
      zh: '[Space / 点击] 触发角色升级圣光新星震退周围包围网！',
      en: '[Space / Click] Trigger Level-Up Golden Nova & Crowd Knockback!',
    },
    tags: ['level-up', 'nova', 'roguelite', 'fanfare', 'loot'],
    autoDemoInterval: 1.9,
    params: [
      { key: 'novaPush', label: { zh: '震退怪物半径', en: 'Knockback Radius' }, min: 2.0, max: 5.5, step: 0.25, defaultValue: 3.8, unit: 'm' },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 3.8, 6.2), new THREE.Vector3(0, 1.0, 0), 50, true);
      const hero = createSamuraiFighter(0xf59e0b, 1);
      ctx.group.add(hero.root);

      const mobGeo = new THREE.BoxGeometry(0.55, 0.85, 0.55);
      const mobs = Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const m = new THREE.Mesh(
          mobGeo,
          new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.4 })
        );
        m.position.set(Math.cos(a) * 1.4, 0.42, Math.sin(a) * 1.4);
        ctx.group.add(m);
        return { mesh: m, angle: a, dist: 1.4, velR: 0 };
      });

      let lv = 1;
      let floatTimer = 0;

      return {
        trigger() {
          const p = ctx.getParams();
          lv++;
          floatTimer = 0.65;
          for (const m of mobs) m.velR = p.novaPush * 3.2;

          if (ctx.isJuiceEnabled()) {
            ctx.audio.playLevelUpChord();
            ctx.stage.clock.triggerSlowMo(0.35, 0.32);
            ctx.stage.addTrauma(0.36, 24, 1.8);
            ctx.stage.punchFov(55);
            ctx.vfx.spawnShockRing(new THREE.Vector3(0, 0.08, 0), 0xfacc15, p.novaPush * 1.6, 0.45, true);
            ctx.vfx.spawnShockRing(new THREE.Vector3(0, 1.1, 0), 0xfef08a, p.novaPush * 1.2, 0.35, false);
            ctx.vfx.spawnSparks(new THREE.Vector3(0, 1.1, 0), { count: 40, color: 0xfde047, speed: 10, flashIntensity: 20 });
            ctx.vfx.spawnFloatingText(new THREE.Vector3(0, 2.35, 0), `★ LEVEL UP! LV.${lv}`, {
              color: '#fde047',
              scale: 1.45,
              life: 1.1,
            });
            ctx.emitCallout(`✨ LEVEL ${lv} GOLDEN NOVA!`, 'gold');
          } else {
            ctx.audio.playFlatBeep(440);
          }
          ctx.setHudStat('PLAYER LEVEL', `LV.${lv}`);
        },
        update(rawDt, scaledDt) {
          if (floatTimer > 0) {
            floatTimer -= rawDt;
            hero.root.position.y = damp(hero.root.position.y, 0.55, 12, rawDt);
          } else {
            hero.root.position.y = damp(hero.root.position.y, 0, 8, rawDt);
          }

          for (const m of mobs) {
            m.dist += m.velR * scaledDt;
            m.velR *= Math.exp(-6.5 * scaledDt);
            if (m.dist > 1.35 && m.velR < 0.4) m.dist = damp(m.dist, 1.35, 1.8, scaledDt);
            m.mesh.position.set(Math.cos(m.angle) * m.dist, 0.42, Math.sin(m.angle) * m.dist);
            m.mesh.lookAt(0, 0.42, 0);
          }
        },
        dispose() {
          mobGeo.dispose();
        },
      };
    },
    generateCode(p) {
      return `// Celebratory Level-Up Radial Knockback Nova (Radius: ${p.novaPush}m)
export function applyLevelUpNova(playerPos: THREE.Vector3, enemies: { pos: THREE.Vector3; vel: THREE.Vector3 }[]): void {
  for (const e of enemies) {
    const away = e.pos.clone().sub(playerPos).setY(0);
    const d = away.length();
    if (d < ${p.novaPush} && d > 0.01) {
      e.vel.addScaledVector(away.normalize(), (${p.novaPush} - d) * 4.5);
    }
  }
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：为角色升级添加黄金圣光新星演出（0.32s 微慢放、双层扩散金色气浪震退 3.8m 内所有小怪、40 颗金星迸射与六声部大九和弦合成庆典音效）。',
      en: 'Use gamefeel-3d skill: Add a celebratory Level-Up Golden Nova with 0.32s slow-mo, dual radial shockwaves knocking back mobs within 3.8m, 40 gold sparks, and a 6-voice major-9th synth chord.',
    },
  },
  {
    id: 'chest-anticipation-jackpot',
    category: 'loot',
    badge: 'LOT-04',
    title: {
      zh: '宝箱蓄力高频颤抖挤压与大爆奖顶盖弹飞',
      en: 'Treasure Chest Anticipation Shake & Jackpot Pop',
    },
    subtitle: {
      zh: '迪士尼动画十二法则「预备动作」：先越压越扁越抖越急 0.55s，再轰然炸开喷金',
      en: 'Disney Principle #2 (Anticipation): 0.55s accelerating squash-rumble before explosive lid pop',
    },
    whyItMatters: {
      zh: '一点就秒开的宝箱毫无悬念；先让箱体下压变胖、高频发抖并发出攀升嗡鸣 0.55 秒，再轰然掀翻箱盖喷出漫天金光，期待感直接拉满十倍！',
      en: 'Instant chest opens feel flat; a 0.55s accelerating squash-shake rumble builds irresistible slot-machine suspense.',
    },
    rawProblem: {
      zh: '交互宝箱瞬间切换成打开模型，没有蓄力压缩和箱盖弹射弧线。',
      en: 'Swapping closed-to-open chest meshes on frame 1 skips anticipation and physical lid pop.',
    },
    controlsHint: {
      zh: '[Space / 点击] 开启宝箱，体验「蓄力颤抖挤压 -> 轰然爆金」！',
      en: '[Space / Click] Open Chest — watch 0.55s Anticipation Shake -> Jackpot Eruption!',
    },
    tags: ['chest', 'anticipation', 'disney-12', 'jackpot', 'loot'],
    autoDemoInterval: 2.1,
    params: [
      { key: 'chargeSec', label: { zh: '蓄力颤抖时长', en: 'Anticipation Time' }, min: 0.2, max: 1.1, step: 0.05, defaultValue: 0.55, unit: 's' },
      { key: 'coinBurst', label: { zh: '爆奖金币飞溅', en: 'Jackpot Burst' }, min: 15, max: 60, step: 5, defaultValue: 38 },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 2.25, 4.4), new THREE.Vector3(0, 0.9, 0), 50, true);

      const chest = new THREE.Group();
      ctx.group.add(chest);
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(1.25, 0.68, 0.85),
        new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.6 })
      );
      base.position.y = 0.34;
      chest.add(base);

      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.14, 0.9),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.2 })
      );
      trim.position.y = 0.65;
      chest.add(trim);

      const lidPivot = new THREE.Group();
      lidPivot.position.set(0, 0.68, -0.42);
      chest.add(lidPivot);
      const lid = new THREE.Mesh(
        new THREE.BoxGeometry(1.28, 0.34, 0.86),
        new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.5 })
      );
      lid.position.set(0, 0.17, 0.42);
      lidPivot.add(lid);

      let state: 'closed' | 'charging' | 'popped' = 'closed';
      let timer = 0;

      return {
        trigger() {
          const p = ctx.getParams();
          lidPivot.rotation.x = 0;
          if (ctx.isJuiceEnabled()) {
            state = 'charging';
            timer = p.chargeSec;
            ctx.audio.playJump(false);
          } else {
            state = 'popped';
            lidPivot.rotation.x = -1.9;
            ctx.audio.playFlatBeep(380);
          }
        },
        update(rawDt) {
          const p = ctx.getParams();
          if (state === 'charging') {
            timer -= rawDt;
            const t = 1 - Math.max(0, timer / p.chargeSec);
            const squash = 1 - t * 0.28;
            chest.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
            chest.position.x = Math.sin(t * 95) * (0.02 + t * 0.08);

            if (timer <= 0) {
              state = 'popped';
              timer = 0.9;
              chest.position.x = 0;
              chest.scale.set(0.84, 1.28, 0.84);
              lidPivot.rotation.x = -2.15;

              ctx.audio.playLootArpeggio(true);
              ctx.audio.playHeavyImpact(0.95);
              ctx.stage.addTrauma(0.42, 28, 2.0);
              ctx.stage.punchFov(55);
              ctx.vfx.spawnSparks(new THREE.Vector3(0, 0.85, 0), {
                count: p.coinBurst,
                color: 0xfacc15,
                coreColor: 0xffffff,
                speed: 9.8,
                flashIntensity: 20,
              });
              ctx.vfx.spawnShockRing(new THREE.Vector3(0, 0.75, 0), 0xfde047, 3.8, 0.28);
              ctx.vfx.spawnFloatingText(new THREE.Vector3(0, 1.65, 0), '💰 JACKPOT +9999!', {
                color: '#fde047',
                scale: 1.35,
              });
              ctx.emitCallout('🎉 JACKPOT CHEST ERUPTION!', 'gold');
            }
          } else {
            chest.scale.lerp(new THREE.Vector3(1, 1, 1), 1 - Math.exp(-12 * rawDt));
            if (state === 'popped') {
              timer -= rawDt;
              if (timer <= 0) {
                lidPivot.rotation.x = damp(lidPivot.rotation.x, 0, 8, rawDt);
              }
            }
          }
          ctx.setHudStat('CHEST PHASE', state.toUpperCase());
        },
      };
    },
    generateCode(p) {
      return `// Disney Principle #2: Accelerating Squash-Shake Anticipation (${p.chargeSec}s)
export function evaluateChestAnticipation(progress01: number): { scaleY: number; scaleXZ: number; jitterX: number } {
  const sy = 1 - progress01 * 0.28; // Compress down before release!
  return {
    scaleY: sy,
    scaleXZ: 1 / Math.sqrt(sy),
    jitterX: Math.sin(progress01 * 95) * (0.02 + progress01 * 0.08),
  };
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：给宝箱/扭蛋添加迪士尼预备动作（Anticipation）开箱手感（前 0.55s 体积守恒下压蓄力并加速横向颤抖，随后弹翻箱盖至 120°、喷射 38 颗金币火星与竖琴琶音）。',
      en: 'Use gamefeel-3d skill: Add Disney-style chest opening anticipation (0.55s accelerating volume-preserving squash & horizontal rumble, then explosive lid pop + 38 golden coin sparks + harp arpeggio).',
    },
  },
];
