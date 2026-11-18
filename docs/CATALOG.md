# Complete Catalog — 24 Zero-Asset 3D Game-Feel Recipes

Every recipe in `src/recipes/` is acted out live in Three.js + GLSL + WebAudio with zero external image, 3D model, or sound files.

| Badge | ID | Category | Recipe (EN / 中文) | Key Technique |
| :--- | :--- | :--- | :--- | :--- |
| `FPS-01` | `recoil-kick-bloom` | `fps` | **2nd-Order Spring Recoil & Crosshair Bloom**<br>二阶弹簧后坐力与准星动态扩散 | Under-damped viewmodel spring (`k=220, d=15`), 3-frame star flash, brass ejection & bloom decay |
| `FPS-02` | `quick-scope-sniper` | `fps` | **Quick-Scope FOV Snap & Q-Switch Cancel**<br>瞬狙开镜曲线与 Q 切刀取消后摇 | `-26°` rapid FOV snap, `.338` supersonic synth, `45ms` hitstop & spinning melee cancel |
| `FPS-03` | `wallbang-penetration` | `fps` | **Material Wallbang Penetration & Falloff**<br>材质穿箱弹道衰减与双面木屑迸射 | Entry/exit wood splinters + `82%` retention vs `0%` steel ricochet sparks |
| `FPS-04` | `headshot-kill-confirm` | `fps` | **Golden Headshot Chime & Damage Arc**<br>黄金爆头清脆反馈与受击方向红弧 | Pitch-climbing 3-partial helmet ding + 2D directional threat HUD arc |
| `ACT-01` | `perfect-deflect-sparks` | `melee` | **Tamahagane Perfect Deflect Sparks**<br>玉钢完美弹反火星与五泛音刀鸣 | 34 additive sparks, `PointLight` flash, `65ms` hitstop & 5-partial katana harmonics |
| `ACT-02` | `hitstop-freeze-shake` | `melee` | **Asymmetric Hitstop & Micro-Jitter**<br>樱井政博非对称顿帧与受击微震挤压 | Freeze limb anim on `scaledDt`, vibrate victim horizontally on `rawDt` before knockback |
| `ACT-03` | `katana-ribbon-trail` | `melee` | **Sub-Stepped GLSL Blade Ribbon Trail**<br>子步插值 GLSL 刀光弧带（五种流派） | Velocity sub-sampling prevents 60fps polygon kinks + razor-tip GLSL glow |
| `ACT-04` | `posture-break-deathblow` | `melee` | **Posture Break & Shinobi Deathblow Gong**<br>架势槽崩解张力与「忍杀」梵钟处决 | HP-coupled posture recovery + `0.16×` slow-mo push-in + Buddhist bronze bell |
| `ACT-05` | `perilous-kanji-mikiri` | `melee` | **Perilous "危" Sting & Mikiri Stomp**<br>「危」字不协和预警与看破踩刀反制 | Dissonant 3-tone biwa sting -> `0.52s` counter window -> ground shockwave stomp |
| `RACE-01` | `drift-slip-sparks` | `racing` | **Decoupled Slip-Angle Drift & 3-Tier Sparks**<br>车头/速度解耦侧滑漂移与三阶胎火 | Separate `headingYaw` vs `velYaw`, chassis roll & Blue → Purple → Gold sparks |
| `RACE-02` | `cww-nitro-fov-warp` | `racing` | **CWW Double-Jet & Speed-Line FOV Warp**<br>CWW 双喷氮气状态机与速度线广角畸变 | `C -> CW -> CWW` speed-cap break (`312 km/h`), `+22°` FOV warp & radial speed-lines |
| `RACE-03` | `cut-drift-snap` | `racing` | **Cut-Drift Counter-Steer Nose Snap**<br>断位拉车头瞬回正与双喷窗口 | Counter-steer tap snaps `velYaw` `82%` to nose heading + instant double mini-boost |
| `RACE-04` | `suspension-landing-squash` | `racing` | **Hang-Time Pitch & Landing Squash**<br>飞跃滞空仰角与落地悬挂压缩回弹 | Airborne pitch + volume-preserving chassis spring squash + landing boost |
| `CAM-01` | `perlin-trauma-shake` | `camera` | **GDC Trauma² Rotational Shake**<br>Trauma² 三轴旋转平滑震屏 vs 劣质随机抖动 | Squirrel Eiserloh's `shake = trauma²` smooth 3-axis rotational noise |
| `CAM-02` | `bullet-time-chromatic` | `camera` | **Witch-Time Dilation & Lowpass Muffle**<br>魔女时间变速与全局音频低通深潜 | `0.14×` world clock synchronized with `680 Hz` WebAudio master lowpass sweep |
| `CAM-03` | `impact-zoom-punch` | `camera` | **Sub-120ms Crit Zoom-Punch & Dutch Roll**<br>零穿模暴击瞬推变焦与荷兰角斜踢 | Under-damped FOV velocity kick + alternating `±9°` Z-axis roll impulse |
| `CAM-04` | `spring-follow-lookahead` | `camera` | **Frame-Rate Independent Damp & Lookahead**<br>帧率无关指数阻尼跟随与速度前瞻 | `1 - exp(-λ·dt)` invariant across 60Hz/144Hz + `1.65m` forward threat framing |
| `VFX-01` | `shockwave-refraction-ring` | `vfx` | **GLSL Fresnel Blast Dome & Shock Ring**<br>零贴图菲涅尔爆破气浪穹顶与双层冲击环 | `pow(1 - dot(N,V), 2.2)` rim-glow dome + horizontal ground blast ring |
| `VFX-02` | `muzzle-tracer-casing` | `vfx` | **3-Plane Star Muzzle Flash & Brass Shells**<br>45ms 随机星芒枪口焰、曳光弹与旋转弹壳 | Z-randomized 3-plane additive star + fading ray tracer + gravity-tumbling brass |
| `VFX-03` | `damage-pop-numbers` | `vfx` | **Parabolic Bounce 3D Damage Numbers**<br>抛物线弹跳伤害跳字与暴击字号阶梯 | Stroked `CanvasTexture` sprites with `16%` elastic scale-pop & crit color tiers |
| `VFX-04` | `hit-flash-rim-shader` | `vfx` | **2-Frame Arcade White Hit-Flash & Wobble**<br>街机两帧纯白受击闪白与弹性摆锤 | `60ms` pure-white emissive override -> `35ms` crimson ember + spring wobble |
| `SFX-01` | `webaudio-gun-forge` | `audio` | **Zero-MP3 Firearm & Cannon Synth**<br>零音频文件 WebAudio 枪炮声学合成器 | Bandpass noise crack + pitch-drop punch + `6:1` `DynamicsCompressor` + hull reverb |
| `SFX-02` | `webaudio-blade-forge` | `audio` | **Sengoku Metallic Harmonics Forge**<br>战国冷兵器非谐泛音锻造台 | Inharmonic steel/bronze partial arrays for deflects, `"危"` stings & temple gongs |
| `SFX-03` | `webaudio-engine-boost` | `audio` | **Click-Free 5-Gear RPM & Tire Screech**<br>五挡连续引擎声浪、胎啸与氮气涡轮 | Smooth `setTargetAtTime` sawtooth gear-modulo RPM + `1950Hz` bandpass tire skid |
