import { Tray as ElectronTray, Menu, nativeImage, clipboard } from "electron";
import type { MenuItemConstructorOptions } from "electron";
import type { Transcript } from "@shared/transcript";

export type TrayState = "idle" | "starting" | "recording" | "stopping" | "transcribing" | "cleaning";

export interface TrayCallbacks {
  onOpenSettings?: () => void;
  onToggleRecording?: () => void;
  onQuit?: () => void;
  onSelectTranscript?: (t: Transcript) => void;
}

const STATUS_LABEL: Record<TrayState, string> = {
  idle: "Status: Idle",
  starting: "Status: Starting",
  recording: "Status: Recording",
  stopping: "Status: Stopping",
  transcribing: "Status: Transcribing",
  cleaning: "Status: Cleaning",
};

function truncate(text: string, max = 60): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.slice(0, max - 1) + "…";
}

/**
 * Build the tray menu template. Pure function — easy to unit test.
 *
 * The submenu shows the most recent 10 transcripts (newest first).
 * Each transcript click defaults to copying the text to the clipboard;
 * callers can override via callbacks.onSelectTranscript.
 */
export function buildMenu(
  state: TrayState,
  transcripts: Transcript[],
  callbacks: TrayCallbacks = {},
): MenuItemConstructorOptions[] {
  // Newest first. Sort by `at` descending then take top 10.
  const sorted = [...transcripts].sort((a, b) => b.at - a.at).slice(0, 10);

  const submenu: MenuItemConstructorOptions[] = sorted.length === 0
    ? [{ label: "(no transcripts yet)", enabled: false }]
    : sorted.map((t) => ({
        label: truncate(t.text),
        click: () => {
          if (callbacks.onSelectTranscript) callbacks.onSelectTranscript(t);
          else clipboard.writeText(t.text);
        },
      }));

  return [
    { label: STATUS_LABEL[state], enabled: false },
    { type: "separator" },
    { label: "Toggle recording", click: () => callbacks.onToggleRecording?.() },
    { label: "Open settings", click: () => callbacks.onOpenSettings?.() },
    { label: "Recent transcripts", submenu },
    { type: "separator" },
    { label: "Quit", click: () => callbacks.onQuit?.() },
  ];
}

/**
 * Thin controller wrapper around Electron's Tray instance. Not unit tested directly
 * (Electron isn't available outside the main process); see buildMenu tests for menu logic.
 */
export class TrayController {
  private tray: ElectronTray | null = null;

  constructor(
    private readonly idleIconPath: string,
    private readonly recordingIconPath: string,
  ) {}

  private iconForState(state: TrayState): string {
    return state === "recording" ? this.recordingIconPath : this.idleIconPath;
  }

  ensure(): ElectronTray {
    if (!this.tray) {
      const img = nativeImage.createFromPath(this.idleIconPath);
      this.tray = new ElectronTray(img);
      this.tray.setToolTip("ultimateASR");
    }
    return this.tray;
  }

  update(state: TrayState, transcripts: Transcript[], callbacks: TrayCallbacks = {}): void {
    const tray = this.ensure();
    const template = buildMenu(state, transcripts, callbacks);
    tray.setContextMenu(Menu.buildFromTemplate(template));
    const img = nativeImage.createFromPath(this.iconForState(state));
    tray.setImage(img);
    tray.setToolTip(`ultimateASR — ${STATUS_LABEL[state].replace(/^Status: /, "")}`);
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
