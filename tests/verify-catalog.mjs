import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();

const requiredFiles = [
  'skills/gamefeel-3d/SKILL.md',
  'skills/gamefeel-3d/references/anti-slop-checklist.md',
  'skills/gamefeel-3d/references/fps-ballistics.md',
  'skills/gamefeel-3d/references/melee-combat.md',
  'skills/gamefeel-3d/references/arcade-racing.md',
  'skills/gamefeel-3d/references/camera-and-time.md',
  'skills/gamefeel-3d/references/webaudio-synth.md',
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
  'docs/CATALOG.md',
  'README.md',
];

for (const rel of requiredFiles) {
  const full = path.join(root, rel);
  assert.ok(fs.existsSync(full), `Missing required file: ${rel}`);
  assert.ok(fs.statSync(full).size > 80, `File unexpectedly small: ${rel}`);
}

const skillMd = fs.readFileSync(path.join(root, 'skills/gamefeel-3d/SKILL.md'), 'utf8');
assert.match(skillMd, /^---\r?\nname:\s*gamefeel-3d/m, 'SKILL.md must declare name: gamefeel-3d in YAML frontmatter');
assert.match(skillMd, /description:\s*.+/m, 'SKILL.md must declare description in YAML frontmatter');

const recipeFiles = ['fps.ts', 'melee.ts', 'racing.ts', 'camera.ts', 'vfx.ts', 'audio.ts'];
const ids = new Set();

for (const file of recipeFiles) {
  const src = fs.readFileSync(path.join(root, 'src/recipes', file), 'utf8');
  const matches = [...src.matchAll(/id:\s*'([a-z0-9-]+)'/g)];
  assert.ok(matches.length >= 3, `${file} must contain at least 3 recipes`);
  for (const m of matches) {
    assert.ok(!ids.has(m[1]), `Duplicate recipe id: ${m[1]}`);
    ids.add(m[1]);
  }
}

assert.equal(ids.size, 24, `Expected exactly 24 unique recipes, found ${ids.size}`);

// Verify zero external binary assets in repo
const forbiddenExt = new Set(['.glb', '.gltf', '.fbx', '.obj', '.mp3', '.wav', '.ogg']);
function scanNoBinaryAssets(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'dist') continue;
    const fp = path.join(dir, ent.name);
    if (ent.isDirectory()) scanNoBinaryAssets(fp);
    else {
      const ext = path.extname(ent.name).toLowerCase();
      assert.ok(!forbiddenExt.has(ext), `Zero-asset violation: binary asset found at ${fp}`);
    }
  }
}
scanNoBinaryAssets(root);

console.log(`✓ Verified 24 unique zero-asset 3D recipes, SKILL.md + 6 reference playbooks, and plugin manifests.`);
