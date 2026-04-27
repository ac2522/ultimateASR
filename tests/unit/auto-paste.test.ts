import { describe, it, expect, vi } from "vitest";

vi.mock("electron", () => ({
  clipboard: { writeText: vi.fn() },
}));

import { pasteText } from "@main/auto-paste";
import { clipboard } from "electron";

describe("pasteText", () => {
  it("copies to clipboard then invokes xdotool on Linux", async () => {
    const spawn = vi.fn().mockResolvedValue({ stdout: "", stderr: "", code: 0 });
    await pasteText("hello", { platform: "linux", spawn });
    expect((clipboard.writeText as any)).toHaveBeenCalledWith("hello");
    expect(spawn).toHaveBeenCalledWith("xdotool", expect.arrayContaining(["type", "--", "hello"]));
  });

  it("falls back to wtype if xdotool fails on Linux", async () => {
    const spawn = vi.fn()
      .mockResolvedValueOnce({ stdout: "", stderr: "", code: 1 })
      .mockResolvedValueOnce({ stdout: "", stderr: "", code: 0 });
    await pasteText("hi", { platform: "linux", spawn });
    expect(spawn.mock.calls[0][0]).toBe("xdotool");
    expect(spawn.mock.calls[1][0]).toBe("wtype");
  });

  it("invokes osascript on darwin with escaped quotes", async () => {
    const spawn = vi.fn().mockResolvedValue({ stdout: "", stderr: "", code: 0 });
    await pasteText('say "hi"', { platform: "darwin", spawn });
    const args = spawn.mock.calls[0][1] as string[];
    expect(spawn.mock.calls[0][0]).toBe("osascript");
    expect(args.some(a => a.includes("keystroke"))).toBe(true);
    expect(args.some(a => a.includes('\\"hi\\"'))).toBe(true);
  });

  it("invokes powershell SendKeys on win32 with escaped single quotes", async () => {
    const spawn = vi.fn().mockResolvedValue({ stdout: "", stderr: "", code: 0 });
    await pasteText("it's fine", { platform: "win32", spawn });
    expect(spawn.mock.calls[0][0]).toBe("powershell.exe");
    const cmd = (spawn.mock.calls[0][1] as string[]).join(" ");
    expect(cmd).toContain("it''s fine");
  });

  it("does not throw if spawn fails — auto-paste is best-effort", async () => {
    const spawn = vi.fn().mockRejectedValue(new Error("ENOENT"));
    await expect(pasteText("hi", { platform: "linux", spawn })).resolves.toBeUndefined();
  });
});
