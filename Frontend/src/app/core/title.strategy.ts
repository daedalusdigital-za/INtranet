import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

/**
 * Names each browser tab after its page, "Logistics · Intranet", so tabs, history and
 * screen readers say where you are (design review D-15). Titles live on the routes in
 * core/modules.config.ts.
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  constructor(private readonly title: Title) {
    super();
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot);
    // Keep the unread-messages count NotificationService puts in front, "(3) …".
    const unread = /^\(\d+\) /.exec(this.title.getTitle())?.[0] ?? '';
    this.title.setTitle(unread + (page ? `${page} · Intranet` : 'Intranet'));
  }
}
