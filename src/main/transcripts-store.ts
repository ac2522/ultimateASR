import fs from "node:fs";
import path from "node:path";
import { TranscriptSchema, type Transcript } from "@shared/transcript";

export interface TranscriptsStoreOpts {
  filePath: string; // absolute path to transcripts.json
  maxEntries?: number; // default 10
}

/**
 * Persistent ring of the most recent transcripts. Backed by a JSON file
 * written via atomic rename so a crash mid-write can never produce a
 * truncated file. Reads are tolerant of missing or corrupted files — both
 * silently degrade to an empty list.
 */
export class TranscriptsStore {
  private readonly filePath: string;
  private readonly maxEntries: number;
  private items: Transcript[] = [];

  constructor(opts: TranscriptsStoreOpts) {
    this.filePath = opts.filePath;
    this.maxEntries = opts.maxEntries ?? 10;
    this.reload();
  }

  list(): Transcript[] {
    // Defensive copy so callers can't mutate the in-memory ring.
    return this.items.slice();
  }

  add(t: Transcript): void {
    const parsed = TranscriptSchema.parse(t);
    this.items.unshift(parsed);
    if (this.items.length > this.maxEntries) {
      this.items.length = this.maxEntries;
    }
    this.persist();
  }

  clear(): void {
    this.items = [];
    this.persist();
  }

  reload(): void {
    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.items = [];
        return;
      }
      const out: Transcript[] = [];
      for (const entry of parsed) {
        const r = TranscriptSchema.safeParse(entry);
        if (r.success) out.push(r.data);
      }
      this.items = out.slice(0, this.maxEntries);
    } catch {
      // Missing file or invalid JSON — start fresh; do not throw.
      this.items = [];
    }
  }

  private persist(): void {
    const dir = path.dirname(this.filePath);
    try { fs.mkdirSync(dir, { recursive: true }); } catch { /* dir may already exist */ }
    const tmp = this.filePath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.items), "utf8");
    fs.renameSync(tmp, this.filePath);
  }
}
