// Replaces the most-used hand-picked colours in component styles with design tokens
// (design review D-01). Only touches style contexts:
//   - *.scss files under src/app
//   - `styles: [...]` / `styles: \`...\`` blocks inside *.ts components
//   - style="..." attributes in templates (*.html and inline templates)
// Colours in TypeScript logic (chart configs, canvas drawing) are left alone because
// canvas APIs cannot resolve CSS variables.
//
// Usage: node tools/codemod-colors.mjs [--dry]
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../src/app', import.meta.url));
const DRY = process.argv.includes('--dry');

const MAP = {
  // primary actions and links: the many blues collapse to Promed blue
  'var(--color-primary)': ['#2563eb', '#1976d2', '#1e90ff', '#3b82f6', '#4169e1', '#2196f3', '#6366f1', '#4f46e5', '#667eea', '#764ba2', '#1a73e8', '#0d6efd'],
  'var(--color-primary-hover)': ['#1d4ed8', '#1565c0', '#1e40af', '#0d47a1', '#4338ca', '#1e3a8a'],
  'var(--color-primary-soft)': ['#e3f2fd', '#dbeafe', '#eff6ff', '#bbdefb', '#e0e7ff', '#eef2ff'],
  // neutrals
  'var(--color-text)': ['#0f172a', '#1a1a2e', '#111827', '#1e293b', '#212121'],
  'var(--color-text-2)': ['#334155', '#374151', '#475569', '#424242', '#4b5563'],
  'var(--color-text-3)': ['#64748b', '#6b7280', '#94a3b8', '#757575', '#9ca3af'],
  'var(--color-line)': ['#e2e8f0', '#e0e0e0', '#e5e7eb'],
  'var(--color-line-strong)': ['#cbd5e1', '#d1d5db', '#bdbdbd'],
  'var(--color-surface-2)': ['#f1f5f9', '#f5f5f5', '#f3f4f6', '#eeeeee'],
  'var(--color-canvas)': ['#f8fafc', '#f9fafb', '#fafafa'],
  // status
  'var(--color-ok)': ['#4caf50', '#2e7d32', '#22c55e', '#16a34a', '#10b981', '#059669', '#388e3c', '#43a047', '#66bb6a'],
  'var(--color-ok-soft)': ['#e8f5e9', '#dcfce7', '#d1fae5', '#ecfdf5', '#f0fdf4'],
  'var(--color-warn)': ['#ff9800', '#e65100', '#f59e0b', '#f97316', '#d97706', '#ef6c00', '#fb8c00', '#ffa726', '#f57c00'],
  'var(--color-warn-soft)': ['#fff3e0', '#fef3c7', '#fffbeb', '#fff7ed', '#ffedd5'],
  'var(--color-danger)': ['#f44336', '#ef4444', '#dc2626', '#c62828', '#d32f2f', '#b91c1c', '#e53935'],
  'var(--color-danger-soft)': ['#ffebee', '#fee2e2', '#fef2f2'],
};
const LOOKUP = new Map();
for (const [token, hexes] of Object.entries(MAP)) for (const h of hexes) LOOKUP.set(h, token);
const HEX = /#[0-9a-fA-F]{6}(?![0-9a-fA-F])/g;

const stats = { files: 0, replaced: 0, byToken: {} };
function replaceHex(text) {
  return text.replace(HEX, (h) => {
    const token = LOOKUP.get(h.toLowerCase());
    if (!token) return h;
    stats.replaced++;
    stats.byToken[token] = (stats.byToken[token] || 0) + 1;
    return token;
  });
}
// style="..." attributes (not [style.x] bindings)
const replaceStyleAttrs = (t) => t.replace(/(\sstyle=")([^"]*)(")/g, (_, a, body, c) => a + replaceHex(body) + c);

function processTs(src) {
  let out = src;
  // styles: [`...`, `...`] or styles: `...`
  out = out.replace(/(styles\s*:\s*\[?\s*)(`[\s\S]*?`)(\s*[,\]])/g, (_, a, body, c) => a + replaceHex(body) + c);
  // inline templates: only style="" attributes
  out = out.replace(/(template\s*:\s*`)([\s\S]*?)(`\s*[,}])/g, (_, a, body, c) => a + replaceStyleAttrs(body) + c);
  return out;
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    const ext = extname(p);
    if (!['.scss', '.ts', '.html'].includes(ext) || p.endsWith('.spec.ts')) continue;
    const src = readFileSync(p, 'utf8');
    const out = ext === '.scss' ? replaceHex(src) : ext === '.html' ? replaceStyleAttrs(src) : processTs(src);
    if (out !== src) {
      stats.files++;
      if (!DRY) writeFileSync(p, out);
    }
  }
}

walk(ROOT);
console.log(`${DRY ? '[dry run] ' : ''}${stats.replaced} colours replaced in ${stats.files} files`);
for (const [t, n] of Object.entries(stats.byToken).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${t}`);
