import { z } from "zod";

export const SettingsSchema = z.object({
  engine_kind: z.enum(["auto", "whisper-local", "parakeet-local", "cloud-openai"]),
  model_size: z.string(),
  compute_backend: z.enum(["auto", "cuda", "metal", "vulkan", "coreml", "cpu"]),
  audio_device_index: z.number().int().nullable(),
  audio_device_name: z.string().nullable(),
  vad_aggressiveness: z.number().int().min(0).max(3),
  padding_duration_ms: z.number().int().nonnegative(),
  recording_mode: z.enum(["silence", "button"]),
  break_length: z.number().int().positive(),
  hotkey: z.string(),
  auto_paste: z.boolean(),
  custom_vocabulary: z.array(z.string()),
  cloud_api_key: z.string(),
  cloud_model: z.string(),
  llm_enabled: z.boolean(),
  llm_provider: z.enum(["openai", "anthropic", "ollama", "llamacpp"]),
  llm_model: z.string(),
  llm_api_key: z.string(),
  llm_endpoint: z.string(),
  llm_system_prompt: z.string(),
  transcripts: z.array(z.string()),
  first_run_done: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;
