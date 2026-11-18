# 3D Camera & Time-Dilation Recipes

## 1. Squirrel Eiserloh's GDC `Trauma²` Rotational Camera Shake
- Store `trauma` in `[0, 1]`, decaying linearly (`trauma = Math.max(0, trauma - 1.55 * rawDt)`).
- Compute `shake = trauma * trauma` (quadratic curve gives sharp initial impact + buttery tail).
- Rotate camera around local `X / Y / Z` axes using 1D smooth value/Perlin noise at `26 Hz` (`maxPitch = 0.075 rad`, `maxRoll = 0.11 rad`) **after** `camera.lookAt(target)`. Never randomly offset `camera.position`!

## 2. Frame-Rate Independent Follow & Velocity Lookahead
```ts
const alpha = 1 - Math.exp(-lambda * rawDt); // Identical across 60Hz, 120Hz, 240Hz
const lead = horizontalVelocity.clone().clampLength(0, 10).multiplyScalar(0.165);
curCamPos.lerp(desiredCamPos.clone().addScaledVector(lead, 0.45), alpha);
curLookAt.lerp(playerPos.clone().add(lead), 1 - Math.exp(-lambda * 1.25 * rawDt));
```

## 3. Zero-Clipping Crit Zoom-Punch & Dutch Roll
Pushing `camera.position` forward clips through indoor walls. Instead, drive an under-damped FOV spring (`fovVel -= 165`, `k = 210, d = 17`) paired with an alternating `±9°` Z-axis roll impulse (`k = 190, d = 15`) and `50ms` hitstop.

## 4. Witch-Time / Bullet-Time Dilation + Audio Lowpass Sync
When entering slow-motion (`timeScale = 0.14` for `1.05s`):
- Smoothly ramp `timeScale` (`damp(cur, 0.14, 22, rawDt)`).
- Narrow FOV by `-8°` and raise radial vignette opacity.
- Sweep a master `BiquadFilterNode` (`type = 'lowpass'`) from `20000 Hz` down to `680 Hz` via `setTargetAtTime(680, ctx.currentTime, 0.035)`, restoring `20000 Hz` on exit.
