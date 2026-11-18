import * as THREE from 'three';
import type { RecipeDefinition } from '../core/types';

export const worldRecipes: RecipeDefinition[] = [
  {
    id: 'procedural-voronoi-shatter',
    category: 'world',
    badge: 'WLD-01',
    title: {
      zh: '零预制模型 3×3×3 实时爆碎飞散与地面弹跳',
      en: 'Zero-Asset 27-Chunk Procedural Mesh Shatter',
    },
    subtitle: {
      zh: '击破瞬间将完整水晶柱原地切分为 27 块物理碎块，径向爆开并在地面二次弹跳消散',
      en: 'Subdivides intact monolith into 27 tumbling, floor-bouncing crystal shards at impact frame',
    },
    whyItMatters: {
      zh: '场景物件被打爆时直接 `scene.remove(box)` 极其突兀；用代码在原包围盒内即时生成 3×3×3 随机抖动碎块并加地面反弹阻尼，无需任何破碎 FBX 就有次世代破坏爽感！',
      en: 'Deleting destroyed props abruptly feels cheap; subdividing the AABB into 27 tumbling, floor-bouncing shards requires zero pre-fractured FBX assets.',
    },
    rawProblem: {
      zh: '箱子或石柱HP归零直接凭空消失，毫无物理质量与破坏残留反馈。',
      en: 'Crates and pillars simply vanish when HP hits 0 with zero physical mass or debris persistence.',
    },
    controlsHint: {
      zh: '[Space / 点击] 重击轰碎能量水晶方尖碑（27 块物理碎片弹跳飞散）！',
      en: '[Space / Click] Shatter Crystal Monolith into 27 Bouncing Shards!',
    },
    tags: ['destruction', 'shatter', 'fracture', 'debris', 'world'],
    autoDemoInterval: 1.75,
    params: [
      { key: 'blastForce', label: { zh: '径向爆破初速', en: 'Shatter Impulse' }, min: 3, max: 14, step: 0.5, defaultValue: 7.5, unit: 'm/s' },
      { key: 'restitution', label: { zh: '地面弹跳弹性', en: 'Floor Bounce' }, min: 0.1, max: 0.8, step: 0.05, defaultValue: 0.48 },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 2.55, 5.6), new THREE.Vector3(0, 1.15, 0), 50, true);

      const crystalMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.45,
        metalness: 0.35,
        roughness: 0.15,
      });

      const monolith = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.1, 1.05), crystalMat);
      monolith.position.y = 1.05;
      ctx.group.add(monolith);

      const shardGeo = new THREE.DodecahedronGeometry(0.22, 0);
      interface Shard {
        mesh: THREE.Mesh;
        vel: THREE.Vector3;
        rotVel: THREE.Vector3;
        age: number;
      }
      const shards: Shard[] = [];
      let respawnTimer = 0;

      const clearShards = () => {
        for (const s of shards) ctx.group.remove(s.mesh);
        shards.length = 0;
      };

      return {
        trigger() {
          const p = ctx.getParams();
          clearShards();
          monolith.visible = false;
          respawnTimer = 1.35;

          if (ctx.isJuiceEnabled()) {
            for (let ix = -1; ix <= 1; ix++) {
              for (let iy = 0; iy < 3; iy++) {
                for (let iz = -1; iz <= 1; iz++) {
                  const m = new THREE.Mesh(shardGeo, crystalMat);
                  m.position.set(ix * 0.32, 0.35 + iy * 0.65, iz * 0.32);
                  m.scale.set(0.8 + Math.random() * 0.5, 0.8 + Math.random() * 0.5, 0.8 + Math.random() * 0.5);
                  ctx.group.add(m);

                  const dir = new THREE.Vector3(ix + (Math.random() - 0.5) * 0.7, 0.7 + iy * 0.35, iz + (Math.random() - 0.5) * 0.7).normalize();
                  shards.push({
                    mesh: m,
                    vel: dir.multiplyScalar(p.blastForce * (0.65 + Math.random() * 0.65)),
                    rotVel: new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14),
                    age: 0,
                  });
                }
              }
            }
            ctx.audio.playCrystalShatter();
            ctx.stage.clock.triggerHitstop(0.06);
            ctx.stage.addTrauma(0.48, 28, 1.9);
            ctx.stage.punchFov(38);
            ctx.vfx.spawnShockRing(new THREE.Vector3(0, 1.0, 0), 0x7dd3fc, 4.2, 0.26);
            ctx.vfx.spawnSparks(new THREE.Vector3(0, 1.1, 0), { count: 28, color: 0xe0f2fe, speed: 10, flashIntensity: 18 });
            ctx.emitCallout('💎 27-CHUNK PROCEDURAL SHATTER!', 'cyan');
          } else {
            ctx.audio.playFlatBeep(220);
          }
        },
        update(_rawDt, scaledDt) {
          const p = ctx.getParams();
          if (respawnTimer > 0) {
            respawnTimer -= scaledDt;
            if (respawnTimer <= 0) {
              clearShards();
              monolith.visible = true;
              monolith.scale.set(0.2, 0.2, 0.2);
            }
          } else {
            monolith.scale.lerp(new THREE.Vector3(1, 1, 1), 1 - Math.exp(-14 * scaledDt));
          }

          for (const s of shards) {
            s.age += scaledDt;
            s.vel.y -= 19.5 * scaledDt;
            s.mesh.position.addScaledVector(s.vel, scaledDt);
            s.mesh.rotation.x += s.rotVel.x * scaledDt;
            s.mesh.rotation.y += s.rotVel.y * scaledDt;
            if (s.mesh.position.y < 0.16) {
              s.mesh.position.y = 0.16;
              s.vel.y = Math.abs(s.vel.y) * p.restitution;
              s.vel.x *= 0.72;
              s.vel.z *= 0.72;
            }
            if (s.age > 0.95) {
              s.mesh.scale.multiplyScalar(Math.max(0.01, 1 - scaledDt * 6));
            }
          }
          ctx.setHudStat('ACTIVE SHARDS', `${shards.length} PIECES`);
        },
        dispose() {
          clearShards();
          shardGeo.dispose();
          crystalMat.dispose();
        },
      };
    },
    generateCode(p) {
      return `// Zero-Asset 3x3x3 AABB Procedural Shatter Spawner
export function spawnBoxShards(origin: THREE.Vector3): { offset: THREE.Vector3; vel: THREE.Vector3 }[] {
  const out = [];
  for (let x = -1; x <= 1; x++) for (let y = 0; y < 3; y++) for (let z = -1; z <= 1; z++) {
    const offset = origin.clone().add(new THREE.Vector3(x * 0.32, 0.35 + y * 0.65, z * 0.32));
    const vel = new THREE.Vector3(x + (Math.random() - 0.5), 0.8 + y * 0.35, z + (Math.random() - 0.5))
      .normalize().multiplyScalar(${p.blastForce});
    out.push({ offset, vel }); // Bounce at y=0.16 with restitution ${p.restitution}!
  }
  return out;
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：为可破坏场景物体实现零预制模型 3×3×3 实时碎裂特效（击毁瞬间隐藏原网格、生成 27 块十二面体碎块沿径向 7.5m/s 爆开、带 0.48 恢复系数地面弹跳与冰晶碎裂合成音）。',
      en: 'Use gamefeel-3d skill: Add zero-asset 3x3x3 procedural mesh shattering that subdivides destroyed props into 27 tumbling, floor-bouncing shards (restitution 0.48) with 60ms hitstop and crystalline shatter audio.',
    },
  },
  {
    id: 'interactive-foliage-bend',
    category: 'world',
    badge: 'WLD-02',
    title: {
      zh: 'GPU 实例化草海风浪与角色穿梭压弯着色器',
      en: 'GPU Instanced Grass Wind & Player Push-Bend Shader',
    },
    subtitle: {
      zh: '900 株实例化荧光草叶全在 Vertex Shader 计算：正弦微风起伏 + 角色球体排斥压弯',
      en: '900 InstancedMesh blades in 1 draw call: GLSL wind wave + radial player trample bend',
    },
    whyItMatters: {
      zh: '《塞尔达/对马岛》的世界之所以有生命力，是因为你走过草地时草会向两侧分开！用 `InstancedMesh` + 顶点着色器只需 1 次 DrawCall 就能跑满千株互动草海！',
      en: 'Zelda/Tsushima worlds breathe because grass parts around your legs — 1-draw-call GPU vertex displacement costs zero CPU.',
    },
    rawProblem: {
      zh: '草地要么是一张死板绿色平面贴图，要么人物穿模走过去草叶纹丝不动。',
      en: 'Ground is either a flat green PlaneGeometry or static blades that clip stiffly through the player.',
    },
    controlsHint: {
      zh: '[Space / 点击] 控制发光能量球冲过 900 株荧光草海，观察分开与回弹！',
      en: '[Space / Click] Surge Energy Sphere through 900 GPU Grass Blades!',
    },
    tags: ['instanced-mesh', 'grass', 'vertex-shader', 'tsushima', 'world'],
    autoDemoInterval: 1.5,
    params: [
      { key: 'bendRadius', label: { zh: '角色压草半径', en: 'Trample Radius' }, min: 0.6, max: 3.0, step: 0.1, defaultValue: 1.55, unit: 'm' },
      { key: 'windStrength', label: { zh: '微风摆动幅度', en: 'Wind Sway' }, min: 0.0, max: 0.7, step: 0.05, defaultValue: 0.25 },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 3.6, 5.4), new THREE.Vector3(0, 0.5, 0), 50, true);

      const count = 900;
      const bladeGeo = new THREE.ConeGeometry(0.055, 0.92, 4);
      bladeGeo.translate(0, 0.46, 0);

      const grassMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPlayer: { value: new THREE.Vector3(-2.5, 0, 0) },
          uRadius: { value: 1.55 },
          uWind: { value: 0.25 },
          uJuice: { value: 1.0 },
        },
        vertexShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uPlayer;
          uniform float uRadius;
          uniform float uWind;
          uniform float uJuice;
          varying float vH;
          void main() {
            vH = clamp(position.y / 0.92, 0.0, 1.0);
            vec4 worldBase = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            vec3 localPos = position;

            if (uJuice > 0.5) {
              float wind = sin(uTime * 2.8 + worldBase.x * 1.7 + worldBase.z * 1.3) * uWind * vH * vH;
              localPos.x += wind;

              vec2 away = worldBase.xz - uPlayer.xz;
              float dist = length(away);
              if (dist < uRadius && dist > 0.001) {
                float push = pow(1.0 - dist / uRadius, 1.6) * 0.85 * vH;
                localPos.xz += normalize(away) * push;
                localPos.y *= (1.0 - push * 0.35);
              }
            }
            gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(localPos, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vH;
          void main() {
            vec3 root = vec3(0.05, 0.26, 0.18);
            vec3 tip = vec3(0.22, 0.92, 0.56);
            gl_FragColor = vec4(mix(root, tip, vH * vH), 1.0);
          }
        `,
      });

      const field = new THREE.InstancedMesh(bladeGeo, grassMat, count);
      const dummy = new THREE.Object3D();
      let idx = 0;
      for (let gx = -15; gx < 15; gx++) {
        for (let gz = -15; gz < 15; gz++) {
          dummy.position.set(gx * 0.18 + (Math.random() - 0.5) * 0.1, 0, gz * 0.18 + (Math.random() - 0.5) * 0.1);
          dummy.rotation.y = Math.random() * Math.PI;
          dummy.scale.setScalar(0.75 + Math.random() * 0.55);
          dummy.updateMatrix();
          field.setMatrixAt(idx++, dummy.matrix);
        }
      }
      ctx.group.add(field);

      const mover = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 18, 16),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 0.9 })
      );
      mover.position.set(-2.4, 0.42, 0);
      ctx.group.add(mover);

      let targetPos = new THREE.Vector3(2.4, 0.42, 0);
      let angle = 0;

      return {
        trigger() {
          angle += 2.2;
          targetPos = new THREE.Vector3(Math.cos(angle) * 2.2, 0.42, Math.sin(angle) * 2.2);
          if (ctx.isJuiceEnabled()) {
            ctx.audio.playBladeSlash(false, false);
            ctx.vfx.spawnSparks(mover.position, { count: 14, color: 0x34d399, speed: 5.5 });
            ctx.emitCallout('🌿 1-DRAWCALL GPU FOLIAGE TRAMPLE', 'emerald');
          } else {
            ctx.audio.playFlatBeep(290);
          }
        },
        update(rawDt, _scaledDt, elapsed) {
          const p = ctx.getParams();
          mover.position.lerp(targetPos, 1 - Math.exp(-6.5 * rawDt));
          grassMat.uniforms.uTime.value = elapsed;
          (grassMat.uniforms.uPlayer.value as THREE.Vector3).copy(mover.position);
          grassMat.uniforms.uRadius.value = p.bendRadius;
          grassMat.uniforms.uWind.value = p.windStrength;
          grassMat.uniforms.uJuice.value = ctx.isJuiceEnabled() ? 1.0 : 0.0;
          ctx.setHudStat('DRAW CALLS', `1 CALL · ${count} BLADES`);
        },
        dispose() {
          bladeGeo.dispose();
          grassMat.dispose();
        },
      };
    },
    generateCode(p) {
      return `// GPU Instanced Foliage Push-Bend Snippet (Vertex Shader, Radius: ${p.bendRadius}m)
const foliageVertexBend = /* glsl */ \`
  vec2 away = worldBase.xz - uPlayer.xz;
  float dist = length(away);
  if (dist < ${p.bendRadius} && dist > 0.001) {
    float push = pow(1.0 - dist / ${p.bendRadius}, 1.6) * 0.85 * vHeight01;
    localPos.xz += normalize(away) * push;
    localPos.y *= (1.0 - push * 0.35); // Arc downward while bending!
  }
\`;`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：添加单次 DrawCall 的 InstancedMesh 互动草海系统（在顶点着色器内叠加正弦微风摇曳与玩家 1.55m 半径法向排斥压弯回弹）。',
      en: 'Use gamefeel-3d skill: Add a 1-draw-call InstancedMesh interactive grass field with GLSL vertex wind sway and radial player trample push-bend within 1.55m.',
    },
  },
  {
    id: 'water-impact-ripples',
    category: 'world',
    badge: 'WLD-03',
    title: {
      zh: '多波源干涉动态水面涟漪与高光法线着色器',
      en: 'Multi-Source Water Ripple Interference & Specular GLSL',
    },
    subtitle: {
      zh: '零法线贴图实时叠加 4 组落水同心波源干涉，自动求偏导计算镜面反射高光',
      en: 'Analytic wave-ring derivatives compute crisp specular water highlights with zero normal maps',
    },
    whyItMatters: {
      zh: '角色踩水或子弹落水时，几圈真实向外扩散并相互干涉的镜面高光波纹 + 飞溅水珠，能让死寂平面瞬间变成灵动浅滩！',
      en: 'Analytic multi-ring ripple interference with specular highlights turns a flat quad into tactile reactive water.',
    },
    rawProblem: {
      zh: '水面只是一个半透明蓝色方块，踩上去没有任何涟漪与水声反馈。',
      en: 'Water is often just a static blue PlaneGeometry with zero footstep ripples or splash acoustics.',
    },
    controlsHint: {
      zh: '[Space / 点击] 在水面不同坐标激起多波源干涉涟漪与水花！',
      en: '[Space / Click] Drop Stones to Trigger Overlapping Specular Water Ripples!',
    },
    tags: ['water', 'ripples', 'glsl', 'shader', 'world'],
    autoDemoInterval: 0.85,
    params: [
      { key: 'waveSpeed', label: { zh: '涟漪扩散波速', en: 'Ripple Speed' }, min: 1.5, max: 6.5, step: 0.25, defaultValue: 3.4, unit: 'm/s' },
      { key: 'waveFreq', label: { zh: '波纹密集频率', en: 'Ring Frequency' }, min: 6, max: 24, step: 1, defaultValue: 13 },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 3.9, 5.2), new THREE.Vector3(0, 0.2, 0), 48, true);

      const ripples = [
        new THREE.Vector4(0, 0, -10, 0),
        new THREE.Vector4(0, 0, -10, 0),
        new THREE.Vector4(0, 0, -10, 0),
        new THREE.Vector4(0, 0, -10, 0),
      ];
      let slot = 0;
      let simTime = 0;

      const waterMat = new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
          uTime: { value: 0 },
          uRipples: { value: ripples },
          uSpeed: { value: 3.4 },
          uFreq: { value: 13.0 },
          uJuice: { value: 1.0 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vWorldXZ;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldXZ = wp.xz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform vec4 uRipples[4];
          uniform float uSpeed;
          uniform float uFreq;
          uniform float uJuice;
          varying vec2 vWorldXZ;
          void main() {
            float h = 0.0;
            vec2 grad = vec2(0.0);
            if (uJuice > 0.5) {
              for (int i = 0; i < 4; i++) {
                float age = uTime - uRipples[i].z;
                if (age > 0.0 && age < 2.4) {
                  vec2 d = vWorldXZ - uRipples[i].xy;
                  float dist = length(d) + 0.001;
                  float front = age * uSpeed;
                  float env = exp(-abs(dist - front) * 2.8) * exp(-age * 1.15);
                  float phase = (dist - front) * uFreq;
                  h += sin(phase) * env;
                  grad += (d / dist) * cos(phase) * env * 1.4;
                }
              }
            }
            vec3 normal = normalize(vec3(-grad.x, 1.0, -grad.y));
            vec3 lightDir = normalize(vec3(0.4, 0.85, 0.5));
            float spec = pow(max(0.0, dot(normal, lightDir)), 28.0);
            vec3 baseCol = mix(vec3(0.04, 0.16, 0.28), vec3(0.14, 0.52, 0.78), clamp(h * 0.5 + 0.5, 0.0, 1.0));
            gl_FragColor = vec4(baseCol + vec3(0.85, 0.95, 1.0) * spec * 1.35, 0.9);
          }
        `,
      });

      const pond = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 7.2, 1, 1), waterMat);
      pond.rotation.x = -Math.PI / 2;
      pond.position.y = 0.08;
      ctx.group.add(pond);

      return {
        trigger() {
          const rx = (Math.random() - 0.5) * 3.8;
          const rz = (Math.random() - 0.5) * 3.8;
          ripples[slot].set(rx, rz, simTime, 1);
          slot = (slot + 1) % 4;

          if (ctx.isJuiceEnabled()) {
            ctx.audio.playWaterSplash();
            ctx.vfx.spawnSparks(new THREE.Vector3(rx, 0.15, rz), {
              count: 16,
              color: 0x7dd3fc,
              coreColor: 0xffffff,
              speed: 5.5,
              gravity: 16,
            });
            ctx.emitCallout(`💧 RIPPLE INTERFERENCE SLOT #${slot + 1}`, 'cyan');
          } else {
            ctx.audio.playFlatBeep(270);
          }
        },
        update(rawDt) {
          const p = ctx.getParams();
          simTime += rawDt;
          waterMat.uniforms.uTime.value = simTime;
          waterMat.uniforms.uSpeed.value = p.waveSpeed;
          waterMat.uniforms.uFreq.value = p.waveFreq;
          waterMat.uniforms.uJuice.value = ctx.isJuiceEnabled() ? 1.0 : 0.0;
          ctx.setHudStat('WAVE SOURCES', '4 ANALYTIC RINGS');
        },
        dispose() {
          pond.geometry.dispose();
          waterMat.dispose();
        },
      };
    },
    generateCode(p) {
      return `// Analytic Water Ripple Envelope & Gradient (Speed: ${p.waveSpeed}, Freq: ${p.waveFreq})
const rippleShaderSnippet = /* glsl */ \`
  float dist = length(vWorldXZ - centerXZ) + 0.001;
  float front = age * ${p.waveSpeed.toFixed(2)};
  float env = exp(-abs(dist - front) * 2.8) * exp(-age * 1.15);
  float phase = (dist - front) * ${p.waveFreq.toFixed(1)};
  vec2 grad = ((vWorldXZ - centerXZ) / dist) * cos(phase) * env;
  vec3 normal = normalize(vec3(-grad.x, 1.0, -grad.y));
\`;`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：编写零贴图动态水面交互 GLSL 着色器，支持 4 个并发环形波源叠加干涉，通过解析偏导数实时计算波峰镜面高光并配合成水花粒子音效。',
      en: 'Use gamefeel-3d skill: Implement a zero-texture reactive water GLSL shader supporting 4 overlapping analytic ripple rings with procedural normal gradients, specular highlights, and splash audio.',
    },
  },
  {
    id: 'gamepad-dual-rumble',
    category: 'world',
    badge: 'WLD-04',
    title: {
      zh: '手柄大小双马达非对称触觉震动锻造台',
      en: 'Web Gamepad Dual-Motor Asymmetric Haptics Forge',
    },
    subtitle: {
      zh: '左侧重锤低频马达（爆炸胸震）+ 右侧轻巧高频马达（刀锋余颤）独立包络驱动',
      en: 'Left heavy low-freq rotor (sub punch) vs Right crisp high-freq rotor (metallic buzz) via Gamepad API',
    },
    whyItMatters: {
      zh: '现代浏览器原生支持 PS5/Xbox 手柄 `vibrationActuator`！重炮不能两个马达一起傻震，必须先左大马达重锤 120ms、再右小马达高频余震 180ms，质感堪比主机大作！',
      en: 'Browsers natively support Xbox/DualSense dual-rumble! Staggering left heavy thump -> right high-freq buzz feels console-grade.',
    },
    rawProblem: {
      zh: '99% 的网页 3D 游戏完全忽略手柄触觉 API，或者粗暴满功率震 1 秒震麻手指。',
      en: '99% of web games ignore navigator.getGamepads() haptics or blast 1.0/1.0 flat rumble that numbs hands.',
    },
    controlsHint: {
      zh: '[Space / 点击] 触发双转子非对称震动（接上 Xbox/PS 手柄可直接体验真机震感）· [Q] 切换震感配方',
      en: '[Space / Click] Fire Dual-Rumble Envelope (plug in Xbox/PS pad for live haptics!) · [Q] Cycle Profile',
    },
    hasSecondary: { zh: '切换手柄震感预设', en: 'Cycle Haptic Profile' },
    tags: ['gamepad', 'haptics', 'rumble', 'controller', 'world'],
    autoDemoInterval: 1.35,
    params: [
      { key: 'strongMag', label: { zh: '左重锤马达强度', en: 'Left Heavy Motor' }, min: 0, max: 1, step: 0.05, defaultValue: 0.85 },
      { key: 'weakMag', label: { zh: '右高频马达强度', en: 'Right Crisp Motor' }, min: 0, max: 1, step: 0.05, defaultValue: 0.65 },
      { key: 'durationMs', label: { zh: '触觉脉冲时长', en: 'Pulse Duration' }, min: 40, max: 450, step: 10, defaultValue: 160, unit: 'ms' },
    ],
    mount(ctx) {
      ctx.stage.setCameraPose(new THREE.Vector3(0, 2.35, 4.6), new THREE.Vector3(0, 1.0, 0), 48, true);

      // Stylized transparent 3D Gamepad housing + visible spinning Left (Big) & Right (Small) eccentric rotors!
      const pad = new THREE.Group();
      pad.position.y = 1.05;
      ctx.group.add(pad);

      const shellMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        transparent: true,
        opacity: 0.55,
        roughness: 0.25,
        metalness: 0.4,
      });
      const centerBridge = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 0.35), shellMat);
      pad.add(centerBridge);

      [-0.85, 0.85].forEach((x) => {
        const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.65, 8, 14), shellMat);
        grip.position.set(x, -0.25, 0);
        grip.rotation.z = x < 0 ? 0.32 : -0.32;
        pad.add(grip);
      });

      const leftRotor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 0.28, 12),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.6, metalness: 0.8 })
      );
      leftRotor.position.set(-0.88, -0.28, 0);
      pad.add(leftRotor);

      const rightRotor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.22, 12),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.6, metalness: 0.8 })
      );
      rightRotor.position.set(0.88, -0.28, 0);
      pad.add(rightRotor);

      const profiles = [
        { name: 'SHOTGUN KICK (重左轻右)', l: 1.0, r: 0.45 },
        { name: 'KATANA PARRY (脆右微左)', l: 0.25, r: 1.0 },
        { name: 'N2O TURBINE (双转子轰鸣)', l: 0.75, r: 0.85 },
      ];
      let profIdx = 0;
      let leftSpin = 0;
      let rightSpin = 0;

      return {
        trigger() {
          const p = ctx.getParams();
          const prof = profiles[profIdx];
          const lPow = Math.min(1, p.strongMag * prof.l);
          const rPow = Math.min(1, p.weakMag * prof.r);

          if (ctx.isJuiceEnabled()) {
            leftSpin = lPow * 38;
            rightSpin = rPow * 65;

            // Real Web Gamepad Haptics API!
            const pads = navigator.getGamepads ? navigator.getGamepads() : [];
            let hwFound = false;
            for (const gp of pads) {
              const act = (gp as unknown as { vibrationActuator?: { playEffect: (t: string, o: object) => Promise<void> } })?.vibrationActuator;
              if (act?.playEffect) {
                hwFound = true;
                void act.playEffect('dual-rumble', {
                  startDelay: 0,
                  duration: p.durationMs,
                  strongMagnitude: lPow,
                  weakMagnitude: rPow,
                });
              }
            }

            if (profIdx === 0) ctx.audio.playGunshot('cannon', 0.85);
            else if (profIdx === 1) ctx.audio.playKatanaDeflect(true, 2, 1);
            else ctx.audio.playNitroBoost('cww');

            ctx.stage.addTrauma(0.26 * lPow, 30, 2.4);
            ctx.vfx.spawnSparks(new THREE.Vector3(-0.88, 0.8, 0), { count: Math.round(16 * lPow), color: 0xf59e0b, speed: 6 });
            ctx.vfx.spawnSparks(new THREE.Vector3(0.88, 0.8, 0), { count: Math.round(18 * rPow), color: 0x38bdf8, speed: 7 });
            ctx.emitCallout(
              `🎮 ${prof.name} ${hwFound ? '(手柄实机已震动!)' : '(模拟转子可视化)'}`,
              hwFound ? 'emerald' : 'gold'
            );
          } else {
            ctx.audio.playFlatBeep(260);
          }
          ctx.setHudStat('MOTORS (L / R)', `${(lPow * 100).toFixed(0)}% HEAVY · ${(rPow * 100).toFixed(0)}% CRISP`);
        },
        secondary() {
          profIdx = (profIdx + 1) % profiles.length;
          ctx.emitCallout(`切换震感模型：${profiles[profIdx].name}`, 'cyan');
        },
        update(rawDt) {
          leftSpin *= Math.exp(-4.5 * rawDt);
          rightSpin *= Math.exp(-5.5 * rawDt);
          leftRotor.rotation.y += leftSpin * rawDt;
          rightRotor.rotation.y += rightSpin * rawDt;
          pad.position.x = Math.sin(performance.now() * 0.09) * (leftSpin * 0.0022);
          pad.rotation.z = Math.cos(performance.now() * 0.12) * (rightSpin * 0.0015);
        },
      };
    },
    generateCode(p) {
      return `// Native Browser Gamepad Dual-Rumble Haptics Helper
export function pulseGamepadHaptics(strong = ${p.strongMag}, weak = ${p.weakMag}, duration = ${p.durationMs}): void {
  if (!navigator.getGamepads) return;
  for (const pad of navigator.getGamepads()) {
    const actuator = (pad as any)?.vibrationActuator;
    if (actuator?.playEffect) {
      actuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration,
        strongMagnitude: Math.min(1, strong), // Left heavy low-freq weight
        weakMagnitude: Math.min(1, weak),     // Right crisp high-freq buzz
      });
    }
  }
}`;
    },
    agentPrompt: {
      zh: '使用 gamefeel-3d 技能：接入浏览器原生 Gamepad vibrationActuator 双马达非对称触觉震动（重炮与受击主推左侧 strongMagnitude 低频马达，完美弹反与高频摩擦主推右侧 weakMagnitude 高频马达）。',
      en: 'Use gamefeel-3d skill: Integrate native browser Gamepad API dual-rumble haptics pairing heavy left-motor low-frequency impulses on explosions with crisp right-motor buzz on blade clashes.',
    },
  },
];
