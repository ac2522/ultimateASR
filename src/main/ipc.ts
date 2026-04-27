import { ipcMain, BrowserWindow } from "electron";
import { ipcContract } from "@shared/ipc-contract";
import type { Sidecar } from "./sidecar";
import type { Transcript } from "@shared/transcript";

// Maps renderer-facing IPC channel names to the sidecar's JSON-RPC method names.
const RPC_METHOD: Record<string, string> = {
  "ping": "ping",
  "settings.get": "get_settings",
  "settings.set": "set_settings",
  "hardware.detect": "detect_hardware",
  "hardware.recommendBackend": "recommend_backend",
  "hardware.recommendModel": "recommend_model",
  "devices.list": "list_input_devices",
  "models.listAvailable": "list_available_models",
  "models.listDownloaded": "list_downloaded_models",
  "models.download": "download_model",
  "models.delete": "delete_model",
  "recording.start": "start_recording",
  "recording.stop": "stop_recording",
  "transcribe": "transcribe",
  "llm.cleanup": "llm_cleanup",
  // transcripts.* live in main-process state; handled below.
};

export interface TranscriptsStoreLike {
  list(): Transcript[];
  clear(): void;
}

export interface IpcDeps {
  transcriptsStore?: TranscriptsStoreLike;
}

export function setupIPC(sidecar: Sidecar, deps: IpcDeps = {}) {
  // Forward sidecar notifications (e.g. download progress) to all renderer windows.
  sidecar.on("notify", (method, params) => {
    for (const w of BrowserWindow.getAllWindows()) {
      w.webContents.send(`event:${method.replace(/_/g, "-")}`, params);
    }
  });

  // Generic forwarders backed by the contract's input/output schemas.
  for (const [channel, method] of Object.entries(RPC_METHOD)) {
    const entry = lookupContract(channel);
    ipcMain.handle(channel, async (_e, raw) => {
      const parsed = entry.input.parse(raw ?? {}) as object;
      const out = await sidecar.call(method, parsed);
      return entry.output.parse(out);
    });
  }

  // Main-process-backed channels for the persistent transcripts store.
  const store = deps.transcriptsStore;
  if (store) {
    ipcMain.handle("transcripts.list", async () => store.list());
    ipcMain.handle("transcripts.clear", async () => { store.clear(); return null; });
  }
}

function lookupContract(channel: string) {
  // Lookup the schema entry for a dotted channel name (e.g. "settings.get").
  const parts = channel.split(".");
  let node: any = ipcContract;
  for (const p of parts) node = node[p];
  if (!node?.input || !node?.output) {
    throw new Error(`No contract entry for channel: ${channel}`);
  }
  return node as { input: { parse: (v: unknown) => unknown }; output: { parse: (v: unknown) => unknown } };
}
