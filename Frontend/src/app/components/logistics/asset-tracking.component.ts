import { Component, ElementRef, OnDestroy, ViewChild, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import QRCode from 'qrcode';
import {
  AssetTrackingService, ResolveResult, ScanEvent, CreateTagRequest, AssetTag,
  ManifestResult, ManifestLine
} from '../../services/asset-tracking.service';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { StatusChipComponent } from '../../ui/status-chip/status-chip.component';

type ScanAction = 'Lookup' | 'CheckIn' | 'CheckOut' | 'LoadOnVehicle' | 'Offload' | 'Deliver' | 'Verify';

/**
 * Scan & Track — electronic asset & consignment tracking.
 *
 * Camera-based barcode/QR scanning (html5-qrcode) with a manual-entry fallback.
 * A scanned or typed code is resolved into everything related to it — the
 * tripsheet, the stock item + live inventory, the invoices and the fixed asset
 * record — and every scan is written to the immutable scan trail.
 * Also generates printable QR labels for stock, assets, invoices and tripsheets.
 */
@Component({
  selector: 'app-asset-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, SkeletonRowsComponent, EmptyStateComponent, StatusChipComponent],
  template: `
  <div class="scan-page">
    <!-- Header -->
    <header class="scan-header">
      <button mat-icon-button class="btn-back" aria-label="Back to logistics" (click)="goBack()"><mat-icon>arrow_back</mat-icon></button>
      <div class="scan-header__title">
        <mat-icon>qr_code_scanner</mat-icon>
        <div>
          <h1>Scan &amp; Track</h1>
          <p>Barcode / QR tracking for cargo, assets, stock, invoices &amp; tripsheets</p>
        </div>
      </div>
      <div class="scan-header__tabs">
        <button [class.on]="tab()==='scan'" (click)="tab.set('scan')"><mat-icon>qr_code_scanner</mat-icon> Scan</button>
        <button [class.on]="tab()==='load'" (click)="tab.set('load')"><mat-icon>checklist</mat-icon> Scan to Load</button>
        <button [class.on]="tab()==='generate'" (click)="tab.set('generate')"><mat-icon>qr_code_2</mat-icon> Generate labels</button>
        <button [class.on]="tab()==='history'" (click)="loadHistory()"><mat-icon>history</mat-icon> Scan history</button>
      </div>
    </header>

    <!-- ============ SCAN TAB ============ -->
    @if (tab() === 'scan') {
      <div class="scan-grid">
        <!-- Left: scanner + manual entry -->
        <section class="card scanner-card">
          <div class="card__head"><mat-icon>photo_camera</mat-icon> Scanner</div>

          <!-- action context -->
          <div class="field-row">
            <label>Scan action</label>
            <select [(ngModel)]="action">
              <option value="Lookup">Lookup only</option>
              <option value="CheckIn">Check in (receive)</option>
              <option value="CheckOut">Check out (issue)</option>
              <option value="LoadOnVehicle">Load on vehicle</option>
              <option value="Offload">Offload</option>
              <option value="Deliver">Deliver</option>
              <option value="Verify">Verify</option>
            </select>
          </div>

          <div id="qr-reader" class="qr-reader" [class.qr-reader--active]="scanning()"></div>

          <div class="scanner-actions">
            @if (!scanning()) {
              <button mat-flat-button color="primary" (click)="startCamera()">
                <mat-icon>videocam</mat-icon> Start camera
              </button>
            } @else {
              <button mat-stroked-button color="warn" (click)="stopCamera()">
                <mat-icon>videocam_off</mat-icon> Stop camera
              </button>
            }
          </div>

          @if (cameraError()) {
            <div class="hint hint--warn"><mat-icon>info</mat-icon> {{ cameraError() }}</div>
          }

          <!-- manual entry fallback -->
          <div class="manual">
            <div class="manual__head"><mat-icon>keyboard</mat-icon> Or enter the code manually</div>
            <div class="manual__row">
              <input #manualInput type="text" placeholder="Barcode / QR number"
                     [(ngModel)]="manualCode" (keyup.enter)="lookupManual()" />
              <button mat-flat-button color="primary" (click)="lookupManual()">
                <mat-icon>search</mat-icon> Look up
              </button>
            </div>
          </div>
        </section>

        <!-- Right: results -->
        <section class="card results-card">
          <div class="card__head">
            <mat-icon>travel_explore</mat-icon> Results
            @if (result()) {
              <span class="code-pill">{{ result()!.code }}</span>
            }
          </div>

          @if (loading()) {
            <app-skeleton-rows [rows]="5" [avatar]="false"></app-skeleton-rows>
          } @else if (!result()) {
            <app-empty-state icon="qr_code_scanner" title="Nothing scanned yet"
                             message="Scan a label or enter a code to see the tripsheet, stock, invoices and asset details linked to it."></app-empty-state>
          } @else {
            <div class="results">
              @if (!result()!.found) {
                <div class="unreg">
                  <div class="unreg__msg">
                    <mat-icon>help_outline</mat-icon>
                    <div>
                      <strong>Unregistered code</strong>
                      <p>{{ result()!.message || 'This code is not linked to anything yet.' }}</p>
                    </div>
                  </div>
                  <button mat-flat-button color="primary" (click)="openRegister(result()!.code)">
                    <mat-icon>add_link</mat-icon> Register this code
                  </button>
                </div>
              }

              <!-- Tag summary -->
              @if (result()!.tag; as t) {
                <div class="block">
                  <div class="block__title"><mat-icon>sell</mat-icon> Tag</div>
                  <div class="kv"><span>Type</span><b>{{ t.tagType }}</b></div>
                  @if (t.label) { <div class="kv"><span>Label</span><b>{{ t.label }}</b></div> }
                  @if (t.serialNumber) { <div class="kv"><span>Serial</span><b>{{ t.serialNumber }}</b></div> }
                  @if (t.currentLocation) { <div class="kv"><span>Location</span><b>{{ t.currentLocation }}</b></div> }
                  <div class="kv"><span>Status</span><b>{{ t.status }}</b></div>
                </div>
              }

              <!-- Tripsheets -->
              @if (result()!.tripSheets.length) {
                <div class="block">
                  <div class="block__title"><mat-icon>local_shipping</mat-icon> Tripsheets ({{ result()!.tripSheets.length }})</div>
                  @for (l of result()!.tripSheets; track l.id) {
                    <div class="row-item">
                      <div>
                        <b>{{ l.loadNumber }}</b> · {{ l.status }}
                        <div class="row-sub">
                          {{ l.customerName || 'No customer' }}
                          @if (l.driver) { · Driver: {{ l.driver }} }
                          @if (l.vehicle) { · {{ l.vehicle }} }
                        </div>
                      </div>
                      <app-status-chip [status]="l.status"></app-status-chip>
                    </div>
                  }
                </div>
              }

              <!-- Stock / inventory -->
              @if (result()!.inventory.length) {
                <div class="block">
                  <div class="block__title"><mat-icon>inventory_2</mat-icon> Live stock</div>
                  @for (b of result()!.inventory; track b.id) {
                    <div class="row-item">
                      <div>
                        <b>{{ b.itemCode }}</b> — {{ b.itemDescription || 'No description' }}
                        <div class="row-sub">Building #{{ b.buildingId }} · {{ b.uom }}</div>
                      </div>
                      <div class="qty">
                        <b>{{ b.quantityOnHand }}</b>
                        <span>on hand</span>
                      </div>
                    </div>
                  }
                </div>
              }

              <!-- Invoices -->
              @if (result()!.invoices.length) {
                <div class="block">
                  <div class="block__title"><mat-icon>receipt_long</mat-icon> Invoices ({{ result()!.invoices.length }})</div>
                  @for (i of result()!.invoices; track i.id) {
                    <div class="row-item">
                      <div>
                        <b>{{ i.transactionNumber }}</b> · {{ i.customerName }}
                        <div class="row-sub">
                          {{ i.productDescription }} · Qty {{ i.quantity }}
                          @if (i.deliveryCity) { · {{ i.deliveryCity }} }
                        </div>
                      </div>
                      <app-status-chip [status]="i.status"></app-status-chip>
                    </div>
                  }
                </div>
              }

              <!-- Asset -->
              @if (result()!.asset; as a) {
                <div class="block">
                  <div class="block__title"><mat-icon>chair</mat-icon> Fixed asset</div>
                  <div class="kv"><span>Code</span><b>{{ a.assetCode || '—' }}</b></div>
                  <div class="kv"><span>Category</span><b>{{ a.category }}</b></div>
                  @if (a.manufacturer || a.model) { <div class="kv"><span>Make/Model</span><b>{{ a.manufacturer }} {{ a.model }}</b></div> }
                  @if (a.serialNumber) { <div class="kv"><span>Serial</span><b>{{ a.serialNumber }}</b></div> }
                  @if (a.assignedTo) { <div class="kv"><span>Assigned to</span><b>{{ a.assignedTo }}</b></div> }
                  @if (a.condition) { <div class="kv"><span>Condition</span><b>{{ a.condition }}</b></div> }
                </div>
              }

              <!-- Commodity -->
              @if (result()!.commodity; as c) {
                <div class="block">
                  <div class="block__title"><mat-icon>category</mat-icon> Commodity</div>
                  <div class="kv"><span>Name</span><b>{{ c.name }}</b></div>
                  @if (c.code) { <div class="kv"><span>Code</span><b>{{ c.code }}</b></div> }
                  @if (c.category) { <div class="kv"><span>Category</span><b>{{ c.category }}</b></div> }
                </div>
              }

              <!-- Recent scans -->
              @if (result()!.recentScans.length) {
                <div class="block">
                  <div class="block__title"><mat-icon>history</mat-icon> Recent scans</div>
                  @for (s of result()!.recentScans; track s.id) {
                    <div class="scan-line">
                      <mat-icon>{{ actionIcon(s.action) }}</mat-icon>
                      <div>
                        <b>{{ s.action }}</b> — {{ s.scannedByName || 'Unknown' }}
                        <div class="row-sub">{{ s.scannedAt | date:'d MMM y, HH:mm' }}@if (s.location) { · {{ s.location }} }</div>
                      </div>
                    </div>
                  }
                </div>
              }

              @if (result()!.found && action !== 'Lookup') {
                <div class="hint hint--ok">
                  <mat-icon>check_circle</mat-icon>
                  Scan recorded as “{{ action }}”.
                </div>
              }
            </div>
          }
        </section>
      </div>
    }

    <!-- ============ SCAN TO LOAD TAB ============ -->
    @if (tab() === 'load') {
      <div class="scan-grid">
        <!-- Left: open a load + scanner -->
        <section class="card scanner-card">
          <div class="card__head"><mat-icon>local_shipping</mat-icon> Open a tripsheet</div>
          <div class="manual__row">
            <input type="text" placeholder="Load number or scan header QR"
                   [(ngModel)]="loadCodeInput" (keyup.enter)="openManifest()" />
            <button mat-flat-button color="primary" (click)="openManifest()" [disabled]="manifestLoading()">
              <mat-icon>search</mat-icon> Open
            </button>
          </div>
          @if (manifestError()) { <div class="hint hint--warn"><mat-icon>info</mat-icon> {{ manifestError() }}</div> }

          @if (manifest()) {
            <div class="card__head" style="margin-top:18px;"><mat-icon>photo_camera</mat-icon> Scan items onto vehicle</div>
            <div id="load-reader" class="qr-reader" [class.qr-reader--active]="scanning()"></div>
            <div class="scanner-actions">
              @if (!scanning()) {
                <button mat-flat-button color="primary" (click)="startLoadCamera()"><mat-icon>videocam</mat-icon> Start camera</button>
              } @else {
                <button mat-stroked-button color="warn" (click)="stopCamera()"><mat-icon>videocam_off</mat-icon> Stop camera</button>
              }
            </div>
            <div class="manual">
              <div class="manual__head"><mat-icon>keyboard</mat-icon> Or enter an item code manually</div>
              <div class="manual__row">
                <input type="text" placeholder="Item / invoice code" [(ngModel)]="loadItemInput" (keyup.enter)="markLoadedManual()" />
                <button mat-flat-button color="primary" (click)="markLoadedManual()"><mat-icon>add_task</mat-icon> Mark loaded</button>
              </div>
            </div>
            @if (loadFlash()) { <div class="hint" [class.hint--ok]="loadFlash()!.ok" [class.hint--warn]="!loadFlash()!.ok"><mat-icon>{{ loadFlash()!.ok ? 'check_circle' : 'error' }}</mat-icon> {{ loadFlash()!.msg }}</div> }
          }
        </section>

        <!-- Right: manifest checklist -->
        <section class="card results-card">
          @if (!manifest()) {
            <app-empty-state icon="checklist" title="No tripsheet open"
                             message="Open a tripsheet to see its expected items, then scan each one to confirm it's on the truck before departure."></app-empty-state>
          } @else {
            <div class="card__head">
              <mat-icon>checklist</mat-icon> {{ manifest()!.loadNumber }}
              <span class="code-pill">{{ manifest()!.loadedLines }} / {{ manifest()!.totalLines }} loaded</span>
            </div>
            <div class="progress"><div class="progress__bar" [style.width.%]="loadedPct()"></div></div>
            @if (manifest()!.customerName || manifest()!.driver) {
              <div class="row-sub" style="margin-bottom:10px;">
                @if (manifest()!.customerName) { {{ manifest()!.customerName }} }
                @if (manifest()!.driver) { · Driver: {{ manifest()!.driver }} }
                @if (manifest()!.vehicle) { · {{ manifest()!.vehicle }} }
              </div>
            }

            @if (allLoaded()) {
              <div class="depart"><mat-icon>verified</mat-icon>
                <div><strong>All items loaded — ready to depart.</strong><p>Every expected item has been scanned onto the vehicle.</p></div>
              </div>
            }

            <div class="checklist">
              @for (ln of manifest()!.lines; track ln.code) {
                <div class="check-row" [class.check-row--done]="ln.loaded">
                  <mat-icon class="check-ico">{{ ln.loaded ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                  <div class="check-main">
                    <b>{{ ln.customerName || ln.productDescription || ln.code }}</b>
                    <div class="row-sub">
                      <span class="mono">{{ ln.code }}</span>
                      @if (ln.productCode) { · {{ ln.productCode }} }
                      @if (ln.quantity) { · Qty {{ ln.quantity }} }
                      @if (ln.deliveryCity) { · {{ ln.deliveryCity }} }
                    </div>
                    @if (ln.loaded && ln.loadedAt) { <div class="row-sub">Loaded {{ ln.loadedAt | date:'HH:mm' }}@if (ln.loadedBy) { by {{ ln.loadedBy }} }</div> }
                  </div>
                  @if (!ln.loaded) {
                    <button mat-icon-button color="primary" aria-label="Mark loaded" (click)="markLoaded(ln.code)"><mat-icon>add_task</mat-icon></button>
                  } @else {
                    <app-status-chip status="Loaded" tone="ok"></app-status-chip>
                  }
                </div>
              }
            </div>
          }
        </section>
      </div>
    }

    <!-- ============ GENERATE TAB ============ -->
    @if (tab() === 'generate') {
      <div class="scan-grid">
        <section class="card">
          <div class="card__head"><mat-icon>qr_code_2</mat-icon> Generate a label</div>

          <div class="field-row"><label>Tag type</label>
            <select [(ngModel)]="genType">
              <option value="StockItem">Stock item</option>
              <option value="Asset">Fixed asset</option>
              <option value="Invoice">Invoice</option>
              <option value="Load">Tripsheet</option>
              <option value="Commodity">Commodity</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
          <div class="field-row"><label>Company</label>
            <select [(ngModel)]="genCompany">
              <option value="PMT">PMT</option><option value="ACM">ACM</option>
              <option value="PHT">PHT</option><option value="SBT">SBT</option>
            </select>
          </div>
          <div class="field-row"><label>Item code / reference</label>
            <input type="text" [(ngModel)]="genItemCode" placeholder="e.g. stock item code" />
          </div>
          <div class="field-row"><label>Label text</label>
            <input type="text" [(ngModel)]="genLabel" placeholder="Human-readable label" />
          </div>
          <div class="field-row"><label>Existing code (optional)</label>
            <input type="text" [(ngModel)]="genCode" placeholder="Leave blank to auto-generate" />
          </div>

          <button mat-flat-button color="primary" (click)="generate()" [disabled]="genBusy()">
            <mat-icon>bolt</mat-icon> Create tag &amp; QR
          </button>
          @if (genError()) { <div class="hint hint--warn"><mat-icon>info</mat-icon> {{ genError() }}</div> }
        </section>

        <section class="card label-preview">
          <div class="card__head"><mat-icon>preview</mat-icon> Label preview</div>
          @if (genQrDataUrl()) {
            <div class="label" #printLabel>
              <img [src]="genQrDataUrl()" alt="QR" />
              <div class="label__code">{{ genCreated()?.code }}</div>
              @if (genCreated()?.label) { <div class="label__text">{{ genCreated()?.label }}</div> }
              <div class="label__type">{{ genCreated()?.tagType }}</div>
            </div>
            <button mat-stroked-button (click)="printLabelNow()"><mat-icon>print</mat-icon> Print label</button>
          } @else {
            <app-empty-state icon="qr_code_2" title="No label yet" message="Create a tag to preview and print its QR label."></app-empty-state>
          }
        </section>
      </div>
    }

    <!-- ============ HISTORY TAB ============ -->
    @if (tab() === 'history') {
      <section class="card">
        <div class="card__head"><mat-icon>history</mat-icon> Scan history</div>
        @if (history().length === 0) {
          <app-empty-state icon="inbox" title="No scans recorded yet" message="Scans and lookups show up here once a code has been scanned."></app-empty-state>
        } @else {
          <table class="app-table">
            <thead><tr><th>When</th><th>Code</th><th>Action</th><th>Method</th><th>By</th><th>Location</th></tr></thead>
            <tbody>
              @for (s of history(); track s.id) {
                <tr>
                  <td>{{ s.scannedAt | date:'d MMM, HH:mm' }}</td>
                  <td class="ref">{{ s.scannedCode }}</td>
                  <td><span class="chip">{{ s.action }}</span></td>
                  <td>{{ s.scanMethod }}</td>
                  <td>{{ s.scannedByName }}</td>
                  <td>{{ s.location || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </section>
    }

    <!-- ============ REGISTER MODAL ============ -->
    @if (registerOpen()) {
      <div class="modal-backdrop" (click)="registerOpen.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal__head"><mat-icon>add_link</mat-icon> Register code
            <button mat-icon-button class="btn-x" aria-label="Close" (click)="registerOpen.set(false)"><mat-icon>close</mat-icon></button>
          </div>
          <div class="field-row"><label>Code</label><input type="text" [(ngModel)]="regCode" /></div>
          <div class="field-row"><label>Type</label>
            <select [(ngModel)]="regType">
              <option value="StockItem">Stock item</option><option value="Asset">Fixed asset</option>
              <option value="Invoice">Invoice</option><option value="Load">Tripsheet</option>
              <option value="Commodity">Commodity</option><option value="Custom">Custom</option>
            </select>
          </div>
          <div class="field-row"><label>Item code / reference</label><input type="text" [(ngModel)]="regItemCode" /></div>
          <div class="field-row"><label>Label</label><input type="text" [(ngModel)]="regLabel" /></div>
          <div class="field-row"><label>Serial no.</label><input type="text" [(ngModel)]="regSerial" /></div>
          <div class="modal__actions">
            <button mat-button (click)="registerOpen.set(false)">Cancel</button>
            <button mat-flat-button color="primary" (click)="submitRegister()" [disabled]="regBusy()">
              <mat-icon>save</mat-icon> Save tag
            </button>
          </div>
          @if (regError()) { <div class="hint hint--warn">{{ regError() }}</div> }
        </div>
      </div>
    }
  </div>
  `,
  styles: [`
    :host { display:block; --ink:var(--color-text); --muted:var(--color-text-3); --line:var(--color-line); --primary:var(--color-primary); --primary2:var(--color-primary); }
    .scan-page { padding:20px; max-width:1280px; margin:0 auto; }
    .scan-header { display:flex; align-items:center; gap:16px; flex-wrap:wrap; margin-bottom:18px; }
    .btn-back { border:1px solid var(--line); background:var(--color-surface); width:40px; height:40px; border-radius:12px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
    .scan-header__title { display:flex; align-items:center; gap:12px; flex:1 1 auto; }
    .scan-header__title > .material-icons { font-size:34px; color:var(--primary); background:#eef0ff; border-radius:14px; padding:8px; }
    .scan-header__title h1 { margin:0; font-size:1.3rem; color:var(--ink); }
    .scan-header__title p { margin:0; font-size:0.8rem; color:var(--muted); }
    .scan-header__tabs { display:flex; gap:6px; background:#eef0f6; padding:4px; border-radius:12px; }
    .scan-header__tabs button { border:none; background:none; padding:8px 14px; border-radius:9px; cursor:pointer; color:var(--muted); font-weight:600; font-size:0.82rem; display:inline-flex; align-items:center; gap:5px; }
    .scan-header__tabs button.on { background:var(--color-surface); color:var(--primary); box-shadow:0 1px 4px rgba(0,0,0,0.08); }
    .scan-header__tabs .material-icons { font-size:18px; }

    .scan-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
    @media (max-width:900px){ .scan-grid{ grid-template-columns:1fr; } }

    .card { background:var(--color-surface); border:1px solid var(--line); border-radius:16px; padding:16px; }
    .card__head { display:flex; align-items:center; gap:8px; font-weight:700; color:var(--ink); margin-bottom:14px; }
    .card__head .material-icons { color:var(--primary); }
    .code-pill { margin-left:auto; background:#eef0ff; color:var(--primary); font-size:0.72rem; font-weight:700; padding:3px 10px; border-radius:999px; font-family:monospace; }

    .field-row { display:flex; flex-direction:column; gap:5px; margin-bottom:12px; }
    .field-row label { font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--muted); font-weight:700; }
    .field-row input, .field-row select { padding:9px 12px; border:1px solid var(--color-line-strong); border-radius:10px; font-size:0.88rem; }
    .field-row input:focus, .field-row select:focus { outline:none; border-color:var(--primary); box-shadow:0 0 0 3px rgba(99,102,241,0.15); }

    .qr-reader { width:100%; min-height:60px; border-radius:12px; overflow:hidden; background:#0b1120; }
    .qr-reader--active { min-height:280px; }
    .scanner-actions { margin-top:12px; }

    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 14px; border:1px solid var(--line); border-radius:10px; background:var(--color-surface); color:var(--color-text-2); font-weight:600; font-size:0.84rem; cursor:pointer; }
    .btn .material-icons { font-size:18px; }
    .btn:hover { background:var(--color-canvas); }
    .btn--primary { background:linear-gradient(120deg,var(--primary2),var(--primary)); border-color:transparent; color:#fff; }
    .btn--danger { color:var(--color-danger); border-color:#fca5a5; }
    .btn[disabled] { opacity:0.5; cursor:not-allowed; }

    .manual { margin-top:16px; border-top:1px dashed var(--line); padding-top:14px; }
    .manual__head { display:flex; align-items:center; gap:6px; font-size:0.8rem; color:var(--muted); font-weight:600; margin-bottom:8px; }
    .manual__head .material-icons { font-size:18px; }
    .manual__row { display:flex; gap:8px; }
    .manual__row input { flex:1; padding:9px 12px; border:1px solid var(--color-line-strong); border-radius:10px; font-size:0.9rem; font-family:monospace; }

    .hint { display:flex; align-items:center; gap:6px; padding:8px 12px; border-radius:10px; font-size:0.82rem; margin-top:12px; }
    .hint .material-icons { font-size:18px; }
    .hint--warn { background:var(--color-warn-soft); color:#92400e; }
    .hint--ok { background:var(--color-ok-soft); color:#047857; }

    .empty { text-align:center; color:var(--color-text-3); padding:40px 20px; }
    .empty .material-icons { font-size:48px; }
    .empty p { margin:8px 0 0; font-size:0.86rem; }
    .spin { animation:spin 1s linear infinite; } @keyframes spin { to { transform:rotate(360deg);} }

    .results { display:flex; flex-direction:column; gap:14px; }
    .block { border:1px solid var(--line); border-radius:12px; padding:12px; }
    .block__title { display:flex; align-items:center; gap:6px; font-size:0.74rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--muted); font-weight:700; margin-bottom:8px; }
    .block__title .material-icons { font-size:16px; color:var(--primary); }
    .kv { display:flex; justify-content:space-between; font-size:0.84rem; padding:3px 0; }
    .kv span { color:var(--muted); }
    .row-item { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 0; border-top:1px dashed var(--line); }
    .row-item:first-of-type { border-top:none; }
    .row-sub { font-size:0.74rem; color:var(--muted); margin-top:2px; }
    .qty { text-align:right; } .qty b { font-size:1.05rem; color:var(--ink); } .qty span { display:block; font-size:0.68rem; color:var(--muted); }
    .chip { font-size:0.68rem; font-weight:700; padding:3px 9px; border-radius:999px; background:#eef0f6; color:var(--color-text-2); text-transform:capitalize; }
    .chip--delivered { background:var(--color-ok-soft); color:#047857; }
    .chip--intransit, .chip--assigned { background:var(--color-primary-soft); color:var(--color-primary-hover); }
    .chip--cancelled { background:var(--color-danger-soft); color:var(--color-danger); }
    .scan-line { display:flex; gap:8px; align-items:center; padding:6px 0; font-size:0.82rem; }
    .scan-line .material-icons { font-size:18px; color:var(--primary); }

    .unreg { background:var(--color-warn-soft); border:1px solid #fde68a; border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:10px; }
    .unreg__msg { display:flex; gap:8px; } .unreg__msg .material-icons { color:var(--color-warn); }
    .unreg__msg strong { color:#92400e; } .unreg__msg p { margin:2px 0 0; font-size:0.8rem; color:#78350f; }

    .label-preview .label { border:2px solid var(--ink); border-radius:10px; padding:16px; text-align:center; width:220px; margin:0 auto 12px; }
    .label img { width:160px; height:160px; }
    .label__code { font-family:monospace; font-weight:700; margin-top:8px; font-size:0.9rem; }
    .label__text { font-size:0.78rem; color:var(--muted); }
    .label__type { font-size:0.66rem; text-transform:uppercase; letter-spacing:1px; color:var(--primary); margin-top:4px; }

    .scan-table { width:100%; border-collapse:collapse; font-size:0.84rem; }
    .scan-table th { text-align:left; color:var(--muted); font-size:0.7rem; text-transform:uppercase; padding:8px; border-bottom:2px solid var(--line); }
    .scan-table td { padding:8px; border-bottom:1px solid var(--line); }
    .mono { font-family:monospace; }

    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,0.5); display:flex; align-items:center; justify-content:center; z-index:2000; }
    .modal { background:var(--color-surface); border-radius:16px; padding:20px; width:min(460px,92vw); }
    .modal__head { display:flex; align-items:center; gap:8px; font-weight:700; margin-bottom:14px; }
    .modal__head .material-icons { color:var(--primary); }
    .btn-x { margin-left:auto; border:none; background:none; cursor:pointer; color:var(--muted); }
    .modal__actions { display:flex; justify-content:flex-end; gap:8px; margin-top:8px; }

    .btn--sm { padding:6px 8px; }
    .progress { height:8px; background:#eef0f6; border-radius:999px; overflow:hidden; margin-bottom:12px; }
    .progress__bar { height:100%; background:linear-gradient(120deg,var(--primary2),var(--primary)); transition:width .3s ease; }
    .checklist { display:flex; flex-direction:column; }
    .check-row { display:flex; align-items:center; gap:10px; padding:10px 4px; border-top:1px solid var(--line); }
    .check-row:first-child { border-top:none; }
    .check-row--done { opacity:0.72; }
    .check-ico { color:var(--color-line-strong); }
    .check-row--done .check-ico { color:var(--color-ok); }
    .check-main { flex:1; min-width:0; }
    .depart { display:flex; gap:10px; background:var(--color-ok-soft); border:1px solid #a7f3d0; border-radius:12px; padding:12px; margin-bottom:12px; }
    .depart .material-icons { color:var(--color-ok); } .depart strong { color:#047857; } .depart p { margin:2px 0 0; font-size:0.8rem; color:#065f46; }
  `]
})
export class AssetTrackingComponent implements OnDestroy {
  private readonly svc = inject(AssetTrackingService);
  private readonly router = inject(Router);

  @ViewChild('printLabel') printLabelRef?: ElementRef<HTMLElement>;

  readonly tab = signal<'scan' | 'load' | 'generate' | 'history'>('scan');

  // Scanner
  readonly scanning = signal(false);
  readonly cameraError = signal<string | null>(null);
  private html5?: Html5Qrcode;
  action: ScanAction = 'Lookup';
  manualCode = '';

  // Results
  readonly loading = signal(false);
  readonly result = signal<ResolveResult | null>(null);

  // Generate
  genType = 'StockItem';
  genCompany = 'PMT';
  genItemCode = '';
  genLabel = '';
  genCode = '';
  readonly genBusy = signal(false);
  readonly genError = signal<string | null>(null);
  readonly genQrDataUrl = signal<string | null>(null);
  readonly genCreated = signal<AssetTag | null>(null);

  // History
  readonly history = signal<ScanEvent[]>([]);

  // Scan to Load
  loadCodeInput = '';
  loadItemInput = '';
  readonly manifest = signal<ManifestResult | null>(null);
  readonly manifestLoading = signal(false);
  readonly manifestError = signal<string | null>(null);
  readonly loadFlash = signal<{ ok: boolean; msg: string } | null>(null);
  readonly loadedPct = computed(() => {
    const m = this.manifest();
    return m && m.totalLines ? Math.round((m.loadedLines / m.totalLines) * 100) : 0;
  });
  readonly allLoaded = computed(() => {
    const m = this.manifest();
    return !!m && m.totalLines > 0 && m.loadedLines >= m.totalLines;
  });

  // Register modal
  readonly registerOpen = signal(false);
  readonly regBusy = signal(false);
  readonly regError = signal<string | null>(null);
  regCode = ''; regType = 'Custom'; regItemCode = ''; regLabel = ''; regSerial = '';

  goBack(): void { this.router.navigate(['/logistics']); }

  // ── Camera ──────────────────────────────────────────────
  async startCamera(): Promise<void> {
    this.cameraError.set(null);
    try {
      this.html5 = new Html5Qrcode('qr-reader', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.ITF
        ],
        verbose: false
      });
      this.scanning.set(true);
      await this.html5.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => this.onScanned(decoded),
        () => { /* per-frame decode failure — ignore */ }
      );
    } catch (e: any) {
      this.scanning.set(false);
      this.cameraError.set('Camera unavailable or permission denied. Use manual entry below.');
    }
  }

  async stopCamera(): Promise<void> {
    try {
      if (this.html5 && this.scanning()) { await this.html5.stop(); await this.html5.clear(); }
    } catch { /* ignore */ }
    this.scanning.set(false);
  }

  private lastCode = '';
  private lastAt = 0;
  private onScanned(code: string): void {
    const now = Date.now();
    // Debounce repeat frames of the same code.
    if (code === this.lastCode && now - this.lastAt < 2500) return;
    this.lastCode = code; this.lastAt = now;
    this.resolve(code, 'Camera');
  }

  lookupManual(): void {
    const c = this.manualCode.trim();
    if (!c) return;
    this.resolve(c, 'Manual');
  }

  // ── Resolve + record ────────────────────────────────────
  private resolve(code: string, method: 'Camera' | 'Manual'): void {
    this.loading.set(true);
    this.result.set(null);
    this.svc.resolve(code).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
        // Record the scan with the chosen action (Lookup is just tracked as a view).
        this.svc.recordScan({ code, action: this.action, scanMethod: method }).subscribe({ error: () => {} });
      },
      error: () => {
        this.loading.set(false);
        this.result.set({ code, found: false, inventory: [], invoices: [], tripSheets: [], pods: [], recentScans: [], message: 'Lookup failed. Check your connection.' } as ResolveResult);
      }
    });
  }

  actionIcon(a: string): string {
    return ({
      Lookup: 'search', CheckIn: 'login', CheckOut: 'logout',
      LoadOnVehicle: 'local_shipping', Offload: 'unarchive',
      Deliver: 'task_alt', Verify: 'fact_check', Register: 'add_link'
    } as Record<string, string>)[a] || 'circle';
  }

  // ── Register ────────────────────────────────────────────
  openRegister(code: string): void {
    this.regCode = code; this.regType = 'Custom'; this.regItemCode = '';
    this.regLabel = ''; this.regSerial = ''; this.regError.set(null);
    this.registerOpen.set(true);
  }

  submitRegister(): void {
    if (!this.regCode.trim()) { this.regError.set('Code is required.'); return; }
    this.regBusy.set(true);
    const req: CreateTagRequest = {
      code: this.regCode.trim(), tagType: this.regType,
      itemCode: this.regItemCode.trim() || undefined,
      label: this.regLabel.trim() || undefined,
      serialNumber: this.regSerial.trim() || undefined
    };
    this.svc.createTag(req).subscribe({
      next: () => { this.regBusy.set(false); this.registerOpen.set(false); this.resolve(this.regCode.trim(), 'Manual'); },
      error: (e) => { this.regBusy.set(false); this.regError.set(e?.error?.error || 'Could not save tag.'); }
    });
  }

  // ── Generate label ──────────────────────────────────────
  async generate(): Promise<void> {
    this.genError.set(null);
    this.genBusy.set(true);
    const req: CreateTagRequest = {
      code: this.genCode.trim() || undefined,
      tagType: this.genType,
      sourceCompany: this.genCompany,
      itemCode: this.genItemCode.trim() || undefined,
      label: this.genLabel.trim() || undefined
    };
    this.svc.createTag(req).subscribe({
      next: async (tag) => {
        this.genCreated.set(tag);
        try {
          const url = await QRCode.toDataURL(tag.code, { width: 320, margin: 1 });
          this.genQrDataUrl.set(url);
        } catch { this.genError.set('Tag created but QR render failed.'); }
        this.genBusy.set(false);
      },
      error: (e) => { this.genBusy.set(false); this.genError.set(e?.error?.error || 'Could not create tag.'); }
    });
  }

  printLabelNow(): void {
    const el = this.printLabelRef?.nativeElement;
    if (!el) return;
    const w = window.open('', '_blank', 'width=400,height=520');
    if (!w) return;
    w.document.write(`<html><head><title>Label ${this.genCreated()?.code}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:20px}
      .label{border:2px solid #000;border-radius:10px;padding:16px;display:inline-block}
      img{width:200px;height:200px}.c{font-family:monospace;font-weight:700;margin-top:8px}
      .t{font-size:12px;color:var(--color-text-2)}</style></head><body>
      <div class="label"><img src="${this.genQrDataUrl()}" alt="QR code"/>
      <div class="c">${this.genCreated()?.code}</div>
      <div class="t">${this.genCreated()?.label || ''}</div></div>
      <script>window.onload=()=>{window.print();window.close();}</script>
      </body></html>`);
    w.document.close();
  }

  // ── History ─────────────────────────────────────────────
  loadHistory(): void {
    this.tab.set('history');
    this.svc.getScans({ pageSize: 100 }).subscribe({
      next: (r) => this.history.set(r.items),
      error: () => this.history.set([])
    });
  }

  // ── Scan to Load ──────────────────────────────────
  openManifest(): void {
    const code = this.loadCodeInput.trim();
    if (!code) return;
    this.manifestError.set(null);
    this.manifestLoading.set(true);
    this.loadFlash.set(null);
    this.svc.getManifestByCode(code).subscribe({
      next: (m) => { this.manifest.set(m); this.manifestLoading.set(false); },
      error: (e) => { this.manifestLoading.set(false); this.manifestError.set(e?.error?.error || 'No tripsheet found for that code.'); this.manifest.set(null); }
    });
  }

  private refreshManifest(): void {
    const m = this.manifest();
    if (!m) return;
    this.svc.getManifest(m.loadId).subscribe({ next: (r) => this.manifest.set(r), error: () => {} });
  }

  async startLoadCamera(): Promise<void> {
    this.cameraError.set(null);
    try {
      this.html5 = new Html5Qrcode('load-reader', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.ITF
        ],
        verbose: false
      });
      this.scanning.set(true);
      await this.html5.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => this.onLoadScanned(decoded),
        () => { /* ignore per-frame failures */ }
      );
    } catch {
      this.scanning.set(false);
      this.cameraError.set('Camera unavailable. Use manual entry.');
    }
  }

  private onLoadScanned(code: string): void {
    const now = Date.now();
    if (code === this.lastCode && now - this.lastAt < 2500) return;
    this.lastCode = code; this.lastAt = now;
    this.markLoaded(code, 'Camera');
  }

  markLoadedManual(): void {
    const c = this.loadItemInput.trim();
    if (!c) return;
    this.markLoaded(c, 'Manual');
    this.loadItemInput = '';
  }

  markLoaded(code: string, method: 'Camera' | 'Manual' = 'Manual'): void {
    const m = this.manifest();
    if (!m) return;
    const match = m.lines.find(l => l.code.toLowerCase() === code.trim().toLowerCase());
    if (!match) {
      this.loadFlash.set({ ok: false, msg: `“${code}” is not on this tripsheet.` });
      return;
    }
    if (match.loaded) {
      this.loadFlash.set({ ok: true, msg: `${match.code} is already loaded.` });
      return;
    }
    this.svc.recordScan({ code: match.code, action: 'LoadOnVehicle', scanMethod: method, loadId: m.loadId }).subscribe({
      next: () => {
        this.loadFlash.set({ ok: true, msg: `Loaded ${match.customerName || match.code}.` });
        this.refreshManifest();
      },
      error: () => this.loadFlash.set({ ok: false, msg: 'Could not record scan. Try again.' })
    });
  }

  ngOnDestroy(): void { this.stopCamera(); }
}
