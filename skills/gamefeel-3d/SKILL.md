---
name: gamefeel-3d
description: Inject visceral, zero-asset 3D game feel ("juice") into Three.js, WebGL, WebGPU, React Three Fiber, or browser 3D games — including 2nd-order spring recoil, Sakurai asymmetric hitstop, Tamahagane deflect sparks, sub-stepped GLSL blade/skid trails, arcade drift slip physics, Trauma² rotational camera shake, and zero-MP3 procedural WebAudio synthesizers. Activate whenever building, polishing, or fixing combat, shooting, racing, camera, VFX, or audio feel in a 3D web game.
---

# gamefeel-3d — Zero-Asset 3D Game Feel Skill

Turn flat, weightless "vibecoded" Three.js prototypes into tactile, responsive, arcade-grade 3D games **without requiring external `.glb`, `.png`, or `.mp3` assets**.

## Core Philosophy: Why AI-Generated 3D Games Feel Like Plastic

Most LLM-generated 3D games fail at game feel for five specific reasons:
1. **Linear/Instant State Changes**: `hp -= 25` with zero hitstop, white hit-flash, or knockback spring.
2. **Nauseating Camera Shake**: Using `camera.position.x += (Math.random() - 0.5) * k` instead of rotational `shake = trauma²` smooth noise.
3. **Frame-Rate Dependent Smoothing**: Writing `lerp(a, b, 0.1)` (breaks on 120Hz/144Hz monitors) instead of `1 - Math.exp(-lambda * dt)`.
4. **Polygonal Kinks & Balloon VFX**: Weapon trails without sub-frame interpolation, and explosions made of scaling opaque orange spheres.
5. **Silent or Beepy Audio**: Either zero sound or a bare single-oscillator `sine` beep instead of layered noise transients + pitch-swept body + `DynamicsCompressorNode`.

---

## Interactive Guided Entry (Codex-Style Onboarding)

When the user invokes `$gamefeel-3d` or `gamefeel-3d` broadly without naming a specific mechanic, start with a brief, structured 3-option prompt (using `request_user_input` / `ask_question` if available, or numbered choices):

1. **(Recommended) Audit & Upgrade Existing 3D Project** — Scan the current workspace against [`references/anti-slop-checklist.md`](references/anti-slop-checklist.md), report the top 3–5 missing feel channels, and apply surgical upgrades.
2. **Inject a Specific Genre Feel Pack** — Choose **FPS Ballistics**, **Sekiro Melee & Hitstop**, **Arcade Kart Drift**, **Trauma² Camera & Bullet-Time**, or **Zero-MP3 WebAudio Synth**.
3. **Scaffold a New Zero-Asset 3D Prototype** — Generate a playable Vite + Three.js + TypeScript arena pre-wired with dual-clock (`rawDt` / `scaledDt`), `Trauma²` camera rig, additive VFX forge, and compressor-backed WebAudio synth.

---

## Workflow When Building or Polishing a 3D Game

1. **Audit Against the Anti-Slop Checklist**: Read [`references/anti-slop-checklist.md`](references/anti-slop-checklist.md) first to spot missing tactile feedback channels (Visual + Kinetic + Temporal + Acoustic).
2. **Load Only the Relevant Domain Playbook**:
   - **FPS / Third-Person Shooters** → Read [`references/fps-ballistics.md`](references/fps-ballistics.md) (2nd-order recoil springs, quick-scope FOV snap & Q-switch cancel, material wallbang falloff, headshot harmonic ding & HUD directional damage arc).
   - **Melee / Action / Boss Combat** → Read [`references/melee-combat.md`](references/melee-combat.md) (Sakurai asymmetric hitstop, sub-stepped GLSL blade ribbon trails, 34-spark perfect deflects, posture break & perilous `"危"` telegraphs).
   - **Arcade Racing / Kart / Vehicular** → Read [`references/arcade-racing.md`](references/arcade-racing.md) (Decoupled `headingYaw` vs `velocityYaw` drift slip, cut-drift nose snap, CWW nitro boost state machine + FOV warp, landing chassis squash).
   - **Platformer / Roguelite Loot / Destructible World & Haptics** → Read [`references/platform-loot-world.md`](references/platform-loot-world.md) (Coyote time & jump buffer, Sandevistan dash ghosts, grapple swing, wall-run tilt, Diablo sky-beams, push-back XP magnet, 27-shard mesh shatter, 1-drawcall GPU grass bend, water ripples, and Gamepad dual-rumble).
   - **3D Camera & Time Manipulation** → Read [`references/camera-and-time.md`](references/camera-and-time.md) (GDC `trauma²` rotational shake, critically damped `damp()` follow with velocity lookahead, sub-120ms crit zoom-punch, bullet-time + WebAudio lowpass sync).
   - **Procedural Sound Effects (Zero MP3)** → Read [`references/webaudio-synth.md`](references/webaudio-synth.md) (Firearms, inharmonic katana/bronze-gong partials, click-free 5-gear sawtooth RPM loops, tire screech, and master compressor setup).
3. **Enforce the Dual-Clock Rule (`rawDt` vs `scaledDt`)**:
   - Always split your main loop into `rawDt` (clamped wall-clock delta `Math.min(dt, 0.05)`) and `scaledDt = rawDt * timeScale`.
   - **Skeletal animations, locomotion, and projectiles** advance by `scaledDt` (so they freeze cleanly during hitstop or slow down in bullet-time).
   - **Camera shake, FOV springs, hit-sparks, shockwave rings, and victim hit-vibration** advance by `rawDt` (so the screen stays alive and energetic during freeze frames!).
4. **Verify Every Impact Fires Across ≥ 3 Senses**:
   - **Kinetic**: 2nd-order spring impulse (`gun`, `victim wobble`, or `chassis squash`) + rotational camera trauma.
   - **Visual**: 45–60ms pure-white emissive hit-flash or muzzle star + additive tangent sparks / GLSL Fresnel ring.
   - **Temporal**: 35–95ms hitstop on heavy/crit/deflect contact, or smooth `0.14x` slow-mo on finishers.
   - **Acoustic**: Transient noise burst + exponential pitch-drop body + harmonic ring on crits/deflects.
