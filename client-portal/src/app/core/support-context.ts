import { Injectable, signal } from '@angular/core';

/** Lets a page tell the support chat which shipment the client is looking at. */
@Injectable({ providedIn: 'root' })
export class SupportContext {
  readonly shipment = signal<{ id: number; ref: string } | null>(null);
  /** Whether the chat panel is open; any page can open it. */
  readonly open = signal(false);
}
