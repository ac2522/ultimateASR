import path from "node:path";
import url from "node:url";

export interface SidecarLaunch {
  command: string;
  args: string[];
  cwd: string;
}

/**
 * Resolves how to launch the sidecar.
 *
 * Precedence:
 *   1. `ULTIMATEASR_E2E_SIDECAR` — a Node script run with the current node
 *      executable. Used by Playwright to inject a fake sidecar.
 *   2. `ULTIMATEASR_PYTHON` (or `python3`) running `-m ultimate_asr` from the
 *      `sidecar/` source dir. The `cwd` is critical — without it the system
 *      Python cannot find the package and exits with `No module named
 *      ultimate_asr`, leaving every sidecar RPC hanging.
 */
export function resolveSidecarCommand(env: NodeJS.ProcessEnv = process.env, execPath = process.execPath): SidecarLaunch {
  const e2e = env.ULTIMATEASR_E2E_SIDECAR;
  if (e2e) {
    return { command: execPath, args: [e2e], cwd: path.dirname(e2e) };
  }
  return {
    command: env.ULTIMATEASR_PYTHON || "python3",
    args: ["-m", "ultimate_asr"],
    cwd: sidecarSourceDir(),
  };
}

function sidecarSourceDir(): string {
  // Built main lives at `dist-electron/main/index.cjs`; the source sidecar is at
  // `<repo>/sidecar/`. Climb out of dist-electron to find it.
  const here = typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(url.fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..", "sidecar");
}
