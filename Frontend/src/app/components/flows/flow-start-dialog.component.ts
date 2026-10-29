import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FlowCatalog, FlowDefinition, FlowsService } from '../../services/flows.service';
import { ToastService } from '../../ui/toast.service';

/** Starts a manual (Level 1/2) flow: renders the flow's declared inputs and kicks off the run. */
@Component({
  selector: 'app-flow-start-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <h2 mat-dialog-title class="fsd-title"><mat-icon>play_circle</mat-icon> {{ data.def.name }}</h2>
    <mat-dialog-content class="fsd-body">
      @if (data.def.description) { <p class="fsd-desc">{{ data.def.description }}</p> }
      <form #f="ngForm" class="fsd-form">
        @for (inp of data.def.inputs; track inp.key) {
          @switch (inp.type) {
            @case ('textarea') {
              <mat-form-field appearance="outline" class="full">
                <mat-label>{{ inp.label }}</mat-label>
                <textarea matInput rows="3" [(ngModel)]="values[inp.key]" [name]="inp.key" [required]="!!inp.required"></textarea>
                @if (inp.hint) { <mat-hint>{{ inp.hint }}</mat-hint> }
              </mat-form-field>
            }
            @case ('select') {
              <mat-form-field appearance="outline" class="full">
                <mat-label>{{ inp.label }}</mat-label>
                <mat-select [(ngModel)]="values[inp.key]" [name]="inp.key" [required]="!!inp.required">
                  @for (o of inp.options || []; track o) { <mat-option [value]="o">{{ o }}</mat-option> }
                </mat-select>
              </mat-form-field>
            }
            @case ('user') {
              <mat-form-field appearance="outline" class="full">
                <mat-label>{{ inp.label }}</mat-label>
                <mat-select [(ngModel)]="values[inp.key]" [name]="inp.key" [required]="!!inp.required">
                  @for (u of data.catalog.users; track u.id) { <mat-option [value]="u.id">{{ u.name }} <span class="muted">· {{ u.role }}</span></mat-option> }
                </mat-select>
              </mat-form-field>
            }
            @case ('department') {
              <mat-form-field appearance="outline" class="full">
                <mat-label>{{ inp.label }}</mat-label>
                <mat-select [(ngModel)]="values[inp.key]" [name]="inp.key" [required]="!!inp.required">
                  @for (d of data.catalog.departments; track d.id) { <mat-option [value]="d.name">{{ d.name }}</mat-option> }
                </mat-select>
              </mat-form-field>
            }
            @default {
              <mat-form-field appearance="outline" class="full">
                <mat-label>{{ inp.label }}</mat-label>
                <input matInput [type]="inp.type === 'number' ? 'number' : inp.type === 'date' ? 'date' : 'text'" [(ngModel)]="values[inp.key]" [name]="inp.key" [required]="!!inp.required" />
                @if (inp.hint) { <mat-hint>{{ inp.hint }}</mat-hint> }
              </mat-form-field>
            }
          }
        }
        @if (!data.def.inputs?.length) {
          <p class="fsd-none">This flow has no inputs — it starts straight away.</p>
        }
        <mat-form-field appearance="outline" class="full">
          <mat-label>Priority</mat-label>
          <mat-select [(ngModel)]="priority" name="priority">
            <mat-option value="Low">Low</mat-option><mat-option value="Normal">Normal</mat-option>
            <mat-option value="High">High</mat-option><mat-option value="Urgent">Urgent</mat-option>
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="busy">Cancel</button>
      <button mat-flat-button color="primary" (click)="start()" [disabled]="busy || !f.valid">
        @if (busy) { <mat-spinner diameter="18"></mat-spinner> } @else { <mat-icon>play_arrow</mat-icon> }
        Start flow
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .fsd-title { display: flex; align-items: center; gap: 8px; }
    .fsd-body { min-width: min(520px, 90vw); }
    .fsd-desc { margin: 0 0 12px; color: var(--color-text-2); font-size: var(--text-sm); }
    .fsd-form { display: grid; gap: 4px; }
    .full { width: 100%; }
    .muted { color: var(--color-text-3); font-size: 12px; }
    .fsd-none { color: var(--color-text-3); font-size: var(--text-sm); }
    mat-dialog-actions button { display: inline-flex; align-items: center; gap: 6px; }
  `]
})
export class FlowStartDialogComponent {
  data = inject<{ def: FlowDefinition; catalog: FlowCatalog }>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<FlowStartDialogComponent>);
  private api = inject(FlowsService);
  private toast = inject(ToastService);

  values: Record<string, any> = {};
  priority = 'Normal';
  busy = false;

  start() {
    this.busy = true;
    this.api.start(this.data.def.id, this.values, undefined, this.priority).subscribe({
      next: res => { this.busy = false; this.toast.done(res?.summary ? `${res.summary.runNumber} started` : (res?.message || 'Started')); this.ref.close(res); },
      error: err => { this.busy = false; this.toast.error(err?.error?.message || 'Could not start flow'); }
    });
  }
}
