import { SubPage, findSubPage } from '../../ui/sub-pages';

/** Stock sub-pages (design review D-12), in sub-navigation order: /stock-management/<slug>. */
export type StockSlug = 'on-hand' | 'counts' | 'issues' | 'exceptions' | 'movements' | 'dispatch' | 'reports';

export const STOCK_SECTIONS: readonly SubPage<StockSlug>[] = [
  { slug: 'on-hand', label: 'Stock on hand', icon: 'inventory_2', hint: '' },
  { slug: 'counts', label: 'Stock counts', icon: 'fact_check', hint: '' },
  { slug: 'issues', label: 'Issues', icon: 'assignment_late', hint: '' },
  { slug: 'exceptions', label: 'Exceptions', icon: 'report_problem', hint: '' },
  { slug: 'movements', label: 'Movements', icon: 'swap_horiz', hint: '' },
  { slug: 'dispatch', label: 'Dispatch', icon: 'local_shipping', hint: '' },
  { slug: 'reports', label: 'Reports', icon: 'summarize', hint: '' },
];

export function stockSection(slug: string | null | undefined): SubPage<StockSlug> | undefined {
  return findSubPage(STOCK_SECTIONS, slug);
}
