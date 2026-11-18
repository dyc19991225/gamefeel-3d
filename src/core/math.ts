import * as THREE from 'three';

/** Frame-rate independent exponential smoothing (Rory Driscoll's damp) */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function dampVec3(
  current: THREE.Vector3,
  target: THREE.Vector3,
  lambda: number,
  dt: number
): THREE.Vector3 {
  const t = 1 - Math.exp(-lambda * dt);
  return current.lerp(target, t);
}

/** 1D/2D deterministic value-gradient smooth noise for Perlin-like trauma camera shake */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export function smoothNoise1D(x: number, seed = 0): number {
  const s = x + seed * 57.3;
  const i = Math.floor(s);
  const f = s - i;
  const u = f * f * (3 - 2 * f);
  const a = hash(i) * 2 - 1;
  const b = hash(i + 1) * 2 - 1;
  return THREE.MathUtils.lerp(a, b, u);
}

/** Second-order critically/under-damped spring (great for viewmodel recoil, FOV punch, scale pop) */
export class Spring1D {
  public value: number;
  public target: number;
  public velocity = 0;

  constructor(initial = 0) {
    this.value = initial;
    this.target = initial;
  }

  public impulse(dv: number): void {
    this.velocity += dv;
  }

  public snap(v: number): void {
    this.value = v;
    this.target = v;
    this.velocity = 0;
  }

  public step(dt: number, stiffness = 220, damping = 18): number {
    const safeDt = Math.min(dt, 0.05);
    const force = (this.target - this.value) * stiffness;
    this.velocity = (this.velocity + force * safeDt) * Math.exp(-damping * safeDt);
    this.value += this.velocity * safeDt;
    return this.value;
  }
}

export class SpringVec3 {
  public readonly value = new THREE.Vector3();
  public readonly target = new THREE.Vector3();
  public readonly velocity = new THREE.Vector3();

  public impulse(x: number, y: number, z: number): void {
    this.velocity.x += x;
    this.velocity.y += y;
    this.velocity.z += z;
  }

  public step(dt: number, stiffness = 200, damping = 16): THREE.Vector3 {
    const safeDt = Math.min(dt, 0.05);
    const decay = Math.exp(-damping * safeDt);
    this.velocity.x = (this.velocity.x + (this.target.x - this.value.x) * stiffness * safeDt) * decay;
    this.velocity.y = (this.velocity.y + (this.target.y - this.value.y) * stiffness * safeDt) * decay;
    this.velocity.z = (this.velocity.z + (this.target.z - this.value.z) * stiffness * safeDt) * decay;
    this.value.addScaledVector(this.velocity, safeDt);
    return this.value;
  }
}

/** Hitstop & Bullet-Time Dilation Clock */
export class TimeFeelClock {
  private hitstopRemaining = 0;
  private slowMoScale = 1;
  private slowMoRemaining = 0;
  private currentScale = 1;

  public triggerHitstop(seconds: number): void {
    this.hitstopRemaining = Math.max(this.hitstopRemaining, seconds);
  }

  public triggerSlowMo(scale: number, duration: number): void {
    this.slowMoScale = THREE.MathUtils.clamp(scale, 0.05, 1);
    this.slowMoRemaining = Math.max(this.slowMoRemaining, duration);
  }

  public reset(): void {
    this.hitstopRemaining = 0;
    this.slowMoRemaining = 0;
    this.slowMoScale = 1;
    this.currentScale = 1;
  }

  public get timeScale(): number {
    return this.currentScale;
  }

  public step(rawDt: number): { scaledDt: number; timeScale: number; inHitstop: boolean } {
    if (this.hitstopRemaining > 0) {
      this.hitstopRemaining = Math.max(0, this.hitstopRemaining - rawDt);
      this.currentScale = 0.02;
      return { scaledDt: rawDt * 0.02, timeScale: 0.02, inHitstop: true };
    }
    if (this.slowMoRemaining > 0) {
      this.slowMoRemaining = Math.max(0, this.slowMoRemaining - rawDt);
      this.currentScale = damp(this.currentScale, this.slowMoScale, 22, rawDt);
    } else {
      this.currentScale = damp(this.currentScale, 1.0, 14, rawDt);
    }
    return {
      scaledDt: rawDt * this.currentScale,
      timeScale: this.currentScale,
      inHitstop: false,
    };
  }
}
