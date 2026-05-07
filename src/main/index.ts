import { app, BrowserWindow, clipboard } from "electron";
import path from "node:path";
import { Sidecar } from "./sidecar";
import { resolveSidecarCommand } from "./sidecar-resolve";
import { acquireOrFocus } from "./single-instance";
import { setupIPC } from "./ipc";
import { TrayController, type TrayCallbacks } from "./tray";
import { trayIdleIcon, trayRecordingIcon } from "./icons";
import { createHotkeyController, type HotkeyController } from "./hotkey";
import { RecordingController, type ControllerState } from "./recording-controller";
import { TranscriptsStore } from "./transcripts-store";
import { SettingsSchema, type Settings } from "@shared/settings-shape";
import type { Transcript } from "@shared/transcript";

let mainWindow: BrowserWindow | null = null;
let sidecar: Sidecar | null = null;
let tray: TrayController | null = null;
let hotkey: HotkeyController | null = null;
let recordingController: RecordingController | null = null;
let transcriptsStore: TranscriptsStore | null = null;

let currentState: ControllerState = "idle";
let currentHotkey: string | null = null;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 980,
    height: 720,
    show: false,
    title: "ultimateASR",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(path.resolve(__dirname, "..", "..", "dist", "renderer", "index.html"));
  }
  win.once("ready-to-show", () => win.show());
  return win;
}

function trayCallbacks(): TrayCallbacks {
  return {
    onOpenSettings: () => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        mainWindow = createWindow();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    onToggleRecording: () => {
      void recordingController?.toggle();
    },
    onQuit: () => {
      app.quit();
    },
    onSelectTranscript: (t) => {
      try { clipboard.writeText(t.text); } catch { /* noop */ }
    },
  };
}

function refreshTray(state: ControllerState = currentState): void {
  if (!tray) return;
  try {
    tray.update(state, transcriptsStore?.list() ?? [], trayCallbacks());
  } catch {
    /* tray may be unavailable in some environments */
  }
}

function broadcast(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send(channel, payload);
  }
}

async function getSettings(): Promise<Settings> {
  if (!sidecar) throw new Error("sidecar not initialized");
  const raw = await sidecar.call("get_settings");
  return SettingsSchema.parse(raw);
}

async function appendTranscript(t: Transcript): Promise<void> {
  transcriptsStore?.add(t);
  refreshTray();
  broadcast("event:transcript-added", t);
}

async function applyHotkey(): Promise<void> {
  if (!hotkey || !recordingController) return;
  let accelerator = "Ctrl+Alt+Shift+L";
  try {
    const settings = await getSettings();
    accelerator = settings.hotkey || accelerator;
  } catch {
    /* fall back to default if settings can't be read yet */
  }
  if (currentHotkey && currentHotkey !== accelerator) {
    hotkey.unregister(currentHotkey);
  }
  const ok = hotkey.register(accelerator, () => {
    void recordingController?.toggle();
  });
  if (ok) currentHotkey = accelerator;
}

async function main() {
  const { isPrimary } = acquireOrFocus(app, () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  if (!isPrimary) {
    app.quit();
    return;
  }

  await app.whenReady();

  const cfg = resolveSidecarCommand();
  sidecar = new Sidecar({ command: cfg.command, args: cfg.args, cwd: cfg.cwd });
  sidecar.on("stderr", (chunk) => process.stderr.write(`[sidecar] ${chunk}`));
  sidecar.on("error", (err) => console.error("[sidecar] error:", err));
  sidecar.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[sidecar] exited with code ${code}`);
    }
  });
  await sidecar.start();

  transcriptsStore = new TranscriptsStore({
    filePath: path.join(app.getPath("userData"), "transcripts.json"),
  });

  setupIPC(sidecar, { transcriptsStore });

  // Lazy-import auto-paste so the electron module reference is only resolved
  // inside an Electron runtime; tests for the controller never touch this path.
  const pasteText = async (text: string): Promise<void> => {
    const mod = await import("./auto-paste");
    await mod.pasteText(text);
  };

  recordingController = new RecordingController({
    sidecar,
    getSettings,
    appendTranscript,
    pasteText,
  });

  tray = new TrayController(trayIdleIcon, trayRecordingIcon);
  refreshTray("idle");

  hotkey = createHotkeyController();
  await applyHotkey();

  recordingController.on("state", (state: ControllerState) => {
    currentState = state;
    refreshTray(state);
    for (const w of BrowserWindow.getAllWindows()) {
      w.webContents.send("event:recording-state", { state });
    }
  });

  mainWindow = createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });

  app.on("before-quit", async () => {
    try { hotkey?.unregisterAll(); } catch { /* noop */ }
    try { tray?.destroy(); } catch { /* noop */ }
    try { await sidecar?.stop(); } catch { /* noop */ }
  });

  app.on("window-all-closed", async () => {
    // On macOS, app stays alive in the tray. Other platforms quit when the
    // window closes — the before-quit handler stops the sidecar.
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

void main();
