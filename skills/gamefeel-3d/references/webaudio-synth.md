# Zero-Asset Procedural WebAudio Synthesizer Recipes

Route all procedural game audio through `lowpassBus -> masterGain -> DynamicsCompressorNode(threshold: -14, knee: 16, ratio: 6, attack: 0.002, release: 0.14) -> ctx.destination` so overlapping explosions and rapid fire never clip!

## 1. 3-Layer Firearm Formula (Crack + Punch + Mech Click)
- **Crack**: Pre-allocated white-noise `AudioBuffer` -> `BiquadFilterNode('bandpass', 980..1200Hz)` -> exponential gain decay (`0.16s` rifle, `0.34s` sniper).
- **Chest Thump**: `sawtooth` oscillator sweeping exponentially `190Hz -> 46Hz` over `0.11s` (`225Hz -> 32Hz` over `0.25s` for sniper; add `88Hz -> 22Hz` `sine` sub for `.50` cannon).
- **Bolt / Action Click**: Short `25ms` `triangle` pitch drops at `2100–3400Hz`.

## 2. Inharmonic Forged Steel & Bronze Gong Partials
Real metallic percussion uses non-integer frequency ratios:
- **Perfect Katana Deflect**: `[1185, 1890, 2740, 4120, 5680] Hz` (`triangle` / `sine` alternating) with decays `[0.36, 0.44, 0.28, 0.22, 0.15]s` + `3900Hz` bandpass spark burst + `168Hz -> 46Hz` chest sub. Multiply frequencies by `2^(((combo % 7) * 0.65) / 12)` for musical combo tension!
- **Buddhist Deathblow Gong**: `[112, 224, 342, 518, 785] Hz` `sine` partials decaying over `1.85s` into a procedural `0.48s` ConvolverNode impulse.

## 3. Click-Free Continuous 5-Gear RPM Engine & Tire Screech
Start two continuous oscillators (`sawtooth` at `1x`, `triangle` at `1.98x`) feeding a `lowpass` filter at init with `gain = 0`, then modulate smoothly every frame:
```ts
const norm = Math.min(1, speedKmh / 310);
const gearTooth = (speedKmh % 68) / 68;
const rpm = 56 + norm * 118 + gearTooth * 42 + boostTier * 24;
osc1.frequency.setTargetAtTime(rpm, ctx.currentTime, 0.035);
osc2.frequency.setTargetAtTime(rpm * 1.98, ctx.currentTime, 0.035);
filter.frequency.setTargetAtTime(340 + norm * 960, ctx.currentTime, 0.04);
```
For tire skid, loop the noise buffer through a `bandpass` filter (`1950 Hz, Q = 4.2`) and fade its gain with `setTargetAtTime`.
