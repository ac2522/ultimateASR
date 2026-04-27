import { contextBridge, ipcRenderer } from "electron";

const api = {
  ping: () => ipcRenderer.invoke("ping", {}),
  settings: {
    get: () => ipcRenderer.invoke("settings.get", {}),
    set: (patch: object) => ipcRenderer.invoke("settings.set", { patch }),
  },
  hardware: {
    detect: () => ipcRenderer.invoke("hardware.detect", {}),
    recommendBackend: () => ipcRenderer.invoke("hardware.recommendBackend", {}),
    recommendModel: () => ipcRenderer.invoke("hardware.recommendModel", {}),
  },
  devices: { list: () => ipcRenderer.invoke("devices.list", {}) },
  models: {
    listAvailable: () => ipcRenderer.invoke("models.listAvailable", {}),
    listDownloaded: () => ipcRenderer.invoke("models.listDownloaded", {}),
    download: (name: string) => ipcRenderer.invoke("models.download", { name }),
    delete: (name: string) => ipcRenderer.invoke("models.delete", { name }),
  },
  recording: {
    start: (input: object = {}) => ipcRenderer.invoke("recording.start", input),
    stop: (session_id: string) => ipcRenderer.invoke("recording.stop", { session_id }),
  },
  transcribe: (input: object) => ipcRenderer.invoke("transcribe", input),
  llm: { cleanup: (input: object) => ipcRenderer.invoke("llm.cleanup", input) },
  transcripts: {
    list: () => ipcRenderer.invoke("transcripts.list", {}),
    clear: () => ipcRenderer.invoke("transcripts.clear", {}),
  },
  events: {
    on: (channel: "progress" | "recording-state" | "transcript-added", cb: (payload: any) => void) => {
      const handler = (_: unknown, payload: any) => cb(payload);
      ipcRenderer.on(`event:${channel}`, handler);
      return () => ipcRenderer.removeListener(`event:${channel}`, handler);
    },
  },
};

contextBridge.exposeInMainWorld("api", api);
export type Api = typeof api;
