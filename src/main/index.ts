import { app, BrowserWindow } from "electron";
import path from "node:path";
import { Sidecar } from "./sidecar";
import { acquireOrFocus } from "./single-instance";
import { setupIPC } from "./ipc";

let mainWindow: BrowserWindow | null = null;
let sidecar: Sidecar | null = null;

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

function resolveSidecarCommand(): { command: string; args: string[] } {
  // In dev, use the system Python to run the package directly.
  // In production (after Phase 10 packaging), we'll use the bundled binary.
  const command = process.env.ULTIMATEASR_PYTHON || "python3";
  return { command, args: ["-m", "ultimate_asr"] };
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
  sidecar = new Sidecar({ command: cfg.command, args: cfg.args });
  await sidecar.start();

  setupIPC(sidecar);

  mainWindow = createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });

  app.on("window-all-closed", async () => {
    if (process.platform !== "darwin") {
      try { await sidecar?.stop(); } catch {}
      app.quit();
    }
  });
}

void main();
