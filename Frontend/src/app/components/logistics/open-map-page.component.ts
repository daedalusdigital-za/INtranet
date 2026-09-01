import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { OpenMapComponent } from './open-map.component';

/**
 * Standalone full-page host for the live Open Map, reachable at
 * /logistics/open-map. Used by the "Open in new tab" action of the map dialog
 * so the map can live in its own browser tab as a separate page.
 */
@Component({
  selector: 'app-open-map-page',
  standalone: true,
  imports: [CommonModule, MatIconModule, NavbarComponent, OpenMapComponent],
  template: `
    <app-navbar></app-navbar>
    <div class="omp-container">
      <div class="omp-header">
        <mat-icon>map</mat-icon>
        <div>
          <h1>Open Map — Live Fleet</h1>
          <p>Real-time vehicle tracking, fuel stations, active loads & customer sites</p>
        </div>
      </div>
      <app-open-map></app-open-map>
    </div>
  `,
  styles: [`
    :host { display:block; min-height:100vh; background:#0b1220; }
    .omp-container { max-width:1600px; margin:0 auto; padding:20px 18px 60px; }
    .omp-header { display:flex; align-items:center; gap:14px; margin-bottom:18px; }
    .omp-header mat-icon { font-size:34px; width:34px; height:34px; color:#60a5fa; }
    .omp-header h1 { margin:0; color:#fff; font-size:22px; font-weight:700; }
    .omp-header p { margin:2px 0 0; color:rgba(255,255,255,0.6); font-size:13px; }
  `]
})
export class OpenMapPageComponent {}
