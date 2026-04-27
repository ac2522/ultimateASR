import { EventEmitter } from "node:events";
import type { Settings } from "@shared/settings-shape";
import type { Transcript } from "@shared/transcript";

export type ControllerState =
  | "idle"
  | "starting"
  | "recording"
  | "stopping"
  | "transcribing"
  | "cleaning";

export interface SidecarLike {
  call<T = unknown>(method: string, params?: object, timeoutMs?: number): Promise<T>;
}

export interface RecordingControllerDeps {
  sidecar: SidecarLike;
  getSettings: () => Promise<Settings>;
  appendTranscript: (t: Transcript) => Promise<void>;
  pasteText?: (text: string) => Promise<void>;
}

interface StartRecordingResponse {
  session_id: string;
}

interface StopRecordingResponse {
  samples_pcm_b64: string;
  sample_rate: number;
}

interface TranscribeResponse {
  text: string;
}

interface LlmCleanupResponse {
  text: string;
}

/**
 * Translate the user-facing engine choice to the concrete sidecar engine.
 * "auto" currently always resolves to whisper-local; future work may pick based on hardware.
 */
function resolveEngine(engineKind: Settings["engine_kind"]): string {
  return engineKind === "auto" ? "whisper-local" : engineKind;
}

/**
 * RecordingController orchestrates the full record → transcribe → cleanup → paste pipeline.
 *
 * State machine (only `idle` and `recording` are user-visible entry points;
 * the `*ing` states are transient and gate `toggle()` to a no-op):
 *
 *   idle ──start()──▶ starting ──▶ recording
 *   recording ──stop()──▶ stopping ──▶ transcribing ──[llm?]──▶ cleaning ──▶ idle
 */
export class RecordingController extends EventEmitter {
  state: ControllerState = "idle";
  sessionId: string | null = null;

  constructor(private readonly deps: RecordingControllerDeps) {
    super();
  }

  private setState(next: ControllerState): void {
    this.state = next;
    this.emit("state", next);
  }

  async start(): Promise<void> {
    if (this.state !== "idle") return;
    this.setState("starting");
    const settings = await this.deps.getSettings();
    const result = await this.deps.sidecar.call<StartRecordingResponse>("start_recording", {
      mode: settings.recording_mode,
      vad_aggressiveness: settings.vad_aggressiveness,
      padding_duration_ms: settings.padding_duration_ms,
      break_length: settings.break_length,
      device_index: settings.audio_device_index,
    });
    this.sessionId = result.session_id;
    this.setState("recording");
  }

  async stop(): Promise<string | null> {
    if (this.state !== "recording") return null;
    const sessionId = this.sessionId;
    this.setState("stopping");
    const settings = await this.deps.getSettings();

    const stopResult = await this.deps.sidecar.call<StopRecordingResponse>("stop_recording", {
      session_id: sessionId,
    });

    this.setState("transcribing");
    const transcribeResult = await this.deps.sidecar.call<TranscribeResponse>("transcribe", {
      pcm_b64: stopResult.samples_pcm_b64,
      sample_rate: stopResult.sample_rate,
      engine_kind: resolveEngine(settings.engine_kind),
      model_size: settings.model_size,
      compute_backend: settings.compute_backend,
      custom_vocabulary: settings.custom_vocabulary,
      cloud_api_key: settings.cloud_api_key,
      cloud_model: settings.cloud_model,
    });

    let finalText = transcribeResult.text ?? "";

    if (settings.llm_enabled) {
      this.setState("cleaning");
      const cleanupResult = await this.deps.sidecar.call<LlmCleanupResponse>("llm_cleanup", {
        text: finalText,
        provider: settings.llm_provider,
        model: settings.llm_model,
        api_key: settings.llm_api_key,
        endpoint: settings.llm_endpoint,
        system_prompt: settings.llm_system_prompt,
      });
      finalText = cleanupResult.text ?? "";
    }

    const trimmed = finalText.trim();
    if (trimmed.length > 0 && sessionId != null) {
      await this.deps.appendTranscript({
        id: sessionId,
        at: Date.now(),
        text: finalText,
        engine: settings.engine_kind,
      });

      if (settings.auto_paste && this.deps.pasteText) {
        try {
          await this.deps.pasteText(finalText);
        } catch {
          /* best-effort: clipboard already populated by paste impl */
        }
      }
    }

    this.sessionId = null;
    this.setState("idle");
    return trimmed.length > 0 ? finalText : null;
  }

  async toggle(): Promise<string | null | void> {
    if (this.state === "idle") {
      await this.start();
      return;
    }
    if (this.state === "recording") {
      return await this.stop();
    }
    // Transient states: no-op.
    return null;
  }
}
