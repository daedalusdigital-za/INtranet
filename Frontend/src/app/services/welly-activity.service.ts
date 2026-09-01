import { Injectable, signal, computed } from '@angular/core';

export interface WellyTask {
  id: number;
  label: string;
  startedAt: number;
}

/**
 * Global registry of in-flight Welly tasks.
 *
 * Any feature that kicks off AI work (chat replies, supplier analysis,
 * invoice matching, etc.) should call `start(label)` and keep the returned
 * id, then call `stop(id)` when finished (success OR failure). The navbar
 * shows a "Welly is working…" indicator whenever at least one task is active.
 */
@Injectable({ providedIn: 'root' })
export class WellyActivityService {
  private _tasks = signal<WellyTask[]>([]);
  private nextId = 1;

  /** All currently-active tasks. */
  readonly tasks = this._tasks.asReadonly();

  /** True when Welly is doing anything anywhere in the app. */
  readonly isBusy = computed(() => this._tasks().length > 0);

  /** How many tasks are running right now. */
  readonly count = computed(() => this._tasks().length);

  /** A short label for the indicator (most recent task, + "(+N more)"). */
  readonly primaryLabel = computed(() => {
    const t = this._tasks();
    if (t.length === 0) return '';
    const latest = t[t.length - 1].label;
    return t.length === 1 ? latest : `${latest} (+${t.length - 1} more)`;
  });

  /** Begin a task; returns an id to pass back to stop(). */
  start(label: string): number {
    const id = this.nextId++;
    this._tasks.update(list => [...list, { id, label, startedAt: Date.now() }]);
    return id;
  }

  /** End a task by id. Safe to call multiple times. */
  stop(id: number): void {
    this._tasks.update(list => list.filter(t => t.id !== id));
  }

  /** Convenience for one-off async work: auto start/stop around a promise. */
  async track<T>(label: string, work: () => Promise<T>): Promise<T> {
    const id = this.start(label);
    try {
      return await work();
    } finally {
      this.stop(id);
    }
  }

  /** Emergency clear (e.g. on logout). */
  clear(): void {
    this._tasks.set([]);
  }
}
