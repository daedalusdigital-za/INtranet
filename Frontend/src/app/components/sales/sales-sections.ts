import { SubPage, findSubPage } from '../../ui/sub-pages';

/** Sales sub-pages (design review D-12), in sub-navigation order: /sales/<slug>. */
export type SalesSlug =
  'orders' | 'customers' | 'invoices' | 'history' | 'back-orders' | 'pods' | 'trip-sheets' | 'tender-pricing';

export const SALES_SECTIONS: readonly SubPage<SalesSlug>[] = [
  { slug: 'orders', label: 'Incoming orders', icon: 'email', hint: 'Order emails from customers' },
  { slug: 'customers', label: 'Customers', icon: 'people', hint: 'Customers of all four companies' },
  { slug: 'invoices', label: 'Invoices', icon: 'receipt_long', hint: 'Imported sales invoices' },
  { slug: 'history', label: 'Sales history', icon: 'history', hint: 'Every imported sale, line by line' },
  { slug: 'back-orders', label: 'Back orders', icon: 'assignment_return', hint: 'Orders waiting for stock' },
  { slug: 'pods', label: 'PODs', icon: 'verified', hint: 'Signed delivery notes from drivers' },
  { slug: 'trip-sheets', label: 'Trip sheets', icon: 'assignment', hint: 'Deliveries planned by Logistics' },
  { slug: 'tender-pricing', label: 'Tender pricing', icon: 'gavel', hint: 'Tender prices by item' },
];

export function salesSection(slug: string | null | undefined): SubPage<SalesSlug> | undefined {
  return findSubPage(SALES_SECTIONS, slug);
}
