import { test, expect } from "@playwright/test";
import { launchApp } from "./helpers";

test("app launches and renders sidebar with all five links", async () => {
  const { window, cleanup } = await launchApp();
  try {
    await expect(window).toHaveTitle(/ultimateASR/i);
    for (const label of ["Home", "Settings", "Models", "Dictionary", "Cloud & LLM"]) {
      await expect(window.getByText(label, { exact: true }).first()).toBeVisible();
    }
  } finally {
    await cleanup();
  }
});

test("sidecar ping returns pong (preload bridge works)", async () => {
  const { window, cleanup } = await launchApp();
  try {
    const pong = await window.evaluate(() => (window as unknown as { api: { ping: () => Promise<string> } }).api.ping());
    expect(pong).toBe("pong");
  } finally {
    await cleanup();
  }
});
