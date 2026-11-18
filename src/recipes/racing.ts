import * as THREE from 'three';
import { RibbonTrail } from '../core/vfxForge';
import { Spring1D, damp } from '../core/math';
import type { RecipeDefinition } from '../core/types';
import { createAeroKart } from './helpers';

export const racingRecipes: RecipeDefinition[] = [
  {
    id: 'drift-slip-sparks',
    category: 'racing',
    badge: 'RACE-01',
    title: {
      zh: '车头/速度解耦侧滑漂移与三阶胎火',
      en: 'Decoupled Slip-Angle Drift & 3-Tier Tire Sparks',
    },
    subtitle: {
      zh: '车头朝向与真实速度矢量分离 + 车身侧倾 + 蓝/紫/金三阶段集气火星',
      en: 'Heading vs velocity yaw separation, chassis roll tilt & Blue -> Purple -> Gold spark tiers',
    },
    whyItMatters: {
      zh: '街机赛车（QQ飞车/马车）爽快过弯的核心绝不是刚体轮胎摩擦模拟，而是手动解耦 `headingYaw` 与 `velocityYaw`，配合后轮三色进阶火星！',
      en: 'Arcade kart magic comes from decoupling visual nose yaw from velocity vector yaw, paired with tiered Blue -> Purple -> Gold sparks.',
    },
    rawProblem: {
      zh: '直接旋转 `car.rotation.y` 并沿车头前进，车子像在轨道上死板平移，毫无侧滑甩尾感。',
      en: 'Rotating car.rotation.y locked to velocity makes karts feel like slot-cars on rails with zero slip.',
    },
    controlsHint: {
      zh: '[Space / 点击] 左右切换甩尾漂移蓄力（观察蓝火 -> 紫火 -> 金火进阶）',
      en: '[Space / Click] Initiate / Flip Drift Direction (watch Blue -> Purple -> Gold charge)',
    },
    tags: ['drift', 'kart', 'racing', 'sparks', 'physics'],
    autoDemoInterval: 1.75,
    params: [
      { key: 'slipDeg', label: { zh: '最大侧滑夹角', en: 'Max Slip Angle' }, min: 15, max: 55, step: 1, defaultValue: 36, unit: '°' },
      { key: 'bodyRoll', label: { zh: '车身侧倾角', en: 'Chassis Roll' }, min: 2, max: 18, step: 1, defaultValue: 10, unit: '°' },
      { key: 'chargeSpeed', label: { zh: '集气进阶速度', en: 'Charge Rate' }, min: 0.5, max: 2.5, step: 0.1, defaultValue: 1.2 },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 2.35, 5.2), new THREE.Vector3(0, 0.75, -1.2), 56, true);
      const kart = createAeroKart(0xf43f5e);
      ctx.group.add(kart.root);

      const skidL = new RibbonTrail(ctx.group, 28);
      const skidR = new RibbonTrail(ctx.group, 28);
      skidL.maxAge = 0.35;
      skidR.maxAge = 0.35;

      let driftDir = 1;
      let driftTime = 0.1;
      const rlPos = new THREE.Vector3();
      const rrPos = new THREE.Vector3();

      return {
        trigger() {
          driftDir *= -1;
          driftTime = 0.05;
          if (ctx.isJuiceEnabled()) {
            ctx.stage.punchRoll(driftDir * 6.5);
            ctx.stage.addTrauma(0.16, 22, 2.4);
          } else {
            ctx.audio.playFlatBeep(260);
          }
        },
        update(rawDt, scaledDt, elapsed) {
          const p = ctx.getParams();
          const juice = ctx.isJuiceEnabled();
          driftTime += scaledDt * p.chargeSpeed;

          const tier = driftTime > 1.25 ? 3 : driftTime > 0.62 ? 2 : 1;
          const tierColors = [0x38bdf8, 0xc084fc, 0xfacc15];
          const tierNames = ['BLUE SPARK', 'PURPLE SPARK', 'GOLD MAX!'];
          const col = tierColors[tier - 1];

          const targetYaw = THREE.MathUtils.degToRad(p.slipDeg) * driftDir;
          kart.root.rotation.y = damp(kart.root.rotation.y, targetYaw, 8.5, scaledDt);
          kart.chassis.rotation.z = damp(
            kart.chassis.rotation.z,
            juice ? THREE.MathUtils.degToRad(-p.bodyRoll * driftDir) : 0,
            10,
            scaledDt
          );
          kart.root.position.x = Math.sin(elapsed * 1.6) * 0.65;

          for (const w of kart.wheels) w.rotation.x -= scaledDt * 24;
          ctx.stage.scrollFloor(scaledDt * 18);

          kart.rearLeft.getWorldPosition(rlPos);
          kart.rearRight.getWorldPosition(rrPos);

          if (juice) {
            ctx.audio.updateEngine(true, 195, true, tier);
            skidL.setPalette(0xffffff, col, 0.72);
            skidR.setPalette(0xffffff, col, 0.72);
            skidL.setActive(true);
            skidR.setActive(true);
            if (Math.random() < 0.65) {
              ctx.vfx.spawnSparks(driftDir > 0 ? rlPos : rrPos, {
                count: tier + 1,
                color: col,
                speed: 5.5,
                life: 0.18,
                flashIntensity: 4,
              });
            }
          } else {
            ctx.audio.stopContinuous();
            skidL.setActive(false);
            skidR.setActive(false);
          }

          skidL.update(rlPos, rlPos.clone().add(new THREE.Vector3(0.14, 0, 0)), scaledDt, elapsed);
          skidR.update(rrPos, rrPos.clone().add(new THREE.Vector3(0.14, 0, 0)), scaledDt, elapsed);
          ctx.setHudStat('SLIP / TIER', `${p.slipDeg}° · ${tierNames[tier - 1]}`);
          void rawDt;
        },
        dispose() {
          ctx.audio.stopContinuous();
          skidL.dispose();
          skidR.dispose();
        },
      };
    },
    generateCode(p) {
      return `// Decoupled Arcade Drift: Nose Heading Yaw vs Velocity Yaw
export function stepArcadeDrift(
  headingYaw: number,
  velYaw: number,
  steerDir: -1 | 1,
  dt: number
): { headingYaw: number; velYaw: number; slipAngle: number } {
  const maxSlip = THREE.MathUtils.degToRad(${p.slipDeg});
  headingYaw += steerDir * 2.6 * dt;
  // Velocity lags behind nose -> authentic sideways tail-slide!
  velYaw = THREE.MathUtils.lerp(velYaw, headingYaw - steerDir * maxSlip, 1 - Math.exp(-4.5 * dt));
  return { headingYaw, velYaw, slipAngle: headingYaw - velYaw };
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：为我的 3D 赛车实现街机侧滑漂移手感（解耦车头朝向角与速度方向角 36°、车身反向侧倾 10°、后轮双胎痕条带、漂移啸叫以及蓝→紫→金三阶段集气火星）。',
      en: 'Use gamefeel-3d skill: Implement arcade kart drift physics with decoupled nose heading vs velocity yaw (36° max slip), 10° chassis roll, dual rear tire trails, tire screech synth, and Blue -> Purple -> Gold spark tiers.',
    },
  },
  {
    id: 'cww-nitro-fov-warp',
    category: 'racing',
    badge: 'RACE-02',
    title: {
      zh: 'CWW 双喷氮气状态机与速度线 FOV 畸变',
      en: 'CWW Double-Jet State Machine & Speed-Line FOV Warp',
    },
    subtitle: {
      zh: '氮气 C + 双小喷 WW 叠加突破极速上限 + 广角拉伸 + 径向破风速度线',
      en: 'N2O + Double Mini-Boost combo cap break, wide-angle FOV punch & radial speed-lines',
    },
    whyItMatters: {
      zh: '300 km/h 在没有参照时跟 100 km/h 差不多，真正让人肾上腺素飙升的是「FOV 瞬间外扩 22° + 车体后拽滞后 + 双尾焰爆燃 + 屏幕边缘速度线」！',
      en: 'Speed is an illusion sold by sudden +22° FOV expansion, camera spring lag, twin blue/gold afterburners, and radial speed-lines.',
    },
    rawProblem: {
      zh: '普通加速只是把 `speed += 50`，镜头死死绑在车屁股后面，完全感觉不到推背感。',
      en: 'Simply increasing speed += 50 with a rigid parented camera conveys zero G-force acceleration.',
    },
    controlsHint: {
      zh: '[Space / 点击] 依次触发：氮气 (C) -> CW 喷 -> 极限 CWW 喷（突破 312 km/h）！',
      en: '[Space / Click] Chain: N2O (C) -> CW Boost -> CWW Limit-Break (312 km/h)!',
    },
    tags: ['nitro', 'fov', 'speed-lines', 'cww', 'racing'],
    autoDemoInterval: 0.72,
    params: [
      { key: 'fovWarp', label: { zh: 'CWW 广角扩张', en: 'Max FOV Warp' }, min: 6, max: 34, step: 1, defaultValue: 22, unit: '°' },
      { key: 'cwwTopSpeed', label: { zh: 'CWW 极限车速', en: 'CWW Cap Speed' }, min: 240, max: 360, step: 5, defaultValue: 312, unit: 'km/h' },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 2.0, 4.9), new THREE.Vector3(0, 0.75, -2.0), 56, true);
      const kart = createAeroKart(0x2563eb);
      ctx.group.add(kart.root);

      let stage = 0; // 0 cruise, 1 C, 2 CW, 3 CWW
      let boostTimer = 0;
      let speedKmh = 185;
      const zLag = new Spring1D(0);

      return {
        trigger() {
          const p = ctx.getParams();
          const juice = ctx.isJuiceEnabled();
          stage = (stage % 3) + 1;
          boostTimer = 1.65;

          const caps = [185, 258, 286, p.cwwTopSpeed];
          const names = ['CRUISE', '氮气加速 N2O (C)', 'CW 蓄力二段!', `🔥 CWW 极限突破 ${p.cwwTopSpeed} km/h!`];
          speedKmh = caps[stage];

          if (juice) {
            ctx.audio.playNitroBoost(stage === 3 ? 'cww' : stage === 1 ? 'nitro' : 'mini');
            const warp = (p.fovWarp * stage) / 3;
            ctx.stage.punchFov(95 + stage * 35, warp);
            ctx.stage.addTrauma(0.14 + stage * 0.08, 28, 1.8);
            ctx.stage.speedLinesIntensity = 0.35 * stage;
            zLag.impulse(-3.2 * stage);
            ctx.vfx.spawnShockRing(new THREE.Vector3(0, 0.55, 1.4), stage === 3 ? 0xfacc15 : 0x38bdf8, 3.2, 0.24);
            ctx.emitCallout(names[stage], stage === 3 ? 'gold' : 'cyan');
          } else {
            ctx.audio.playFlatBeep(320 + stage * 60);
          }
        },
        update(rawDt, scaledDt, elapsed) {
          const juice = ctx.isJuiceEnabled();
          if (boostTimer > 0) {
            boostTimer -= scaledDt;
            if (juice) ctx.stage.speedLinesIntensity = Math.max(ctx.stage.speedLinesIntensity, 0.22 * stage);
            if (boostTimer <= 0) {
              stage = 0;
              ctx.stage.fovSpring.target = 0;
            }
          } else {
            speedKmh = damp(speedKmh, 185, 4, scaledDt);
          }

          const lag = zLag.step(rawDt, 140, 12);
          kart.root.position.z = juice ? lag * 0.22 : 0;
          kart.chassis.rotation.x = juice ? lag * 0.08 : 0;

          for (const w of kart.wheels) w.rotation.x -= scaledDt * (speedKmh / 7.5);
          ctx.stage.scrollFloor(scaledDt * (speedKmh / 9.5));

          for (const f of kart.flames) {
            f.visible = juice && stage > 0;
            if (f.visible) {
              const mat = f.material as THREE.MeshBasicMaterial;
              mat.color.setHex(stage === 3 ? 0xfacc15 : stage === 2 ? 0xa855f7 : 0x38bdf8);
              const pulse = 0.85 + Math.sin(elapsed * 45) * 0.22 + stage * 0.28;
              f.scale.set(1 + stage * 0.15, pulse, 1 + stage * 0.15);
            }
          }

          if (juice) ctx.audio.updateEngine(true, speedKmh, false, stage);
          else ctx.audio.stopContinuous();

          ctx.setHudStat('SPEED / COMBO', `${speedKmh.toFixed(0)} km/h · ${['CRUISE', 'N2O', 'CW', 'CWW'][stage]}`);
        },
        dispose() {
          ctx.audio.stopContinuous();
        },
      };
    },
    generateCode(p) {
      return `// CWW Nitro + Double Mini-Boost Combo State Machine
export type BoostStage = 'none' | 'c_only' | 'cw' | 'cww';
export function advanceBoostCombo(stage: BoostStage): { stage: BoostStage; speedCap: number; fovOffset: number } {
  if (stage === 'none') return { stage: 'c_only', speedCap: 258, fovOffset: ${(p.fovWarp * 0.35).toFixed(1)} };
  if (stage === 'c_only') return { stage: 'cw', speedCap: 286, fovOffset: ${(p.fovWarp * 0.68).toFixed(1)} };
  return { stage: 'cww', speedCap: ${p.cwwTopSpeed}, fovOffset: ${p.fovWarp} };
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：为赛车添加 CWW 氮气双喷状态机与速度感镜头（随 C -> CW -> CWW 阶梯突破极速至 312 km/h、相机广角 FOV 扩张 22°、车体推背弹簧前冲、双尾焰变色与边缘径向速度线）。',
      en: 'Use gamefeel-3d skill: Implement a CWW nitro double-boost state machine with +22° wide-angle FOV warp, camera G-force lag spring, color-shifting twin afterburners, and radial speed-lines.',
    },
  },
  {
    id: 'cut-drift-snap',
    category: 'racing',
    badge: 'RACE-03',
    title: {
      zh: '断位拉车头瞬回正与双喷窗口',
      en: 'Cut-Drift Counter-Steer Nose Snap',
    },
    subtitle: {
      zh: '漂移途中反向点漂瞬间收拢速度矢量，秒拉直线并赠送双喷小窗口',
      en: 'Counter-steer drift tap snaps velocity vector back to nose heading + grants instant double-boost',
    },
    whyItMatters: {
      zh: '高手向竞速手感精髓在于「可控收放」：入弯甩尾，出弯反打断位瞬间拉直车头冲出去，操作响应干脆利落！',
      en: 'High-skill racing depth comes from crisp exit control: snapping out of a deep slide via counter-steer cut-drift.',
    },
    rawProblem: {
      zh: '普通漂移松键后还要滑行半天才能回正，出弯粘滞拖泥带水。',
      en: 'Standard drift models take forever to regain grip on corner exit, feeling sluggish and floaty.',
    },
    controlsHint: {
      zh: '[Space / 点击] 入弯深漂 -> [Q / 副动作] 触发「断位拉车头」瞬间回正双喷！',
      en: '[Space / Click] Enter Deep Drift -> [Q / Secondary] Cut-Drift Snap & Double Jet!',
    },
    hasSecondary: { zh: '断位拉车头 SNAP!', en: 'Cut-Drift Snap!' },
    tags: ['cut-drift', 'counter-steer', 'racing', 'controls'],
    autoDemoInterval: 1.4,
    params: [
      { key: 'snapRatio', label: { zh: '矢量瞬回正比例', en: 'Velocity Snap Lerp' }, min: 0.4, max: 1.0, step: 0.05, defaultValue: 0.82 },
      { key: 'jetPunch', label: { zh: '出弯双喷推力', en: 'Exit Jet Punch' }, min: 1, max: 4, step: 0.2, defaultValue: 2.4 },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 2.35, 5.1), new THREE.Vector3(0, 0.8, -1.5), 55, true);
      const kart = createAeroKart(0x10b981);
      ctx.group.add(kart.root);

      let drifting = false;
      let jetTimer = 0;
      const pitchSpring = new Spring1D(0);

      const snapStraight = () => {
        const p = ctx.getParams();
        drifting = false;
        jetTimer = 0.55;
        kart.root.rotation.y *= 1 - p.snapRatio;
        if (ctx.isJuiceEnabled()) {
          ctx.audio.playNitroBoost('mini');
          ctx.stage.punchFov(75 * p.jetPunch, 12);
          ctx.stage.punchRoll(-8);
          ctx.stage.addTrauma(0.22, 26, 2.2);
          ctx.stage.speedLinesIntensity = 0.55;
          pitchSpring.impulse(-3.2 * p.jetPunch);
          ctx.vfx.spawnShockRing(new THREE.Vector3(0, 0.5, 1.2), 0x34d399, 2.8, 0.2);
          ctx.vfx.spawnFloatingText(new THREE.Vector3(0, 1.35, 0), '断位双喷!', { color: '#34d399', scale: 1.2 });
          ctx.emitCallout('⚡ 断位拉车头 CUT-DRIFT SNAP!', 'emerald');
        } else {
          ctx.audio.playFlatBeep(350);
        }
      };

      return {
        trigger() {
          if (!drifting) {
            drifting = true;
            if (ctx.isJuiceEnabled()) ctx.emitCallout('↪ 入弯侧滑蓄力...', 'cyan');
          } else {
            snapStraight();
          }
        },
        secondary: snapStraight,
        update(rawDt, scaledDt, elapsed) {
          const juice = ctx.isJuiceEnabled();
          const pitch = pitchSpring.step(rawDt, 180, 14);
          if (jetTimer > 0) {
            jetTimer -= scaledDt;
            if (jetTimer <= 0) ctx.stage.fovSpring.target = 0;
          }

          kart.root.rotation.y = damp(kart.root.rotation.y, drifting ? 0.68 : 0, drifting ? 7 : 18, scaledDt);
          kart.chassis.rotation.z = damp(kart.chassis.rotation.z, drifting && juice ? -0.18 : 0, 12, scaledDt);
          kart.chassis.rotation.x = juice ? pitch * 0.08 : 0;

          for (const f of kart.flames) {
            f.visible = juice && jetTimer > 0;
            f.scale.y = 0.9 + Math.sin(elapsed * 40) * 0.25;
          }
          for (const w of kart.wheels) w.rotation.x -= scaledDt * (jetTimer > 0 ? 32 : 20);
          ctx.stage.scrollFloor(scaledDt * (jetTimer > 0 ? 28 : 16));

          if (juice) ctx.audio.updateEngine(true, jetTimer > 0 ? 255 : 185, drifting, jetTimer > 0 ? 2 : 0);
          else ctx.audio.stopContinuous();

          ctx.setHudStat('DRIFT STATE', drifting ? 'SLIDING (39°)' : jetTimer > 0 ? 'SNAP DOUBLE-JET!' : 'GRIP');
        },
        dispose() {
          ctx.audio.stopContinuous();
        },
      };
    },
    generateCode(p) {
      return `// Cut-Drift Counter-Steer Detection & Velocity Alignment
export function tryCutDrift(
  driftDuration: number,
  driftDir: number,
  steerInput: number,
  driftTapped: boolean,
  velYaw: number,
  headingYaw: number
): { snapped: boolean; newVelYaw: number; miniBoosts: number } {
  if (driftTapped && driftDuration > 0.22 && Math.sign(steerInput) === -driftDir) {
    return {
      snapped: true,
      newVelYaw: THREE.MathUtils.lerp(velYaw, headingYaw, ${p.snapRatio}),
      miniBoosts: 2,
    };
  }
  return { snapped: false, newVelYaw: velYaw, miniBoosts: 0 };
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：在漂移物理中加入「断位拉车头」操作（漂移满 0.22s 后反向打方向并轻点漂移键，以 0.82 比例瞬间对齐速度角与车头角并激活双小喷窗口）。',
      en: 'Use gamefeel-3d skill: Add a Cut-Drift mechanic where tapping drift while counter-steering after 0.22s snaps velocity yaw 82% toward nose heading and grants a double mini-boost window.',
    },
  },
  {
    id: 'suspension-landing-squash',
    category: 'racing',
    badge: 'RACE-04',
    title: {
      zh: '飞跃滞空仰角与落地悬挂压缩回弹',
      en: 'Ramp Hang-Time Pitch & Landing Suspension Squash',
    },
    subtitle: {
      zh: '飞坡车头上扬 -> 触地瞬间底盘下沉挤压 + 地面气浪尘环 + 落地喷触发',
      en: 'Airborne nose-up hang -> landing chassis compression spring + ground shock ring + landing boost',
    },
    whyItMatters: {
      zh: '有高低落差的赛道如果落下来像砖头粘在地上会非常假；底盘二阶弹簧下压 18cm 再弹起 + 环形尘雾能让整台车立刻活过来！',
      en: 'Ramps feel dead if cars land stiffly like bricks; chassis spring compression + ground dust ring + landing boost sells real suspension mass.',
    },
    rawProblem: {
      zh: '刚体直接 `if (y < 0) y = 0; vy = 0;`，落地硬邦邦毫无悬挂缓冲。',
      en: 'Clamping if (y < 0) y = 0 with zero chassis spring compression makes vehicles look weightless and stiff.',
    },
    controlsHint: {
      zh: '[Space / 点击] 飞跃跳台，观察空中姿态与触地瞬间悬挂挤压回弹！',
      en: '[Space / Click] Launch off Ramp — watch airborne pitch & landing chassis compression!',
    },
    tags: ['suspension', 'squash-stretch', 'landing-boost', 'racing'],
    autoDemoInterval: 1.65,
    params: [
      { key: 'jumpVel', label: { zh: '起跳垂直初速', en: 'Launch Velocity' }, min: 4, max: 13, step: 0.5, defaultValue: 8.2, unit: 'm/s' },
      { key: 'squashDepth', label: { zh: '落地悬挂下压', en: 'Landing Squash' }, min: 0.05, max: 0.45, step: 0.05, defaultValue: 0.24 },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(3.2, 2.05, 4.6), new THREE.Vector3(0, 0.9, 0), 50, true);
      const kart = createAeroKart(0xf59e0b);
      ctx.group.add(kart.root);

      let y = 0;
      let vy = 0;
      let airborne = false;
      let landBoostTimer = 0;
      const suspSpring = new Spring1D(0);

      return {
        trigger() {
          if (airborne) return;
          const p = ctx.getParams();
          vy = p.jumpVel;
          airborne = true;
          if (ctx.isJuiceEnabled()) {
            ctx.audio.playNitroBoost('mini');
            ctx.stage.punchFov(28);
          } else {
            ctx.audio.playFlatBeep(300);
          }
        },
        update(rawDt, scaledDt, elapsed) {
          const p = ctx.getParams();
          const juice = ctx.isJuiceEnabled();

          if (airborne) {
            vy -= 21 * scaledDt;
            y += vy * scaledDt;
            kart.chassis.rotation.x = juice ? THREE.MathUtils.clamp(-vy * 0.045, -0.32, 0.28) : 0;
            if (y <= 0) {
              y = 0;
              const impactSpeed = Math.abs(vy);
              vy = 0;
              airborne = false;
              landBoostTimer = 0.5;

              if (juice) {
                suspSpring.impulse(-impactSpeed * p.squashDepth * 3.8);
                ctx.audio.playHeavyImpact(0.85);
                ctx.audio.playNitroBoost('mini');
                ctx.stage.addTrauma(0.32, 24, 2.0);
                ctx.stage.punchFov(48, 8);
                ctx.vfx.spawnShockRing(new THREE.Vector3(0, 0.04, 0), 0xfbbf24, 3.6, 0.28, true);
                ctx.vfx.spawnSparks(new THREE.Vector3(0, 0.12, 0.7), { count: 18, color: 0xfde047, speed: 6.5 });
                ctx.vfx.spawnFloatingText(new THREE.Vector3(0, 1.4, 0), '落地喷 LANDING JET!', {
                  color: '#fbbf24',
                  scale: 1.15,
                });
                ctx.emitCallout('🛬 悬挂触底回弹 + 落地喷!', 'gold');
              }
            }
          } else {
            kart.chassis.rotation.x = damp(kart.chassis.rotation.x, 0, 12, scaledDt);
          }

          if (landBoostTimer > 0) {
            landBoostTimer -= scaledDt;
            if (landBoostTimer <= 0) ctx.stage.fovSpring.target = 0;
          }

          const comp = suspSpring.step(rawDt, 230, 13);
          kart.root.position.y = y;
          kart.chassis.position.y = juice ? comp : 0;
          const stretch = juice ? THREE.MathUtils.clamp(1 + comp * 0.9, 0.72, 1.2) : 1;
          kart.chassis.scale.set(1 / Math.sqrt(stretch), stretch, 1);

          for (const f of kart.flames) {
            f.visible = juice && landBoostTimer > 0;
            f.scale.y = 1 + Math.sin(elapsed * 40) * 0.2;
          }
          for (const w of kart.wheels) w.rotation.x -= scaledDt * 22;
          ctx.stage.scrollFloor(scaledDt * (landBoostTimer > 0 ? 25 : 16));
          ctx.setHudStat('AIR / SUSPENSION', `${airborne ? `AIR +${y.toFixed(2)}m` : 'GROUNDED'} · ${(comp * 100).toFixed(0)}cm`);
        },
      };
    },
    generateCode(p) {
      return `// Landing Chassis Compression Spring + Squash-and-Stretch Volume Preservation
export function onVehicleLand(impactVy: number, suspensionSpring: { velocity: number }): void {
  suspensionSpring.velocity -= Math.abs(impactVy) * ${p.squashDepth} * 3.8;
}

export function applyChassisSquash(chassis: THREE.Object3D, springOffset: number): void {
  chassis.position.y = springOffset;
  const sy = THREE.MathUtils.clamp(1 + springOffset * 0.9, 0.72, 1.2);
  chassis.scale.set(1 / Math.sqrt(sy), sy, 1); // Preserve volume!
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：为车辆添加飞坡滞空仰角与落地二阶弹簧悬挂压缩（触地按垂直速度注入下压冲量、车壳体积守恒挤压回弹、地面扩散气浪环并自动激活落地小喷）。',
      en: 'Use gamefeel-3d skill: Add airborne pitch tilt and landing chassis spring compression with volume-preserving squash-and-stretch, ground shockwave dust ring, and landing mini-boost.',
    },
  },
];
