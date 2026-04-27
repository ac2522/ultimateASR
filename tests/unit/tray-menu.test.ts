import { describe, it, expect, vi } from "vitest";

vi.mock("electron", () => ({
  clipboard: { writeText: vi.fn() },
}));

import { buildMenu } from "@main/tray";
import type { Transcript } from "@shared/transcript";

const tx = (i: number, text: string): Transcript => ({
  id: `t${i}`, at: i, text, engine: "whisper-local",
});

describe("buildMenu", () => {
  it("includes status, settings, toggle, recent submenu (with up to 10 entries), and quit", () => {
    const transcripts: Transcript[] = Array.from({ length: 12 }, (_, i) => tx(i, `text ${i}`));
    const menu = buildMenu("idle", transcripts);
    const labels = menu.map((m) => m.label);
    expect(labels).toContain("Status: Idle");
    expect(labels).toContain("Open settings");
    expect(labels).toContain("Toggle recording");
    expect(labels).toContain("Recent transcripts");
    expect(labels).toContain("Quit");

    const recent = menu.find((m) => m.label === "Recent transcripts");
    expect(Array.isArray(recent?.submenu)).toBe(true);
    expect((recent!.submenu as any[]).length).toBe(10);

    // Newest first
    const firstLabel = (recent!.submenu as any[])[0].label as string;
    expect(firstLabel.startsWith("text 11")).toBe(true);
  });

  it("status label changes with state", () => {
    expect(buildMenu("recording", []).find(m => m.label?.toString().startsWith("Status:"))?.label)
      .toBe("Status: Recording");
  });

  it("recent submenu shows empty placeholder when no transcripts", () => {
    const menu = buildMenu("idle", []);
    const recent = menu.find((m) => m.label === "Recent transcripts");
    expect((recent!.submenu as any[])[0].label).toBe("(no transcripts yet)");
    expect((recent!.submenu as any[])[0].enabled).toBe(false);
  });
});
