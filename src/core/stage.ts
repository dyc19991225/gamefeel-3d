import * as THREE from 'three';
import { Spring1D, TimeFeelClock, dampVec3, smoothNoise1D } from './math';
import type { TelemetryFrame } from './types';

export class StudioStage {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly clock = new TimeFeelClock();

  private readonly baseCamPos = new THREE.Vector3(0, 2.3, 6.4);
  private readonly baseLookAt = new THREE.Vector3(0, 1.15, 0);
  private readonly curCamPos = new THREE.Vector3(0, 2.3, 6.4);
  private readonly curLookAt = new THREE.Vector3(0, 1.15, 0);

  public baseFov = 52;
  public readonly fovSpring = new Spring1D(0);
  public readonly rollSpring = new Spring1D(0);

  private trauma = 0;
  private traumaDecay = 1.55;
  private shakeFreq = 26;
  private shakeTime = 0;
  private naiveJitterMode = false;

  // Screen FX state read by 2D HUD overlay
  public speedLinesIntensity = 0;
  public damageArcAlpha = 0;
  public damageArcAngle = 0; // radians
  public vignetteIntensity = 0;
  public crosshairGap = 0; // >0 renders dynamic FPS crosshair

  private floorGrid: THREE.GridHelper;

  constructor(host: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c0e13);
    this.scene.fog = new THREE.FogExp2(0x0c0e13, 0.042);

    const w = Math.max(320, host.clientWidth || 800);
    const h = Math.max(240, host.clientHeight || 520);
    this.camera = new THREE.PerspectiveCamera(this.baseFov, w / h, 0.08, 140);
    this.camera.position.copy(this.baseCamPos);
    this.camera.lookAt(this.baseLookAt);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    host.appendChild(this.renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xc8dcff, 0x1a1d26, 0.95);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff1dc, 1.85);
    key.position.set(5.5, 9.5, 6.2);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x4ea4ff, 0.95);
    rim.position.set(-6.0, 4.5, -5.5);
    this.scene.add(rim);

    // Subtle dark tactical studio floor + grid
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      new THREE.MeshStandardMaterial({
        color: 0x11151d,
        roughness: 0.82,
        metalness: 0.14,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.005;
    this.scene.add(floor);

    this.floorGrid = new THREE.GridHelper(48, 48, 0x2f3b52, 0x1a2130);
    this.scene.add(this.floorGrid);
  }

  public setCameraPose(pos: THREE.Vector3, lookAt: THREE.Vector3, fov = 52, snap = false): void {
    this.baseCamPos.copy(pos);
    this.baseLookAt.copy(lookAt);
    this.baseFov = fov;
    if (snap) {
      this.curCamPos.copy(pos);
      this.curLookAt.copy(lookAt);
      this.fovSpring.snap(0);
      this.rollSpring.snap(0);
    }
  }

  public resetFeelState(): void {
    this.trauma = 0;
    this.traumaDecay = 1.55;
    this.shakeFreq = 26;
    this.naiveJitterMode = false;
    this.fovSpring.snap(0);
    this.rollSpring.snap(0);
    this.clock.reset();
    this.speedLinesIntensity = 0;
    this.damageArcAlpha = 0;
    this.vignetteIntensity = 0;
    this.crosshairGap = 0;
    this.floorGrid.position.z = 0;
  }

  public addTrauma(amount: number, freq = 26, decay = 1.55, naiveJitter = false): void {
    this.trauma = Math.min(1, this.trauma + amount);
    this.shakeFreq = freq;
    this.traumaDecay = decay;
    this.naiveJitterMode = naiveJitter;
  }

  public punchFov(deltaVel: number, targetOffset = 0): void {
    this.fovSpring.target = targetOffset;
    this.fovSpring.impulse(deltaVel);
  }

  public punchRoll(degVel: number): void {
    this.rollSpring.impulse(THREE.MathUtils.degToRad(degVel));
  }

  public scrollFloor(dz: number): void {
    this.floorGrid.position.z = (this.floorGrid.position.z + dz) % 1.0;
  }

  public resize(width: number, height: number): void {
    const w = Math.max(320, width);
    const h = Math.max(240, height);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  public stepCamera(rawDt: number): TelemetryFrame {
    const timeScale = this.clock.timeScale;
    dampVec3(this.curCamPos, this.baseCamPos, 11, rawDt);
    dampVec3(this.curLookAt, this.baseLookAt, 13, rawDt);

    const fovOff = this.fovSpring.step(rawDt, 210, 17);
    const rollOff = this.rollSpring.step(rawDt, 190, 15);

    this.shakeTime += rawDt * this.shakeFreq;
    const shake = this.trauma * this.trauma; // Squirrel Eiserloh's trauma^2!
    this.trauma = Math.max(0, this.trauma - this.traumaDecay * rawDt);

    this.camera.position.copy(this.curCamPos);
    if (this.naiveJitterMode && shake > 0.0001) {
      // Bad naive random XYZ translation jitter (for side-by-side comparison)
      this.camera.position.x += (Math.random() * 2 - 1) * this.trauma * 0.45; // doctor-ignore
      this.camera.position.y += (Math.random() * 2 - 1) * this.trauma * 0.45; // doctor-ignore
      this.camera.lookAt(this.curLookAt);
    } else {
      this.camera.lookAt(this.curLookAt);
      if (shake > 0.0001) {
        const pitch = smoothNoise1D(this.shakeTime, 1) * 0.075 * shake;
        const yaw = smoothNoise1D(this.shakeTime, 2) * 0.075 * shake;
        const roll = smoothNoise1D(this.shakeTime, 3) * 0.11 * shake;
        this.camera.rotateX(pitch);
        this.camera.rotateY(yaw);
        this.camera.rotateZ(roll);
      }
    }

    this.camera.rotateZ(rollOff);
    this.camera.fov = THREE.MathUtils.clamp(this.baseFov + fovOff, 20, 115);
    this.camera.updateProjectionMatrix();

    this.damageArcAlpha = Math.max(0, this.damageArcAlpha - rawDt * 1.4);
    this.vignetteIntensity = Math.max(0, this.vignetteIntensity - rawDt * 1.8);
    this.speedLinesIntensity = Math.max(0, this.speedLinesIntensity - rawDt * 2.5);

    return {
      trauma: this.trauma,
      timeScale,
      fovOffset: fovOff,
      intensity: Math.min(1, shake * 1.3 + Math.abs(fovOff) / 18),
    };
  }
}
