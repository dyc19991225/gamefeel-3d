import * as THREE from 'three';
import { Spring1D, SpringVec3, damp } from '../core/math';
import type { RecipeDefinition } from '../core/types';
import { createTargetDummy, createWeaponRig } from './helpers';

export const fpsRecipes: RecipeDefinition[] = [
  {
    id: 'recoil-kick-bloom',
    category: 'fps',
    badge: 'FPS-01',
    title: {
      zh: '二阶弹簧后坐力与准星动态扩散',
      en: '2nd-Order Spring Recoil & Crosshair Bloom',
    },
    subtitle: {
      zh: 'AK-47 枪口上跳恢复曲线 + 视角微抬 + 抛壳与三帧星芒枪口焰',
      en: 'Dual-spring viewmodel kickback, pitch climb, shell ejection & 3-frame star flash',
    },
    whyItMatters: {
      zh: '真实爽快的射击不是把枪往后瞬移 5cm，而是「瞬时后坐冲量 + 欠阻尼弹簧回弹 + 准星扩散滞后收敛」三层叠加。',
      en: 'Visceral gunplay comes from instantaneous impulse + under-damped spring recovery + delayed crosshair bloom decay.',
    },
    rawProblem: {
      zh: 'AI 默认写的射击往往只有线性位移或纹丝不动，打出去像激光水枪。',
      en: 'Vibecoded shooters keep the gun static or linearly tween Z, feeling like a weightless laser pointer.',
    },
    controlsHint: {
      zh: '[Space / 点击] 开火连射 · 右上角可切换 Raw 无手感对比',
      en: '[Space / Click] Fire burst · Toggle Raw vs GameFeel in top bar',
    },
    tags: ['recoil', 'spring', 'crosshair', 'fps', 'viewmodel'],
    autoDemoInterval: 0.24,
    params: [
      { key: 'kickZ', label: { zh: '后坐冲量', en: 'Kick Impulse' }, min: 0.5, max: 4.5, step: 0.1, defaultValue: 2.2 },
      { key: 'stiffness', label: { zh: '弹簧刚度', en: 'Spring Stiffness' }, min: 80, max: 380, step: 10, defaultValue: 220 },
      { key: 'damping', label: { zh: '弹簧阻尼', en: 'Spring Damping' }, min: 6, max: 30, step: 1, defaultValue: 15 },
      { key: 'bloomAdd', label: { zh: '准星扩散增量', en: 'Bloom Per Shot' }, min: 2, max: 22, step: 1, defaultValue: 9, unit: 'px' },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 1.72, 4.2), new THREE.Vector3(0, 1.55, -2.5), 55, true);
      const dummy = createTargetDummy(0x3b82f6);
      dummy.root.position.set(0, 0, -2.6);
      ctx.group.add(dummy.root);

      const gun = createWeaponRig(false);
      const baseGunPos = new THREE.Vector3(0.42, 1.44, 3.25);
      gun.root.position.copy(baseGunPos);
      ctx.group.add(gun.root);

      const posSpring = new SpringVec3();
      const rotSpring = new Spring1D(0);
      let flashTimer = 0;
      let bloom = 6;
      let shots = 0;

      const worldMuzzle = new THREE.Vector3();
      const worldEject = new THREE.Vector3();

      return {
        trigger() {
          shots++;
          const p = ctx.getParams();
          const juice = ctx.isJuiceEnabled();

          gun.muzzle.getWorldPosition(worldMuzzle);
          gun.ejectPort.getWorldPosition(worldEject);
          const hitPos = new THREE.Vector3(
            (Math.random() - 0.5) * (bloom * 0.018),
            1.42 + (Math.random() - 0.35) * (bloom * 0.018),
            -2.4
          );

          if (juice) {
            posSpring.impulse((Math.random() - 0.5) * 0.55, 0.35 * p.kickZ, 1.45 * p.kickZ);
            rotSpring.impulse(2.8 * p.kickZ);
            bloom = Math.min(44, bloom + p.bloomAdd);
            flashTimer = 0.048;
            gun.flashMesh.rotation.z = Math.random() * Math.PI;
            gun.flashMesh.visible = true;

            ctx.audio.playGunshot('rifle', 0.95);
            ctx.vfx.spawnTracer(worldMuzzle, hitPos, 0xffe082, 0.075);
            ctx.vfx.spawnShellCasing(worldEject, new THREE.Vector3(1, 0, 0.2));
            ctx.vfx.spawnSparks(hitPos, { count: 9, color: 0xffb84d, speed: 5.5, life: 0.2 });
            ctx.stage.addTrauma(0.24, 30, 2.2);
            ctx.stage.punchFov(14);
            dummy.flash(0.065, false);
            dummy.kickVel.x = -2.4;
          } else {
            ctx.audio.playFlatBeep(310);
            ctx.vfx.spawnTracer(worldMuzzle, hitPos, 0x999999, 0.05);
          }
          ctx.setHudStat('SHOTS / BLOOM', `#${shots} · ${bloom.toFixed(0)}px`);
        },
        update(rawDt, scaledDt, elapsed) {
          const p = ctx.getParams();
          posSpring.step(rawDt, p.stiffness, p.damping);
          const rx = rotSpring.step(rawDt, p.stiffness, p.damping);

          const swayX = ctx.isJuiceEnabled() ? Math.sin(elapsed * 2.1) * 0.008 : 0;
          const swayY = ctx.isJuiceEnabled() ? Math.cos(elapsed * 4.2) * 0.006 : 0;

          gun.root.position.set(
            baseGunPos.x + posSpring.value.x + swayX,
            baseGunPos.y + posSpring.value.y + swayY,
            baseGunPos.z + posSpring.value.z
          );
          gun.root.rotation.x = rx * 0.16;
          gun.root.rotation.z = -posSpring.value.x * 0.5;

          if (flashTimer > 0) {
            flashTimer -= rawDt;
            if (flashTimer <= 0) gun.flashMesh.visible = false;
          }

          bloom = damp(bloom, 6, 9.5, rawDt);
          ctx.stage.crosshairGap = ctx.isJuiceEnabled() ? bloom : 6;
          dummy.update(scaledDt);
        },
      };
    },
    generateCode(p) {
      return `// Zero-Asset 2nd-Order Spring Recoil & Crosshair Bloom (Three.js)
export class WeaponRecoilRig {
  private zVel = 0; private zOff = 0;
  private pitchVel = 0; private pitchOff = 0;
  public crosshairBloom = 6;

  fire(): void {
    this.zVel += ${(1.45 * p.kickZ).toFixed(2)};
    this.pitchVel += ${(2.8 * p.kickZ).toFixed(2)};
    this.crosshairBloom = Math.min(44, this.crosshairBloom + ${p.bloomAdd});
  }

  update(gun: THREE.Object3D, dt: number): void {
    const k = ${p.stiffness}, d = ${p.damping};
    const decay = Math.exp(-d * dt);
    this.zVel = (this.zVel - this.zOff * k * dt) * decay;
    this.zOff += this.zVel * dt;
    this.pitchVel = (this.pitchVel - this.pitchOff * k * dt) * decay;
    this.pitchOff += this.pitchVel * dt;

    gun.position.z = this.zOff;
    gun.rotation.x = this.pitchOff * 0.16;
    this.crosshairBloom += (6 - this.crosshairBloom) * (1 - Math.exp(-9.5 * dt));
  }
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：给我的 Three.js 第一人称步枪添加二阶弹簧后坐力回弹（刚度 220、阻尼 15）、3 帧加色星芒枪口火焰、右侧旋转抛壳以及随连射扩张收敛的动态准星。',
      en: 'Use gamefeel-3d skill: Add a 2nd-order under-damped spring recoil rig (stiffness 220, damping 15), 3-frame additive star muzzle flash, spinning brass shell ejection, and dynamic crosshair bloom to my Three.js FPS weapon.',
    },
  },
  {
    id: 'quick-scope-sniper',
    category: 'fps',
    badge: 'FPS-02',
    title: {
      zh: '瞬狙开镜曲线与 Q 切刀取消后摇',
      en: 'Quick-Scope FOV Snap & Q-Switch Cancel',
    },
    subtitle: {
      zh: 'AWM 双倍镜瞬开 + 超音速狙击轰鸣 + Q 键尼泊尔旋转切枪瞬狙节奏',
      en: 'AWM optic snap -> supersonic .338 crack -> crisp Q-knife spin recovery',
    },
    whyItMatters: {
      zh: '经典竞技 FPS 狙击灵魂在于「开镜 FOV 急收 -> 击发重低音震屏 -> Q 切近战旋转消后摇」的肌肉记忆节拍。',
      en: 'Iconic sniper feel comes from the rhythmic 3-beat cadence: rapid FOV zoom-in, heavy sub-bass kick, and snappy Q-switch cancel.',
    },
    rawProblem: {
      zh: '普通实现直接硬切 camera.fov，没有收镜过渡、拉栓机械音和切刀旋转惯性。',
      en: 'Naive implementations hard-set camera.fov with zero spring inertia, bolt Foley, or weapon-draw flourish.',
    },
    controlsHint: {
      zh: '[Space / 点击] 瞬狙开火 · [Q / 副动作按钮] 旋转切刀切回狙击',
      en: '[Space / Click] Quick-Scope Shot · [Q / Secondary] Knife Quick-Switch',
    },
    hasSecondary: { zh: 'Q 切刀瞬切', en: 'Q Quick-Switch' },
    tags: ['sniper', 'fov', 'quick-scope', 'fps', 'awm'],
    autoDemoInterval: 1.45,
    params: [
      { key: 'zoomFov', label: { zh: '开镜 FOV 缩减', en: 'Scope FOV Drop' }, min: 12, max: 34, step: 1, defaultValue: 26, unit: '°' },
      { key: 'recoilKick', label: { zh: '狙击震屏强度', en: 'Sniper Trauma' }, min: 0.2, max: 0.9, step: 0.05, defaultValue: 0.58 },
      { key: 'qSpinSpeed', label: { zh: 'Q 切旋转角速度', en: 'Q-Switch Spin' }, min: 6, max: 22, step: 1, defaultValue: 14, unit: 'rad/s' },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 1.72, 4.6), new THREE.Vector3(0, 1.65, -3.2), 54, true);
      const dummy = createTargetDummy(0x10b981);
      dummy.root.position.set(0, 0, -3.2);
      ctx.group.add(dummy.root);

      const sniper = createWeaponRig(true);
      const basePos = new THREE.Vector3(0.38, 1.42, 3.55);
      sniper.root.position.copy(basePos);
      ctx.group.add(sniper.root);

      // Stylized curved Kukri blade for Q-switch
      const knifeGroup = new THREE.Group();
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.48, 0.11),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.92, roughness: 0.14 })
      );
      blade.position.y = 0.22;
      blade.rotation.x = -0.28;
      knifeGroup.add(blade);
      knifeGroup.position.set(0.38, 1.36, 3.65);
      knifeGroup.visible = false;
      ctx.group.add(knifeGroup);

      let phase: 'idle' | 'scoping' | 'recoil' | 'qswitch' = 'idle';
      let timer = 0;
      const kickSpring = new Spring1D(0);

      const runQuickSwitch = () => {
        phase = 'qswitch';
        timer = 0.36;
        sniper.root.visible = false;
        knifeGroup.visible = true;
        knifeGroup.rotation.set(0, 0, 0);
        if (ctx.isJuiceEnabled()) {
          ctx.audio.playBladeSlash(false, false);
          ctx.emitCallout('Q-SWITCH 切刀瞬切!', 'cyan');
        }
      };

      return {
        trigger() {
          phase = 'scoping';
          timer = 0.11;
          const p = ctx.getParams();
          if (ctx.isJuiceEnabled()) {
            ctx.stage.punchFov(-120, -p.zoomFov);
          }
        },
        secondary: runQuickSwitch,
        update(rawDt, scaledDt) {
          const p = ctx.getParams();
          const juice = ctx.isJuiceEnabled();
          const kOff = kickSpring.step(rawDt, 180, 13);

          if (phase === 'scoping') {
            timer -= rawDt;
            sniper.root.position.x = damp(sniper.root.position.x, 0.02, 28, rawDt);
            if (timer <= 0) {
              phase = 'recoil';
              timer = 0.32;
              const muzzlePos = new THREE.Vector3();
              sniper.muzzle.getWorldPosition(muzzlePos);
              const headPos = new THREE.Vector3(0, 2.02, -3.2);

              if (juice) {
                ctx.audio.playGunshot('sniper', 1.15);
                ctx.audio.playHeadshotChime(1.0);
                ctx.audio.playBoltCycle();
                ctx.stage.punchFov(210, 0);
                ctx.stage.addTrauma(p.recoilKick, 24, 1.8);
                ctx.stage.clock.triggerHitstop(0.045);
                kickSpring.impulse(4.8);
                ctx.vfx.spawnTracer(muzzlePos, headPos, 0xfff099, 0.14);
                ctx.vfx.spawnSparks(headPos, { count: 24, color: 0xffd24c, speed: 9.5 });
                ctx.vfx.spawnShockRing(headPos, 0xffe066, 2.8, 0.22);
                ctx.vfx.spawnFloatingText(headPos.clone().add(new THREE.Vector3(0, 0.45, 0)), '400 CRIT!', {
                  color: '#ffd84d',
                  scale: 1.25,
                });
                dummy.flash(0.11, true);
                dummy.kickVel.x = -5.5;
                ctx.emitCallout('⚡ QUICK-SCOPE HEADSHOT!', 'gold');
              } else {
                ctx.audio.playFlatBeep(220);
                ctx.stage.fovSpring.snap(0);
              }
            }
          } else if (phase === 'recoil') {
            timer -= rawDt;
            sniper.root.position.x = damp(sniper.root.position.x, basePos.x, 14, rawDt);
            if (timer <= 0 && juice) {
              runQuickSwitch();
            } else if (timer <= 0) {
              phase = 'idle';
            }
          } else if (phase === 'qswitch') {
            timer -= rawDt;
            knifeGroup.rotation.x -= rawDt * p.qSpinSpeed;
            if (timer <= 0) {
              knifeGroup.visible = false;
              sniper.root.visible = true;
              sniper.root.position.y = basePos.y - 0.16;
              phase = 'idle';
            }
          } else {
            sniper.root.position.x = damp(sniper.root.position.x, basePos.x, 14, rawDt);
            sniper.root.position.y = damp(sniper.root.position.y, basePos.y, 14, rawDt);
          }

          sniper.root.position.z = basePos.z + kOff * 0.25;
          sniper.root.rotation.x = kOff * 0.22;
          dummy.update(scaledDt);
          ctx.setHudStat('PHASE / FOV', `${phase.toUpperCase()} · ${ctx.camera.fov.toFixed(1)}°`);
        },
      };
    },
    generateCode(p) {
      return `// Quick-Scope FOV Snap + Q-Switch Recovery Cadence
export class QuickScopeController {
  private fovTarget = 0;
  public scopeIn(): void {
    this.fovTarget = -${p.zoomFov}; // Rapid zoom-in before trigger release
  }
  public fireShot(addTrauma: (t: number) => void, punchFov: (v: number) => void): void {
    this.fovTarget = 0;
    punchFov(210); // Snap optic back out with heavy kick
    addTrauma(${p.recoilKick});
  }
  public updateKnifeSpin(knife: THREE.Object3D, dt: number): void {
    knife.rotation.x -= dt * ${p.qSpinSpeed};
  }
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：为我的狙击步枪实现瞬狙手感（开镜快速收窄 FOV 26°、击发超音速轰鸣震屏 + 45ms 顿帧，以及按 Q 旋转近战刀快速取消拉栓后摇）。',
      en: 'Use gamefeel-3d skill: Implement AWM quick-scope sniper feel with rapid 26° FOV snap, supersonic gunshot synth, 45ms hitstop, and Q-key spinning melee switch cancel.',
    },
  },
  {
    id: 'wallbang-penetration',
    category: 'fps',
    badge: 'FPS-03',
    title: {
      zh: '材质穿箱弹道衰减与双面木屑迸射',
      en: 'Material Wallbang Penetration & Damage Falloff',
    },
    subtitle: {
      zh: '运输船经典穿木箱：入射/出射双面碎木粒子 + 闷响滤波 + 穿箱伤害保留率',
      en: 'Entry/exit wood splinter bursts, muffled impact acoustics & wallbang damage retention',
    },
    whyItMatters: {
      zh: '掩体可穿透且带材质视听区分（清脆钢板跳弹 vs 沉闷木箱碎屑 + 穿箱衰减跳字），会让地图博弈瞬间立体起来。',
      en: 'Differentiating wood splinters + attenuated penetration hits vs steel ricochets makes cover tactical and tactile.',
    },
    rawProblem: {
      zh: '多数 Web 射击要么射线遇到第一个 Box 就停，要么穿墙毫无视觉与音效衰减反馈。',
      en: 'Most browser shooters stop raycasts on the first box or pass through silently without exit debris or falloff.',
    },
    controlsHint: {
      zh: '[Space / 点击] 射击穿箱 · [Q / 副动作] 切换木箱 / 钢板掩体',
      en: '[Space / Click] Shoot through cover · [Q / Secondary] Toggle Wood Crate / Steel Plate',
    },
    hasSecondary: { zh: '切换木箱/钢板', en: 'Toggle Wood/Steel' },
    tags: ['wallbang', 'raycast', 'materials', 'debris', 'fps'],
    autoDemoInterval: 0.9,
    params: [
      { key: 'baseDmg', label: { zh: '基础伤害', en: 'Base Damage' }, min: 30, max: 140, step: 2, defaultValue: 84 },
      { key: 'woodRetain', label: { zh: '木箱穿透保留率', en: 'Wood Retention' }, min: 0.25, max: 0.95, step: 0.05, defaultValue: 0.82 },
      { key: 'splinterCount', label: { zh: '碎木飞溅数', en: 'Splinter Count' }, min: 4, max: 28, step: 2, defaultValue: 14 },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(2.5, 2.25, 4.8), new THREE.Vector3(0, 1.35, -1.2), 50, true);
      const dummy = createTargetDummy(0xef4444);
      dummy.root.position.set(0, 0, -2.5);
      ctx.group.add(dummy.root);

      let isSteel = false;
      const woodMat = new THREE.MeshStandardMaterial({ color: 0xb7793e, roughness: 0.78 });
      const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.25 });
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.75, 0.55), woodMat);
      crate.position.set(0, 0.88, -0.45);
      ctx.group.add(crate);

      // Crate cross frame
      const frame = new THREE.LineSegments(
        new THREE.EdgesGeometry(crate.geometry),
        new THREE.LineBasicMaterial({ color: 0x3f2711 })
      );
      crate.add(frame);

      const muzzleOrigin = new THREE.Vector3(0.2, 1.52, 3.2);

      return {
        trigger() {
          const p = ctx.getParams();
          const juice = ctx.isJuiceEnabled();
          const spreadX = (Math.random() - 0.5) * 0.35;
          const isHead = Math.random() > 0.55;
          const targetY = isHead ? 2.02 : 1.38;
          const entryPos = new THREE.Vector3(spreadX, Math.min(1.68, targetY), -0.17);
          const exitPos = new THREE.Vector3(spreadX, Math.min(1.68, targetY), -0.73);
          const hitPos = new THREE.Vector3(spreadX * 0.7, targetY, -2.35);

          if (!juice) {
            ctx.audio.playFlatBeep(250);
            ctx.vfx.spawnTracer(muzzleOrigin, entryPos, 0x888888, 0.06);
            return;
          }

          ctx.audio.playGunshot('suppressed', 1.0);
          ctx.stage.addTrauma(0.22, 28, 2.0);

          if (isSteel && targetY < 1.74) {
            // Ricochet off steel!
            ctx.audio.playWallImpact('steel', false);
            ctx.vfx.spawnTracer(muzzleOrigin, entryPos, 0x93c5fd, 0.09);
            ctx.vfx.spawnSparks(entryPos, {
              count: 20,
              color: 0x60a5fa,
              speed: 9,
              normal: new THREE.Vector3(0, 0.2, 1),
            });
            ctx.vfx.spawnFloatingText(entryPos.clone().add(new THREE.Vector3(0, 0.35, 0)), 'BLOCKED 0', {
              color: '#94a3b8',
              scale: 0.85,
            });
            ctx.emitCallout('🛡️ STEEL RICOCHET (0 DMG)', 'cyan');
          } else {
            const throughWood = targetY < 1.75 && !isSteel;
            if (throughWood) {
              ctx.audio.playWallImpact('wood', true);
              ctx.vfx.spawnSparks(entryPos, {
                count: p.splinterCount,
                color: 0xd99b52,
                coreColor: 0xfde68a,
                chunk: true,
                speed: 5.2,
                normal: new THREE.Vector3(0, 0.2, 1),
              });
              ctx.vfx.spawnSparks(exitPos, {
                count: Math.ceil(p.splinterCount * 0.8),
                color: 0xc2813d,
                chunk: true,
                speed: 6.5,
                normal: new THREE.Vector3(0, 0.1, -1),
              });
            }

            const mult = (throughWood ? p.woodRetain : 1) * (isHead ? 2.4 : 1);
            const dmg = Math.round(p.baseDmg * mult);
            ctx.vfx.spawnTracer(muzzleOrigin, hitPos, throughWood ? 0xfbbf24 : 0xfef08a, 0.11);
            ctx.vfx.spawnSparks(hitPos, { count: isHead ? 18 : 10, color: isHead ? 0xfacc15 : 0xf87171, speed: 7 });
            if (isHead) ctx.audio.playHeadshotChime(throughWood ? 0.92 : 1.05);
            dummy.flash(0.09, isHead);
            dummy.kickVel.x = -3.8;
            ctx.vfx.spawnFloatingText(
              hitPos.clone().add(new THREE.Vector3(0, 0.42, 0)),
              `${throughWood ? 'WALLBANG ' : ''}-${dmg}`,
              { color: isHead ? '#fde047' : '#fb923c', scale: isHead ? 1.15 : 0.95 }
            );
            ctx.emitCallout(
              throughWood ? `📦 穿箱命中 ${Math.round(p.woodRetain * 100)}% 伤害!` : '🎯 直接爆头命中!',
              isHead ? 'gold' : 'emerald'
            );
          }
          ctx.setHudStat('COVER / RETAIN', `${isSteel ? 'STEEL (0%)' : `WOOD (${Math.round(p.woodRetain * 100)}%)`}`);
        },
        secondary() {
          isSteel = !isSteel;
          crate.material = isSteel ? steelMat : woodMat;
          ctx.emitCallout(isSteel ? '切换为：防弹钢板掩体' : '切换为：可穿透战术木箱', 'cyan');
        },
        update(_rawDt, scaledDt) {
          dummy.update(scaledDt);
        },
      };
    },
    generateCode(p) {
      return `// Material Wallbang Attenuation & Entry/Exit Debris
export function computeWallbangDamage(
  baseDmg = ${p.baseDmg},
  material: 'none' | 'wood' | 'steel',
  isHeadshot: boolean
): number {
  if (material === 'steel') return 0; // Ricochet!
  const retain = material === 'wood' ? ${p.woodRetain} : 1.0;
  return Math.round(baseDmg * retain * (isHeadshot ? 2.4 : 1.0));
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：实现射击穿箱系统，区分木箱（82% 伤害保留 + 入射与出射双面木屑飞溅 + 闷响音效）与钢板（0 伤害蓝白火星跳弹）。',
      en: 'Use gamefeel-3d skill: Implement tactical wallbang ballistics differentiating penetrable wood crates (82% damage retention, entry/exit splinter bursts, muffled audio) vs steel ricochets.',
    },
  },
  {
    id: 'headshot-kill-confirm',
    category: 'fps',
    badge: 'FPS-04',
    title: {
      zh: '黄金爆头清脆反馈与受击方向红弧',
      en: 'Golden Headshot Chime & Directional Damage Arc',
    },
    subtitle: {
      zh: '头盔金属清脆泛音 + 连杀音阶递进 + 屏幕受击方位红弧指示器',
      en: 'Multi-harmonic helmet ring, pitch-climbing killstreak chime & HUD directional damage arc',
    },
    whyItMatters: {
      zh: '竞技射击最上瘾的正反馈就是「叮！」那一下高频泛音与金色星芒爆裂；而挨打时玩家必须在 0.1 秒内靠红弧知道敌人在哪一侧。',
      en: 'Nothing hooks FPS players faster than a crisp metallic headshot "DING!" paired with instant directional threat awareness.',
    },
    rawProblem: {
      zh: '缺乏命中确认音阶与受击方向 HUD，玩家既不知道打没打中头，也不知道自己从哪边掉血。',
      en: 'Without hit-confirm harmonics and directional HUD arcs, combat feels muddy and disorienting.',
    },
    controlsHint: {
      zh: '[Space / 点击] 触发黄金爆头连杀 · [Q / 副动作] 模拟侧方受击红弧预警',
      en: '[Space / Click] Golden Headshot Streak · [Q / Secondary] Simulate Incoming Side Hit',
    },
    hasSecondary: { zh: '模拟侧向受击红弧', en: 'Simulate Incoming Hit' },
    tags: ['headshot', 'hud', 'killstreak', 'audio', 'fps'],
    autoDemoInterval: 0.85,
    params: [
      { key: 'pitchStep', label: { zh: '连杀升调半音', en: 'Streak Pitch Climb' }, min: 0, max: 3, step: 0.25, defaultValue: 1.25 },
      { key: 'sparkBurst', label: { zh: '金星爆裂粒子', en: 'Gold Spark Count' }, min: 8, max: 45, step: 1, defaultValue: 28 },
      { key: 'hitstopMs', label: { zh: '击杀微顿帧', en: 'Kill Hitstop' }, min: 0, max: 90, step: 5, defaultValue: 35, unit: 'ms' },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 1.85, 4.9), new THREE.Vector3(0, 1.5, -1.8), 52, true);
      const dummies = [-1.7, 0, 1.7].map((x, idx) => {
        const d = createTargetDummy([0x3b82f6, 0x8b5cf6, 0xec4899][idx]);
        d.root.position.set(x, 0, -1.8);
        ctx.group.add(d.root);
        return d;
      });

      let streak = 0;
      return {
        trigger() {
          const p = ctx.getParams();
          const target = dummies[streak % dummies.length];
          streak = (streak % 5) + 1;
          const headPos = target.root.position.clone().add(new THREE.Vector3(0, 2.02, 0));

          if (ctx.isJuiceEnabled()) {
            const pitch = Math.pow(2, ((streak - 1) * p.pitchStep) / 12);
            ctx.audio.playGunshot('rifle', 0.85);
            ctx.audio.playHeadshotChime(pitch);
            ctx.stage.clock.triggerHitstop(p.hitstopMs / 1000);
            ctx.stage.addTrauma(0.32, 30, 2.1);
            ctx.stage.punchFov(18);
            ctx.vfx.spawnSparks(headPos, {
              count: p.sparkBurst,
              color: 0xffd700,
              coreColor: 0xffffff,
              speed: 9.2,
            });
            ctx.vfx.spawnShockRing(headPos, 0xffe066, 2.6, 0.22);
            const labels = ['HEADSHOT!', 'DOUBLE KILL!', 'MULTI KILL!', 'ULTRA KILL!', 'RAMPAGE ★'];
            ctx.vfx.spawnFloatingText(headPos.clone().add(new THREE.Vector3(0, 0.5, 0)), labels[streak - 1], {
              color: '#fde047',
              scale: 1.1 + streak * 0.08,
            });
            target.flash(0.12, true);
            target.kickVel.x = -5.2;
            ctx.emitCallout(`★ ${labels[streak - 1]} (${streak}x)`, 'gold');
          } else {
            ctx.audio.playFlatBeep(340);
          }
          ctx.setHudStat('KILLSTREAK', `${streak} CHAIN`);
        },
        secondary() {
          const angle = (Math.random() * Math.PI * 1.4) - Math.PI * 0.7;
          if (ctx.isJuiceEnabled()) {
            ctx.stage.damageArcAngle = angle;
            ctx.stage.damageArcAlpha = 0.95;
            ctx.stage.vignetteIntensity = 0.55;
            ctx.stage.addTrauma(0.38, 25, 1.9);
            ctx.stage.punchRoll(angle > 0 ? -9 : 9);
            ctx.audio.playHeavyImpact(0.75);
            ctx.emitCallout('⚠️ INCOMING DIRECTIONAL HIT!', 'crimson');
          } else {
            ctx.audio.playFlatBeep(180);
          }
        },
        update(_rawDt, scaledDt) {
          for (const d of dummies) d.update(scaledDt);
        },
      };
    },
    generateCode(p) {
      return `// Pitch-Climbing Headshot Chime + Directional Threat Angle
export function getStreakPitchMultiplier(streakCount: number): number {
  return Math.pow(2, ((streakCount - 1) * ${p.pitchStep}) / 12);
}

export function getDamageIndicatorAngle(
  playerPos: THREE.Vector3,
  playerForward: THREE.Vector3,
  attackerPos: THREE.Vector3
): number {
  const toAttacker = attackerPos.clone().sub(playerPos).setY(0).normalize();
  const fwd = playerForward.clone().setY(0).normalize();
  return Math.atan2(fwd.x * toAttacker.z - fwd.z * toAttacker.x, fwd.dot(toAttacker));
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：添加黄金爆头击杀确认反馈（三泛音金属头盔叮声 + 连杀半音阶递增 + 28 颗金星迸射 + 35ms 顿帧）以及屏幕中心受击方位红弧指示器。',
      en: 'Use gamefeel-3d skill: Add golden headshot confirmation (3-partial metallic chime with killstreak pitch climb, 28 gold sparks, 35ms hitstop) plus a directional HUD damage indicator arc.',
    },
  },
];
