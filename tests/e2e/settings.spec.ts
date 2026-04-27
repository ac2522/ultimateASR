import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { launchApp } from "./helpers";

test("auto-paste toggle persists to settings.json on disk", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ultimateasr-e2e-"));
  const settingsPath = path.join(userDataDir, "settings.json");

  // First launch: toggle auto_paste on, expect settings.json to reflect it.
  const first = await launchApp({ userDataDir });
  try {
    await first.window.getByRole("link", { name: /settings/i }).click();
    const toggle = first.window.getByRole("switch", { name: /auto.paste/i });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("data-state", "unchecked");
    await toggle.click();
    await expect(toggle).toHaveAttribute("data-state", "checked");

    // Wait for settings.json to be written by the fake sidecar.
    await expect.poll(() => {
      if (!fs.existsSync(settingsPath)) return null;
      try {
        return JSON.parse(fs.readFileSync(settingsPath, "utf8")).auto_paste;
      } catch { return null; }
    }, { timeout: 5_000 }).toBe(true);
  } finally {
    // Don't delete the userDataDir between launches; we re-use it.
    try { await first.app.close(); } catch { /* noop */ }
  }

  // Second launch with same userDataDir: toggle should still show checked.
  const second = await launchApp({ userDataDir });
  try {
    await second.window.getByRole("link", { name: /settings/i }).click();
    const toggle = second.window.getByRole("switch", { name: /auto.paste/i });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("data-state", "checked");
  } finally {
    await second.cleanup();
  }
});
