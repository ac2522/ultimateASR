import path from "node:path";

// Resolve tray icon paths relative to the compiled main process file location.
// In dev (vite-node) and packaged builds, __dirname points at the `dist-electron/main` directory.
// The repo layout is:
//   <root>/assets/tray-idle.png
//   <root>/assets/tray-recording.png
// From `dist-electron/main` we go up two levels to reach the project root.
const ROOT = path.resolve(__dirname, "..", "..");

export const trayIdleIcon = path.join(ROOT, "assets", "tray-idle.png");
export const trayRecordingIcon = path.join(ROOT, "assets", "tray-recording.png");
