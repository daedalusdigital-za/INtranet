import { Injectable, computed, effect, signal } from '@angular/core';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type Density = 'comfortable' | 'compact';
export type TextSize = 'default' | 'large' | 'xlarge';
export type FontChoice = 'manrope' | 'inter' | 'atkinson' | 'source' | 'system';

const THEME_KEY = 'ui.theme';
const DENSITY_KEY = 'ui.density';
const TEXT_SIZE_KEY = 'ui.textSize';
const FONT_KEY = 'ui.font';

/** Google Fonts stylesheets for the fonts that aren't loaded up front. Keep in step with index.html. */
const FONT_SHEETS: Partial<Record<FontChoice, string>> = {
  inter: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  atkinson: 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap',
  source: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700;800&display=swap'
};

/** Adds a font's stylesheet once; Manrope and the system font need none. */
export function loadFontSheet(font: FontChoice): void {
  const href = FONT_SHEETS[font];
  if (!href || document.querySelector(`link[data-font-sheet="${font}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset['fontSheet'] = font;
  document.head.appendChild(link);
}

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
 * Light or dark, comfortable or compact rows (design review D-04), text size and font. The choice is kept on
 * this computer and applied as data-theme / data-density on <html>, which the design tokens
 * and the shared table read. "System" follows the computer's own light or dark setting.
 * The default is light; dark or system is opt-in from Appearance.
 * index.html applies the saved theme before the app starts, so pages don't flash white.
 */
@Injectable({ providedIn: 'root' })
export class AppearanceService {
  readonly theme = signal<ThemeChoice>(read(THEME_KEY, ['system', 'light', 'dark'], 'light'));
  readonly density = signal<Density>(read(DENSITY_KEY, ['comfortable', 'compact'], 'comfortable'));
  readonly textSize = signal<TextSize>(read(TEXT_SIZE_KEY, ['default', 'large', 'xlarge'], 'default'));
  readonly font = signal<FontChoice>(read(FONT_KEY, ['manrope', 'inter', 'atkinson', 'source', 'system'], 'manrope'));

  private readonly media = window.matchMedia?.('(prefers-color-scheme: dark)');
  private readonly systemDark = signal(!!this.media?.matches);

  /** The theme actually showing. */
  readonly dark = computed(() => this.immersive() > 0 || this.theme() === 'dark' || (this.theme() === 'system' && this.systemDark()));

  /**
   * Screens that are built for the dark (Cortex) can hold the whole intranet dark while they are on screen,
   * without touching the person's saved choice. Counted, so two holders don't fight. Release when you leave.
   */
  private readonly immersive = signal(0);
  holdDark(): () => void {
    this.immersive.update(n => n + 1);
    let released = false;
    return () => { if (!released) { released = true; this.immersive.update(n => Math.max(0, n - 1)); } };
  }

  constructor() {
    this.media?.addEventListener('change', e => this.systemDark.set(e.matches));
    effect(() => {
      const root = document.documentElement;
      root.dataset['theme'] = this.dark() ? 'dark' : 'light';
      root.dataset['density'] = this.density();
      root.dataset['textSize'] = this.textSize();
      root.dataset['font'] = this.font();
      loadFontSheet(this.font());
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

  setTextSize(size: TextSize): void {
    this.textSize.set(size);
    write(TEXT_SIZE_KEY, size);
  }

  setFont(font: FontChoice): void {
    this.font.set(font);
    write(FONT_KEY, font);
  }
}
