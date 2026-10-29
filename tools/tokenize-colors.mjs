// Context-aware codemod: replaces hard-coded light-mode colour literals inside CSS
// declarations with design tokens from src/styles/_tokens.scss so components follow
// dark mode. Light mode is unchanged because the token values equal the literals.
//
//   node tools/tokenize-colors.mjs          # dry run (report only)
//   node tools/tokenize-colors.mjs --write  # apply
//
// Only CSS declaration contexts are touched (background*, color, border*, outline*).
// Quoted values (chart configs, ngStyle objects, JS strings) are never matched.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(process.cwd(), 'Frontend', 'src', 'app');
const WRITE = process.argv.includes('--write');

const EXCLUDE = [
  `core${sep}modules.config.ts`,          // module identity colours
  `warehouse-3d${sep}`,                   // 3D scene
  `chatbot${sep}welly-mascot${sep}`,      // glow colours are intentional
];

const lower = (xs) => xs.map((x) => x.toLowerCase());

// Background context
const BG_SURFACE = lower(['#fff', '#ffffff', 'white']);
const BG_SURFACE2 = lower(['#f5f5f5', '#fafafa', '#f8f9fa', '#f8fafc', '#f9fafb', '#f7f8fa', '#f5f6fa', '#f4f5f7',
  '#f6f7f9', '#f7f7f7', '#f0f0f0', '#f1f5f9', '#eef2f7', '#f3f4f6', '#f5f7fa', '#f4f6f8', '#f9f9f9', '#fcfcfc',
  '#fdfdfd', '#f6f8fa', '#f1f3f5', '#f2f4f7', '#f0f2f5', '#f5f6f8', '#fafbfc', '#f8f8f8', '#f3f3f3', '#f4f4f4', '#efefef', '#f0f4f8']);
const BG_SURFACE3 = lower(['#e2e8f0', '#e5e7eb', '#e8eaf6', '#e0e0e0', '#eee', '#eeeeee', '#e3e6ea', '#e6edf3', '#e9ecef',
  '#dee2e6', '#e1e4e8', '#eaeaea', '#ebebeb', '#ececec', '#e8e8e8', '#dcdfeb', '#e6e9f3', '#eef0f7']);
const BG_PRIMARY_SOFT = lower(['#e3f2fd', '#e8f4fc', '#eff6ff', '#dbeafe', '#e3eef8', '#eef4fb', '#e1f5fe', '#e0f2fe', '#f0f7ff', '#f0f9ff']);
const BG_WARN_SOFT = lower(['#fff8e1', '#fef3c7', '#fffbeb', '#fef9c3', '#fdf6e3', '#fff3e0', '#fffde7', '#fbf0dc', '#fef5e7', '#fdf2e9']);
const BG_OK_SOFT = lower(['#e8f5e9', '#dcfce7', '#f0fdf4', '#d1fae5', '#e2f3ea', '#ecfdf5', '#e6f4ea', '#eafaf1']);
const BG_DANGER_SOFT = lower(['#ffebee', '#fee2e2', '#fef2f2', '#fde8e8', '#f9e5e1', '#fdecea', '#fff5f5', '#fdeaea']);
const BG_PURPLE_SOFT = lower(['#f3e5f5', '#ede9fe', '#f5f3ff', '#efeafb', '#fae8ff', '#f5d0fe', '#e1bee7', '#d1c4e9']);
const BG_TINT_EXTRA = {
  'var(--color-ok-soft)': lower(['#c8e6c9', '#a7f3d0', '#dcedc8', '#bbf7d0', '#d9f99d']),
  'var(--color-primary-soft)': lower(['#bfdbfe', '#bbdefb', '#c5cae9', '#b3e5fc', '#b2ebf2', '#b2dfdb', '#cfe8ff']),
  'var(--color-warn-soft)': lower(['#ffe0b2', '#ffecb3', '#fff9c4', '#fde68a', '#fed7aa', '#f0f4c3']),
  'var(--color-danger-soft)': lower(['#ffcdd2', '#fecaca', '#fecdd3']),
};

// Dark navy / indigo used as heading or label text: invisible on dark surfaces.
const TXT_BRAND = lower(['#1a237e', '#283593', '#033142', '#0d47a1', '#1e3a8a', '#1e40af', '#0f3460', '#262262', '#1a365d', '#0b3d91', '#14213d']);

// Text context
const TXT_1 = lower(['#333', '#333333', '#222', '#222222', '#111', '#111111', '#1a1936', '#212121', '#1f2937', '#111827',
  '#0f172a', '#1e293b', '#212529', '#2c3e50', '#1a1a1a', '#2d3748', '#24292f', '#000', '#000000', 'black', '#263238', '#1e1e1e', '#2d2d2d', '#3c4043', '#202124']);
const TXT_2 = lower(['#666', '#666666', '#555', '#555555', '#444', '#444444', '#4b5070', '#64748b', '#6b7280', '#475569',
  '#4a5568', '#546e7a', '#5f6368', '#57606a', '#6c757d', '#495057', '#374151', '#616161', '#424242', '#4a4a4a', '#5a5a5a', '#595959', '#606060', '#707070', '#777', '#777777']);
const TXT_3 = lower(['#999', '#999999', '#888', '#888888', '#aaa', '#aaaaaa', '#94a3b8', '#9ca3af', '#a0aec0', '#8a8fb0',
  '#737896', '#adb5bd', '#9e9e9e', '#757575', '#8b949e', '#6a737d', '#a1a1aa', '#a3a3a3', '#b0b0b0', '#bbb', '#bbbbbb', '#999a9b', '#909090']);

// Border context
const LINE = lower(['#e2e8f0', '#e5e7eb', '#e0e0e0', '#eee', '#eeeeee', '#ddd', '#dddddd', '#dcdfeb', '#e3e6ea', '#eef2f7',
  '#e6edf3', '#d1d5db', '#cbd5e1', '#e1e4e8', '#d0d7de', '#e8eaf6', '#f0f0f0', '#f1f5f9', '#e4e7ec', '#dfe3e8', '#ced4da',
  '#dee2e6', '#e9ecef', '#e3e3e3', '#e5e5e5', '#e8e8e8', '#eaeaea', '#ebebeb', '#ececec', '#f5f5f5', '#f0f2f5', '#e6e6e6', '#d9d9d9', '#dadce0', '#c5c9da', '#e6e9f3', '#eef0f7', '#f3f4f6', '#f8f9fa', '#fafafa']);
const LINE_STRONG = lower(['#ccc', '#cccccc', '#bdbdbd', '#c0c0c0', '#b0bec5', '#9ca3af', '#94a3b8', '#adb5bd']);

const bgMap = new Map();
for (const c of BG_SURFACE) bgMap.set(c, 'var(--color-surface)');
for (const c of BG_SURFACE2) bgMap.set(c, 'var(--color-surface-2)');
for (const c of BG_SURFACE3) bgMap.set(c, 'var(--color-surface-3)');
for (const c of BG_PRIMARY_SOFT) bgMap.set(c, 'var(--color-primary-soft)');
for (const c of BG_WARN_SOFT) bgMap.set(c, 'var(--color-warn-soft)');
for (const c of BG_OK_SOFT) bgMap.set(c, 'var(--color-ok-soft)');
for (const c of BG_DANGER_SOFT) bgMap.set(c, 'var(--color-danger-soft)');
for (const c of BG_PURPLE_SOFT) bgMap.set(c, 'var(--color-cat-purple-soft)');
for (const [tok, cs] of Object.entries(BG_TINT_EXTRA)) for (const c of cs) bgMap.set(c, tok);

const txtMap = new Map();
for (const c of TXT_1) txtMap.set(c, 'var(--color-text)');
for (const c of TXT_2) txtMap.set(c, 'var(--color-text-2)');
for (const c of TXT_3) txtMap.set(c, 'var(--color-text-3)');
for (const c of TXT_BRAND) txtMap.set(c, 'var(--color-brand)');

const lineMap = new Map();
for (const c of LINE) lineMap.set(c, 'var(--color-line)');
for (const c of LINE_STRONG) lineMap.set(c, 'var(--color-line-strong)');

// A CSS declaration: prop : value  (value stops at ; } newline or a quote so JS strings never match)
const DECL = /(^|[\s;{])(background-color|background|color|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline(?:-color)?)(\s*:\s*)([^;{}"'\n`]+?)(\s*)(?=[;}"'\n`])/gi;
const LITERAL = /#[0-9a-f]{3,6}\b|\b(?:white|black)\b/gi;

function mapFor(prop) {
  const p = prop.toLowerCase();
  if (p.startsWith('background')) return bgMap;
  if (p === 'color') return txtMap;
  return lineMap; // border*, outline*
}

function tokenize(src) {
  let count = 0;
  const out = src.replace(DECL, (whole, lead, prop, colon, value, trail) => {
    // url() values are never touched; gradients are fine because only light tints are in bgMap
    if (/url\(/i.test(value)) return whole;
    const map = mapFor(prop);
    const nv = value.replace(LITERAL, (lit) => {
      const t = map.get(lit.toLowerCase());
      if (!t) return lit;
      count++;
      return t;
    });
    return `${lead}${prop}${colon}${nv}${trail}`;
  });
  return { out, count };
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(scss|css|ts|html)$/.test(name) && !name.endsWith('.spec.ts')) acc.push(p);
  }
  return acc;
}

const files = walk(ROOT).filter((f) => !EXCLUDE.some((x) => f.includes(x)));
let total = 0;
const report = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const { out, count } = tokenize(src);
  if (count > 0) {
    total += count;
    report.push([count, relative(ROOT, f)]);
    if (WRITE && out !== src) writeFileSync(f, out, 'utf8');
  }
}
report.sort((a, b) => b[0] - a[0]);
for (const [n, f] of report) console.log(String(n).padStart(5), f);
console.log(`\n${WRITE ? 'Replaced' : 'Would replace'} ${total} literals in ${report.length} files.`);
