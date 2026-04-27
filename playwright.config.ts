import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  // Electron tests must run serially: each spawns its own Electron instance,
  // and parallel runs would compete for clipboard/tray/global-hotkey resources.
  workers: 1,
  fullyParallel: false,
  use: { trace: "retain-on-failure" },
});
