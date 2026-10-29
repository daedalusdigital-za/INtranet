import { SubPage, findSubPage } from '../../ui/sub-pages';

/**
 * Logistics sub-pages (design review D-12), in sub-navigation order: /logistics/<slug>.
 * Loads and trip sheets also take one item: /logistics/loads/RF-20261023-004.
 */
export type LogisticsSlug =
  'loads' | 'fleet' | 'maintenance' | 'trip-sheets' | 'overberg-tripsheets' | 'pods' | 'fuel' | 'requisitions' | 'controller' | 'reports';

export const LOGISTICS_SECTIONS: readonly SubPage<LogisticsSlug>[] = [
  { slug: 'loads', label: 'Loads', icon: 'assignment', hint: 'Active loads across all warehouses' },
  { slug: 'fleet', label: 'Fleet', icon: 'directions_car', hint: 'Vehicles, drivers and live positions' },
  { slug: 'maintenance', label: 'Maintenance', icon: 'build', hint: 'Services, repairs and inspections' },
  { slug: 'trip-sheets', label: 'Trip sheets', icon: 'description', hint: 'Planned and completed trips' },
  { slug: 'overberg-tripsheets', label: 'Overberg Tripsheets', icon: 'rocket_launch', hint: 'Waybills placed on the Rocket Freight client portal and the tripsheets carrying them' },
  { slug: 'pods', label: 'PODs', icon: 'verified', hint: 'Signed delivery notes from drivers' },
  { slug: 'fuel', label: 'Fuel history', icon: 'local_gas_station', hint: 'Monthly fuel reports from TFN and Puma' },
  { slug: 'requisitions', label: 'Requisitions', icon: 'receipt_long', hint: 'Petty cash and e-wallet payments' },
  { slug: 'controller', label: 'Controller', icon: 'shield', hint: 'Security monitoring of the fleet' },
  { slug: 'reports', label: 'Reports', icon: 'assessment', hint: 'Daily security incident log' },
];

export function logisticsSection(slug: string | null | undefined): SubPage<LogisticsSlug> | undefined {
  return findSubPage(LOGISTICS_SECTIONS, slug);
}
