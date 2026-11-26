import { Component, HostListener, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TaskRecorderService } from '../../services/task-recorder.service';
import { RecordingReviewDialogComponent } from './recording-review-dialog.component';

/**
 * Floating bar for the task recorder: while recording (red dot, step count, stop) and while Welly walks someone
 * through a recorded task (one step at a time; Welly acts only on Do it). Marked data-recorder-ui so its own
 * clicks are never recorded.
 */
@Component({
  selector: 'app-task-recorder-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    @if (rec.highlight(); as h) {
      <div class="tr-ring" data-recorder-ui [style.top.px]="h.top - 5" [style.left.px]="h.left - 5" [style.width.px]="h.width + 10" [style.height.px]="h.height + 10"></div>
    }

    @if (rec.recording()) {
      <div class="tr-bar rec" data-recorder-ui role="status">
        <span class="dot" [class.paused]="rec.paused()"></span>
        <div class="tr-txt">
          <b>{{ rec.paused() ? 'Recording paused' : 'Recording a task' }} · {{ rec.steps().length }} step{{ rec.steps().length === 1 ? '' : 's' }}</b>
          <small>{{ lastStep() || 'Do the task as you normally would. Passwords and PINs are never saved.' }}</small>
        </div>
        <button mat-icon-button (click)="showSteps = !showSteps" [matTooltip]="showSteps ? 'Hide steps' : 'Show steps'" aria-label="Show steps"><mat-icon>{{ showSteps ? 'expand_more' : 'list' }}</mat-icon></button>
        <button mat-icon-button (click)="rec.togglePause()" [matTooltip]="rec.paused() ? 'Resume' : 'Pause'" [attr.aria-label]="rec.paused() ? 'Resume' : 'Pause'"><mat-icon>{{ rec.paused() ? 'play_arrow' : 'pause' }}</mat-icon></button>
        <button mat-stroked-button (click)="discard()">Discard</button>
        <button mat-flat-button color="warn" (click)="stop()"><mat-icon>stop</mat-icon>Stop and save</button>
        @if (showSteps) {
          <ol class="tr-list">
            @for (s of rec.steps(); track $index; let i = $index) {
              <li><span>{{ s.label }}</span><button mat-icon-button (click)="rec.removeStep(i)" aria-label="Remove step"><mat-icon>close</mat-icon></button></li>
            }
          </ol>
        }
      </div>
    }

    @if (rec.run(); as r) {
      <div class="tr-bar run" data-recorder-ui role="dialog" aria-label="Welly is walking you through a task">
        <img class="face" [src]="r.find === 'missing' || r.find === 'manual' ? '/welly/thinking.png' : '/welly/happy.png'" alt="" />
        <div class="tr-main">
          <div class="tr-title"><b>{{ r.task.name }}</b>
            @if (r.phase === 'step') { <span class="count">Step {{ r.index + 1 }} of {{ r.task.steps.length }}</span> }
          </div>

          @switch (r.phase) {
            @case ('inputs') {
              <p class="tr-say">Before I start, what should I use this time?</p>
              <form class="tr-inputs" (ngSubmit)="go()">
                @for (i of inputs(); track i.key) {
                  <label>{{ i.label }}
                    @if (i.sensitive) { <input [name]="i.key" type="password" autocomplete="off" disabled placeholder="You type this yourself at that step" /> }
                    @else { <input [name]="i.key" [(ngModel)]="values[i.key]" [placeholder]="i.example ? 'Last time: ' + i.example : ''" /> }
                  </label>
                }
                <div class="tr-actions"><button mat-button type="button" (click)="rec.stopRun()">Cancel</button><button mat-flat-button color="primary" type="submit">Start</button></div>
              </form>
            }
            @case ('step') {
              @if (rec.currentStep(); as s) {
                <p class="tr-say">{{ say(s) }}</p>
                @if (rec.risky() && r.find === 'found') { <p class="tr-warn"><mat-icon>warning_amber</mat-icon>This one saves, sends or deletes something. Check before you click Do it.</p> }
                @if (r.message) { <p class="tr-msg">{{ r.message }}</p> }
                <div class="tr-actions">
                  <button mat-button (click)="rec.stopRun()">Stop</button>
                  <span class="spacer"></span>
                  @switch (r.find) {
                    @case ('searching') { <span class="tr-muted">Looking for it…</span><button mat-stroked-button (click)="rec.personDid()">I did it</button> }
                    @case ('found') {
                      <button mat-stroked-button (click)="rec.personDid()">I did it myself</button>
                      <button mat-flat-button color="primary" (click)="rec.doStep()" [disabled]="r.busy"><mat-icon>smart_toy</mat-icon>Do it</button>
                    }
                    @default {
                      @if (r.find === 'missing') { <button mat-button (click)="rec.retry()">Look again</button> }
                      <button mat-flat-button color="primary" (click)="rec.personDid()"><mat-icon>check</mat-icon>Done</button>
                    }
                  }
                </div>
              }
            }
            @case ('done') {
              <p class="tr-say">All done. Welly did {{ count(r.states, 'welly') }} step{{ count(r.states, 'welly') === 1 ? '' : 's' }}, you did {{ count(r.states, 'person') }}.</p>
              <div class="tr-actions"><span class="spacer"></span><button mat-flat-button color="primary" (click)="rec.closeRun()">Close</button></div>
            }
          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host { position: fixed; inset: auto 0 0 0; z-index: 1100; pointer-events: none; }
    .tr-ring { position: fixed; border: 3px solid #db2777; border-radius: 10px; box-shadow: 0 0 0 4px rgba(219,39,119,.18); pointer-events: none; z-index: 1099; transition: all .2s ease; }
    .tr-bar { pointer-events: auto; position: fixed; left: 50%; transform: translateX(-50%); bottom: 18px; width: min(640px, calc(100vw - 32px));
      background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-line); border-radius: 14px;
      box-shadow: 0 12px 32px rgba(15,23,42,.18); padding: 10px 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .tr-bar.rec { border-color: color-mix(in srgb, #dc2626 35%, var(--color-line)); }
    .dot { width: 12px; height: 12px; border-radius: 50%; background: #dc2626; flex: none; animation: pulse 1.4s infinite; margin-left: 4px; }
    .dot.paused { animation: none; background: var(--color-text-3); }
    @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,.5); } 50% { box-shadow: 0 0 0 6px rgba(220,38,38,0); } }
    @media (prefers-reduced-motion: reduce) { .dot { animation: none; } .tr-ring { transition: none; } }
    .tr-txt { flex: 1; min-width: 160px; display: grid; b { font-size: 13.5px; } small { font-size: 12px; color: var(--color-text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } }
    .tr-bar button { display: inline-flex; align-items: center; gap: 4px; }
    .tr-list { flex-basis: 100%; max-height: 220px; overflow: auto; margin: 4px 0 0; padding: 0 0 0 22px; font-size: 12.5px; color: var(--color-text-2);
      li { display: flex; align-items: center; justify-content: space-between; gap: 6px; } li button { transform: scale(.8); } }
    .tr-bar.run { align-items: flex-start; flex-wrap: nowrap; }
    .face { width: 44px; height: 44px; object-fit: contain; flex: none; }
    .tr-main { flex: 1; min-width: 0; display: grid; gap: 6px; }
    .tr-title { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; b { font-size: 13.5px; } .count { font-size: 12px; color: var(--color-text-3); } }
    .tr-say { margin: 0; font-size: 14px; line-height: 1.4; }
    .tr-msg { margin: 0; font-size: 12.5px; color: var(--color-text-2); }
    .tr-warn { margin: 0; display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--color-warn); mat-icon { font-size: 17px; width: 17px; height: 17px; } }
    .tr-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; .spacer { flex: 1; } }
    .tr-muted { font-size: 12.5px; color: var(--color-text-3); }
    .tr-inputs { display: grid; gap: 8px; label { display: grid; gap: 3px; font-size: 12.5px; color: var(--color-text-2); }
      input { font: inherit; font-size: 13.5px; padding: 6px 8px; border: 1px solid var(--color-line); border-radius: 8px; background: var(--color-surface); color: var(--color-text); } }
    @media (max-width: 600px) { .tr-bar { bottom: 8px; } .face { display: none; } }
  `]
})
export class TaskRecorderBarComponent implements OnInit, OnDestroy {
  rec = inject(TaskRecorderService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  showSteps = false;
  values: Record<string, string> = {};
  private timer?: ReturnType<typeof setInterval>;

  lastStep = computed(() => { const s = this.rec.steps(); return s.length ? `Last: ${s[s.length - 1].label}` : ''; });
  inputs = computed(() => { this.rec.run(); return this.rec.runInputs(); });

  ngOnInit() {
    this.rec.onStopped = draft => {
      this.dialog.open(RecordingReviewDialogComponent, { data: { draft }, width: '760px', maxWidth: '96vw', maxHeight: '92vh', autoFocus: 'first-tabbable' })
        .afterClosed().subscribe(t => { if (t && !this.router.url.startsWith('/flows')) this.router.navigate(['/flows'], { queryParams: { tab: 'ai' } }); });
    };
    // Keep the highlight on the control as the page scrolls or re-lays out.
    this.timer = setInterval(() => { if (this.rec.highlight()) this.rec.refreshHighlight(); }, 400);
  }
  ngOnDestroy() { clearInterval(this.timer); this.rec.onStopped = null; }

  @HostListener('window:scroll') @HostListener('window:resize') onMove() { if (this.rec.highlight()) this.rec.refreshHighlight(); }

  stop() { this.showSteps = false; this.rec.stop(); }
  discard() { this.showSteps = false; this.rec.discard(); }
  go() { this.rec.setInputs({ ...this.values }); this.values = {}; }
  count(states: string[], s: string) { return states.filter(x => x === s).length; }

  say(s: { kind: string; label: string; value?: string; input?: { key: string; label: string } }): string {
    const v = this.rec.valueFor(s as any);
    if (s.kind === 'fill' && v !== undefined) return `${s.label.replace(/^Type “.*?” in /, `Type “${v}” in `)}`;
    if (s.kind === 'select' && v !== undefined) return s.label.replace(/^Choose “.*?”/, `Choose “${v}”`);
    if (s.input && v !== undefined) return `${s.label}: “${v}”`;
    return s.label;
  }
}
