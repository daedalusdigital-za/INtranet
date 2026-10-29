// Gives icon-only buttons an accessible name (design review D-15).
//
// Screen readers announce an icon-only button as just "button". For every <button> or <a>
// that is a Material icon button, or whose only content is a <mat-icon>, and has no
// aria-label yet, this adds one:
//   matTooltip="Delete row"   ->  aria-label="Delete row"
//   [matTooltip]="expr"       ->  [attr.aria-label]="expr"
//   no tooltip                ->  a label from the icon name (close -> "Close")
// Buttons it can't name are listed so they can be labelled by hand.
//
//   node tools/codemod-a11y-labels.mjs --dry   report only
//   node tools/codemod-a11y-labels.mjs         write changes
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../src/app', import.meta.url));
const DRY = process.argv.includes('--dry');

const ICON_LABELS = {
  close: 'Close', cancel: 'Close', clear: 'Clear',
  more_vert: 'More actions', more_horiz: 'More actions',
  chevron_left: 'Previous', chevron_right: 'Next', navigate_before: 'Previous', navigate_next: 'Next',
  arrow_back: 'Back', arrow_forward: 'Forward', arrow_upward: 'Move up', arrow_downward: 'Move down',
  edit: 'Edit', delete: 'Delete', delete_outline: 'Delete', add: 'Add', add_circle: 'Add', remove: 'Remove',
  remove_circle_outline: 'Remove', send: 'Send', refresh: 'Refresh', check: 'Confirm', search: 'Search',
  attach_file: 'Attach a file', download: 'Download', upload: 'Upload', print: 'Print', menu: 'Menu',
  rotate_left: 'Rotate left', rotate_right: 'Rotate right', zoom_in: 'Zoom in', zoom_out: 'Zoom out',
  visibility: 'Show', content_copy: 'Copy', open_in_new: 'Open in a new tab', fullscreen: 'Full screen',
  filter_list: 'Filter', settings: 'Settings', info: 'More information', help: 'Help', save: 'Save',
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if ((p.endsWith('.html') || p.endsWith('.ts')) && !p.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

const OPEN = /<(button|a)\b([^>]*)>/g;
const ICON_BUTTON = /\bmat-(?:mini-)?(?:icon-button|fab)\b/;
let changed = 0, files = 0;
const unnamed = [];

for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');
  let out = '', last = 0, n = 0;
  for (const m of src.matchAll(OPEN)) {
    const [tag, name, attrs] = m;
    if (/aria-label|aria-labelledby/.test(attrs)) continue;
    const end = src.indexOf(`</${name}>`, m.index + tag.length);
    if (end < 0) continue;
    const inner = src.slice(m.index + tag.length, end);
    const iconOnly = /^\s*<mat-icon\b[^>]*>[^<]*<\/mat-icon>\s*$/.test(inner);
    if (!ICON_BUTTON.test(attrs) && !iconOnly) continue;
    // Icon buttons with visible text beside the icon already have a name.
    if (ICON_BUTTON.test(attrs) && inner.replace(/<mat-icon\b[^>]*>[^<]*<\/mat-icon>/g, '').replace(/<[^>]+>/g, '').trim()) continue;

    let add = null;
    const tip = attrs.match(/\smatTooltip="([^"]*)"/);
    const boundTip = attrs.match(/\s\[matTooltip\]="([^"]*)"/);
    if (tip && !tip[1].includes('{{')) add = `aria-label="${tip[1]}"`;
    else if (boundTip) add = `[attr.aria-label]="${boundTip[1]}"`;
    else if (!tip) {
      const icon = inner.match(/<mat-icon\b[^>]*>\s*([a-z_0-9]+)\s*<\/mat-icon>/);
      if (icon && ICON_LABELS[icon[1]]) add = `aria-label="${ICON_LABELS[icon[1]]}"`;
    }
    if (!add) {
      const line = src.slice(0, m.index).split('\n').length;
      unnamed.push(`${relative(ROOT, file)}:${line}  ${tag.slice(0, 90).replace(/\s+/g, ' ')}`);
      continue;
    }
    const insertAt = m.index + 1 + name.length;
    out += src.slice(last, insertAt) + ' ' + add;
    last = insertAt;
    n++;
  }
  if (n) {
    out += src.slice(last);
    if (!DRY) writeFileSync(file, out);
    changed += n; files++;
  }
}

console.log(`${DRY ? 'Would label' : 'Labelled'} ${changed} icon buttons in ${files} files.`);
if (unnamed.length) {
  console.log(`\n${unnamed.length} need a label by hand:`);
  for (const u of unnamed) console.log('  ' + u);
}
