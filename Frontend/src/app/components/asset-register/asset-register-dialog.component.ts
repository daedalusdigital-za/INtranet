import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

interface AssetRegion {
  key: string;
  name: string;
  icon: string;
  gradient: string;
  shadow: string;
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
                 [style.background]="r.gradient"
                 [style.box-shadow]="r.shadow"
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
            <button mat-icon-button class="back-btn" (click)="step = 'regions'">
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
    .header-main-icon { font-size: 34px; width: 34px; height: 34px; color: #2563eb; }
    .header-main-icon.sm { font-size: 22px; width: 22px; height: 22px; color: #2563eb; }
    .dialog-header h2 { margin: 4px 0 2px; font-size: 19px; font-weight: 700; color: #111827; }
    .dialog-header p { margin: 0; color: #6b7280; font-size: 12px; }

    .sub-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-shrink: 0; }
    .back-btn { flex-shrink: 0; color: #6b7280; }
    .sub-title-wrap { display: flex; align-items: center; gap: 8px; }
    .sub-title-wrap h2 { margin: 0 0 1px; font-size: 17px; font-weight: 700; color: #111827; }
    .sub-title-wrap p { margin: 0; font-size: 11px; color: #6b7280; }

    /* ── Region blocks (level 1) ── */
    .region-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
    .region-block {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 6px; padding: 14px 8px 12px; border-radius: 14px;
      cursor: pointer; transition: transform 0.18s, filter 0.18s;
      color: white; min-height: 84px;
    }
    .region-block:hover { transform: translateY(-2px) scale(1.02); filter: brightness(1.08); }
    .rb-icon { font-size: 24px; width: 24px; height: 24px; opacity: 0.95; }
    .rb-name { font-size: 11.5px; font-weight: 700; text-align: center; line-height: 1.3; }
    .rb-chevron { font-size: 14px; width: 14px; height: 14px; opacity: 0.7; }

    /* ── Sub-location cards (level 2) ── */
    .sub-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .sub-card {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 6px; padding: 12px 6px 10px; border: 1.5px solid #e5e7eb;
      border-radius: 11px; cursor: pointer; transition: all 0.18s;
      background: #f9fafb; text-align: center;
    }
    .sub-card:hover { border-color: #2563eb; background: #eff6ff; transform: translateY(-2px); box-shadow: 0 3px 10px rgba(37,99,235,0.14); }
    .sub-icon-wrap { width: 36px; height: 36px; border-radius: 9px; background: linear-gradient(135deg, #dbeafe, #bfdbfe); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .sub-icon-wrap mat-icon { color: #1d4ed8; font-size: 19px; width: 19px; height: 19px; }
    .sub-name { font-size: 11px; font-weight: 600; color: #374151; line-height: 1.3; }

    /* ── Footer — always visible at bottom ── */
    .dialog-footer {
      flex-shrink: 0;
      display: flex; justify-content: flex-end;
      padding: 10px 20px 14px;
      border-top: 1px solid #f3f4f6;
      background: white;
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
      gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
      shadow: '0 6px 20px rgba(79,70,229,0.4)', hasChildren: true
    },
    {
      key: 'cape-town', name: 'Cape Town', icon: 'water',
      gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
      shadow: '0 6px 20px rgba(2,132,199,0.4)'
    },
    {
      key: 'gauteng', name: 'Gauteng', icon: 'apartment',
      gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
      shadow: '0 6px 20px rgba(217,119,6,0.4)'
    },
    {
      key: 'eastern-cape', name: 'Eastern Cape', icon: 'terrain',
      gradient: 'linear-gradient(135deg, #10b981, #059669)',
      shadow: '0 6px 20px rgba(5,150,105,0.4)'
    },
    {
      key: 'properties', name: 'Properties', icon: 'home_work',
      gradient: 'linear-gradient(135deg, #ec4899, #db2777)',
      shadow: '0 6px 20px rgba(219,39,119,0.4)'
    },
    {
      key: 'contracts', name: 'Contracts', icon: 'description',
      gradient: 'linear-gradient(135deg, #64748b, #475569)',
      shadow: '0 6px 20px rgba(71,85,105,0.4)'
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
