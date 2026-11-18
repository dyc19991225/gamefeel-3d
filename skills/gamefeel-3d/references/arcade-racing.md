# Arcade Racing, Drift & Speed-Feel Recipes

## 1. Decoupled Nose Heading vs Velocity Yaw (Arcade Drift)
Never lock car movement strictly to `car.rotation.y`. Maintain two separate angles:
- `headingYaw`: visual chassis orientation controlled rapidly by steer input during drift.
- `velYaw`: actual world travel vector lagging behind `headingYaw` by up to `36°` (`maxSlip`), damped via `1 - Math.exp(-4.5 * dt)`.
- Roll the chassis outward (`chassis.rotation.z = -driftDir * 0.17`) and escalate rear-wheel sparks through 3 visual tiers (`0.0s` Blue `0x38bdf8` -> `0.62s` Purple `0xc084fc` -> `1.25s` Gold `0xfacc15`).

## 2. Cut-Drift (`断位拉车头`) Exit Snap
If `driftDuration > 0.22s` and the player taps Drift while counter-steering (`Math.sign(steer) === -driftDir`):
- Immediately end drift and snap `velYaw = lerp(velYaw, headingYaw, 0.82)`.
- Grant 2 short mini-boost charges (`0.22s` minimum spacing, `1.45s` window) for crisp corner-exit acceleration.

## 3. CWW Nitro + Double Mini-Boost State Machine & Speed Illusion
- Chain N2O (`C`, `258 km/h`) -> first mini-boost (`CW`, `286 km/h`) -> second mini-boost (`CWW`, `312 km/h`).
- Sell extreme speed via 4 camera/HUD layers:
  1. Wide-angle FOV spring target (`+8°` -> `+15°` -> `+22°`).
  2. Longitudinal G-force lag spring pulling chassis slightly back on ignition, then surging forward.
  3. Color-shifting additive exhaust cones (`Blue -> Violet -> Gold`).
  4. 28 radial peripheral speed-lines drawn on a 2D HUD overlay.

## 4. Airborne Pitch & Volume-Preserving Landing Squash
- While airborne, tilt pitch proportional to vertical velocity: `chassis.rotation.x = clamp(-vy * 0.045, -0.32, 0.28)`.
- On touchdown, inject downward velocity `-Math.abs(impactVy) * 0.9` into a 2nd-order chassis spring (`k = 230, d = 13`), preserve volume (`scale.set(1/sqrt(sy), sy, 1)`), and spawn a horizontal ground shockwave ring.
