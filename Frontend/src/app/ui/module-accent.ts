/**
 * Visual refresh: which module a route belongs to, for its accent colour (data-module on
 * <body>, see styles/_refresh.scss) and the sidebar icon colours.
 */
export type ModuleKey = 'home' | 'docs' | 'projects' | 'sales' | 'logistics' | 'stock' | 'tenders' | 'people' | 'finance' | 'admin';

const PREFIXES: Array<[string, ModuleKey]> = [
  ['/dashboard', 'home'], ['/calendar', 'home'], ['/messages', 'home'], ['/emails', 'home'], ['/welcome', 'home'], ['/profile', 'home'],
  ['/documents', 'docs'], ['/docs', 'docs'], ['/archives', 'docs'], ['/sheets', 'docs'], ['/books', 'docs'],
  ['/departments', 'projects'], ['/projects', 'projects'], ['/board', 'projects'], ['/company-projects', 'projects'],
  ['/sales', 'sales'], ['/customers', 'sales'],
  ['/logistics', 'logistics'],
  ['/stock-management', 'stock'], ['/warehouse-3d', 'stock'], ['/asset-register', 'stock'],
  ['/tenders', 'tenders'],
  ['/people', 'people'],
  ['/finance', 'finance'], ['/directors', 'finance'], ['/treasury', 'finance'], ['/executive', 'finance'],
  ['/settings', 'admin'], ['/user-management', 'admin'], ['/management', 'admin'], ['/flows', 'admin'], ['/support-ticket', 'admin'],
];

export function moduleForUrl(url: string | null | undefined): ModuleKey {
  const path = (url ?? '').split(/[?#]/)[0].toLowerCase();
  for (const [prefix, key] of PREFIXES) if (path === prefix || path.startsWith(prefix + '/')) return key;
  return 'home';
}
