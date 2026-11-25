import { Component, computed, input } from '@angular/core';

/** Stable hue from a name, so the same person always gets the same colour. */
export function nameHue(name: string | null | undefined): number {
  let h = 0;
  for (const ch of (name ?? '').trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? '').replace(/\(.*?\)/g, '').split(/[\s._@-]+/).filter(Boolean);
  if (!words.length) return '?';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Person avatar: the photo if there is one, else initials on a colour chosen from the name,
 * with an optional green online dot.
 *
 *   <app-avatar [name]="u.fullName" [photo]="u.photoUrl" [online]="u.isOnline" size="36" />
 */
@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    <span class="av" [style.width.px]="px()" [style.height.px]="px()" [style.font-size.px]="px() * 0.38"
          [style.--h]="hue()" [attr.title]="name() || null" role="img" [attr.aria-label]="name() || 'Person'">
      @if (photo()) { <img [src]="photo()" alt="" (error)="broken = true" [hidden]="broken"> }
      @if (!photo() || broken) { <span class="ini">{{ initials() }}</span> }
      @if (online()) { <i class="dot" aria-hidden="true"></i> }
    </span>
  `,
  styles: [`
    :host { display: inline-flex; flex: none; }
    .av { position: relative; display: inline-grid; place-items: center; border-radius: 50%;
      background: hsl(var(--h) 62% 90%); color: hsl(var(--h) 55% 32%); font-weight: 700; letter-spacing: 0.01em; line-height: 1; }
    :host-context([data-theme='dark']) .av { background: hsl(var(--h) 35% 26%); color: hsl(var(--h) 70% 82%); }
    img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
    .dot { position: absolute; right: 0; bottom: 0; width: 28%; height: 28%; min-width: 8px; min-height: 8px; border-radius: 50%;
      background: var(--color-ok); box-shadow: 0 0 0 2px var(--color-surface); }
  `]
})
export class AvatarComponent {
  readonly name = input<string | null | undefined>('');
  readonly photo = input<string | null | undefined>(null);
  readonly online = input<boolean>(false);
  readonly size = input<number | string>(32);
  readonly px = computed(() => Number(this.size()) || 32);
  readonly hue = computed(() => nameHue(this.name()));
  readonly initials = computed(() => initialsOf(this.name()));
  broken = false;
}
