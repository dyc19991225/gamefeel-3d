# Platforming, Roguelite Loot & Reactive World Recipes

## 1. Platforming & Parkour (`PLT-01` .. `PLT-04`)
- **Coyote Time + Jump Buffer + Asymmetric Gravity**:
  - `coyoteTimer = isGrounded ? 0.11 : Math.max(0, coyoteTimer - dt)`.
  - `jumpBuffer = jumpPressed ? 0.12 : Math.max(0, jumpBuffer - dt)`.
  - Apply `2.15×` gravity when `vy < 0` (or when jump button is released early) to eliminate floaty moon-jumps.
- **Sandevistan Ghost-Dash Afterimages**: Spawn `8` equidistant additive silhouettes (`[0x22d3ee, 0x38bdf8, 0x818cf8, 0xc084fc]`) fading over `0.42s` between dash start and end positions.
- **Grapple Swing & Wall-Run Tilt**:
  - Project outward radial velocity off the rope vector (`if (vel.dot(ropeDir) > 0) vel.addScaledVector(ropeDir, -vel.dot(ropeDir))`) and multiply tangential velocity by `1.45×` on release.
  - During wall-runs, drop gravity to `22%` and tilt camera roll `14°` away from the wall normal.

## 2. Roguelite Loot & Dopamine (`LOT-01` .. `LOT-04`)
- **Diablo Loot Fountain & Sky-Beam**: Launch drops upward (`vy = 6.2..8.6`) in a radial ring, bounce twice on the floor, and ignite an additive vertical cylinder GLSL beam (`pow(1 - vUv.y, 1.5)`) + 6-note harp arpeggio `[523, 659, 784, 1046, 1318, 1568] Hz` on legendary touch-down.
- **Vampire-Survivors Anticipation Magnet**: Push XP gems **away** from the player at `4.2 m/s` for the first `0.14s` before accelerating inward (`24 + age * 55 m/s`), climbing pickup pop pitch by `0.85` semitones per chain.
- **Chest Anticipation & Level-Up Nova**: Compress chest (`scaleY = 1 - t * 0.28`, `scaleXZ = 1 / sqrt(scaleY)`) with accelerating horizontal sine rumble for `0.55s` before popping lid; knock back mobs within `3.8m` on level-up.

## 3. Destruction, Foliage, Water & Haptics (`WLD-01` .. `WLD-04`)
- **Zero-Asset 27-Chunk Shatter**: Subdivide destroyed AABB props into a `3×3×3` grid of tumbling `DodecahedronGeometry` shards with `0.48` floor bounce restitution + `60ms` hitstop.
- **1-Draw-Call GPU Foliage Trample**: Use `THREE.InstancedMesh` and displace `localPos.xz += normalize(worldXZ - uPlayer.xz) * pow(1 - dist / uRadius, 1.6) * 0.85 * height01` directly in the vertex shader.
- **Analytic Multi-Ripple Water**: Sum 4 expanding rings `sin((dist - age * speed) * freq) * exp(...)` and compute surface normal from analytic XY derivatives for crisp specular highlights without normal maps.
- **Gamepad Dual-Rumble**: Drive `pad.vibrationActuator.playEffect('dual-rumble', { duration, strongMagnitude, weakMagnitude })`, pairing heavy left-motor low-freq thumps with crisp right-motor blade buzz.
