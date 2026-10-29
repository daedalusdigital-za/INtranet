import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ShipmentService, SHIPMENT_STATUS_LABEL, ShipmentStatus } from '../../services/shipment.service';

/**
 * Public, unauthenticated tracking page reached from the waybill QR code (/t/<token>).
 * Shows status, ETA, route suburbs and a coarse timeline. No names, phone numbers or exact addresses (POPIA).
 */
@Component({
  selector: 'app-public-tracking',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="wrap">
      <header class="brand"><img src="assets/logo.png" alt="" onerror="this.style.display='none'" /><span>Rocket Freight · Shipment tracking</span></header>

      @if (loading()) { <div class="card"><p class="muted">Looking up your shipment…</p></div> }
      @else if (notFound()) {
        <div class="card"><h1>We couldn't find that shipment</h1><p class="muted">Check the link on your waybill or contact the sender.</p></div>
      } @else {
        @if (t(); as t) {
        <div class="card">
          <div class="top">
            <div><div class="muted">Waybill</div><h1>{{ t.waybillNo }}</h1></div>
            <div class="status" [class]="'status ' + tone(t.status)">{{ label(t.status) }}</div>
          </div>
          <div class="route">
            <div><div class="muted">From</div><b>{{ t.from.suburb || t.from.city }}</b><div class="muted">{{ t.from.city }}</div></div>
            <div class="arrow">→</div>
            <div><div class="muted">To</div><b>{{ t.to.suburb || t.to.city }}</b><div class="muted">{{ t.to.city }}</div></div>
          </div>
          <div class="facts">
            @if (t.status === 'DELIVERED') { <div><div class="muted">Delivered</div><b>{{ t.deliveredAt | date:'EEE dd MMM, HH:mm' }}</b></div> }
            @else if (t.eta) { <div><div class="muted">Estimated arrival</div><b>{{ t.eta | date:'EEE dd MMM, HH:mm' }}</b></div> }
            @else { <div><div class="muted">Expected delivery</div><b>{{ t.requestedDeliveryDate | date:'EEE dd MMM' }}</b></div> }
            @if (t.vehicle) { <div><div class="muted">Vehicle position</div><b>Updated {{ t.vehicle.ageMinutes != null ? t.vehicle.ageMinutes + ' min ago' : (t.vehicle.timestamp | date:'HH:mm') }}</b>
              <div class="muted"><a [href]="mapUrl(t.vehicle)" target="_blank" rel="noopener">Open map</a></div></div> }
          </div>
          <ol class="steps">
            @for (s of steps; track s) {
              <li [class.done]="reached(t, s)" [class.now]="t.status === s"><span class="dot"></span>
                <div><b>{{ label(s) }}</b>@if (when(t, s); as w) { <div class="muted">{{ w | date:'dd MMM HH:mm' }}</div> }</div></li>
            }
            @if (isException(t.status)) { <li class="now bad"><span class="dot"></span><div><b>{{ label(t.status) }}</b><div class="muted">We'll re-attempt and keep you updated.</div></div></li> }
          </ol>
          <p class="muted small">Updates every minute while the vehicle is on the road. This page shows only the status of your shipment and no personal details.</p>
        </div>
        }
      }
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: #f3f5f7; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #1c2430; }
    .wrap { max-width: 640px; margin: 0 auto; padding: 24px 16px 60px; }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; color: var(--color-brand); margin-bottom: 14px; } .brand img { height: 28px; }
    .card { background: var(--color-surface); border-radius: 16px; padding: 20px 22px; box-shadow: 0 2px 14px rgba(0,0,0,.06); display: grid; gap: 16px; }
    h1 { margin: 0; font-size: 22px; letter-spacing: .02em; }
    .muted { color: #6b7684; font-size: 12.5px; } .small { font-size: 11.5px; }
    .top { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .status { padding: 6px 14px; border-radius: 999px; font-weight: 700; font-size: 13px; background: #eef1f4; }
    .status.ok { background: #e3f5e9; color: #1b6b3a; } .status.warn { background: #fff4de; color: #8a5a00; } .status.bad { background: var(--color-danger-soft); color: #a1261b; } .status.go { background: #e3eefc; color: #1b4f9c; }
    .route { display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: center; } .arrow { font-size: 22px; color: #9aa4b1; }
    .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; padding: 12px; background: #f7f9fb; border-radius: 10px; }
    .steps { list-style: none; margin: 0; padding: 0 0 0 8px; border-left: 2px solid var(--color-line); display: grid; gap: 12px; }
    .steps li { position: relative; padding-left: 16px; color: #9aa4b1; } .steps li.done, .steps li.now { color: inherit; }
    .dot { position: absolute; left: -9px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: var(--color-surface-3); border: 2px solid #fff; box-shadow: 0 0 0 1px #e3e6ea; }
    .done .dot { background: #1b6b3a; } .now .dot { background: #033142; box-shadow: 0 0 0 4px rgba(3,49,66,.15); } .bad .dot { background: #a1261b; }
  `]
})
export class PublicTrackingComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private svc = inject(ShipmentService);
  private timer: any;

  t = signal<any | null>(null); loading = signal(true); notFound = signal(false);
  readonly steps: ShipmentStatus[] = ['CONFIRMED', 'WAYBILL_ISSUED', 'COLLECTED', 'IN_TRANSIT', 'ARRIVING', 'DELIVERED'];
  private order: string[] = ['BOOKED', 'CONFIRMED', 'PLANNED', 'WAYBILL_ISSUED', 'COLLECTED', 'IN_TRANSIT', 'ARRIVING', 'DELIVERED'];

  ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    const fetch = () => this.svc.track(token).subscribe({
      next: t => { this.t.set(t); this.loading.set(false); if (t.status === 'DELIVERED' || t.status === 'CANCELLED') clearInterval(this.timer); },
      error: () => { this.loading.set(false); if (!this.t()) this.notFound.set(true); }
    });
    fetch();
    this.timer = setInterval(fetch, 60_000);
  }
  ngOnDestroy() { clearInterval(this.timer); }

  label(s: string) { return SHIPMENT_STATUS_LABEL[s as ShipmentStatus] ?? s; }
  tone(s: string) { return s === 'DELIVERED' ? 'ok' : this.isException(s) ? 'bad' : ['IN_TRANSIT', 'ARRIVING', 'COLLECTED'].includes(s) ? 'go' : 'warn'; }
  isException(s: string) { return ['COLLECTION_FAILED', 'DELIVERY_FAILED', 'CANCELLED', 'REJECTED'].includes(s); }
  reached(t: any, s: string) { return this.order.indexOf(this.effective(t.status)) >= this.order.indexOf(s); }
  when(t: any, s: string) { return t.timeline?.find((e: any) => e.toStatus === s)?.occurredAt ?? null; }
  mapUrl(v: any) { return `https://www.google.com/maps?q=${v.latitude},${v.longitude}`; }
  private effective(s: string) { return s === 'PLANNED' ? 'CONFIRMED' : s === 'DELIVERY_FAILED' ? 'IN_TRANSIT' : s === 'COLLECTION_FAILED' ? 'WAYBILL_ISSUED' : s; }
}
