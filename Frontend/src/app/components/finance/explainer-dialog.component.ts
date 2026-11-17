import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

export interface ExplainerStep { title: string; body: string; icon?: string; }
export interface ExplainerData { title: string; intro?: string; steps: ExplainerStep[]; }

/** "How does this work?" pop-up used behind the ? icon on finance screens. Keeps the page itself free of explanatory text. */
@Component({
  selector: 'app-explainer-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule],
  template: `
  <div class="ex">
    <header><mat-icon>help_outline</mat-icon><h2>{{ d.title }}</h2><button mat-icon-button mat-dialog-close aria-label="Close"><mat-icon>close</mat-icon></button></header>
    @if (d.intro) { <p class="intro">{{ d.intro }}</p> }
    <ol>
      @for (s of d.steps; track $index) {
        <li><span class="n">@if (s.icon) { <mat-icon>{{ s.icon }}</mat-icon> } @else { {{ $index + 1 }} }</span><div><strong>{{ s.title }}</strong><p>{{ s.body }}</p></div></li>
      }
    </ol>
    <footer><button mat-flat-button color="primary" mat-dialog-close>Got it</button></footer>
  </div>
  `,
  styles: [`
    .ex { padding: 4px 4px 12px; }
    header { display: flex; align-items: center; gap: 8px; padding: 12px 8px 8px 16px; > mat-icon { color: var(--color-primary); } h2 { flex: 1; margin: 0; font-size: var(--text-lg); } }
    .intro { margin: 0 16px 8px; color: var(--color-text-2); font-size: var(--text-sm); }
    ol { list-style: none; margin: 0; padding: 0 16px; display: grid; gap: 10px;
      li { display: flex; gap: 12px; align-items: flex-start;
        .n { flex: 0 0 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--color-primary-soft); color: var(--color-primary); font-weight: 700; font-size: var(--text-sm); mat-icon { font-size: 18px; width: 18px; height: 18px; } }
        strong { display: block; font-size: var(--text-sm); } p { margin: 2px 0 0; font-size: var(--text-sm); color: var(--color-text-2); } } }
    footer { display: flex; justify-content: flex-end; padding: 16px 16px 0; }
  `]
})
export class ExplainerDialogComponent {
  d = inject<ExplainerData>(MAT_DIALOG_DATA);
  static open(dialog: MatDialog, data: ExplainerData) { return dialog.open(ExplainerDialogComponent, { width: 'min(620px, 94vw)', data, autoFocus: false }); }
}
