import { describe, it, expect } from "vitest";
import path from "node:path";
import url from "node:url";
import { Sidecar } from "@main/sidecar";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const FAKE = path.resolve(here, "fixtures/fake-sidecar.mjs");

describe("Sidecar", () => {
  it("round-trips a request", async () => {
    const sc = new Sidecar({ command: process.execPath, args: [FAKE] });
    await sc.start();
    const r = await sc.call("ping", {});
    expect(r).toBe("pong");
    await sc.stop();
  });
  it("rejects on RPC error", async () => {
    const sc = new Sidecar({ command: process.execPath, args: [FAKE] });
    await sc.start();
    await expect(sc.call("missing", {})).rejects.toThrow(/not found/);
    await sc.stop();
  });
  it("relays notifications via the notify event", async () => {
    const sc = new Sidecar({ command: process.execPath, args: [FAKE] });
    const seen: any[] = [];
    sc.on("notify", (m, p) => seen.push([m, p]));
    await sc.start();
    await sc.call("emit", { method: "progress", params: { percent: 42 } });
    // wait a tick for the notification to arrive
    await new Promise(r => setTimeout(r, 50));
    expect(seen).toContainEqual(["progress", { percent: 42 }]);
    await sc.stop();
  });
});
