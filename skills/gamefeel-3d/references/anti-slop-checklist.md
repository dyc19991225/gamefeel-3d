# Anti-Slop 3D Game-Feel Checklist (12 Rules)

Run every Three.js / WebGL / WebGPU game through these 12 rules before shipping:

1. **Never use `Math.random()` on `camera.position` for shake.** Use `shake = trauma * trauma` driving 3-axis smooth rotational noise (`rotateX`, `rotateY`, `rotateZ`).
2. **Never use raw `lerp(a, b, 0.1)` in `requestAnimationFrame`.** Always use frame-rate independent damping: `THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt))`.
3. **Clamp `rawDt = Math.min(dt, 0.05)`.** Switching browser tabs spikes `dt` to several seconds and explodes spring velocities if unclamped.
4. **Split `rawDt` and `scaledDt`.** During Hitstop (`timeScale ≈ 0.02`), freeze attacker/victim limb motion (`scaledDt`), but tick camera trauma, sparks, and victim horizontal micro-jitter on `rawDt`.
5. **Every hit target needs a 50–65ms pure-white emissive flash** (`emissive.setHex(0xffffff)` -> 35ms `0xff2a44` decay) plus a spring wobble impulse.
6. **Keep muzzle flashes under 50ms (2–3 frames)** using 3 crossed additive planes, randomizing Z-rotation every shot so consecutive frames never look static.
7. **Sub-step fast weapon/tire trails.** When blade tip distance between frames exceeds `0.18m`, linearly interpolate intermediate hilt/tip samples so arcs stay silky smooth at 60fps.
8. **Decouple visual heading from velocity yaw in arcade vehicles.** A kart whose nose always points along its velocity vector cannot feel like it is drifting.
9. **Preserve volume during squash-and-stretch.** When landing compresses `scale.y = s`, set `scale.x = 1 / Math.sqrt(s)` and `scale.z = 1 / Math.sqrt(s)`.
10. **Never play bare single-oscillator beeps.** Layer a filtered noise transient (attack crack) + an exponential pitch-swept oscillator (`190Hz -> 45Hz` punch) routed through a `DynamicsCompressorNode`.
11. **Never assign continuous WebAudio frequencies directly (`osc.frequency.value = f`).** Always smooth with `osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.035)` to prevent audible clicks.
12. **Unlock `AudioContext` on the first `pointerdown` / `keydown`** and resume if `ctx.state === 'suspended'`.
