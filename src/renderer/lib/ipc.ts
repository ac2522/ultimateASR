import type { Settings } from "@shared/settings-shape";
import type { Transcript } from "@shared/transcript";

// Strongly-typed view onto the preload's contextBridge `api`. The preload
// declares its shape in src/preload/index.ts.
export interface RendererApi {
  ping(): Promise<"pong">;
  settings: {
    get(): Promise<Settings>;
    set(patch: Partial<Settings>): Promise<Settings>;
  };
  hardware: {
    detect(): Promise<{
      os: "linux" | "darwin" | "windows"; arch: string;
      cpu_count: number; ram_gb: number;
      cuda: boolean; metal: boolean; vulkan: boolean; coreml: boolean;
    }>;
    recommendBackend(): Promise<"cuda" | "metal" | "vulkan" | "cpu">;
    recommendModel(): Promise<string>;
  };
  devices: {
    list(): Promise<{ index: number; name: string; channels: number; sample_rate: number }[]>;
  };
  models: {
    listAvailable(): Promise<any[]>;
    listDownloaded(): Promise<any[]>;
    download(name: string): Promise<{ path: string }>;
    delete(name: string): Promise<null>;
  };
  recording: {
    start(input?: { mode?: "silence" | "button"; vad_aggressiveness?: number; break_length?: number; device_index?: number | null }): Promise<{ session_id: string }>;
    stop(session_id: string): Promise<{ samples_pcm_b64: string; sample_rate: number }>;
  };
  transcribe(input: {
    engine_kind: "auto" | "whisper-local" | "parakeet-local" | "cloud-openai";
    pcm_b64: string; sample_rate: number;
    vocabulary?: string[]; model_path?: string;
    cloud_api_key?: string; cloud_model?: string;
  }): Promise<{ text: string }>;
  llm: {
    cleanup(input: {
      text: string; provider: "openai" | "anthropic" | "ollama" | "llamacpp"; model: string;
      api_key?: string; endpoint?: string; system_prompt?: string;
    }): Promise<{ text: string }>;
  };
  transcripts: {
    list(): Promise<Transcript[]>;
    clear(): Promise<null>;
  };
  events: {
    on(channel: "progress" | "recording-state" | "transcript-added", cb: (payload: any) => void): () => void;
  };
}

declare global {
  interface Window { api: RendererApi }
}

// Proxy onto `window.api` so test setups that stub the bridge after import
// time (via vi.stubGlobal) still work — every property access dereferences
// the live window reference.
export const api: RendererApi = new Proxy({} as RendererApi, {
  get(_target, prop) {
    const w = typeof window !== "undefined" ? (window as any).api : undefined;
    return w ? w[prop as keyof RendererApi] : undefined;
  },
});
