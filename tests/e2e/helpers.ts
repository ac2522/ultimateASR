import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import url from "node:url";
import { _electron as electron, type ElectronApplication, type Page } from "@playwright/test";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, "..", "..");
const FAKE_SIDECAR = path.resolve(here, "fixtures", "fake-sidecar-e2e.mjs");
const MAIN_ENTRY = path.resolve(REPO_ROOT, "dist-electron", "main", "index.cjs");

export interface LaunchOpts {
  userDataDir?: string;
  initialSettings?: Record<string, unknown>;
}

export interface LaunchResult {
  app: ElectronApplication;
  window: Page;
  userDataDir: string;
  cleanup: () => Promise<void>;
}

export async function launchApp(opts: LaunchOpts = {}): Promise<LaunchResult> {
  const userDataDir = opts.userDataDir
    ?? fs.mkdtempSync(path.join(os.tmpdir(), "ultimateasr-e2e-"));

  if (opts.initialSettings) {
    fs.writeFileSync(
      path.join(userDataDir, "settings.json"),
      JSON.stringify(opts.initialSettings, null, 2),
    );
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ULTIMATEASR_DATA_DIR: userDataDir,
    ULTIMATEASR_E2E_SIDECAR: FAKE_SIDECAR,
    NODE_ENV: "test",
    // Override the userData path so transcripts.json + settings live in our tmpdir.
    ULTIMATEASR_USER_DATA_DIR: userDataDir,
  };

  const app = await electron.launch({
    args: [MAIN_ENTRY, `--user-data-dir=${userDataDir}`],
    env,
    timeout: 30_000,
  });
  const window = await app.firstWindow();
  await window.waitForLoadState("domcontentloaded");

  return {
    app, window, userDataDir,
    cleanup: async () => {
      try { await app.close(); } catch { /* noop */ }
      try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* noop */ }
    },
  };
}
