import { describe, it, expect } from "vitest";
import path from "node:path";
import { resolveSidecarCommand } from "@main/sidecar-resolve";

const repoRoot = path.resolve(__dirname, "..", "..");
const sidecarDir = path.join(repoRoot, "sidecar");

describe("resolveSidecarCommand", () => {
  it("uses python3 from the sidecar source dir so `-m ultimate_asr` resolves", () => {
    const r = resolveSidecarCommand({});
    expect(r.command).toBe("python3");
    expect(r.args).toEqual(["-m", "ultimate_asr"]);
    expect(r.cwd).toBe(sidecarDir);
  });

  it("honours ULTIMATEASR_PYTHON for venv use", () => {
    const r = resolveSidecarCommand({ ULTIMATEASR_PYTHON: "/opt/py/bin/python" });
    expect(r.command).toBe("/opt/py/bin/python");
    expect(r.cwd).toBe(sidecarDir);
  });

  it("ULTIMATEASR_E2E_SIDECAR overrides everything and runs the script with node", () => {
    const r = resolveSidecarCommand(
      { ULTIMATEASR_E2E_SIDECAR: "/tmp/fake.mjs" },
      "/usr/bin/node",
    );
    expect(r.command).toBe("/usr/bin/node");
    expect(r.args).toEqual(["/tmp/fake.mjs"]);
    expect(r.cwd).toBe("/tmp");
  });
});
