import { Component, ElementRef, Inject, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../../environments/environment';
import { SecureSrcDirective } from '../../../directives/secure-src.directive';
import { ToastService } from '../../../ui/toast.service';

export interface SignatureDialogData {
  /** Whose signature. Omit / pass the signed-in user's id for "my signature". */
  userId: number;
  name: string;
  hasSignature: boolean;
  /** true when an admin is doing it on someone's behalf (changes the wording). */
  onBehalf?: boolean;
}

/**
 * View, draw, upload or remove a saved hand signature. Used from the navbar profile menu
 * ("My signature"), the Profile page, and Admin settings › Users (for any user).
 * Returns `{ hasSignature: boolean }` on close when something changed.
 */
@Component({
  selector: 'app-signature-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule, SecureSrcDirective],
  template: `
    <h2 mat-dialog-title><mat-icon>draw</mat-icon> {{ data.onBehalf ? data.name + "'s signature" : 'My signature' }}</h2>
    <mat-dialog-content>
      <p class="muted">This hand signature is stamped on payment packs, approval sheets and other documents {{ data.onBehalf ? data.name + ' signs' : 'you sign' }} on the intranet. Draw it with a mouse, finger or stylus — or upload a photo/scan of a real signature.</p>

      @if (has() && !drawing()) {
        <div class="current">
          <img [appSecureSrc]="url()" alt="Saved signature">
          <small>Saved signature</small>
        </div>
      }

      @if (drawing()) {
        <div class="pad-wrap">
          <canvas #pad width="640" height="200" class="pad"
                  (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up()" (pointerleave)="up()"></canvas>
          <div class="pad-tools">
            <small>Sign inside the box</small>
            <button mat-button type="button" (click)="clear()" [disabled]="!drew()"><mat-icon>backspace</mat-icon> Clear</button>
          </div>
        </div>
      }

      <div class="choices">
        @if (!drawing()) {
          <button mat-stroked-button type="button" (click)="startDrawing()"><mat-icon>gesture</mat-icon> {{ has() ? 'Draw a new one' : 'Draw signature' }}</button>
        }
        <button mat-stroked-button type="button" (click)="file.click()" [disabled]="busy()"><mat-icon>upload</mat-icon> {{ has() ? 'Upload a different image' : 'Upload image' }}</button>
        <input #file type="file" accept="image/png,image/jpeg,image/webp" hidden (change)="upload($event)">
        @if (has()) { <button mat-button type="button" class="danger" (click)="remove()" [disabled]="busy()"><mat-icon>delete</mat-icon> Remove</button> }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="close()">{{ drawing() ? 'Cancel' : 'Close' }}</button>
      @if (drawing()) {
        <button mat-flat-button color="primary" type="button" [disabled]="!drew() || busy()" (click)="saveDrawing()"><mat-icon>save</mat-icon> {{ busy() ? 'Saving…' : 'Save signature' }}</button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    h2 { display: flex; align-items: center; gap: 8px; }
    .muted { color: var(--color-ink-muted, #64748b); margin: 0 0 14px; font-size: 13px; }
    .current { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px; border: 1px solid var(--color-line, #e2e8f0); border-radius: 8px; background: #fff; margin-bottom: 14px; }
    .current img { max-width: 100%; max-height: 140px; object-fit: contain; }
    .current small { color: var(--color-ink-muted, #64748b); }
    .pad-wrap { margin-bottom: 14px; }
    .pad { display: block; width: 100%; height: auto; border: 1px dashed var(--color-line-strong, #94a3b8); border-radius: 8px; background: #fff; touch-action: none; cursor: crosshair; }
    .pad-tools { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; color: var(--color-ink-muted, #64748b); }
    .choices { display: flex; flex-wrap: wrap; gap: 8px; }
    .danger { color: var(--color-danger, #b91c1c); margin-left: auto; }
    mat-dialog-content { min-width: min(560px, 90vw); }
  `]
})
export class SignatureDialogComponent {
  @ViewChild('pad') pad?: ElementRef<HTMLCanvasElement>;
  has = signal(false);
  drawing = signal(false);
  drew = signal(false);
  busy = signal(false);
  private stamp = Date.now();
  private isDown = false;
  private changed = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: SignatureDialogData,
    private ref: MatDialogRef<SignatureDialogComponent>,
    private http: HttpClient,
    private toast: ToastService
  ) {
    this.has.set(!!data.hasSignature);
    if (!data.hasSignature) this.drawing.set(true);
  }

  url(): string { return `${environment.apiUrl}/users/${this.data.userId}/signature?v=${this.stamp}`; }
  private get endpoint(): string { return `${environment.apiUrl}/users/${this.data.userId}/signature`; }

  startDrawing(): void { this.drawing.set(true); this.drew.set(false); setTimeout(() => this.clear(), 0); }

  // ── canvas ──
  private ctx(): CanvasRenderingContext2D | null {
    const c = this.pad?.nativeElement; if (!c) return null;
    const x = c.getContext('2d'); if (x) { x.lineWidth = 2.5; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#111'; }
    return x;
  }
  private pos(e: PointerEvent) {
    const c = this.pad!.nativeElement; const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height };
  }
  down(e: PointerEvent): void { const x = this.ctx(); if (!x) return; this.isDown = true; const p = this.pos(e); x.beginPath(); x.moveTo(p.x, p.y); }
  move(e: PointerEvent): void { if (!this.isDown) return; const x = this.ctx(); if (!x) return; const p = this.pos(e); x.lineTo(p.x, p.y); x.stroke(); this.drew.set(true); }
  up(): void { this.isDown = false; }
  clear(): void { const c = this.pad?.nativeElement; if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height); this.drew.set(false); }

  // ── save / upload / remove ──
  saveDrawing(): void {
    const c = this.pad?.nativeElement; if (!c || !this.drew()) return;
    const fd = new FormData(); fd.append('imageBase64', c.toDataURL('image/png'));
    this.send(fd, 'Signature saved');
  }
  upload(e: Event): void {
    const inp = e.target as HTMLInputElement; const f = inp.files?.[0]; inp.value = ''; if (!f) return;
    if (f.size > 2 * 1024 * 1024) { this.toast.warn('Signature image must be 2 MB or smaller.'); return; }
    const fd = new FormData(); fd.append('file', f);
    this.send(fd, 'Signature uploaded');
  }
  private send(fd: FormData, okMsg: string): void {
    this.busy.set(true);
    this.http.put(this.endpoint, fd).subscribe({
      next: () => { this.busy.set(false); this.changed = true; this.stamp = Date.now(); this.has.set(true); this.drawing.set(false); this.drew.set(false); this.toast.done(okMsg); },
      error: err => { this.busy.set(false); this.toast.error(err?.error?.message || "Couldn't save the signature."); }
    });
  }
  remove(): void {
    if (!confirm(`Remove ${this.data.onBehalf ? this.data.name + "'s" : 'your'} saved signature? ${this.data.onBehalf ? 'They' : 'You'} will have to draw one each time until a new one is saved.`)) return;
    this.busy.set(true);
    this.http.delete(this.endpoint).subscribe({
      next: () => { this.busy.set(false); this.changed = true; this.has.set(false); this.drawing.set(true); this.drew.set(false); this.toast.done('Signature removed'); },
      error: err => { this.busy.set(false); this.toast.error(err?.error?.message || "Couldn't remove the signature."); }
    });
  }
  close(): void { this.ref.close(this.changed ? { hasSignature: this.has() } : undefined); }
}
