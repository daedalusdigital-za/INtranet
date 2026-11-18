/**
 * Logos uploaded in Admin settings › Company branding, keyed by company code. Filled once at
 * start-up by BrandingService; the helpers below prefer these over the built-in files.
 */
const UPLOADED: { logo: Record<string, string>; round: Record<string, string>; names: Record<string, string> } = { logo: {}, round: {}, names: {} };
export function registerUploadedBranding(list: { code: string; name: string; logo?: { url: string } | null; logoRound?: { url: string } | null }[]): void {
  for (const c of list) {
    UPLOADED.names[c.code] = c.name;
    UPLOADED.names[c.name.toLowerCase()] = c.name;
    if (c.logo?.url) UPLOADED.logo[c.code] = UPLOADED.logo[c.name.toLowerCase()] = c.logo.url; else { delete UPLOADED.logo[c.code]; delete UPLOADED.logo[c.name.toLowerCase()]; }
    if (c.logoRound?.url) UPLOADED.round[c.code] = UPLOADED.round[c.name.toLowerCase()] = c.logoRound.url; else { delete UPLOADED.round[c.code]; delete UPLOADED.round[c.name.toLowerCase()]; }
  }
}
function uploaded(map: Record<string, string>, k: string): string | undefined { return map[k] ?? map[k.toLowerCase()]; }

/** Round company logos: the uploaded one if there is one, else the built-in /logos file. Accepts a code (PMT/ACM/PHT/SBT) or a full name. */
const FILES: Record<string, string> = {
  PMT: 'promed', ACM: 'access', PHT: 'pharmatech', SBT: 'sebenzani',
  'promed technologies': 'promed', 'access medical': 'access', 'promed pharmatech': 'pharmatech', 'sebenzani trading': 'sebenzani'
};
export const COMPANY_NAMES: Record<string, string> = { PMT: 'Promed Technologies', ACM: 'Access Medical', PHT: 'Promed Pharmatech', SBT: 'Sebenzani Trading' };

export function companyLogo(codeOrName: string | null | undefined): string {
  const k = (codeOrName ?? '').trim();
  const up = uploaded(UPLOADED.round, k) ?? uploaded(UPLOADED.logo, k);
  if (up) return up;
  const f = FILES[k] ?? FILES[k.toLowerCase()] ?? 'rocket';
  return `/logos/${f}-round.png`;
}
export function companyName(code: string | null | undefined): string { return COMPANY_NAMES[code ?? ''] ?? (code ?? ''); }

/**
 * Full (non-round) brand logos, web-sized to 640px wide (public/logos/*-wide.png).
 * Companies without artwork yet return null — callers show a monogram placeholder until the file is uploaded.
 */
const WIDE: Record<string, string> = {
  PMT: 'promed', ACM: 'access', PHT: 'pharmatech', PHC: 'pharmatech', SBT: 'sebenzani',
  'promed technologies': 'promed', 'access medical': 'access', 'promed pharmatech': 'pharmatech', 'promed pharmacare (pharmatech)': 'pharmatech', 'sebenzani trading': 'sebenzani'
};
export function companyWideLogo(codeOrName: string | null | undefined): string | null {
  const k = (codeOrName ?? '').trim();
  const up = uploaded(UPLOADED.logo, k);
  if (up) return up;
  const f = WIDE[k] ?? WIDE[k.toLowerCase()];
  return f ? `/logos/${f}-wide.png` : null;
}
/** Up-to-3-letter monogram for companies with no logo yet, e.g. "New Age Technologies" → "NAT", "KOG" → "KOG". */
export function companyMonogram(code: string | null | undefined, name?: string | null): string {
  const c = (code ?? '').trim().toUpperCase();
  if (c.length >= 2 && c.length <= 4) return c;
  const words = (name ?? c).replace(/\(.*?\)/g, '').split(/[\s&/-]+/).filter(Boolean);
  return (words.length > 1 ? words.map(w => w[0]).join('') : (words[0] ?? '').slice(0, 3)).toUpperCase().slice(0, 3);
}
/** Stable brand-ish colour per company code for monogram placeholders. */
export function companyHue(code: string | null | undefined): number {
  let h = 0; for (const ch of (code ?? '')) h = (h * 31 + ch.charCodeAt(0)) % 360; return h;
}
