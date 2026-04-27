import { describe, it, expect, vi } from "vitest";

vi.mock("electron", () => ({
  globalShortcut: {
    register: vi.fn(() => true),
    unregister: vi.fn(),
    unregisterAll: vi.fn(),
    isRegistered: vi.fn(() => false),
  },
}));

import { createHotkeyController } from "@main/hotkey";

describe("hotkey", () => {
  it("uses globalShortcut on non-Wayland linux/win/mac", () => {
    const reg = vi.fn(() => true);
    const unreg = vi.fn();
    const ctrl = createHotkeyController({
      globalShortcut: { register: reg, unregister: unreg, unregisterAll: vi.fn(), isRegistered: () => false } as any,
      isWayland: () => false,
    });
    const ok = ctrl.register("Ctrl+Alt+Shift+L", () => {});
    expect(ok).toBe(true);
    expect(reg).toHaveBeenCalledWith("Ctrl+Alt+Shift+L", expect.any(Function));
  });

  it("uses evdev fallback on Wayland", () => {
    const fallback = vi.fn(() => vi.fn());
    const ctrl = createHotkeyController({
      globalShortcut: undefined,
      isWayland: () => true,
      evdevFallback: fallback,
    });
    const ok = ctrl.register("Ctrl+Alt+Shift+L", () => {});
    expect(ok).toBe(true);
    expect(fallback).toHaveBeenCalled();
  });

  it("unregisterAll cleans up both backends", () => {
    const reg = vi.fn(() => true);
    const unregAll = vi.fn();
    const teardown = vi.fn();
    const fallback = vi.fn(() => teardown);
    const c1 = createHotkeyController({
      globalShortcut: { register: reg, unregister: vi.fn(), unregisterAll: unregAll, isRegistered: () => false } as any,
      isWayland: () => false,
    });
    c1.register("Ctrl+Alt+Shift+L", () => {});
    c1.unregisterAll();
    expect(unregAll).toHaveBeenCalled();

    const c2 = createHotkeyController({ isWayland: () => true, evdevFallback: fallback });
    c2.register("Ctrl+Alt+Shift+L", () => {});
    c2.unregisterAll();
    expect(teardown).toHaveBeenCalled();
  });
});
