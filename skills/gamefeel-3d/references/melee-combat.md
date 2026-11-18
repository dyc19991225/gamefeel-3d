# Melee Combat, Deflect & Hitstop Recipes

## 1. Sakurai Asymmetric Hitstop
Never pause `requestAnimationFrame`. Freeze skeletal animation (`scaledDt ≈ 0`) for `65–95ms` while keeping three things running on `rawDt`:
1. **Victim horizontal micro-vibration**: `victim.position.x = baseX + Math.sin(freezeRemaining * 190) * 0.11` + contact squash `scale.set(0.86, 1.14, 1.08)`.
2. **Additive sparks & shockwave ring expansion**.
3. **Rotational camera trauma**.
Release knockback velocity only **after** `freezeRemaining <= 0` so the launch reads clearly!

## 2. Tamahagane Perfect Deflect vs Normal Block
Differentiate timing windows (`<= 160ms` before impact = Perfect Deflect) across 4 simultaneous channels:
- **Sparks**: `34` fast orange-gold additive boxes (`0xffae34` + `0xffffff` core) + `intensity = 16` `PointLight` flash for `120ms` (vs `10` dim blue sparks on normal guard).
- **Audio**: 5 inharmonic steel partials `[1185, 1890, 2740, 4120, 5680] Hz` climbing `0.65` semitones per consecutive combo deflect + `3900Hz` bandpass spark noise + `168Hz -> 46Hz` chest sub-punch.
- **Temporal**: `65ms` hitstop + `4.5°` Z-axis Dutch roll kick.

## 3. Sub-Stepped GLSL Weapon Ribbon Trail
At 60fps, fast swings jump `> 0.6m` per frame. Sub-divide between previous and current world hilt/tip positions:
```ts
const steps = Math.min(5, Math.max(1, Math.ceil(prevTip.distanceTo(curTip) / 0.18)));
for (let s = 1; s <= steps; s++) {
  const t = s / steps;
  samples.unshift({ base: prevBase.clone().lerp(curBase, t), tip: prevTip.clone().lerp(curTip, t), age: 0 });
}
```
Shade with `THREE.AdditiveBlending`, fading tail via `pow(1.0 - vUv.x, 1.6)` and brightening the outer blade edge via `smoothstep(0.70, 0.99, vUv.y)`.

## 4. Posture Gauge & Perilous (`危`) Counter Loop
- Recover enemy posture nonlinearly with remaining HP: `recovery = 12 * Math.pow(hpRatio, 1.6)` so damaged bosses hold posture damage longer.
- On unblockable thrusts, fire a dissonant 3-oscillator warning (`[740, 1085, 1520] Hz`, middle oscillator `sawtooth`) + crimson `"危"` billboard `0.52s` ahead of impact to invite a forward-dash Mikiri stomp (`85ms` hitstop + ground shockwave ring).
