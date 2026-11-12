/** Round company logos served from /logos (Frontend/public/logos). Accepts a code (PMT/ACM/PHT/SBT) or a full name. */
const FILES: Record<string, string> = {
  PMT: 'promed', ACM: 'access', PHT: 'pharmatech', SBT: 'sebenzani',
  'promed technologies': 'promed', 'access medical': 'access', 'promed pharmatech': 'pharmatech', 'sebenzani trading': 'sebenzani'
};
export const COMPANY_NAMES: Record<string, string> = { PMT: 'Promed Technologies', ACM: 'Access Medical', PHT: 'Promed Pharmatech', SBT: 'Sebenzani Trading' };

export function companyLogo(codeOrName: string | null | undefined): string {
  const k = (codeOrName ?? '').trim();
  const f = FILES[k] ?? FILES[k.toLowerCase()] ?? 'rocket';
  return `/logos/${f}-round.png`;
}
export function companyName(code: string | null | undefined): string { return COMPANY_NAMES[code ?? ''] ?? (code ?? ''); }
