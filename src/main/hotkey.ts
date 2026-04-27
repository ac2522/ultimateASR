import { globalShortcut as electronGlobalShortcut } from "electron";

/**
 * Hotkey controller — registers OS-global shortcuts.
 *
 * Strategy:
 *  - Non-Wayland (X11, Windows, macOS): use Electron's globalShortcut API.
 *  - Wayland: globalShortcut.register() returns false (Wayland doesn't expose
 *    a portable shortcut API). Fall back to an injected evdev-based path,
 *    which the sidecar will eventually provide.
 *
 * The evdevFallback dependency is intentionally a function returning a
 * teardown so the test can stub it without reaching real /dev/input/* devices.
 */

export interface HotkeyController {
  register(accelerator: string, cb: () => void): boolean;
  unregister(accelerator: string): void;
  unregisterAll(): void;
}

type GlobalShortcutLike = Pick<
  typeof Electron.globalShortcut,
  "register" | "unregister" | "unregisterAll" | "isRegistered"
>;

export interface HotkeyDeps {
  globalShortcut?: GlobalShortcutLike;
  isWayland?: () => boolean;
  evdevFallback?: (accelerator: string, cb: () => void) => () => void;
}

function defaultIsWayland(): boolean {
  if (process.platform !== "linux") return false;
  const t = process.env.XDG_SESSION_TYPE;
  return !!t && t.toLowerCase().includes("wayland");
}

export function createHotkeyController(deps: HotkeyDeps = {}): HotkeyController {
  const isWayland = deps.isWayland ?? defaultIsWayland;
  // Only resolve the real Electron globalShortcut lazily so test environments
  // without an Electron instance running can supply a stub via deps.
  const gs = deps.globalShortcut ?? (electronGlobalShortcut as unknown as GlobalShortcutLike | undefined);
  const evdev = deps.evdevFallback;

  // Track which backend handled which accelerator so we can dispose precisely.
  const gsRegistered = new Set<string>();
  const evdevTeardowns = new Map<string, () => void>();

  return {
    register(accelerator, cb) {
      if (isWayland()) {
        if (!evdev) return false;
        const teardown = evdev(accelerator, cb);
        evdevTeardowns.set(accelerator, teardown);
        return true;
      }
      if (!gs) return false;
      const ok = gs.register(accelerator, cb);
      if (ok) gsRegistered.add(accelerator);
      return ok;
    },
    unregister(accelerator) {
      const td = evdevTeardowns.get(accelerator);
      if (td) {
        try { td(); } catch { /* best-effort */ }
        evdevTeardowns.delete(accelerator);
      }
      if (gsRegistered.has(accelerator) && gs) {
        try { gs.unregister(accelerator); } catch { /* best-effort */ }
        gsRegistered.delete(accelerator);
      }
    },
    unregisterAll() {
      for (const td of evdevTeardowns.values()) {
        try { td(); } catch { /* best-effort */ }
      }
      evdevTeardowns.clear();
      if (gsRegistered.size > 0 && gs) {
        try { gs.unregisterAll(); } catch { /* best-effort */ }
        gsRegistered.clear();
      }
    },
  };
}
