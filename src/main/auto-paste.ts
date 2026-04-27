import { spawn as nodeSpawn } from "node:child_process";
import { clipboard } from "electron";

export interface SpawnResult {
  stdout: string;
  stderr: string;
  code: number;
}

export type SpawnFn = (cmd: string, args: string[]) => Promise<SpawnResult>;

export interface PasteOpts {
  platform?: NodeJS.Platform;
  spawn?: SpawnFn;
}

const defaultSpawn: SpawnFn = (cmd, args) =>
  new Promise<SpawnResult>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const p = nodeSpawn(cmd, args);
    p.stdout?.on("data", (b: Buffer) => {
      stdout += b.toString();
    });
    p.stderr?.on("data", (b: Buffer) => {
      stderr += b.toString();
    });
    p.on("error", reject);
    p.on("exit", (code) => resolve({ stdout, stderr, code: code ?? -1 }));
  });

/**
 * Cross-platform "paste at the focused window" helper.
 *
 * Strategy:
 *  1. Always copy the text to the system clipboard first — this is the safety net.
 *     Even if the synthetic keystroke fails, the user can manually paste.
 *  2. Synthesize a typing event so the text actually lands in the focused app
 *     without requiring the user to press Ctrl+V.
 *
 * Per platform:
 *  - linux: prefer `xdotool type` (X11). On Wayland, xdotool returns non-zero;
 *    fall back to `wtype`. If both are missing, swallow the error — clipboard wins.
 *  - darwin: `osascript` driving System Events to send keystrokes.
 *  - win32: PowerShell + `[System.Windows.Forms.SendKeys]::SendWait`.
 *
 * All errors are swallowed: auto-paste is best-effort, not a hard contract.
 */
export async function pasteText(text: string, opts: PasteOpts = {}): Promise<void> {
  try {
    clipboard.writeText(text);
  } catch {
    /* clipboard may be unavailable in headless test envs */
  }

  const platform = opts.platform ?? process.platform;
  const sp = opts.spawn ?? defaultSpawn;

  try {
    if (platform === "linux") {
      const r = await sp("xdotool", ["type", "--", text]).catch(
        () => ({ code: -1, stdout: "", stderr: "" }) as SpawnResult,
      );
      if (r.code !== 0) {
        await sp("wtype", [text]).catch(() => {
          /* both backends missing — clipboard remains the fallback */
        });
      }
      return;
    }

    if (platform === "darwin") {
      // Escape backslashes first, then double-quotes — order matters
      // because the second pass would otherwise re-escape the slashes we add.
      const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      await sp("osascript", [
        "-e",
        `tell application "System Events" to keystroke "${escaped}"`,
      ]);
      return;
    }

    if (platform === "win32") {
      // PowerShell single-quoted string: escape `'` by doubling.
      const escaped = text.replace(/'/g, "''");
      await sp("powershell.exe", [
        "-NoProfile",
        "-Command",
        `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')`,
      ]);
      return;
    }
  } catch {
    /* best-effort — clipboard is already populated */
  }
}
