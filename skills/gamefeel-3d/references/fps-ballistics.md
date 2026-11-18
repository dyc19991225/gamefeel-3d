# FPS Gunfeel & Ballistics Recipes

## 1. 2nd-Order Under-Damped Viewmodel Recoil + Crosshair Bloom
Avoid linear backward tweens. Inject velocity impulses into a 2nd-order spring (`stiffness = 220`, `damping = 15`):

```ts
export class SpringRecoil {
  public zOff = 0; private zVel = 0;
  public pitchOff = 0; private pitchVel = 0;
  public bloomPx = 6;

  fire(kick = 2.2): void {
    this.zVel += 1.45 * kick;
    this.pitchVel += 2.8 * kick;
    this.bloomPx = Math.min(44, this.bloomPx + 9);
  }

  update(viewmodel: THREE.Object3D, dt: number): void {
    const k = 220, d = 15, decay = Math.exp(-d * dt);
    this.zVel = (this.zVel - this.zOff * k * dt) * decay;
    this.zOff += this.zVel * dt;
    this.pitchVel = (this.pitchVel - this.pitchOff * k * dt) * decay;
    this.pitchOff += this.pitchVel * dt;

    viewmodel.position.z = this.zOff;
    viewmodel.rotation.x = this.pitchOff * 0.16;
    this.bloomPx += (6 - this.bloomPx) * (1 - Math.exp(-9.5 * dt));
  }
}
```

## 2. Quick-Scope Sniper Cadence & `Q`-Switch Cancel
- **Scope-in**: Apply negative FOV target (`-26°`) with fast spring impulse (`-120 deg/s`) rather than instant FOV jump.
- **Shot release**: Reset FOV target to `0`, inject `+210 deg/s` FOV snap + `0.58` rotational trauma + `45ms` hitstop.
- **Q-Switch flourish**: Hide rifle for `0.34s`, show melee blade spinning at `14 rad/s` around X-axis to rhythmically cancel bolt recovery.

## 3. Material Wallbang Penetration & Falloff
- Tag colliders by material (`'wood' | 'steel' | 'concrete'`).
- On `steel`: stop ray, spawn 20 blue-white additive sparks (`0x60a5fa`) along surface normal + high metallic ring (`1820Hz -> 960Hz`), deal `0` damage.
- On `wood`: continue ray through thickness `< 0.8m`, spawn tumbling wood-chunk particles at **both entry and exit points**, attenuate damage by `0.82`, and muffle impact sound (`720Hz` bandpass).

## 4. Pitch-Climbing Headshot Chime & Directional Damage Arc
- Play a 3-partial metallic helmet chime (`[2340, 3520, 5180] Hz`) multiplied by `Math.pow(2, ((killStreak - 1) * 1.25) / 12)`.
- When the player takes damage, compute horizontal angle in view space:
  `angle = Math.atan2(fwd.x * toEnemy.z - fwd.z * toEnemy.x, fwd.dot(toEnemy))`
  and draw a fading crimson arc on a 2D HUD canvas around screen center.
