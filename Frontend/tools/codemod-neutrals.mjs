// Replaces hand-picked greys and whites in component styles with the neutral design tokens
// (design review D-01, D-04), so pages follow the light and dark themes. The token depends on
// the CSS property: #f5f5f5 is a surface as a background but a line as a border, and #666 is
// secondary text. Only touches style contexts, like tools/codemod-colors.mjs:
//   - *.scss files under src/app
//   - `styles: [...]` / `styles: \`...\`` blocks inside *.ts components
//   - style="..." attributes in templates (*.html and inline templates)
// Left alone: white text (it depends on what it sits on), dark backgrounds (tooltips, video,
// photo overlays), and anything inside gradients or shadows.
//
// Usage: node tools/codemod-neutrals.mjs [--dry] [--skip=<path fragment>,...]
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../src/app', import.meta.url));
const DRY = process.argv.includes('--dry');
const SKIP = (process.argv.find(a => a.startsWith('--skip=')) ?? '--skip=').slice(7).split(',').filter(Boolean);

const group = (token, values) => values.map(v => [v, token]);
const BACKGROUND = new Map([
  ...group('var(--color-surface)', ['#fff', '#ffffff', 'white']),
  ...group('var(--color-canvas)', ['#fafafa', '#f8f9fa', '#f9f9f9', '#fcfcfc', '#fbfbfb', '#f8f8f8', '#fdfdfd']),
  ...group('var(--color-surface-2)', ['#f5f5f5', '#f0f0f0', '#f4f4f4', '#f3f3f3', '#eee', '#eeeeee', '#f1f1f1', '#f2f2f2',
    '#e9ecef', '#eef2f7', '#f6f6f6', '#f7f7f7', '#f5f6f8', '#f4f6f8', '#f0f2f5', '#f1f3f4', '#f8f9fb', '#eef0f3']),
  ...group('var(--color-surface-3)', ['#e0e0e0', '#ddd', '#dddddd', '#e8e8e8', '#e5e5e5', '#e3e6ea', '#e6e6e6', '#e9e9e9', '#ececec', '#dee2e6']),
  ...group('var(--color-line-strong)', ['#ccc', '#cccccc', '#bbb', '#bdbdbd', '#d0d0d0', '#d9d9d9']),
]);
const TEXT = new Map([
  ...group('var(--color-text)', ['#000', '#000000', '#111', '#111111', '#222', '#222222', '#1a1a1a', '#212121', '#333', '#333333',
    '#2c3e50', '#263238', '#1f2937', '#1f2430', '#2d3748', '#202124', '#24292f']),
  ...group('var(--color-text-2)', ['#444', '#444444', '#555', '#555555', '#5f6368', '#666', '#666666', '#616161', '#4a4a4a',
    '#495057', '#57606a', '#4a5568', '#5a5a5a']),
  ...group('var(--color-text-3)', ['#777', '#777777', '#888', '#888888', '#8b949e', '#999', '#999999', '#9e9e9e', '#aaa', '#aaaaaa',
    '#a0a0a0', '#bbb', '#b0b0b0', '#6c757d', '#868e96', '#adb5bd', '#ccc', '#cccccc', '#718096', '#a0aec0']),
]);
const BORDER = new Map([
  ...group('var(--color-line)', ['#eee', '#eeeeee', '#f0f0f0', '#e0e0e0', '#e8e8e8', '#e5e5e5', '#e9ecef', '#dee2e6', '#ddd', '#dddddd',
    '#dadce0', '#e3e6ea', '#e6e6e6', '#ececec', '#f1f1f1', '#f5f5f5', '#e9e9e9', '#ebebeb', '#e1e4e8', '#d0d7de', '#e2e8f0']),
  ...group('var(--color-line-strong)', ['#ccc', '#cccccc', '#ced4da', '#bbb', '#bdbdbd', '#c0c0c0', '#d0d0d0', '#d1d1d1', '#d9d9d9', '#aaa']),
  ...group('var(--color-surface)', ['#fff', '#ffffff', 'white']),
]);

function mapFor(prop) {
  if (prop === 'background' || prop === 'background-color') return BACKGROUND;
  if (prop === 'color' || prop === 'caret-color' || prop === '-webkit-text-fill-color') return TEXT;
  if (/^(border(-(top|right|bottom|left))?(-color)?|outline(-color)?|column-rule(-color)?)$/.test(prop)) return BORDER;
  return null;
}

const stats = { files: 0, replaced: 0, byToken: {} };
const COLOUR = /#[0-9a-fA-F]{6}(?![0-9a-fA-F])|#[0-9a-fA-F]{3}(?![0-9a-fA-F])|\bwhite\b/g;

// One declaration's value. Values with gradients or functions other than var() are left alone.
function replaceValue(prop, value) {
  const map = mapFor(prop);
  if (!map || /gradient|rgba?\(|hsla?\(|url\(/i.test(value)) return value;
  return value.replace(COLOUR, c => {
    const token = map.get(c.toLowerCase());
    if (!token) return c;
    stats.replaced++;
    stats.byToken[token] = (stats.byToken[token] || 0) + 1;
    return token;
  });
}

// Declarations: `prop: value` up to ; or } or the end of a style attribute.
const replaceCss = css => css.replace(/(^|[{;\s"])([a-z-]+)(\s*:\s*)([^;{}"]+)/g,
  (all, lead, prop, colon, value) => lead + prop + colon + replaceValue(prop.toLowerCase(), value));
const replaceStyleAttrs = t => t.replace(/(\sstyle=")([^"]*)(")/g, (_, a, body, c) => a + replaceCss(body) + c);

function processTs(src) {
  let out = src.replace(/(styles\s*:\s*\[?\s*)(`[\s\S]*?`)(\s*[,\]])/g, (_, a, body, c) => a + replaceCss(body) + c);
  out = out.replace(/(template\s*:\s*`)([\s\S]*?)(`\s*[,}])/g, (_, a, body, c) => a + replaceStyleAttrs(body) + c);
  return out;
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    const rel = relative(ROOT, p).split('\\').join('/');
    if (SKIP.some(s => rel.includes(s)) || p.endsWith('.spec.ts')) continue;
    const ext = extname(p);
    if (!['.scss', '.ts', '.html'].includes(ext)) continue;
    const src = readFileSync(p, 'utf8');
    const before = stats.replaced;
    const out = ext === '.scss' ? replaceCss(src) : ext === '.ts' ? processTs(src) : replaceStyleAttrs(src);
    if (stats.replaced > before) {
      stats.files++;
      if (!DRY) writeFileSync(p, out);
    }
  }
}

walk(ROOT);
console.log(`${DRY ? '[dry run] ' : ''}${stats.replaced} colours in ${stats.files} files`);
for (const [t, n] of Object.entries(stats.byToken).sort((a, b) => b[1] - a[1])) console.log(`  ${n}\t${t}`);
