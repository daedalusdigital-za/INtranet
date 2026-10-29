import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges,
  ElementRef, NgZone, ChangeDetectorRef, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';

/** Every face Welly can pull. Files live in /public/welly/<face>.png */
export type WellyFace =
  | 'default' | 'default2' | 'defaulteyesclosed'
  | 'lookingtopleft' | 'lookingtopright' | 'lookingdirectlyabove'
  | 'thinking' | 'happy' | 'angry' | 'error' | 'updating';

/** External mood the host (chatbot) can push. 'idle' hands control back to the mascot. */
export type WellyMood = 'idle' | 'thinking' | 'happy' | 'angry' | 'error' | 'updating';

const ALL_FACES: WellyFace[] = [
  'default', 'default2', 'defaulteyesclosed',
  'lookingtopleft', 'lookingtopright', 'lookingdirectlyabove',
  'thinking', 'happy', 'angry', 'error', 'updating'
];

/** Random idle "thoughts" and how long they last (ms). Always returns to a default face. */
const RANDOM_MOODS: { face: WellyFace; min: number; max: number; weight: number }[] = [
  { face: 'thinking', min: 1800, max: 3200, weight: 5 },
  { face: 'happy',    min: 1400, max: 2600, weight: 4 },
  { face: 'angry',    min: 900,  max: 1600, weight: 1 },
  { face: 'error',    min: 900,  max: 1500, weight: 1 },
  { face: 'updating', min: 1500, max: 2500, weight: 2 },
  { face: 'lookingdirectlyabove', min: 1200, max: 2200, weight: 3 },
];

const rnd = (min: number, max: number) => min + Math.random() * (max - min);

@Component({
  selector: 'app-welly-mascot',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './welly-mascot.component.html',
  styleUrls: ['./welly-mascot.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WellyMascotComponent implements OnInit, OnDestroy, OnChanges {
  /** Host-driven mood. When not 'idle' the mascot holds this face (with its own glow colour). */
  @Input() mood: WellyMood = 'idle';
  /** Pulse harder / show a badge (e.g. unread reply). */
  @Input() attention = false;
  @Input() badge: string | number | null = null;
  @Input() size = 72;
  @Input() title = 'Chat with Welly';
  /** Follow the cursor. Falls back to the focused element when the mouse is idle. */
  @Input() followMouse = true;

  @Output() clicked = new EventEmitter<void>();

  readonly faces = ALL_FACES;
  face: WellyFace = 'default';
  /** Head tilt toward the cursor (deg / px). */
  tiltX = 0; tiltY = 0; shiftX = 0; shiftY = 0;
  hovering = false;
  pressed = false;

  private restingFace: WellyFace = 'default';
  private gazeFace: WellyFace | null = null;
  private randomMoodActive = false;
  private blinking = false;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private raf = 0;
  private lastPointer: { x: number; y: number; at: number } | null = null;
  private targetTilt = { x: 0, y: 0, sx: 0, sy: 0 };
  private reducedMotion = false;

  constructor(private host: ElementRef<HTMLElement>, private zone: NgZone, private cdr: ChangeDetectorRef) {}

  // ─── lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.reducedMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

    this.zone.runOutsideAngular(() => {
      if (this.followMouse) {
        window.addEventListener('pointermove', this.onPointerMove, { passive: true });
        window.addEventListener('focusin', this.onFocusIn, { passive: true });
      }
      document.addEventListener('visibilitychange', this.onVisibility);
      this.loop();
    });

    this.scheduleBlink();
    this.scheduleRandomMood();
    this.scheduleRestingSwap();
  }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['mood']) this.applyFace();
  }

  ngOnDestroy(): void {
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('focusin', this.onFocusIn);
    document.removeEventListener('visibilitychange', this.onVisibility);
    cancelAnimationFrame(this.raf);
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }

  // ─── public helpers for the host ──────────────────────────────────────────

  /** Flash a face briefly (e.g. 'happy' when a reply lands), then return to resting. */
  react(face: WellyFace, ms = 1600): void {
    if (this.mood !== 'idle') return;
    this.randomMoodActive = true;
    this.applyFace(face);
    this.after(ms, () => { this.randomMoodActive = false; this.applyFace(); });
  }

  onClick(): void { this.clicked.emit(); }
  onEnter(): void { this.hovering = true; if (this.mood === 'idle' && !this.randomMoodActive) this.react('happy', 1200); this.cdr.markForCheck(); }
  onLeave(): void { this.hovering = false; this.pressed = false; this.cdr.markForCheck(); }
  onDown(): void { this.pressed = true; this.cdr.markForCheck(); }
  onUp(): void { this.pressed = false; this.cdr.markForCheck(); }

  get glowClass(): string {
    const m = this.mood !== 'idle' ? this.mood : this.face;
    if (m === 'error' || m === 'angry') return 'glow-red';
    if (m === 'thinking' || m === 'updating') return 'glow-cyan';
    if (m === 'happy') return 'glow-green';
    return 'glow-default';
  }

  // ─── face selection ───────────────────────────────────────────────────────

  /** Decide which PNG is showing, in priority order: host mood > blink > random mood > gaze > resting. */
  private applyFace(forced?: WellyFace): void {
    let next: WellyFace;
    if (this.mood !== 'idle') next = this.mood;
    else if (forced) next = forced;
    else if (this.blinking) next = 'defaulteyesclosed';
    else if (this.randomMoodActive) next = this.face; // keep whatever react() set
    else if (this.gazeFace) next = this.gazeFace;
    else next = this.restingFace;

    if (next !== this.face) {
      this.face = next;
      this.cdr.markForCheck();
    }
  }

  private scheduleBlink(): void {
    this.after(rnd(2500, 6500), () => {
      if (document.visibilityState === 'visible' && this.mood === 'idle' && !this.randomMoodActive) {
        this.blinking = true; this.applyFace();
        this.after(140, () => {
          this.blinking = false; this.applyFace();
          // occasional double blink
          if (Math.random() < 0.25) {
            this.after(160, () => { this.blinking = true; this.applyFace(); this.after(120, () => { this.blinking = false; this.applyFace(); }); });
          }
        });
      }
      this.scheduleBlink();
    });
  }

  private scheduleRandomMood(): void {
    this.after(rnd(9000, 22000), () => {
      if (document.visibilityState === 'visible' && this.mood === 'idle' && !this.hovering) {
        const total = RANDOM_MOODS.reduce((s, m) => s + m.weight, 0);
        let r = Math.random() * total;
        const pick = RANDOM_MOODS.find(m => (r -= m.weight) <= 0) ?? RANDOM_MOODS[0];
        this.react(pick.face, rnd(pick.min, pick.max));
      }
      this.scheduleRandomMood();
    });
  }

  /** Alternate default ↔ default2 so the idle pose feels alive. */
  private scheduleRestingSwap(): void {
    this.after(rnd(5000, 12000), () => {
      this.restingFace = this.restingFace === 'default' ? 'default2' : 'default';
      this.applyFace();
      this.scheduleRestingSwap();
    });
  }

  // ─── gaze / tilt ──────────────────────────────────────────────────────────

  private onPointerMove = (e: PointerEvent) => {
    this.lastPointer = { x: e.clientX, y: e.clientY, at: performance.now() };
    this.lookAt(e.clientX, e.clientY);
  };

  /** When the user is typing somewhere, look at the field (cursor may be idle). */
  private onFocusIn = (e: FocusEvent) => {
    const el = e.target as HTMLElement | null;
    if (!el || !(el instanceof HTMLElement) || this.host.nativeElement.contains(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    this.lookAt(r.left + r.width / 2, r.top + r.height / 2);
  };

  private onVisibility = () => {
    if (document.visibilityState === 'visible') { this.applyFace(); }
  };

  private lookAt(x: number, y: number): void {
    const r = this.host.nativeElement.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy);

    // Smooth head tilt toward the cursor (clamped)
    const nx = Math.max(-1, Math.min(1, dx / (window.innerWidth * 0.6)));
    const ny = Math.max(-1, Math.min(1, dy / (window.innerHeight * 0.6)));
    this.targetTilt = {
      x: -ny * 10,  // rotateX
      y: nx * 14,   // rotateY
      sx: nx * 4,   // translate px
      sy: ny * 3
    };

    // Pick the sprite that best matches the gaze direction
    let gaze: WellyFace | null = null;
    if (dist > r.width * 0.9) {
      const ang = Math.atan2(-dy, dx) * 180 / Math.PI; // 0 = right, 90 = up
      if (ang > 25 && ang < 75) gaze = 'lookingtopright';
      else if (ang >= 75 && ang <= 105) gaze = 'lookingdirectlyabove';
      else if (ang > 105 && ang < 180) gaze = 'lookingtopleft';
      else if (ang <= -100 || ang >= 170) gaze = 'lookingtopleft';   // far left / below-left → left-ish
      else if (ang < 25 && ang > -80) gaze = 'lookingtopright';      // right / below-right → right-ish
      else gaze = null;
    }
    if (gaze !== this.gazeFace) {
      this.gazeFace = gaze;
      this.applyFace();
    }
  }

  /** rAF loop: ease tilt toward target and relax gaze when the cursor has been still. */
  private loop = () => {
    const ease = this.reducedMotion ? 1 : 0.12;
    const t = this.targetTilt;
    const nX = this.tiltX + (t.x - this.tiltX) * ease;
    const nY = this.tiltY + (t.y - this.tiltY) * ease;
    const nSX = this.shiftX + (t.sx - this.shiftX) * ease;
    const nSY = this.shiftY + (t.sy - this.shiftY) * ease;
    if (Math.abs(nX - this.tiltX) > 0.01 || Math.abs(nY - this.tiltY) > 0.01 || Math.abs(nSX - this.shiftX) > 0.01 || Math.abs(nSY - this.shiftY) > 0.01) {
      this.tiltX = nX; this.tiltY = nY; this.shiftX = nSX; this.shiftY = nSY;
      // Write directly to DOM to avoid change detection every frame
      const head = this.host.nativeElement.querySelector<HTMLElement>('.wm-head');
      if (head) head.style.transform = `translate(${nSX.toFixed(2)}px, ${nSY.toFixed(2)}px) rotateX(${nX.toFixed(2)}deg) rotateY(${nY.toFixed(2)}deg)`;
    }

    // After ~3.5s of no pointer movement, drift back to looking at the user
    if (this.lastPointer && performance.now() - this.lastPointer.at > 3500 && (this.gazeFace || t.x || t.y)) {
      this.targetTilt = { x: 0, y: 0, sx: 0, sy: 0 };
      if (this.gazeFace) { this.gazeFace = null; this.zone.run(() => this.applyFace()); }
      this.lastPointer = null;
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private after(ms: number, fn: () => void): void {
    const id = setTimeout(() => { this.timers.delete(id); this.zone.run(fn); }, ms);
    this.timers.add(id);
  }
}
