import * as THREE from 'three';

interface SparkItem {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
  spin: boolean;
}

interface RingItem {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  maxScale: number;
  ground: boolean;
}

interface TracerItem {
  line: THREE.Line;
  mat: THREE.LineBasicMaterial;
  life: number;
  maxLife: number;
}

interface FloatingSprite {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  tex: THREE.CanvasTexture;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  baseScale: number;
  gravity: number;
}

/** Sub-stepped GLSL Blade / Tire Ribbon Trail */
export class RibbonTrail {
  public readonly mesh: THREE.Mesh;
  private readonly maxSamples: number;
  private samples: { base: THREE.Vector3; tip: THREE.Vector3; age: number }[] = [];
  private posAttr: THREE.BufferAttribute;
  private uvAttr: THREE.BufferAttribute;
  private mat: THREE.ShaderMaterial;
  private active = false;
  public maxAge = 0.17;

  constructor(parent: THREE.Object3D, maxSamples = 30) {
    this.maxSamples = maxSamples;
    const verts = maxSamples * 2;
    const positions = new Float32Array(verts * 3);
    const uvs = new Float32Array(verts * 2);
    const indices: number[] = [];
    for (let i = 0; i < maxSamples - 1; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(positions, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.uvAttr = new THREE.BufferAttribute(uvs, 2);
    this.uvAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('uv', this.uvAttr);
    geo.setIndex(indices);

    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uCore: { value: new THREE.Color(0xf4fbff) },
        uEdge: { value: new THREE.Color(0x4ca6ff) },
        uOpacity: { value: 0.94 },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uCore;
        uniform vec3 uEdge;
        uniform float uOpacity;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float fade = pow(max(0.0, 1.0 - vUv.x), 1.6);
          float body = smoothstep(0.04, 0.42, vUv.y);
          float razor = smoothstep(0.70, 0.99, vUv.y);
          float streak = 0.8 + 0.2 * sin(vUv.y * 26.0 - vUv.x * 13.0 + uTime * 20.0);
          vec3 col = mix(uEdge, uCore, razor * 0.85 + (1.0 - vUv.x) * 0.32);
          float a = fade * body * streak * uOpacity;
          if (a < 0.01) discard;
          gl_FragColor = vec4(col * (1.18 + razor * 0.85), a);
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    parent.add(this.mesh);
  }

  public setPalette(coreHex: number, edgeHex: number, opacity = 0.94): void {
    (this.mat.uniforms.uCore.value as THREE.Color).setHex(coreHex);
    (this.mat.uniforms.uEdge.value as THREE.Color).setHex(edgeHex);
    this.mat.uniforms.uOpacity.value = opacity;
  }

  public setActive(on: boolean): void {
    if (on && !this.active) this.samples.length = 0;
    this.active = on;
  }

  public update(baseWorld: THREE.Vector3, tipWorld: THREE.Vector3, dt: number, elapsed: number): void {
    this.mat.uniforms.uTime.value = elapsed;
    if (this.active) {
      if (this.samples.length > 0) {
        const prev = this.samples[0];
        const dist = prev.tip.distanceTo(tipWorld);
        const steps = Math.min(5, Math.max(1, Math.ceil(dist / 0.18)));
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          this.samples.unshift({
            base: prev.base.clone().lerp(baseWorld, t),
            tip: prev.tip.clone().lerp(tipWorld, t),
            age: 0,
          });
        }
      } else {
        this.samples.unshift({ base: baseWorld.clone(), tip: tipWorld.clone(), age: 0 });
      }
    }

    for (let i = this.samples.length - 1; i >= 0; i--) {
      this.samples[i].age += dt;
      if (this.samples[i].age > this.maxAge || i >= this.maxSamples) {
        this.samples.splice(i, 1);
      }
    }

    if (this.samples.length < 2) {
      this.mesh.visible = false;
      return;
    }

    this.mesh.visible = true;
    const pos = this.posAttr.array as Float32Array;
    const uv = this.uvAttr.array as Float32Array;
    const n = this.samples.length;
    for (let i = 0; i < this.maxSamples; i++) {
      const smp = this.samples[Math.min(i, n - 1)];
      const u = Math.min(1, smp.age / this.maxAge);
      const vi = i * 6;
      pos[vi] = smp.base.x;
      pos[vi + 1] = smp.base.y;
      pos[vi + 2] = smp.base.z;
      pos[vi + 3] = smp.tip.x;
      pos[vi + 4] = smp.tip.y;
      pos[vi + 5] = smp.tip.z;
      const ui = i * 4;
      uv[ui] = u;
      uv[ui + 1] = 0;
      uv[ui + 2] = u;
      uv[ui + 3] = 1;
    }
    this.posAttr.needsUpdate = true;
    this.uvAttr.needsUpdate = true;
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

export class VfxForge {
  private container: THREE.Group;
  private sparks: SparkItem[] = [];
  private rings: RingItem[] = [];
  private tracers: TracerItem[] = [];
  private sprites: FloatingSprite[] = [];
  private flashLight: THREE.PointLight;
  private flashTimer = 0;

  private readonly sparkGeo = new THREE.BoxGeometry(0.028, 0.028, 0.26);
  private readonly chunkGeo = new THREE.BoxGeometry(0.06, 0.045, 0.09);
  private readonly shellGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.075, 6);
  private readonly ringGeo = new THREE.RingGeometry(0.24, 0.42, 36);

  constructor(scene: THREE.Scene) {
    this.container = new THREE.Group();
    scene.add(this.container);
    this.flashLight = new THREE.PointLight(0xffb84d, 0, 14, 1.6);
    this.container.add(this.flashLight);
  }

  public clear(): void {
    for (const s of this.sparks) {
      this.container.remove(s.mesh);
      s.mat.dispose();
    }
    for (const r of this.rings) {
      this.container.remove(r.mesh);
      r.mat.dispose();
    }
    for (const t of this.tracers) {
      this.container.remove(t.line);
      t.line.geometry.dispose();
      t.mat.dispose();
    }
    for (const sp of this.sprites) {
      this.container.remove(sp.sprite);
      sp.tex.dispose();
      sp.mat.dispose();
    }
    this.sparks.length = 0;
    this.rings.length = 0;
    this.tracers.length = 0;
    this.sprites.length = 0;
    this.flashLight.intensity = 0;
  }

  public spawnSparks(
    pos: THREE.Vector3,
    options: {
      count?: number;
      color?: number;
      coreColor?: number;
      speed?: number;
      gravity?: number;
      life?: number;
      chunk?: boolean;
      flashIntensity?: number;
      normal?: THREE.Vector3;
    } = {}
  ): void {
    const count = options.count ?? 22;
    const color = options.color ?? 0xffae34;
    const core = options.coreColor ?? 0xffffff;
    const speed = options.speed ?? 8.5;
    const gravity = options.gravity ?? 15;
    const life = options.life ?? 0.28;

    if ((options.flashIntensity ?? 10) > 0) {
      this.flashLight.color.setHex(color);
      this.flashLight.position.copy(pos);
      this.flashLight.intensity = options.flashIntensity ?? 10;
      this.flashTimer = 0.12;
    }

    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? core : color,
        transparent: true,
        opacity: 1,
        blending: options.chunk ? THREE.NormalBlending : THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(options.chunk ? this.chunkGeo : this.sparkGeo, mat);
      mesh.position.copy(pos);

      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.3) * Math.PI * 0.85;
      const s = speed * (0.45 + Math.random() * 0.9);
      const vel = new THREE.Vector3(
        Math.cos(theta) * Math.cos(phi) * s,
        Math.sin(phi) * s + 1.6,
        Math.sin(theta) * Math.cos(phi) * s
      );
      if (options.normal) vel.addScaledVector(options.normal, speed * 0.55);

      this.container.add(mesh);
      this.sparks.push({
        mesh,
        mat,
        vel,
        life: life * (0.65 + Math.random() * 0.5),
        maxLife: life,
        gravity,
        spin: Boolean(options.chunk),
      });
    }
  }

  public spawnShellCasing(pos: THREE.Vector3, rightDir: THREE.Vector3): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0xf4c542, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(this.shellGeo, mat);
    mesh.position.copy(pos);
    this.container.add(mesh);
    const vel = rightDir
      .clone()
      .multiplyScalar(2.4 + Math.random() * 1.2)
      .add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 2.5 + Math.random() * 1.1, (Math.random() - 0.5) * 0.6));
    this.sparks.push({
      mesh,
      mat,
      vel,
      life: 0.75,
      maxLife: 0.75,
      gravity: 13.5,
      spin: true,
    });
  }

  public spawnShockRing(
    pos: THREE.Vector3,
    color = 0xffc456,
    maxScale = 4.2,
    life = 0.26,
    ground = false
  ): void {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.ringGeo, mat);
    mesh.position.copy(pos);
    if (ground) mesh.rotation.x = -Math.PI / 2;
    this.container.add(mesh);
    this.rings.push({ mesh, mat, life, maxLife: life, maxScale, ground });
  }

  public spawnTracer(start: THREE.Vector3, end: THREE.Vector3, color = 0xffe484, life = 0.085): void {
    const geo = new THREE.BufferGeometry().setFromPoints([start.clone(), end.clone()]);
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geo, mat);
    this.container.add(line);
    this.tracers.push({ line, mat, life, maxLife: life });
  }

  public spawnFloatingText(
    pos: THREE.Vector3,
    text: string,
    options: {
      color?: string;
      stroke?: string;
      scale?: number;
      life?: number;
      gravity?: number;
      upSpeed?: number;
    } = {}
  ): void {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const g = canvas.getContext('2d')!;
    g.clearRect(0, 0, 256, 128);
    g.font = '900 56px "Segoe UI", "Microsoft YaHei", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = options.stroke ?? 'rgba(12, 14, 20, 0.92)';
    g.strokeText(text, 128, 66);
    g.fillStyle = options.color ?? '#ffd24c';
    g.fillText(text, 128, 66);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.renderOrder = 25;
    const baseScale = options.scale ?? 1.15;
    sprite.scale.set(baseScale * 2, baseScale, 1);
    this.container.add(sprite);

    this.sprites.push({
      sprite,
      mat,
      tex,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        options.upSpeed ?? 3.4,
        (Math.random() - 0.5) * 0.8
      ),
      life: options.life ?? 0.72,
      maxLife: options.life ?? 0.72,
      baseScale,
      gravity: options.gravity ?? 7.2,
    });
  }

  public update(rawDt: number, camera: THREE.Camera): void {
    if (this.flashTimer > 0) {
      this.flashTimer -= rawDt;
      if (this.flashTimer <= 0) this.flashLight.intensity = 0;
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= rawDt;
      s.vel.y -= s.gravity * rawDt;
      s.mesh.position.addScaledVector(s.vel, rawDt);
      if (s.spin) {
        s.mesh.rotation.x += rawDt * 16;
        s.mesh.rotation.z += rawDt * 13;
      } else if (s.vel.lengthSq() > 0.01) {
        s.mesh.lookAt(s.mesh.position.clone().add(s.vel));
      }
      const ratio = Math.max(0, s.life / s.maxLife);
      s.mat.opacity = ratio;
      s.mesh.scale.setScalar(Math.max(0.15, ratio));
      if (s.life <= 0) {
        this.container.remove(s.mesh);
        s.mat.dispose();
        this.sparks.splice(i, 1);
      }
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= rawDt;
      const progress = 1 - Math.max(0, r.life / r.maxLife);
      r.mesh.scale.setScalar(0.25 + progress * r.maxScale);
      if (!r.ground) r.mesh.quaternion.copy(camera.quaternion);
      r.mat.opacity = Math.pow(1 - progress, 1.5) * 0.9;
      if (r.life <= 0) {
        this.container.remove(r.mesh);
        r.mat.dispose();
        this.rings.splice(i, 1);
      }
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= rawDt;
      t.mat.opacity = Math.max(0, t.life / t.maxLife);
      if (t.life <= 0) {
        this.container.remove(t.line);
        t.line.geometry.dispose();
        t.mat.dispose();
        this.tracers.splice(i, 1);
      }
    }

    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const sp = this.sprites[i];
      sp.life -= rawDt;
      sp.vel.y -= sp.gravity * rawDt;
      sp.sprite.position.addScaledVector(sp.vel, rawDt);
      const t = 1 - Math.max(0, sp.life / sp.maxLife);
      const pop = t < 0.16 ? 0.65 + (t / 0.16) * 0.55 : 1.2 - t * 0.25;
      sp.sprite.scale.set(sp.baseScale * 2 * pop, sp.baseScale * pop, 1);
      sp.mat.opacity = t > 0.65 ? Math.max(0, 1 - (t - 0.65) / 0.35) : 1;
      if (sp.life <= 0) {
        this.container.remove(sp.sprite);
        sp.tex.dispose();
        sp.mat.dispose();
        this.sprites.splice(i, 1);
      }
    }
  }
}
