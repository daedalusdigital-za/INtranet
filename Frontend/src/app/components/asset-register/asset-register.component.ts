import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { AssetRegisterDialogComponent } from './asset-register-dialog.component';

@Component({
  selector: 'app-asset-register',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDialogModule, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
    <div class="asset-container">
      <div class="asset-header">
        <div class="header-left">
          <div class="header-icon-wrap">
            <mat-icon class="header-icon">inventory_2</mat-icon>
          </div>
          <div>
            <h1>Asset Register</h1>
            <p class="subtitle">{{ regionName ? regionName + ' › ' + locationName : locationName || 'All Locations' }}</p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-stroked-button (click)="changeLocation()">
            <mat-icon>swap_horiz</mat-icon>
            Change Location
          </button>
        </div>
      </div>

      <div class="empty-state">
        <mat-icon>inventory</mat-icon>
        <h3>No assets recorded yet</h3>
        <p>Assets for <strong>{{ locationName || 'this location' }}</strong> will appear here.</p>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); }
    .asset-container { max-width: 1400px; margin: 0 auto; padding: 24px 20px 48px; }

    .asset-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-icon-wrap { width: 56px; height: 56px; border-radius: 16px; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; }
    .header-icon { color: white; font-size: 30px; width: 30px; height: 30px; }
    .asset-header h1 { margin: 0; color: white; font-size: 26px; font-weight: 700; }
    .subtitle { margin: 2px 0 0; color: rgba(255,255,255,0.85); font-size: 14px; }
    .header-actions button { background: white; border-radius: 10px; }

    .empty-state { background: rgba(255,255,255,0.95); border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); padding: 60px 24px; text-align: center; color: #6b7280; }
    .empty-state mat-icon { font-size: 56px; width: 56px; height: 56px; color: #cbd5e1; margin-bottom: 12px; }
    .empty-state h3 { margin: 0 0 6px; color: #374151; font-size: 20px; }
    .empty-state p { margin: 0; font-size: 14px; }
  `]
})
export class AssetRegisterComponent implements OnInit {
  locationKey = '';
  locationName = '';
  regionName = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.locationKey = params['location'] || '';
      this.locationName = params['name'] || '';
      this.regionName = params['regionName'] || '';
    });
  }

  changeLocation(): void {
    this.dialog.open(AssetRegisterDialogComponent, {
      width: '580px',
      maxWidth: '95vw',
      maxHeight: '80vh',
      panelClass: 'centered-dialog'
    });
  }
}
