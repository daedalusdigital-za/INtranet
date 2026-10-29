// Style guardrail (design review D-17): stops component styles drifting away from the
// design tokens. Counts hand-written colours, pixel font sizes, !important and gradients in
// component style contexts, and browser pop-ups (alert/confirm/prompt) in component code,
// and fails if any count rises above tools/style-baseline.json.
// The counts may only go down; lower the baseline when they do:
//
//   npm run check:styles            check against the baseline
//   npm run check:styles -- --update   write the current counts as the new baseline
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../src/app', import.meta.url));
const BASELINE = fileURLToPath(new URL('./style-baseline.json', import.meta.url));

const RULES = {
  hexColours: /#[0-9a-fA-F]{6}(?![0-9a-fA-F])|#[0-9a-fA-F]{3}(?![0-9a-fA-F])/g,
  pxFontSizes: /font-size\s*:\s*\d+(\.\d+)?px/g,
  important: /!important/g,
  // No gradients in the interface (D-01).
  gradients: /(linear|radial|conic)-gradient\(/g,
};
const POPUPS = /(^|[^.\w$])(alert|confirm|prompt)\(|window\.(alert|confirm|prompt)\(/g;
// Code without comments and without methods that happen to be called confirm() and the like.
const codeOnly = src => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
  .replace(/^\s*(async\s+)?(alert|confirm|prompt)\([^)]*\)\s*(:[^{=;]+)?\{/gm, '');

// Only style contexts: .scss files, `styles:` blocks in components, style="" attributes.
function styleText(path, src) {
  const ext = extname(path);
  if (ext === '.scss') return src;
  const parts = [];
  if (ext === '.ts') {
    for (const m of src.matchAll(/styles\s*:\s*\[?\s*`([\s\S]*?)`\s*[,\]]/g)) parts.push(m[1]);
    for (const m of src.matchAll(/template\s*:\s*`([\s\S]*?)`\s*[,}]/g)) parts.push(...[...m[1].matchAll(/\sstyle="([^"]*)"/g)].map(x => x[1]));
  }
  if (ext === '.html') parts.push(...[...src.matchAll(/\sstyle="([^"]*)"/g)].map(x => x[1]));
  return parts.join('\n');
}

const totals = Object.fromEntries([...Object.keys(RULES), 'browserPopups'].map(k => [k, 0]));
const perFile = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!['.scss', '.ts', '.html'].includes(extname(p)) || p.endsWith('.spec.ts')) continue;
    const src = readFileSync(p, 'utf8');
    const text = styleText(p, src);
    const counts = Object.fromEntries(Object.entries(RULES).map(([k, re]) => [k, (text.match(re) || []).length]));
    // Browser pop-ups (D-10): ConfirmService and ToastService replace them.
    counts.browserPopups = extname(p) === '.ts' ? (codeOnly(src).match(POPUPS) || []).length : 0;
    Object.entries(counts).forEach(([k, n]) => (totals[k] += n));
    perFile.push([relative(APP, p), counts]);
  }
})(APP);

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, JSON.stringify(totals, null, 2) + '\n');
  console.log('Baseline updated:', totals);
  process.exit(0);
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : null;
if (!baseline) {
  console.error('No baseline yet. Run: npm run check:styles -- --update');
  process.exit(1);
}

let failed = false;
for (const [k, n] of Object.entries(totals)) {
  const b = baseline[k] ?? 0;
  const status = n > b ? 'TOO MANY' : n < b ? 'down, lower the baseline' : 'ok';
  console.log(`${k.padEnd(12)} ${String(n).padStart(6)}  (baseline ${b})  ${status}`);
  if (n > b) failed = true;
}
if (failed) {
  console.error('\nNew styles must use the tokens in src/styles/_tokens.scss (var(--color-*), var(--text-*)).');
  const worst = perFile.sort((a, b) => b[1].hexColours - a[1].hexColours).slice(0, 5);
  console.error('Files with the most hand-written colours:\n' + worst.map(([f, c]) => `  ${c.hexColours}  ${f}`).join('\n'));
  process.exit(1);
}
