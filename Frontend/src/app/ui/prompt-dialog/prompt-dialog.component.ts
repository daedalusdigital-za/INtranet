import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

export interface PromptField {
  key: string;
  label: string;
  /** Defaults to text. Dates are yyyy-mm-dd strings; numbers come back as numbers. */
  type?: 'text' | 'textarea' | 'number' | 'date' | 'select';
  value?: string | number | null;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** For select fields. */
  options?: { value: string; label: string }[];
  /** For number fields. */
  min?: number;
}

export interface PromptOptions {
  /** Says what the answer is for, e.g. "Decline waybill 1042?" */
  title: string;
  message?: string;
  fields: PromptField[];
  /** Button text naming the action, e.g. "Decline waybill". Defaults to "Save". */
  confirmText?: string;
  cancelText?: string;
  /** Red confirm button, for declines, cancellations and reversals. */
  danger?: boolean;
}

export type PromptResult = Record<string, string | number | null>;

/** In-app replacement for window.prompt() (design review D-10). Open it through ConfirmService. */
@Component({
  selector: 'app-prompt-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <form class="pd" #form="ngForm" (ngSubmit)="form.valid && submit()">
      <h2 mat-dialog-title class="pd-title">{{ data.title }}</h2>
      <mat-dialog-content class="pd-body">
        @if (data.message) { <p class="pd-msg">{{ data.message }}</p> }
        @for (f of data.fields; track f.key) {
          <mat-form-field appearance="outline" class="pd-field">
            <mat-label>{{ f.label }}</mat-label>
            @switch (f.type) {
              @case ('textarea') {
                <textarea matInput [name]="f.key" [(ngModel)]="values[f.key]" [required]="!!f.required"
                          [placeholder]="f.placeholder ?? ''" rows="3"></textarea>
              }
              @case ('select') {
                <mat-select [name]="f.key" [(ngModel)]="values[f.key]" [required]="!!f.required">
                  @for (o of f.options ?? []; track o.value) { <mat-option [value]="o.value">{{ o.label }}</mat-option> }
                </mat-select>
              }
              @case ('number') {
                <input matInput type="number" [name]="f.key" [(ngModel)]="values[f.key]" [required]="!!f.required"
                       [min]="f.min ?? null" [placeholder]="f.placeholder ?? ''">
              }
              @case ('date') {
                <input matInput type="date" [name]="f.key" [(ngModel)]="values[f.key]" [required]="!!f.required">
              }
              @default {
                <input matInput [name]="f.key" [(ngModel)]="values[f.key]" [required]="!!f.required"
                       [placeholder]="f.placeholder ?? ''" autocomplete="off">
              }
            }
            @if (f.hint) { <mat-hint>{{ f.hint }}</mat-hint> }
            <mat-error>Enter {{ f.label.toLowerCase() }}{{ f.type === 'number' && f.min != null ? ' of at least ' + f.min : '' }}.</mat-error>
          </mat-form-field>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end" class="pd-actions">
        <button mat-stroked-button type="button" (click)="ref.close(null)">{{ data.cancelText || 'Cancel' }}</button>
        <button mat-flat-button type="submit" color="primary" [class.pd-danger]="data.danger">{{ data.confirmText || 'Save' }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`
    .pd { max-width: 480px; }
    .pd-title { font-size: var(--text-xl); font-weight: 800; line-height: 1.3; color: var(--color-text); }
    .pd-body { display: grid; gap: var(--space-1); color: var(--color-text-2); font-size: var(--text-md); }
    .pd-msg { margin: 0 0 var(--space-3); white-space: pre-line; }
    .pd-field { width: 100%; }
    .pd-actions { gap: var(--space-2); padding: var(--space-2) var(--space-5) var(--space-5); }
    .pd-danger { --mdc-filled-button-container-color: var(--color-danger); --mdc-filled-button-label-text-color: var(--color-on-primary); }
  `]
})
export class PromptDialogComponent {
  readonly data = inject<PromptOptions>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<PromptDialogComponent, PromptResult | null>);
  readonly values: Record<string, any> = Object.fromEntries(this.data.fields.map(f => [f.key, f.value ?? null]));

  submit(): void {
    const result: PromptResult = {};
    for (const f of this.data.fields) {
      const v = this.values[f.key];
      if (f.type === 'number') result[f.key] = v === null || v === '' ? null : Number(v);
      else result[f.key] = typeof v === 'string' ? v.trim() : v ?? null;
    }
    this.ref.close(result);
  }
}
