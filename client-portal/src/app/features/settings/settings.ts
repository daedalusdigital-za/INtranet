import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { messageFor } from '../../core/errors';
import { NotificationPrefs } from '../../core/models';
import { PortalApi } from '../../core/portal-api';
import { NOTIFICATION_LABEL } from '../../core/status';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  styleUrl: './settings.scss',
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Notifications</h1>
          <p>Choose what we tell you about, and how. Settings apply to everyone on your account.</p>
        </div>
      </div>

      @if (p(); as prefs) {
        <form (ngSubmit)="save()" class="stack-lg">
          <section class="panel">
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Tell us when</th><th class="c">Email</th><th class="c">SMS</th></tr></thead>
                <tbody>
                  @for (r of prefs.rules; track r.event) {
                    <tr>
                      <td>{{ label[r.event] }}</td>
                      <td class="c"><input type="checkbox" [(ngModel)]="r.email" [name]="r.event + '-email'" [attr.aria-label]="label[r.event] + ', email'"></td>
                      <td class="c">
                        @if (r.smsAvailable) {
                          <input type="checkbox" [(ngModel)]="r.sms" [name]="r.event + '-sms'" [disabled]="!prefs.smsOptIn" [attr.aria-label]="label[r.event] + ', SMS'">
                        } @else { <span class="muted small">Email only</span> }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>

          <section class="panel panel-pad grid-2">
            <div class="stack">
              <h2>Also email</h2>
              <label class="field"><span>Extra addresses, separated by commas</span>
                <input class="input" name="extra" [(ngModel)]="extra" placeholder="dispatch@yourcompany.co.za">
              </label>
              <p class="hint">The person who books always gets the booking emails.</p>
            </div>
            <div class="stack">
              <h2>SMS</h2>
              <label class="field"><span>Mobile number</span>
                <input class="input" type="tel" name="sms" [(ngModel)]="prefs.smsNumber" placeholder="082 555 0100">
              </label>
              <label class="check"><input type="checkbox" name="optin" [(ngModel)]="prefs.smsOptIn"> I agree to receive delivery updates by SMS on this number</label>
              <p class="hint">The delivery contact on each shipment also gets an SMS when the truck is close, so they can be ready to receive.</p>
            </div>
          </section>

          @if (error()) { <p class="error-text" role="alert">{{ error() }}</p> }
          <div><button class="btn btn-primary" type="submit" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save notification settings' }}</button></div>
        </form>
      } @else {
        <div class="skeleton" style="height:320px"></div>
      }
    </div>
  `,
})
export class Settings implements OnInit {
  private api = inject(PortalApi);
  private toast = inject(ToastService);
  protected readonly label = NOTIFICATION_LABEL;
  protected readonly p = signal<NotificationPrefs | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected extra = '';

  ngOnInit(): void {
    this.api.notificationPrefs().subscribe({
      next: p => { this.p.set(p); this.extra = p.extraEmails.join(', '); },
      error: e => this.error.set(messageFor(e)),
    });
  }

  save(): void {
    const p = this.p()!;
    const emails = this.extra.split(',').map(s => s.trim()).filter(Boolean);
    const bad = emails.find(e => !/^\S+@\S+\.\S+$/.test(e));
    if (bad) { this.error.set(`“${bad}” isn’t a valid email address.`); return; }
    if (p.smsOptIn && !/^(\+27|0)\d{9}$/.test((p.smsNumber ?? '').replace(/\s/g, ''))) {
      this.error.set('Enter a South African mobile number, like 082 555 0100, or untick SMS.'); return;
    }
    if (!p.smsOptIn) p.rules.forEach(r => (r.sms = false));
    this.error.set('');
    this.saving.set(true);
    this.api.saveNotificationPrefs({ ...p, extraEmails: emails }).subscribe({
      next: saved => { this.p.set(saved); this.saving.set(false); this.toast.show('Notification settings saved.'); },
      error: e => { this.saving.set(false); this.error.set(messageFor(e)); },
    });
  }
}
