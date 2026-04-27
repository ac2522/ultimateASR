import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { TranscriptsStore } from "@main/transcripts-store";

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ultimateasr-test-"));
});

const t = (id: string, text: string, at = Date.now()) => ({
  id, at, text, engine: "whisper-local",
});

describe("TranscriptsStore", () => {
  it("starts empty when no file exists", () => {
    const s = new TranscriptsStore({ filePath: path.join(tmp, "transcripts.json") });
    expect(s.list()).toEqual([]);
  });

  it("add prepends newest first", () => {
    const s = new TranscriptsStore({ filePath: path.join(tmp, "tx.json") });
    s.add(t("a", "first", 1));
    s.add(t("b", "second", 2));
    expect(s.list().map(x => x.id)).toEqual(["b", "a"]);
  });

  it("caps at maxEntries (default 10)", () => {
    const s = new TranscriptsStore({ filePath: path.join(tmp, "tx.json") });
    for (let i = 0; i < 15; i++) s.add(t(`id${i}`, `text ${i}`, i));
    expect(s.list().length).toBe(10);
    expect(s.list()[0].id).toBe("id14");
    expect(s.list()[9].id).toBe("id5");
  });

  it("persists across restart", () => {
    const fp = path.join(tmp, "tx.json");
    const s1 = new TranscriptsStore({ filePath: fp });
    s1.add(t("x", "hello"));
    const s2 = new TranscriptsStore({ filePath: fp });
    expect(s2.list()).toEqual(s1.list());
  });

  it("clear empties and persists", () => {
    const fp = path.join(tmp, "tx.json");
    const s = new TranscriptsStore({ filePath: fp });
    s.add(t("a", "x"));
    s.clear();
    expect(s.list()).toEqual([]);
    const s2 = new TranscriptsStore({ filePath: fp });
    expect(s2.list()).toEqual([]);
  });

  it("ignores corrupted JSON gracefully", () => {
    const fp = path.join(tmp, "tx.json");
    fs.writeFileSync(fp, "not json");
    const s = new TranscriptsStore({ filePath: fp });
    expect(s.list()).toEqual([]);
  });

  it("rejects malformed transcripts via add()", () => {
    const s = new TranscriptsStore({ filePath: path.join(tmp, "tx.json") });
    expect(() => s.add({ id: 1, at: "now", text: 2, engine: null } as any)).toThrow();
  });
});
