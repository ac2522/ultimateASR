import { describe, it, expect, vi } from "vitest";
import { acquireOrFocus } from "@main/single-instance";

function fakeApp(gotLock: boolean) {
  const handlers: Record<string, Function> = {};
  return {
    requestSingleInstanceLock: vi.fn(() => gotLock),
    on: vi.fn((evt: string, cb: Function) => { handlers[evt] = cb; return this; }),
    fire: (evt: string, ...args: any[]) => handlers[evt]?.(...args),
  } as any;
}

describe("acquireOrFocus", () => {
  it("returns isPrimary=true and registers second-instance handler when lock is acquired", () => {
    const app = fakeApp(true);
    const onSecond = vi.fn();
    const res = acquireOrFocus(app, onSecond);
    expect(res.isPrimary).toBe(true);
    app.fire("second-instance");
    expect(onSecond).toHaveBeenCalled();
  });
  it("returns isPrimary=false when lock not acquired", () => {
    const app = fakeApp(false);
    const res = acquireOrFocus(app, () => {});
    expect(res.isPrimary).toBe(false);
  });
});
