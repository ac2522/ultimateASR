import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { launchApp } from "./helpers";

test("dictionary entry add → persist across relaunches → remove", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ultimateasr-e2e-"));
  const settingsPath = path.join(userDataDir, "settings.json");

  // First launch: add SDLT entry via the dictionary UI.
  const first = await launchApp({ userDataDir });
  try {
    await first.window.getByRole("link", { name: /dictionary/i }).click();
    await first.window.getByPlaceholder(/word or phrase/i).fill("SDLT");
    await first.window.getByRole("button", { name: /^add$/i }).click();
    await expect(first.window.getByText("SDLT", { exact: true })).toBeVisible();

    await expect.poll(() => {
      if (!fs.existsSync(settingsPath)) return null;
      try {
        const v = JSON.parse(fs.readFileSync(settingsPath, "utf8")).custom_vocabulary;
        return Array.isArray(v) ? v : null;
      } catch { return null; }
    }, { timeout: 5_000 }).toContain("SDLT");
  } finally {
    try { await first.app.close(); } catch { /* noop */ }
  }

  // Second launch: SDLT should still be there.
  const second = await launchApp({ userDataDir });
  try {
    await second.window.getByRole("link", { name: /dictionary/i }).click();
    await expect(second.window.getByText("SDLT", { exact: true })).toBeVisible();

    // Remove via the X button on the badge, confirm it disappears + persists.
    await second.window.getByRole("button", { name: /remove sdlt/i }).click();
    await expect(second.window.getByText("SDLT", { exact: true })).toHaveCount(0);

    await expect.poll(() => {
      if (!fs.existsSync(settingsPath)) return null;
      try {
        const v = JSON.parse(fs.readFileSync(settingsPath, "utf8")).custom_vocabulary;
        return Array.isArray(v) ? v : null;
      } catch { return null; }
    }, { timeout: 5_000 }).not.toContain("SDLT");
  } finally {
    try { await second.app.close(); } catch { /* noop */ }
  }

  // Third launch (clean teardown): SDLT remains absent.
  const third = await launchApp({ userDataDir });
  try {
    await third.window.getByRole("link", { name: /dictionary/i }).click();
    await expect(third.window.getByText("SDLT", { exact: true })).toHaveCount(0);
  } finally {
    await third.cleanup();
  }
});
