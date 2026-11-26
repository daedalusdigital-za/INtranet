import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RecStep, RecordedTask, SaveRecording, TaskRecorderService } from '../../services/task-recorder.service';
import { ToastService } from '../../ui/toast.service';

export interface RecordingReviewData { draft?: SaveRecording; task?: RecordedTask; }

/** After recording (or to edit one): name it, tidy the steps, and mark the values that change each time. */
@Component({
  selector: 'app-recording-review-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatCheckboxModule, MatTooltipModule, MatProgressSpinnerModule],
  template: `
    <h2 mat-dialog-title>{{ data.task ? 'Edit recorded task' : 'Save what you recorded' }}</h2>
    <mat-dialog-content class="rr">
      <form #f="ngForm">
        <mat-form-field appearance="outline" class="full"><mat-label>Task name</mat-label>
          <input matInput name="name" [(ngModel)]="name" required maxlength="150" placeholder="e.g. Upload a POD and link it to the invoice" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full"><mat-label>What it's for (optional)</mat-label>
          <textarea matInput name="desc" [(ngModel)]="description" rows="2" maxlength="1000"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full"><mat-label>Who can run it</mat-label>
          <mat-select name="vis" [(ngModel)]="visibility">
            <mat-option value="private">Only me</mat-option>
            <mat-option value="shared">Everyone (each person still needs access to these pages)</mat-option>
          </mat-select>
        </mat-form-field>
      </form>

      <div class="rr-head"><b>Steps</b><span>{{ steps.length }} · tick <em>Ask each time</em> for values that change, like an invoice number</span></div>
      <ol class="rr-steps">
        @for (s of steps; track $index; let i = $index) {
          <li [attr.data-k]="s.kind">
            <mat-icon class="k">{{ icon(s) }}</mat-icon>
            <div class="m">
              <input class="lbl" [(ngModel)]="s.label" [name]="'l' + i" aria-label="Step description" />
              @if (s.kind === 'fill' || s.kind === 'select' || s.kind === 'check') {
                <div class="v">
                  @if (s.sensitive) {
                    <span class="lock"><mat-icon>lock</mat-icon>Not saved: a person types this each time</span>
                  } @else {
                    @if (s.value !== undefined && s.kind !== 'check') { <span class="val">Recorded: “{{ s.value }}”</span> }
                    <mat-checkbox [checked]="!!s.input" (change)="toggleInput(s, $event.checked)">Ask each time</mat-checkbox>
                  }
                  @if (s.input) {
                    <input class="ask" [(ngModel)]="s.input.label" [name]="'a' + i" placeholder="Question, e.g. Invoice number" aria-label="What to ask" />
                  }
                </div>
              }
              @if (s.note) { <small class="note">{{ s.note }}</small> }
            </div>
            <button mat-icon-button type="button" (click)="steps.splice(i, 1)" matTooltip="Remove this step" aria-label="Remove step"><mat-icon>close</mat-icon></button>
          </li>
        }
      </ol>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ data.task ? 'Cancel' : 'Discard' }}</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="busy || !name.trim() || !steps.length">
        @if (busy) { <mat-spinner diameter="18"></mat-spinner> } Save task
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .rr { min-width: min(640px, 86vw); }
    .full { width: 100%; }
    .rr-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin: 4px 0 8px; span { font-size: 12.5px; color: var(--color-text-3); } }
    .rr-steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; counter-reset: s; }
    .rr-steps li { display: flex; gap: 10px; align-items: flex-start; padding: 8px 6px 8px 10px; border: 1px solid var(--color-line); border-radius: 10px; background: var(--color-surface); }
    .rr-steps li[data-k="navigate"] { background: var(--color-surface-2); }
    .k { color: var(--color-text-3); margin-top: 4px; font-size: 20px; width: 20px; height: 20px; flex: none; }
    .m { flex: 1; min-width: 0; display: grid; gap: 4px; }
    .lbl { width: 100%; border: 1px solid transparent; border-radius: 6px; padding: 4px 6px; font: inherit; font-size: 13.5px; background: transparent; color: var(--color-text); }
    .lbl:hover, .lbl:focus { border-color: var(--color-line); outline: none; background: var(--color-surface); }
    .v { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; font-size: 12.5px; color: var(--color-text-2); padding-left: 6px; }
    .val { overflow-wrap: anywhere; }
    .ask { flex: 1; min-width: 180px; border: 1px solid var(--color-line); border-radius: 6px; padding: 4px 8px; font: inherit; font-size: 12.5px; background: var(--color-surface); color: var(--color-text); }
    .lock { display: inline-flex; align-items: center; gap: 4px; color: var(--color-text-3); mat-icon { font-size: 15px; width: 15px; height: 15px; } }
    .note { color: var(--color-text-3); padding-left: 6px; }
    mat-dialog-actions button { display: inline-flex; align-items: center; gap: 6px; }
  `]
})
export class RecordingReviewDialogComponent {
  data = inject<RecordingReviewData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<RecordingReviewDialogComponent>);
  private api = inject(TaskRecorderService);
  private toast = inject(ToastService);

  name = this.data.task?.name ?? this.data.draft?.name ?? '';
  description = this.data.task?.description ?? '';
  visibility: 'private' | 'shared' = this.data.task?.visibility ?? 'private';
  steps: RecStep[] = JSON.parse(JSON.stringify(this.data.task?.steps ?? this.data.draft?.steps ?? []));
  busy = false;

  icon(s: RecStep) {
    return { navigate: 'open_in_browser', click: 'ads_click', fill: 'keyboard', select: 'arrow_drop_down_circle', check: 'check_box' }[s.kind] ?? 'circle';
  }

  toggleInput(s: RecStep, on: boolean) {
    if (!on) { delete s.input; return; }
    const field = s.target?.label || s.target?.aria || s.target?.placeholder || s.target?.name || 'Value';
    const used = new Set(this.steps.filter(x => x.input).map(x => x.input!.key));
    let key = field.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'value';
    while (used.has(key)) key += '_2';
    s.input = { key, label: field };
  }

  save() {
    const body: SaveRecording = {
      name: this.name.trim(), description: this.description?.trim() || undefined, visibility: this.visibility,
      startUrl: this.data.task?.startUrl ?? this.data.draft?.startUrl, steps: this.steps
    };
    this.busy = true;
    const call = this.data.task ? this.api.update(this.data.task.id, body) : this.api.create(body);
    call.subscribe({
      next: t => { this.busy = false; this.toast.done(`Saved “${t.name}”. Find it under Flows → AI flows.`); this.ref.close(t); },
      error: err => { this.busy = false; this.toast.error(err?.error?.message || 'Could not save the task'); }
    });
  }
}
