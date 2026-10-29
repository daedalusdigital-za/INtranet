// Accessibility guardrail (design review D-15): fails when a template adds an icon-only
// button without an accessible name, or an image without alt text. Both counts are zero
// today, so any new one fails the check and is listed with its file and line.
//
//   npm run check:a11y
//
// Fix an icon-only button with aria-label="What it does" (the same words as its tooltip),
// or [attr.aria-label]="expr" when the words change. Give content images a description
// in alt, and decorative images alt="".
// tools/codemod-a11y-labels.mjs labels most icon buttons automatically.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../src/app', import.meta.url));
const ICON_BUTTON = /\bmat-(?:mini-)?(?:icon-button|fab)\b/;
const NAMED = /aria-label|aria-labelledby/;
const problems = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if ((p.endsWith('.html') || p.endsWith('.ts')) && !p.endsWith('.spec.ts')) check(p);
  }
}

function lineOf(src, index) {
  return src.slice(0, index).split('\n').length;
}

function check(file) {
  const src = readFileSync(file, 'utf8');
  const where = (i) => `${relative(ROOT, file)}:${lineOf(src, i)}`;

  for (const m of src.matchAll(/<(button|a)\b([^>]*)>/g)) {
    const [tag, name, attrs] = m;
    if (NAMED.test(attrs)) continue;
    const end = src.indexOf(`</${name}>`, m.index + tag.length);
    if (end < 0) continue;
    const inner = src.slice(m.index + tag.length, end);
    const iconOnly = /^\s*<mat-icon\b[^>]*>[^<]*<\/mat-icon>\s*$/.test(inner);
    const textBesideIcon = inner.replace(/<mat-icon\b[^>]*>[^<]*<\/mat-icon>/g, '').replace(/<[^>]+>/g, '').trim();
    if (iconOnly || (ICON_BUTTON.test(attrs) && !textBesideIcon)) {
      problems.push(`${where(m.index)}  icon-only ${name} has no aria-label`);
    }
  }

  for (const m of src.matchAll(/<img\b[^>]*>/g)) {
    // Skip the example in a doc comment ("<img src>").
    if (/^<img src>$/.test(m[0])) continue;
    if (!/\balt\s*=|\[alt\]|\[attr\.alt\]/.test(m[0])) problems.push(`${where(m.index)}  image has no alt text`);
  }
}

walk(ROOT);

if (problems.length) {
  console.error(`${problems.length} accessibility problem${problems.length === 1 ? '' : 's'}:\n`);
  for (const p of problems) console.error('  ' + p);
  console.error('\nSee the comment at the top of tools/check-a11y.mjs for how to fix them.');
  process.exit(1);
}
console.log('Accessibility check: every icon-only button is named and every image has alt text.');
