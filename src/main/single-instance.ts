import type { App } from "electron";

export interface SingleInstanceResult {
  isPrimary: boolean;
}

/** Acquire the single-instance lock; if we're a duplicate, request the existing
 *  instance to focus its window and return isPrimary=false so the caller can quit. */
export function acquireOrFocus(app: App, onSecondInstance: () => void): SingleInstanceResult {
  const got = app.requestSingleInstanceLock();
  if (!got) return { isPrimary: false };
  app.on("second-instance", onSecondInstance);
  return { isPrimary: true };
}
