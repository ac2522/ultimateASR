import { z } from "zod";
import { SettingsSchema } from "./settings-shape";
import { TranscriptSchema } from "./transcript";

const empty = z.object({});

export const ipcContract = {
  ping: { input: empty, output: z.literal("pong") },

  settings: {
    get: { input: empty, output: SettingsSchema },
    set: { input: z.object({ patch: SettingsSchema.partial() }), output: SettingsSchema },
  },

  hardware: {
    detect: { input: empty, output: z.object({
      os: z.enum(["linux", "darwin", "windows"]),
      arch: z.string(), cpu_count: z.number(), ram_gb: z.number(),
      cuda: z.boolean(), metal: z.boolean(), vulkan: z.boolean(), coreml: z.boolean(),
    }) },
    recommendBackend: { input: empty, output: z.enum(["cuda", "metal", "vulkan", "cpu"]) },
    recommendModel: { input: empty, output: z.string() },
  },

  devices: {
    list: { input: empty, output: z.array(z.object({
      index: z.number(), name: z.string(), channels: z.number(), sample_rate: z.number(),
    })) },
  },

  models: {
    listAvailable: { input: empty, output: z.array(z.any()) },
    listDownloaded: { input: empty, output: z.array(z.any()) },
    download: { input: z.object({ name: z.string() }), output: z.object({ path: z.string() }) },
    delete: { input: z.object({ name: z.string() }), output: z.null() },
  },

  recording: {
    start: {
      input: z.object({
        mode: z.enum(["silence", "button"]).optional(),
        vad_aggressiveness: z.number().int().min(0).max(3).optional(),
        break_length: z.number().int().positive().optional(),
        device_index: z.number().int().nullable().optional(),
      }),
      output: z.object({ session_id: z.string() }),
    },
    stop: {
      input: z.object({ session_id: z.string() }),
      output: z.object({ samples_pcm_b64: z.string(), sample_rate: z.number() }),
    },
  },

  transcribe: {
    input: z.object({
      engine_kind: z.enum(["auto", "whisper-local", "parakeet-local", "cloud-openai"]),
      pcm_b64: z.string(),
      sample_rate: z.number(),
      vocabulary: z.array(z.string()).optional(),
      model_path: z.string().optional(),
      cloud_api_key: z.string().optional(),
      cloud_model: z.string().optional(),
    }),
    output: z.object({ text: z.string() }),
  },

  llm: {
    cleanup: {
      input: z.object({
        text: z.string(),
        provider: z.enum(["openai", "anthropic", "ollama", "llamacpp"]),
        model: z.string(),
        api_key: z.string().optional(),
        endpoint: z.string().optional(),
        system_prompt: z.string().optional(),
      }),
      output: z.object({ text: z.string() }),
    },
  },

  transcripts: {
    list: { input: empty, output: z.array(TranscriptSchema) },
    clear: { input: empty, output: z.null() },
  },
} as const;

export { SettingsSchema };
