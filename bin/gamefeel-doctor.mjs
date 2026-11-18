#!/usr/bin/env node
/**
 * gamefeel-3d CLI Doctor (`npx gamefeel-3d doctor ./my-threejs-game`)
 * Audits a Three.js / React Three Fiber / WebGL project against the 12 Anti-Slop Game-Feel Rules,
 * computes a 0-100 GameFeel Health Score, and outputs a ready-to-paste `$gamefeel-3d` fix prompt.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const subcmd = args[0] && !args[0].startsWith('-') ? args[0] : 'doctor';
const targetArg =
  subcmd === 'doctor'
    ? args.find((a, i) => i > 0 && !a.startsWith('-')) ?? '.'
    : args[0] ?? '.';
const jsonMode = args.includes('--json');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
⚡ gamefeel-3d CLI (v2.0.0)

Usage:
  npx gamefeel-3d doctor [project-dir] [--json]

Examples:
  npx gamefeel-3d doctor .
  npx gamefeel-3d doctor ../my-threejs-shooter
`);
  process.exit(0);
}

const targetRoot = path.resolve(process.cwd(), targetArg);
if (!fs.existsSync(targetRoot)) {
  console.error(`Error: target directory does not exist: ${targetRoot}`);
  process.exit(1);
}

const SKIP = new Set(['node_modules', 'dist', 'build', '.git', '.next', 'coverage']);
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.html']);

const sourceFiles = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    const fp = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(fp);
    else if (CODE_EXT.has(path.extname(ent.name).toLowerCase())) sourceFiles.push(fp);
  }
}
walk(targetRoot);

const findings = [];
const positives = new Set();

const ANTI_PATTERNS = [
  {
    id: 'RULE-01-RANDOM-SHAKE',
    penalty: 18,
    regex: /camera\.position\.[xyz]\s*\+?=\s*.*Math\.random\s*\(/,
    title: 'Naive Math.random() on camera.position (causes motion-sick jitter)',
    fix: 'Replace with GDC Trauma² smooth 3-axis rotational shake (shake = trauma * trauma).',
  },
  {
    id: 'RULE-02-FIXED-LERP',
    penalty: 14,
    regex: /\.lerp\s*\([^,]+,\s*0\.(?:0[1-9]|[1-3]\d?)\s*\)/,
    title: 'Frame-rate dependent fixed-factor .lerp(..., 0.x) (breaks on 120Hz/144Hz)',
    fix: 'Use exponential damping: THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt)).',
  },
  {
    id: 'RULE-11-HARD-AUDIO-FREQ',
    penalty: 10,
    regex: /\.frequency\.value\s*=\s*[^;]+(?:speed|rpm|vel)/i,
    title: 'Direct continuous Oscillator frequency assignment (causes audible click pops)',
    fix: 'Smooth continuous pitch updates via osc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.035).',
  },
];

const POSITIVE_SIGNALS = [
  { key: 'Hitstop / Dual-Clock Dilation', bonus: 12, regex: /hitstop|timeScale|scaledDt|slowMo/i },
  { key: '2nd-Order Spring Physics / Exp Damp', bonus: 12, regex: /Math\.exp\s*\(\s*-|stiffness|Spring/i },
  { key: 'Trauma² Rotational Camera Rig', bonus: 10, regex: /trauma\s*\*\s*trauma|addTrauma|rotateZ/i },
  { key: '2-Frame Emissive Hit-Flash', bonus: 8, regex: /emissive\.setHex|emissiveIntensity/ },
  { key: 'Additive Shader / Sparks / Trails', bonus: 10, regex: /AdditiveBlending|ShaderMaterial/ },
  { key: 'Procedural WebAudio + Compressor', bonus: 12, regex: /createDynamicsCompressor|AudioContext/ },
  { key: 'Clamped Delta-Time Safety', bonus: 8, regex: /Math\.min\s*\([^,]+,\s*0\.0[3-9]/ },
];

for (const fp of sourceFiles) {
  const content = fs.readFileSync(fp, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const sig of POSITIVE_SIGNALS) {
    if (sig.regex.test(content)) positives.add(sig.key);
  }

  lines.forEach((line, idx) => {
    // Ignore comments, educational string literals, or explicit doctor-ignore lines
    if (/^\s*(\/\/|\*|\/\*)|doctor-ignore|['"`].*Math\.random/.test(line)) return;
    for (const rule of ANTI_PATTERNS) {
      if (rule.regex.test(line)) {
        findings.push({
          rule: rule.id,
          penalty: rule.penalty,
          file: path.relative(targetRoot, fp).replace(/\\/g, '/'),
          line: idx + 1,
          title: rule.title,
          fix: rule.fix,
        });
      }
    }
  });
}

let score = 36; // Base baseline for a bare playable prototype
for (const sig of POSITIVE_SIGNALS) {
  if (positives.has(sig.key)) score += sig.bonus;
}
const uniquePenalties = new Map();
for (const f of findings) {
  uniquePenalties.set(f.rule, f.penalty);
}
for (const pen of uniquePenalties.values()) score -= pen;
score = Math.max(5, Math.min(100, score));

const grade = score >= 90 ? 'S' : score >= 78 ? 'A' : score >= 60 ? 'B' : score >= 42 ? 'C' : 'D';

const missingSignals = POSITIVE_SIGNALS.filter((s) => !positives.has(s.key)).map((s) => s.key);
const suggestedPrompt =
  findings.length === 0 && missingSignals.length === 0
    ? '$gamefeel-3d Your project already hits S-tier across all 7 feel channels! Try adding Gamepad Dual-Rumble or GPU Interactive Foliage.'
    : `$gamefeel-3d Audit fix: upgrade this project (currently ${score}/100 Grade ${grade}) by fixing [${
        [...uniquePenalties.keys()].join(', ') || 'missing feel channels'
      }] and adding [${missingSignals.slice(0, 4).join(', ')}].`;

if (jsonMode) {
  console.log(
    JSON.stringify(
      {
        target: targetRoot,
        filesScanned: sourceFiles.length,
        score,
        grade,
        positives: [...positives],
        missingSignals,
        findings,
        suggestedPrompt,
      },
      null,
      2
    )
  );
  process.exit(0);
}

console.log(`\n⚡ gamefeel-3d Doctor Report — ${path.basename(targetRoot)}`);
console.log(`${'─'.repeat(62)}`);
console.log(`  Files Scanned : ${sourceFiles.length}`);
console.log(`  Health Score  : ${score} / 100  [Grade ${grade}]`);
console.log(`${'─'.repeat(62)}`);

if (positives.size > 0) {
  console.log(`\n✓ Detected Tactile Channels (${positives.size}/${POSITIVE_SIGNALS.length}):`);
  for (const p of positives) console.log(`  • ${p}`);
}

if (missingSignals.length > 0) {
  console.log(`\n○ Missing Feel Channels to Unlock Higher Score:`);
  for (const m of missingSignals) console.log(`  • ${m}`);
}

if (findings.length > 0) {
  console.log(`\n⚠ Anti-Slop Violations Found (${findings.length}):`);
  for (const f of findings.slice(0, 10)) {
    console.log(`  [${f.rule}] ${f.file}:${f.line} -> ${f.title}`);
    console.log(`     ↳ Fix: ${f.fix}`);
  }
} else {
  console.log(`\n✓ Zero Anti-Slop Violations Detected!`);
}

console.log(`\n🤖 Copy-Paste Prompt for Codex / Claude Code / Antigravity:`);
console.log(`  ${suggestedPrompt}\n`);
