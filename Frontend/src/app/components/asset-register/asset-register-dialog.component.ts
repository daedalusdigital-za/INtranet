import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

interface AssetRegion {
  key: string;
  name: string;
  icon: string;
  tone: string;
  hasChildren?: boolean;
}

interface AssetSub {
  key: string;
  name: string;
  icon: string;
}

@Component({
  selector: 'asset-register-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDialogModule],
  template: `
    <div class="asset-dialog">

      <!-- ── LEVEL 1: Regions ── -->
      <ng-container *ngIf="step === 'regions'">
        <div class="step-content">
          <div class="dialog-header">
            <mat-icon class="header-main-icon">inventory_2</mat-icon>
            <h2>Asset Register</h2>
            <p>Choose a region to get started</p>
          </div>

          <div class="region-grid">
            <div class="region-block" *ngFor="let r of regions"
                 [ngClass]="'tone-' + r.tone"
                 (click)="selectRegion(r)">
              <mat-icon class="rb-icon">{{ r.icon }}</mat-icon>
              <span class="rb-name">{{ r.name }}</span>
              <mat-icon class="rb-chevron" *ngIf="r.hasChildren">expand_more</mat-icon>
              <mat-icon class="rb-chevron" *ngIf="!r.hasChildren">arrow_forward</mat-icon>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button mat-button (click)="dialogRef.close()">Close</button>
        </div>
      </ng-container>

      <!-- ── LEVEL 2: KwaZulu-Natal sub-locations ── -->
      <ng-container *ngIf="step === 'kzn'">
        <div class="step-content">
          <div class="sub-header dialog-header">
            <button aria-label="Back" mat-icon-button class="back-btn" (click)="step = 'regions'">
              <mat-icon>arrow_back</mat-icon>
            </button>
            <div class="sub-title-wrap">
              <mat-icon class="header-main-icon sm">location_on</mat-icon>
              <div>
                <h2>KwaZulu-Natal</h2>
                <p>Select a specific site</p>
              </div>
            </div>
          </div>

          <div class="sub-grid">
            <div class="sub-card" *ngFor="let s of kznSubs" (click)="selectSub(s)">
              <div class="sub-icon-wrap">
                <mat-icon>{{ s.icon }}</mat-icon>
              </div>
              <span class="sub-name">{{ s.name }}</span>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button mat-button (click)="dialogRef.close()">Close</button>
        </div>
      </ng-container>

    </div>
  `,
  styles: [`
    /* Make the host fill the mat-dialog-container and behave as flex column */
    :host { display: flex; flex-direction: column; max-height: 80vh; overflow: hidden; }

    /* Dialog shell */
    .asset-dialog { display: flex; flex-direction: column; flex: 1 1 auto; overflow: hidden; }

    /* ng-container siblings — each fills the dialog */
    .asset-dialog > * { display: flex; flex-direction: column; flex: 1 1 auto; overflow: hidden; }

    /* Scrollable body */
    .step-content {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 20px 20px 12px;
      display: flex; flex-direction: column; gap: 0;
    }

    /* ── Header ── */
    .dialog-header { text-align: center; margin-bottom: 16px; flex-shrink: 0; }
    .header-main-icon { font-size: var(--text-4xl); width: 32px; height: 32px; color: var(--color-primary); }
    .header-main-icon.sm { font-size: var(--text-2xl); width: 20px; height: 20px; color: var(--color-primary); }
    .dialog-header h2 { margin: 4px 0 2px; font-size: var(--text-xl); font-weight: 700; color: var(--color-text); }
    .dialog-header p { margin: 0; color: var(--color-text-3); font-size: var(--text-xs); }

    .sub-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-shrink: 0; }
    .back-btn { flex-shrink: 0; color: var(--color-text-3); }
    .sub-title-wrap { display: flex; align-items: center; gap: 8px; }
    .sub-title-wrap h2 { margin: 0 0 1px; font-size: var(--text-lg); font-weight: 700; color: var(--color-text); }
    .sub-title-wrap p { margin: 0; font-size: var(--text-xs); color: var(--color-text-3); }

    /* ── Region blocks (level 1) ── */
    .region-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
    .region-block {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 6px; padding: 14px 8px 12px; border-radius: 14px;
      cursor: pointer; transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
      border: 1px solid var(--color-line); min-height: 84px;
      background: var(--color-surface-2); color: var(--color-text-2);
    }
    .region-block:hover { transform: translateY(-2px); border-color: currentColor; box-shadow: var(--shadow-sm); }
    .tone-primary { background: var(--color-primary-soft); color: var(--color-primary); }
    .tone-teal { background: var(--color-cat-teal-soft); color: var(--color-cat-teal); }
    .tone-amber { background: var(--color-cat-amber-soft); color: var(--color-cat-amber); }
    .tone-purple { background: var(--color-cat-purple-soft); color: var(--color-cat-purple); }
    .tone-pink { background: var(--color-cat-pink-soft); color: var(--color-cat-pink); }
    .tone-neutral { background: var(--color-surface-2); color: var(--color-text-2); }
    .rb-icon { font-size: var(--text-3xl); width: 24px; height: 24px; opacity: 0.95; }
    .rb-name { font-size: var(--text-xs); font-weight: 700; text-align: center; line-height: 1.3; color: var(--color-text); }
    .rb-chevron { font-size: var(--text-md); width: 14px; height: 14px; opacity: 0.7; }

    /* ── Sub-location cards (level 2) ── */
    .sub-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .sub-card {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 6px; padding: 12px 6px 10px; border: 1.5px solid var(--color-line);
      border-radius: 11px; cursor: pointer; transition: all 0.18s;
      background: var(--color-canvas); text-align: center;
    }
    .sub-card:hover { border-color: var(--color-primary); background: var(--color-primary-soft); transform: translateY(-2px); box-shadow: var(--shadow-sm); }
    .sub-icon-wrap { width: 36px; height: 36px; border-radius: 9px; background: var(--color-primary-soft); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .sub-icon-wrap mat-icon { color: var(--color-primary); font-size: var(--text-xl); width: 18px; height: 18px; }
    .sub-name { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-2); line-height: 1.3; }

    /* ── Footer — always visible at bottom ── */
    .dialog-footer {
      flex-shrink: 0;
      display: flex; justify-content: flex-end;
      padding: 10px 20px 14px;
      border-top: 1px solid var(--color-surface-2);
      background: var(--color-surface);
    }

    @media (max-width: 480px) {
      .region-grid, .sub-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `]
})
export class AssetRegisterDialogComponent {
  step: 'regions' | 'kzn' = 'regions';

  regions: AssetRegion[] = [
    {
      key: 'kwazulu-natal', name: 'KwaZulu-Natal', icon: 'location_on',
      tone: 'primary', hasChildren: true
    },
    {
      key: 'cape-town', name: 'Cape Town', icon: 'water',
      tone: 'teal'
    },
    {
      key: 'gauteng', name: 'Gauteng', icon: 'apartment',
      tone: 'amber'
    },
    {
      key: 'eastern-cape', name: 'Eastern Cape', icon: 'terrain',
      tone: 'purple'
    },
    {
      key: 'properties', name: 'Properties', icon: 'home_work',
      tone: 'pink'
    },
    {
      key: 'contracts', name: 'Contracts', icon: 'description',
      tone: 'neutral'
    }
  ];

  kznSubs: AssetSub[] = [
    { key: 'main-office',              name: 'Main Office',            icon: 'business'       },
    { key: 'pharmacare',               name: 'Pharmacare',             icon: 'local_pharmacy' },
    { key: 'condom-factory',           name: 'Condom Factory',         icon: 'factory'        },
    { key: 'logistics-building',       name: 'Logistics Building',     icon: 'local_shipping' },
    { key: 'warehouse-1',              name: 'Warehouse 1',            icon: 'warehouse'      },
    { key: 'warehouse-2',              name: 'Warehouse 2',            icon: 'warehouse'      },
    { key: 'new-road',                 name: 'New Road',               icon: 'add_road'       },
    { key: 'albatross-guest-house',    name: 'Albatross Guest House',  icon: 'hotel'          },
    { key: 'church',                   name: 'Church',                 icon: 'church'         }
  ];

  constructor(public dialogRef: MatDialogRef<AssetRegisterDialogComponent>) {}

  // Maps dialog keys → DB region names
  private regionDbName: Record<string, string> = {
    'kwazulu-natal': 'KZN',
    'cape-town': 'Cape Town',
    'gauteng': 'Gauteng',
    'eastern-cape': 'Eastern Cape',
    'properties': 'Properties',
    'contracts': 'Contracts'
  };

  // Maps KZN sub keys → DB subLocation values
  private subDbName: Record<string, string> = {
    'main-office':           'Main Building',
    'pharmacare':            'Pharmacare',
    'condom-factory':        'Condom Factory',
    'logistics-building':    'Main Building',
    'warehouse-1':           'Warehouse 1',
    'warehouse-2':           'Warehouse 2',
    'new-road':              'New Road',
    'albatross-guest-house': 'Albatross Guest House',
    'church':                'Church'
  };

  selectRegion(r: AssetRegion): void {
    if (r.hasChildren) {
      this.step = 'kzn';
      return;
    }
    const dbRegion = this.regionDbName[r.key] || r.name;
    this.dialogRef.close({ regionName: dbRegion, name: r.name });
  }

  selectSub(s: AssetSub): void {
    const dbSub = this.subDbName[s.key] || s.name;
    this.dialogRef.close({ regionName: 'KZN', name: dbSub });
  }
}
