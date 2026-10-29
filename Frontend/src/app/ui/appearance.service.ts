import { Injectable, computed, effect, signal } from '@angular/core';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type Density = 'comfortable' | 'compact';

const THEME_KEY = 'ui.theme';
const DENSITY_KEY = 'ui.density';

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* private window: keep it for this visit only */ }
}

/**
 * Light or dark, and comfortable or compact rows (design review D-04). The choice is kept on
 * this computer and applied as data-theme / data-density on <html>, which the design tokens
 * and the shared table read. "System" follows the computer's own light or dark setting.
 * index.html applies the saved theme before the app starts, so pages don't flash white.
 */
@Injectable({ providedIn: 'root' })
export class AppearanceService {
  readonly theme = signal<ThemeChoice>(read(THEME_KEY, ['system', 'light', 'dark'], 'system'));
  readonly density = signal<Density>(read(DENSITY_KEY, ['comfortable', 'compact'], 'comfortable'));

  private readonly media = window.matchMedia?.('(prefers-color-scheme: dark)');
  private readonly systemDark = signal(!!this.media?.matches);

  /** The theme actually showing. */
  readonly dark = computed(() => this.theme() === 'dark' || (this.theme() === 'system' && this.systemDark()));

  constructor() {
    this.media?.addEventListener('change', e => this.systemDark.set(e.matches));
    effect(() => {
      const root = document.documentElement;
      root.dataset['theme'] = this.dark() ? 'dark' : 'light';
      root.dataset['density'] = this.density();
    });
    // Paper is white: print in the light theme whatever is on screen.
    window.addEventListener('beforeprint', () => document.documentElement.dataset['theme'] = 'light');
    window.addEventListener('afterprint', () => document.documentElement.dataset['theme'] = this.dark() ? 'dark' : 'light');
  }

  setTheme(choice: ThemeChoice): void {
    this.theme.set(choice);
    write(THEME_KEY, choice);
  }

  setDensity(density: Density): void {
    this.density.set(density);
    write(DENSITY_KEY, density);
  }
}
