import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { Observable, filter, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

/** How the runner finds a control again: the most stable clue first (data-welly, id, field label), the CSS path last. */
export interface RecTarget {
  welly?: string; id?: string; aria?: string; name?: string; label?: string; text?: string;
  role?: string; tag?: string; css?: string; placeholder?: string; type?: string;
}
export type RecStepKind = 'navigate' | 'click' | 'fill' | 'select' | 'check';
export interface RecStep {
  kind: RecStepKind;
  label: string;
  url?: string;
  target?: RecTarget;
  value?: string;
  /** Set when the value changes each time: the runner asks for it before starting. */
  input?: { key: string; label: string };
  /** Password / PIN / card / token field: the value is never stored. */
  sensitive?: boolean;
  note?: string;
}
export interface RecordedTask {
  id: number; name: string; description?: string; startUrl?: string; visibility: 'private' | 'shared';
  createdByUserId: number; createdByName?: string; createdAt: string; updatedAt?: string;
  runCount: number; lastRunAt?: string; canEdit: boolean; steps: RecStep[];
}
export interface SaveRecording { name: string; description?: string; visibility: 'private' | 'shared'; startUrl?: string; steps: RecStep[]; }

type RunStepState = 'pending' | 'welly' | 'person' | 'skipped';
export interface RunnerState {
  task: RecordedTask;
  runId: number | null;
  index: number;
  /** inputs: asking for this run's values first · step: on a step · done: finished */
  phase: 'inputs' | 'step' | 'done';
  inputs: Record<string, string>;
  /** found: control highlighted, ready for Do it · searching · missing: can't find it, the person does it · manual: Welly never does this one */
  find: 'searching' | 'found' | 'missing' | 'manual';
  message?: string;
  states: RunStepState[];
  busy: boolean;
  /** Autoplay: Welly moves its cursor and does every step itself, stopping only where it has to. */
  auto: boolean;
  paused: boolean;
  /** Seconds left before a save / send / delete click, so there's a moment to pause it. */
  countdown: number | null;
}

const INTERACTIVE = 'button, a[href], a[routerlink], [role=button], [role=tab], [role=menuitem], [role=option], [role=combobox], [role=switch], [role=link], mat-option, mat-select, input, textarea, select, [data-welly]';
const IGNORE = '[data-recorder-ui], app-chatbot, .welly-chat, .cdk-overlay-backdrop';
const SENSITIVE = /pass(word|code)?|\bpin\b|otp|one.?time|cvv|cvc|card.?(no|num)|secret|token|api.?key|iban|account.?(no|num)|id.?number/i;
const RISKY = /\b(delete|remove|send|submit|approve|pay|post|confirm|finali[sz]e|sign|decline|reject|cancel order|archive)\b/i;
const STORE_KEY = 'welly_recording';

@Injectable({ providedIn: 'root' })
export class TaskRecorderService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private zone = inject(NgZone);
  private base = `${environment.apiUrl}/welly/recordings`;

  // ── Recording ──
  readonly recording = signal(false);
  readonly paused = signal(false);
  readonly steps = signal<RecStep[]>([]);
  private startUrl = '';
  /** Element each step was recorded from (not saved), so repeated typing in one field stays one step. */
  private stepEls: (Element | null)[] = [];
  private pendingSelect: { el: Element; target: RecTarget; label: string } | null = null;
  private listening = false;
  /** Called when recording stops with steps, so the bar can open the review dialog. */
  onStopped: ((draft: SaveRecording) => void) | null = null;

  // ── Running ──
  readonly run = signal<RunnerState | null>(null);
  readonly highlight = signal<DOMRect | null>(null);
  /** Welly's on-screen cursor while it plays a task. */
  readonly cursor = signal<{ x: number; y: number; click: boolean } | null>(null);
  private manualEl: Element | null = null;
  private manualListener: (() => void) | null = null;
  private foundEl: Element | null = null;
  private findToken = 0;
  readonly currentStep = computed(() => { const r = this.run(); return r && r.phase === 'step' ? r.task.steps[r.index] ?? null : null; });
  readonly risky = computed(() => { const s = this.currentStep(); return !!s && s.kind === 'click' && RISKY.test(s.label + ' ' + (s.target?.text ?? '')); });

  constructor() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.onNavigated());
    // A page reload mid-recording carries on where it was.
    try {
      const saved = sessionStorage.getItem(STORE_KEY);
      if (saved) {
        const s = JSON.parse(saved);
        this.steps.set(s.steps || []); this.stepEls = (s.steps || []).map(() => null); this.startUrl = s.startUrl || '';
        this.recording.set(true); this.attach();
      }
    } catch { }
  }

  // ════════════ API ════════════
  list(): Observable<RecordedTask[]> { return this.http.get<RecordedTask[]>(this.base); }
  get(id: number): Observable<RecordedTask> { return this.http.get<RecordedTask>(`${this.base}/${id}`); }
  create(r: SaveRecording): Observable<RecordedTask> { return this.http.post<RecordedTask>(this.base, r); }
  update(id: number, r: SaveRecording): Observable<RecordedTask> { return this.http.put<RecordedTask>(`${this.base}/${id}`, r); }
  remove(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }

  // ════════════ Recording ════════════
  start() {
    if (this.run()) this.stopRun('Started a recording');
    this.startUrl = this.router.url;
    this.steps.set([]); this.stepEls = []; this.pendingSelect = null;
    this.recording.set(true); this.paused.set(false);
    this.addNavigate(this.router.url);
    this.attach();
  }
  togglePause() { this.paused.update(p => !p); }
  discard() { this.detach(); this.recording.set(false); this.steps.set([]); this.stepEls = []; this.clearSaved(); }
  removeStep(i: number) { this.steps.update(s => s.filter((_, j) => j !== i)); this.stepEls.splice(i, 1); this.save(); }
  stop() {
    this.detach(); this.recording.set(false); this.clearSaved();
    // A trailing page change with nothing done on it is noise.
    const steps = [...this.steps()];
    while (steps.length && steps[steps.length - 1].kind === 'navigate' && steps.length > 1) steps.pop();
    this.steps.set([]); this.stepEls = [];
    if (steps.some(s => s.kind !== 'navigate')) this.onStopped?.({ name: '', visibility: 'private', startUrl: this.startUrl, steps });
    return steps;
  }

  private attach() {
    if (this.listening) return;
    this.listening = true;
    this.zone.runOutsideAngular(() => {
      document.addEventListener('click', this.onClick, true);
      document.addEventListener('change', this.onChange, true);
    });
  }
  private detach() {
    this.listening = false;
    document.removeEventListener('click', this.onClick, true);
    document.removeEventListener('change', this.onChange, true);
  }
  private save() { try { sessionStorage.setItem(STORE_KEY, JSON.stringify({ steps: this.steps(), startUrl: this.startUrl })); } catch { } }
  private clearSaved() { try { sessionStorage.removeItem(STORE_KEY); } catch { } }

  private push(step: RecStep, el: Element | null, replaceLast = false) {
    this.zone.run(() => {
      this.steps.update(s => replaceLast && s.length ? [...s.slice(0, -1), step] : [...s, step]);
      if (replaceLast && this.stepEls.length) this.stepEls[this.stepEls.length - 1] = el; else this.stepEls.push(el);
      this.save();
    });
  }

  private onNavigated() {
    if (this.recording() && !this.paused()) this.addNavigate(this.router.url);
    if (this.run()?.phase === 'step') setTimeout(() => this.locate(), 150);
  }

  private addNavigate(url: string) {
    const steps = this.steps();
    const last = steps[steps.length - 1];
    const step: RecStep = { kind: 'navigate', url, label: `Open ${this.pageName(url)}` };
    this.push(step, null, last?.kind === 'navigate');
    // Use the page's own heading once it has rendered.
    setTimeout(() => {
      const h = (document.querySelector('app-page-header h1, .page-header h1, main h1, h1') as HTMLElement | null)?.innerText?.trim();
      if (!h || !this.recording()) return;
      this.steps.update(s => s.map(x => x === step ? { ...x, label: `Open ${h}` } : x));
      this.save();
    }, 700);
  }

  private pageName(url: string) {
    const [path, q] = url.split('?');
    const parts = path.split('/').filter(Boolean).map(p => /^\d+$/.test(p) ? '#' + p : p.replace(/[-_]/g, ' '));
    const extra = new URLSearchParams(q || '').get('tab') || new URLSearchParams(q || '').get('side');
    return (parts.join(' · ') || 'Home') + (extra ? ` · ${extra}` : '');
  }

  private onClick = (ev: MouseEvent) => {
    if (!this.recording() || this.paused() || !ev.isTrusted) return;
    const raw = ev.target as Element | null;
    if (!raw || raw.closest(IGNORE)) return;
    const el = raw.closest(INTERACTIVE);
    if (!el) return;
    // Typing, ticking and choosing are recorded from their change events, not the click.
    if (el.matches('input, textarea, select') || el.closest('mat-checkbox, mat-radio-button')) return;
    const option = el.closest('mat-option, [role=option]');
    if (option && this.pendingSelect) {
      const value = this.textOf(option);
      const p = this.pendingSelect; this.pendingSelect = null;
      const last = this.stepEls[this.stepEls.length - 1];
      this.push({ kind: 'select', label: `Choose “${value}” in ${p.label}`, target: p.target, value }, p.el, last === p.el);
      return;
    }
    const target = this.describe(el);
    if (el.matches('mat-select, [role=combobox]')) {
      const label = target.label || target.aria || target.placeholder || 'the list';
      this.pendingSelect = { el, target, label };
      this.push({ kind: 'click', label: `Open ${label}`, target }, el);
      return;
    }
    if (target.type === 'file') return;
    const name = target.text || target.aria || target.label || target.welly || 'the control';
    const what = el.matches('[role=tab]') ? 'tab' : el.matches('a, [role=link]') ? 'link' : el.matches('[role=menuitem]') ? 'menu item' : '';
    this.push({ kind: 'click', label: `Click “${name}”${what ? ' ' + what : ''}`, target }, el);
  };

  private onChange = (ev: Event) => {
    if (!this.recording() || this.paused()) return;
    const el = ev.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (!el || !(el instanceof Element) || el.closest(IGNORE)) return;
    if (!el.matches('input, textarea, select')) return;
    const target = this.describe(el);
    const field = target.label || target.aria || target.placeholder || target.name || 'a field';
    const type = (el as HTMLInputElement).type;
    if (type === 'file') {
      this.push({ kind: 'click', label: `Choose a file for ${field}`, target, note: 'Welly can’t pick files: the person does this step' }, el);
      return;
    }
    if (type === 'checkbox' || type === 'radio') {
      const on = (el as HTMLInputElement).checked;
      const name = this.labelFor(el) || field;
      this.push({ kind: 'check', label: type === 'radio' ? `Pick “${name}”` : `${on ? 'Tick' : 'Untick'} “${name}”`, target, value: String(on) }, el);
      return;
    }
    const sensitive = type === 'password' || /cc-|one-time-code|password/.test(el.getAttribute('autocomplete') || '')
      || SENSITIVE.test(`${field} ${target.name ?? ''} ${target.id ?? ''} ${target.aria ?? ''}`);
    const value = el instanceof HTMLSelectElement ? el.value : el.value;
    const last = this.stepEls[this.stepEls.length - 1];
    const step: RecStep = sensitive
      ? { kind: 'fill', label: `Type into ${field}`, target, sensitive: true, input: { key: this.keyFor(field), label: field } }
      : { kind: el instanceof HTMLSelectElement ? 'select' : 'fill', label: `${el instanceof HTMLSelectElement ? 'Choose' : 'Type'} “${this.short(value)}” in ${field}`, target, value };
    this.push(step, el, last === el);
  };

  // ── Describing a control so it can be found again ──
  private describe(el: Element): RecTarget {
    const t: RecTarget = { tag: el.tagName.toLowerCase() };
    const w = el.closest('[data-welly]')?.getAttribute('data-welly'); if (w) t.welly = w;
    const id = el.id; if (id && !/^(mat-|cdk-|mdc-|ng-)|\d{2,}/.test(id)) t.id = id;
    const aria = el.getAttribute('aria-label'); if (aria) t.aria = aria.trim();
    const name = el.getAttribute('name') || el.getAttribute('formcontrolname'); if (name) t.name = name;
    const role = el.getAttribute('role'); if (role) t.role = role;
    const ph = el.getAttribute('placeholder'); if (ph) t.placeholder = ph;
    const type = el.getAttribute('type'); if (type) t.type = type;
    const label = this.fieldLabel(el); if (label) t.label = label;
    if (!el.matches('input, textarea, select, mat-select')) { const text = this.textOf(el); if (text) t.text = text; }
    t.css = this.cssPath(el);
    return t;
  }
  private fieldLabel(el: Element): string {
    const ff = el.closest('mat-form-field');
    const l = ff?.querySelector('mat-label, label') as HTMLElement | null;
    if (l?.innerText) return l.innerText.replace(/\*\s*$/, '').trim();
    if (el.id) { const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`) as HTMLElement | null; if (lab?.innerText) return lab.innerText.trim(); }
    return '';
  }
  private labelFor(el: Element): string {
    const host = el.closest('mat-checkbox, mat-radio-button, mat-slide-toggle, label');
    return host ? this.textOf(host) : '';
  }
  /** Visible text without Material icon ligatures ("add", "edit") mixed in. */
  textOf(el: Element): string {
    const c = el.cloneNode(true) as Element;
    c.querySelectorAll('mat-icon, .mat-icon, .material-icons, .material-symbols-outlined, svg').forEach(x => x.remove());
    return (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  }
  private cssPath(el: Element): string {
    const parts: string[] = [];
    let cur: Element | null = el;
    for (let i = 0; cur && i < 5 && cur !== document.body; i++, cur = cur.parentElement) {
      const tag = cur.tagName.toLowerCase();
      const parent: Element | null = cur.parentElement;
      const sibs = parent ? Array.from(parent.children).filter(c => c.tagName === cur!.tagName) : [];
      parts.unshift(sibs.length > 1 ? `${tag}:nth-of-type(${sibs.indexOf(cur) + 1})` : tag);
    }
    return parts.join(' > ');
  }
  private keyFor(label: string) { return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'value'; }
  private short(v: string) { return v.length > 40 ? v.slice(0, 40) + '…' : v; }

  // ════════════ Running (Suggest: Welly does a step only when the person clicks Do it) ════════════
  async startRun(task: RecordedTask) {
    if (this.recording()) this.discard();
    let runId: number | null = null;
    try { runId = (await firstValueFrom(this.http.post<{ id: number }>(`${this.base}/${task.id}/runs`, {}))).id; } catch { }
    const needs = task.steps.some(s => s.input);
    this.run.set({ task, runId, index: 0, phase: needs ? 'inputs' : 'step', inputs: {}, find: 'searching', states: task.steps.map(() => 'pending'), busy: false, auto: true, paused: false, countdown: null });
    if (!needs) this.locate();
  }
  /** Values asked for up front (one per input key). */
  runInputs(): { key: string; label: string; example?: string; sensitive?: boolean }[] {
    const r = this.run(); if (!r) return [];
    const seen = new Map<string, { key: string; label: string; example?: string; sensitive?: boolean }>();
    for (const s of r.task.steps) if (s.input && !seen.has(s.input.key)) seen.set(s.input.key, { key: s.input.key, label: s.input.label, example: s.sensitive ? undefined : s.value, sensitive: s.sensitive });
    return [...seen.values()];
  }
  setInputs(values: Record<string, string>) {
    this.patch({ inputs: values, phase: 'step' });
    this.locate();
  }
  valueFor(s: RecStep): string | undefined {
    const r = this.run();
    if (s.input) { const v = r?.inputs[s.input.key]; if (v !== undefined && v !== '') return v; }
    return s.sensitive ? undefined : s.value;
  }

  private patch(p: Partial<RunnerState>) { this.run.update(r => r ? { ...r, ...p } : r); }

  /** Find the current step's control (waiting a little for the page to render), then highlight it. */
  async locate() {
    const r = this.run(); if (!r || r.phase !== 'step') return;
    const step = r.task.steps[r.index]; if (!step) return;
    const token = ++this.findToken;
    this.foundEl = null; this.highlight.set(null);
    this.clearManual();
    if (step.kind === 'navigate') {
      if (this.samePage(step.url!)) { this.mark('skipped'); return; }
      this.patch({ find: 'found', message: undefined });
      this.autoNext(token);
      return;
    }
    if (step.target?.type === 'file' || (step.sensitive && !this.valueFor(step))) {
      const isFile = step.target?.type === 'file';
      this.patch({ find: 'manual', message: isFile
        ? 'The browser only lets you pick a file from your computer. Choose it and I’ll carry on by myself.'
        : 'I never type passwords or PINs. Type it in and I’ll carry on by myself.' });
      let el: Element | null = null;
      for (let i = 0; i < 12 && !el; i++) { el = this.find(step.target!); if (!el) await new Promise(res => setTimeout(res, 250)); if (token !== this.findToken) return; }
      // File inputs are usually hidden behind an Upload button: point at that.
      const shown = el && !this.visible(el) ? el.closest('label, button, [role=button], .upload, mat-form-field') ?? el.parentElement : el;
      this.highlightEl(shown);
      if (el) this.watchManual(el);
      if (shown) this.moveCursorTo(shown);
      return;
    }
    this.patch({ find: 'searching', message: undefined });
    for (let i = 0; i < 16; i++) {
      if (token !== this.findToken) return;
      const el = this.find(step.target!);
      if (el) { this.highlightEl(el); this.patch({ find: 'found' }); this.autoNext(token); return; }
      await new Promise(res => setTimeout(res, 250));
    }
    if (token === this.findToken) this.patch({ find: 'missing', message: `I can’t find this on the page. Do it yourself, then click Done and I’ll carry on.` });
  }

  private sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

  /** Autoplay: glide the cursor to the control, click, move on. Save / send / delete clicks get a 3-second countdown. */
  private async autoNext(token: number) {
    const live = () => { const r = this.run(); return !!r && r.auto && !r.paused && r.phase === 'step' && token === this.findToken; };
    if (!live()) return;
    const step = this.currentStep(); if (!step) return;
    if (step.kind !== 'navigate') {
      await this.sleep(380); // let the scroll settle
      if (!live() || !this.foundEl) return;
      this.moveCursorTo(this.foundEl);
      await this.sleep(700);
      if (!live()) return;
      if (this.risky()) {
        for (let n = 3; n > 0; n--) {
          this.patch({ countdown: n });
          await this.sleep(1000);
          if (!live()) { this.patch({ countdown: null }); return; }
        }
        this.patch({ countdown: null });
      }
      this.cursor.update(c => c ? { ...c, click: true } : c);
      await this.sleep(160);
      this.cursor.update(c => c ? { ...c, click: false } : c);
      if (!live()) return;
    } else {
      await this.sleep(300);
      if (!live()) return;
    }
    await this.doStep();
  }

  private moveCursorTo(el: Element) {
    const r = el.getBoundingClientRect();
    if (!this.cursor()) this.cursor.set({ x: window.innerWidth / 2, y: window.innerHeight - 120, click: false });
    // Next frame, so the first move animates from the start point.
    requestAnimationFrame(() => this.cursor.set({ x: r.left + Math.min(r.width / 2, 40), y: r.top + r.height / 2, click: false }));
  }

  /** File and password steps: carry on as soon as the person has done it. */
  private watchManual(el: Element) {
    const input = (el.matches('input, textarea') ? el : el.querySelector('input, textarea')) as HTMLInputElement | null;
    if (!input) return;
    const handler = () => {
      if (input.type !== 'file' && !input.value) return;
      if (input.type === 'file' && !(input.files && input.files.length)) return;
      this.clearManual();
      if (this.run()?.find === 'manual') this.mark('person');
    };
    input.addEventListener('change', handler);
    this.manualEl = input; this.manualListener = handler;
  }
  private clearManual() {
    if (this.manualEl && this.manualListener) this.manualEl.removeEventListener('change', this.manualListener);
    this.manualEl = null; this.manualListener = null;
  }

  pause() { this.findToken++; this.patch({ paused: true, countdown: null }); this.locateQuiet(); }
  resume() { this.patch({ paused: false, auto: true }); this.locate(); }
  /** Step by step: the person clicks Do it for each step (the old way). */
  setAuto(on: boolean) { this.findToken++; this.patch({ auto: on, paused: false, countdown: null }); this.locate(); }
  /** Re-find and highlight without acting (used when paused). */
  private async locateQuiet() {
    const step = this.currentStep(); if (!step || step.kind === 'navigate' || !step.target) return;
    const el = this.find(step.target); if (el) { this.highlightEl(el); this.patch({ find: 'found' }); }
  }

  private samePage(url: string) {
    const cur = this.router.url;
    return cur === url || cur.split('?')[0] === url.split('?')[0] && !url.includes('?');
  }

  private highlightEl(el: Element | null) {
    this.foundEl = el;
    if (!el) { this.highlight.set(null); return; }
    (el as HTMLElement).scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    setTimeout(() => this.refreshHighlight(), 350);
  }
  refreshHighlight() {
    if (!this.foundEl || !this.foundEl.isConnected) { this.highlight.set(null); return; }
    this.highlight.set(this.foundEl.getBoundingClientRect());
  }

  private visible(el: Element) { const r = (el as HTMLElement).getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.closest(IGNORE); }
  private norm(s: string | null | undefined) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

  /** Most stable clue first. Returns the first visible match. */
  find(t: RecTarget): Element | null {
    const pick = (els: ArrayLike<Element>) => { for (const e of Array.from(els)) if (this.visible(e)) return e; return null; };
    const all = (sel: string) => Array.from(document.querySelectorAll(sel));
    if (t.welly) { const e = pick(all(`[data-welly="${CSS.escape(t.welly)}"]`)); if (e) return e; }
    if (t.id) { const e = document.getElementById(t.id); if (e && this.visible(e)) return e; }
    const isField = t.tag === 'input' || t.tag === 'textarea' || t.tag === 'select' || t.tag === 'mat-select' || t.role === 'combobox';
    if (isField) {
      const fieldSel = t.tag === 'mat-select' || t.role === 'combobox' ? 'mat-select, [role=combobox]' : t.tag!;
      if (t.label) {
        const want = this.norm(t.label);
        for (const ff of all('mat-form-field')) {
          const l = ff.querySelector('mat-label, label') as HTMLElement | null;
          if (l && this.norm(l.innerText).replace(/\s*\*$/, '') === want) { const e = pick(ff.querySelectorAll(fieldSel)); if (e) return e; }
        }
        for (const lab of all('label[for]')) if (this.norm((lab as HTMLElement).innerText) === want) { const e = document.getElementById(lab.getAttribute('for')!); if (e && this.visible(e)) return e; }
      }
      if (t.name) { const e = pick(all(`${fieldSel}[name="${CSS.escape(t.name)}"], ${fieldSel}[formcontrolname="${CSS.escape(t.name)}"]`)); if (e) return e; }
      if (t.aria) { const e = pick(all(`${fieldSel}[aria-label="${CSS.escape(t.aria)}"]`)); if (e) return e; }
      if (t.placeholder) { const e = pick(all(`${fieldSel}[placeholder="${CSS.escape(t.placeholder)}"]`)); if (e) return e; }
    } else {
      const sel = t.role ? `[role="${t.role}"], ${t.tag}` : (t.tag || 'button');
      const cands = all(`${sel}, button, a, [role=button], [role=tab], [role=menuitem], [role=option], mat-option`).filter(e => this.visible(e));
      if (t.aria) { const e = cands.find(c => c.getAttribute('aria-label')?.trim() === t.aria); if (e) return e; }
      if (t.text) {
        const want = this.norm(t.text);
        const same = cands.filter(c => this.norm(this.textOf(c)) === want);
        const sameTag = same.find(c => c.tagName.toLowerCase() === t.tag);
        if (sameTag || same[0]) return sameTag || same[0];
      }
    }
    if (t.css) { try { const e = pick(all(t.css)); if (e && (!t.text || this.norm(this.textOf(e)) === this.norm(t.text))) return e; } catch { } }
    return null;
  }

  /** The person clicked Do it: Welly does this one step as them. */
  async doStep() {
    const r = this.run(); const step = this.currentStep(); if (!r || !step || r.busy) return;
    this.patch({ busy: true });
    try {
      if (step.kind === 'navigate') {
        await this.router.navigateByUrl(step.url!);
      } else {
        const el = this.foundEl && this.foundEl.isConnected ? this.foundEl : this.find(step.target!);
        if (!el) { this.patch({ busy: false, find: 'missing', message: 'That control has gone. Do it yourself, then click Done.' }); return; }
        const ok = await this.perform(step, el);
        if (!ok) { this.patch({ busy: false, find: 'missing', message: `I couldn’t do that one. Do it yourself, then click Done.` }); return; }
      }
      this.patch({ busy: false });
      this.mark('welly');
    } catch {
      this.patch({ busy: false, find: 'missing', message: 'Something went wrong. Do it yourself, then click Done.' });
    }
  }

  private async perform(step: RecStep, el: Element): Promise<boolean> {
    const value = this.valueFor(step) ?? '';
    switch (step.kind) {
      case 'click': (el as HTMLElement).click(); return true;
      case 'check': {
        const box = (el.matches('input') ? el : el.querySelector('input')) as HTMLInputElement | null;
        if (!box) { (el as HTMLElement).click(); return true; }
        const want = value === 'true' || box.type === 'radio';
        if (box.checked !== want) box.click();
        return true;
      }
      case 'fill': {
        const input = (el.matches('input, textarea') ? el : el.querySelector('input, textarea')) as HTMLInputElement | HTMLTextAreaElement | null;
        if (!input) return false;
        input.focus();
        const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
        const delay = value.length ? Math.min(35, 900 / value.length) : 0;
        if (delay >= 8 && value.length <= 120) {
          for (let i = 1; i <= value.length; i++) {
            setter.call(input, value.slice(0, i));
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await this.sleep(delay);
          }
        } else setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        return true;
      }
      case 'select': {
        if (el instanceof HTMLSelectElement) {
          const opt = Array.from(el.options).find(o => o.value === value || this.norm(o.text) === this.norm(value));
          if (!opt) return false;
          el.value = opt.value; el.dispatchEvent(new Event('change', { bubbles: true })); return true;
        }
        (el as HTMLElement).click();
        for (let i = 0; i < 12; i++) {
          await new Promise(res => setTimeout(res, 120));
          const opt = Array.from(document.querySelectorAll('mat-option, [role=option]')).find(o => this.norm(this.textOf(o)) === this.norm(value));
          if (opt) { (opt as HTMLElement).click(); return true; }
        }
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return false;
      }
    }
    return false;
  }

  /** The person did this step themselves (or Welly couldn't find it). */
  personDid() { this.mark('person'); }
  retry() { this.locate(); }

  private mark(state: RunStepState) {
    const r = this.run(); if (!r) return;
    const states = [...r.states]; states[r.index] = state;
    const next = r.index + 1;
    this.foundEl = null; this.highlight.set(null);
    if (next >= r.task.steps.length) {
      this.cursor.set(null);
      this.run.set({ ...r, states, phase: 'done', index: next });
      this.finish('completed');
      return;
    }
    this.run.set({ ...r, states, index: next, find: 'searching', message: undefined });
    // Let the page react to the last step (dialogs open, routes change) before looking for the next control.
    setTimeout(() => this.locate(), 450);
  }

  stopRun(reason = 'Stopped by the person') {
    const r = this.run(); if (!r) return;
    if (r.phase !== 'done') this.finish('stopped', reason);
    this.closeRun();
  }
  closeRun() { this.findToken++; this.clearManual(); this.run.set(null); this.foundEl = null; this.highlight.set(null); this.cursor.set(null); }

  private finish(outcome: 'completed' | 'stopped', reason?: string) {
    const r = this.run(); if (!r?.runId) return;
    const byWelly = r.states.filter(s => s === 'welly').length, byPerson = r.states.filter(s => s === 'person').length;
    this.http.put(`${this.base}/runs/${r.runId}`, {
      outcome, stepsByWelly: byWelly, stepsByPerson: byPerson,
      stoppedAtStep: outcome === 'stopped' ? r.index + 1 : null, stopReason: reason ?? null
    }).subscribe({ error: () => { } });
  }
}
