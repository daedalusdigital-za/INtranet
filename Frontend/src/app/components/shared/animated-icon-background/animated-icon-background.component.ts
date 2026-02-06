/**
 * AnimatedIconBackgroundComponent
 * 
 * ════════════════════════════════════════════════════════════════════════════════
 * WHY THIS COMPONENT DOES NOT LEAK MEMORY:
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * 1. STATIC DOM: All icon elements are rendered once via @for over a static
 *    readonly array. No icons are added or removed during the component lifecycle.
 *    The DOM structure is completely static after initial render.
 * 
 * 2. NO JAVASCRIPT TIMERS: There are NO setInterval, setTimeout, or 
 *    requestAnimationFrame calls in this component. Zero timer-based logic.
 * 
 * 3. CSS-ONLY ANIMATIONS: All motion is handled purely by CSS @keyframes 
 *    animations using infinite scrolling marquee effect. The browser's 
 *    compositor thread handles these animations efficiently.
 * 
 * 4. GPU-FRIENDLY TRANSFORMS: Animations use only 'transform: translateX()'
 *    which is composited on the GPU and doesn't trigger layout/paint.
 * 
 * 5. NO EVENT LISTENERS: The component has pointer-events: none and creates
 *    no event subscriptions that could leak.
 * 
 * 6. NO SUBSCRIPTIONS: No RxJS observables or subscriptions are used.
 * 
 * PERFORMANCE NOTES:
 * - Uses row-based scrolling (marquee effect) for smooth continuous motion
 * - 3 parallax layers with different speeds and opacity
 * - Each row has duplicate icon sets for seamless looping
 * - prefers-reduced-motion is respected to pause animations
 * - All animations are paused when visibility input is false
 * 
 * ════════════════════════════════════════════════════════════════════════════════
 */

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Medical icon names from Material Symbols Outlined - reduced set */
const MEDICAL_ICONS: readonly string[] = [
  'pill',
  'vaccines', 
  'stethoscope',
  'medical_services',
  'monitor_heart',
  'local_hospital',
  'health_and_safety',
  'healing',
  'favorite',
  'science'
] as const;

/** Row configuration for each parallax layer */
interface IconRow {
  readonly icons: readonly string[];
  readonly layer: 1 | 2 | 3;
  readonly direction: 'left' | 'right';
}

@Component({
  selector: 'app-animated-icon-background',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './animated-icon-background.component.html',
  styleUrl: './animated-icon-background.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnimatedIconBackgroundComponent {
  /**
   * Toggle visibility of the animated background.
   * When false, animations are paused and layer is hidden.
   */
  @Input() visible: boolean = true;

  /**
   * Theme affects opacity of icons.
   * 'light' = lower opacity for light backgrounds
   * 'dark' = slightly higher opacity for dark backgrounds
   */
  @Input() theme: 'light' | 'dark' = 'light';

  /** Static array of icon rows - created once, never modified */
  readonly iconRows: readonly IconRow[] = this.generateRows();

  /** The medical icons to display */
  readonly icons = MEDICAL_ICONS;

  /**
   * Generates rows for parallax effect with alternating directions.
   * Called once during class initialization.
   * Total icons: 6 rows × 10 icons × 2 sets = 120 DOM elements (60 visible icons)
   */
  private generateRows(): IconRow[] {
    const rows: IconRow[] = [];
    
    // Generate 6 rows total (2 per layer) - keeps icon count low ~60
    // Layer 1 (back): slowest, largest, most transparent
    // Layer 2 (middle): medium speed
    // Layer 3 (front): fastest, smallest, most visible
    
    for (let i = 0; i < 2; i++) {
      rows.push({
        icons: MEDICAL_ICONS,
        layer: 1,
        direction: i % 2 === 0 ? 'left' : 'right'
      });
    }
    
    for (let i = 0; i < 2; i++) {
      rows.push({
        icons: MEDICAL_ICONS,
        layer: 2,
        direction: i % 2 === 0 ? 'right' : 'left'
      });
    }
    
    for (let i = 0; i < 2; i++) {
      rows.push({
        icons: MEDICAL_ICONS,
        layer: 3,
        direction: i % 2 === 0 ? 'left' : 'right'
      });
    }
    
    return rows;
  }

  /**
   * TrackBy function for rows
   */
  trackByRow(index: number): number {
    return index;
  }

  /**
   * TrackBy function for icons
   */
  trackByIcon(index: number, icon: string): string {
    return `${index}-${icon}`;
  }

  /**
   * Get CSS classes for a row based on its layer and direction.
   */
  getRowClasses(row: IconRow): string {
    return `icon-row layer-${row.layer} scroll-${row.direction}`;
  }
}
