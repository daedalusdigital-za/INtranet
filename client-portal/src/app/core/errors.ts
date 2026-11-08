import { ValidationProblem } from './models';

/** Turns an API error into one sentence the client can act on. */
export function messageFor(e: unknown, fallback = 'Something went wrong. Try again, or contact us if it keeps happening.'): string {
  const status = (e as { status?: number })?.status;
  if (status === 0) return 'Can’t reach the server. Check your connection and try again.';
  if (status === 403) return 'Your account doesn’t have access to this.';
  if (status === 404) return 'This shipment isn’t on your account, or it no longer exists.';
  if (status === 409) return 'This shipment has moved on since you opened it. Refresh to see its current status.';
  if (status === 429) return 'Too many attempts. Wait a minute and try again.';
  return fallback;
}

export function problemsFrom(e: unknown): ValidationProblem[] {
  const err = (e as { status?: number; error?: { problems?: ValidationProblem[] } });
  return err?.status === 422 && err.error?.problems ? err.error.problems : [];
}
