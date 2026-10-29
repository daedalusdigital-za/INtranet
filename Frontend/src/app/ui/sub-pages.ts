import { ActivatedRoute, Params, ResolveFn, Router, Routes } from '@angular/router';

/**
 * Sub-pages of a module (design review D-12): /logistics/trip-sheets, /sales/back-orders and so on.
 * Each has its own address, so it can be bookmarked and shared, and the browser's Back button
 * moves between sub-pages. A module lists its sub-pages, adds subPageRoutes() as children of its
 * route, shows <app-sub-nav> under its page title, and keeps its filters in the address with
 * toQuery() and recordFilters().
 */
export interface SubPage<S extends string = string> {
  slug: S;
  label: string;
  icon: string;
  /** One line under the page title when the sub-page has nothing more specific to say. */
  hint: string;
}

export function findSubPage<P extends SubPage>(pages: readonly P[], slug: string | null | undefined): P | undefined {
  return pages.find(p => p.slug === slug);
}

/**
 * Child routes for a module whose sub-pages share one component, so moving between them keeps
 * the data already loaded. The children have no component: the module reads the section (and
 * item, with withItem) from the address. /<module> opens the first sub-page.
 */
export function subPageRoutes(pages: readonly SubPage[], fallbackTitle: string, withItem = false): Routes {
  const title: ResolveFn<string> = route => findSubPage(pages, route.paramMap.get('section'))?.label ?? fallbackTitle;
  return [
    { path: '', pathMatch: 'full', redirectTo: pages[0].slug },
    { path: ':section', title, children: [] },
    ...(withItem ? [{ path: ':section/:ref', title, children: [] }] : [])
  ];
}

/** Filter values as address parameters, leaving out empty values and defaults. */
export function toQuery(values: Record<string, string | null | undefined>, defaults: Record<string, string> = {}): Params {
  const query: Params = {};
  for (const [key, value] of Object.entries(values)) {
    if (value && value !== defaults[key]) query[key] = value;
  }
  return query;
}

/** True when two sets of address parameters say the same thing. */
export function sameQuery(a: Params, b: Params): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every(k => String(a[k] ?? '') === String(b[k] ?? ''));
}

const FILTER_RECORD = 'subPageFilters';

/**
 * Puts the current filters in the address. It replaces the history entry rather than adding
 * one, so Back still goes to the previous page, and does nothing when the address already
 * says the same.
 */
export function recordFilters(router: Router, route: ActivatedRoute, query: Params): void {
  if (sameQuery(query, route.snapshot.queryParams)) return;
  router.navigate([], {
    relativeTo: route.firstChild ?? route,
    queryParams: query,
    replaceUrl: true,
    state: { [FILTER_RECORD]: true }
  });
}

/**
 * True when the last navigation was recordFilters() writing down filters the page already shows.
 * Applying them again could undo what someone typed while the address was catching up. Back and
 * Forward restore the same history state, so only the page's own (imperative) navigation counts.
 */
export function isFilterRecord(router: Router): boolean {
  const nav = router.lastSuccessfulNavigation;
  return nav?.trigger === 'imperative' && !!nav.extras.state?.[FILTER_RECORD];
}

/** A text parameter from the address, or '' when it's missing. */
export function queryText(query: Params, key: string): string {
  return typeof query[key] === 'string' ? query[key] : '';
}

/** A calendar day as yyyy-mm-dd, for the address bar. */
export function formatDay(date: Date | null): string | null {
  if (!date) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDay(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
