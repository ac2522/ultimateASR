import { useEffect, useState } from "react";
import { QueryState } from "@/components/query-state";
import { SettingsSection } from "@/components/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import type { Settings } from "@shared/settings-shape";

// Mirror of sidecar/ultimate_asr/settings.py DEFAULT_SETTINGS["llm_system_prompt"].
export const DEFAULT_LLM_SYSTEM_PROMPT =
  "Clean up this dictation transcript. Fix obvious recognition errors, " +
  "remove filler words ('um', 'uh'), preserve meaning, do not add new content.";

const PROVIDER_OPTIONS: { value: Settings["llm_provider"]; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "ollama", label: "Ollama" },
  { value: "llamacpp", label: "llama.cpp" },
];

function isApiKeyProvider(p: Settings["llm_provider"]): boolean {
  return p === "openai" || p === "anthropic";
}
function isEndpointProvider(p: Settings["llm_provider"]): boolean {
  return p === "ollama" || p === "llamacpp";
}

export function LlmPage() {
  const { data: settings, error, isLoading, refetch } = useSettings();
  const update = useUpdateSettings();

  const [cloudKey, setCloudKey] = useState("");
  const [cloudModel, setCloudModel] = useState("whisper-1");
  const [llmModel, setLlmModel] = useState("");
  const [llmKey, setLlmKey] = useState("");
  const [llmEndpoint, setLlmEndpoint] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");

  useEffect(() => {
    if (!settings) return;
    setCloudKey(settings.cloud_api_key);
    setCloudModel(settings.cloud_model);
    setLlmModel(settings.llm_model);
    setLlmKey(settings.llm_api_key);
    setLlmEndpoint(settings.llm_endpoint);
    setSystemPrompt(settings.llm_system_prompt);
  }, [settings]);

  if (!settings) {
    return <QueryState isLoading={isLoading} error={error} onRetry={() => refetch()} loadingLabel="Loading settings..." />;
  }

  function commit<K extends keyof Settings>(key: K, value: Settings[K]) {
    update.mutate({ [key]: value } as Partial<Settings>);
  }

  const llmDisabled = !settings.llm_enabled;

  return (
    <div className="space-y-6 p-8">
      <header>
        <h2 className="text-2xl font-semibold">Cloud & LLM</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cloud Whisper credentials and optional LLM cleanup.
        </p>
      </header>

      <SettingsSection title="Cloud Whisper API" description="Used when engine is set to Cloud OpenAI.">
        <div className="space-y-2">
          <Label htmlFor="cloud_api_key">API key</Label>
          <Input
            id="cloud_api_key"
            type="password"
            autoComplete="off"
            value={cloudKey}
            onChange={(e) => setCloudKey(e.target.value)}
            onBlur={() => commit("cloud_api_key", cloudKey)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cloud_model">Model</Label>
          <Input
            id="cloud_model"
            value={cloudModel}
            onChange={(e) => setCloudModel(e.target.value)}
            onBlur={() => commit("cloud_model", cloudModel)}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="LLM Cleanup"
        description="Optional: post-process transcripts with an LLM."
      >
        <div className="flex items-center gap-3">
          <Switch
            id="llm_enabled"
            checked={settings.llm_enabled}
            onCheckedChange={(v) => commit("llm_enabled", v)}
          />
          <Label htmlFor="llm_enabled">Enable LLM cleanup</Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="llm_provider">LLM provider</Label>
          <select
            id="llm_provider"
            disabled={llmDisabled}
            value={settings.llm_provider}
            onChange={(e) => commit("llm_provider", e.target.value as Settings["llm_provider"])}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm disabled:opacity-50"
          >
            {PROVIDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="llm_model">LLM model</Label>
          <Input
            id="llm_model"
            disabled={llmDisabled}
            value={llmModel}
            onChange={(e) => setLlmModel(e.target.value)}
            onBlur={() => commit("llm_model", llmModel)}
          />
        </div>

        {isApiKeyProvider(settings.llm_provider) && (
          <div className="space-y-2">
            <Label htmlFor="llm_api_key">LLM API key</Label>
            <Input
              id="llm_api_key"
              type="password"
              autoComplete="off"
              disabled={llmDisabled}
              value={llmKey}
              onChange={(e) => setLlmKey(e.target.value)}
              onBlur={() => commit("llm_api_key", llmKey)}
            />
          </div>
        )}

        {isEndpointProvider(settings.llm_provider) && (
          <div className="space-y-2">
            <Label htmlFor="llm_endpoint">LLM endpoint</Label>
            <Input
              id="llm_endpoint"
              disabled={llmDisabled}
              placeholder="http://localhost:11434"
              value={llmEndpoint}
              onChange={(e) => setLlmEndpoint(e.target.value)}
              onBlur={() => commit("llm_endpoint", llmEndpoint)}
            />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="llm_system_prompt">System prompt</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={llmDisabled}
              onClick={() => {
                setSystemPrompt(DEFAULT_LLM_SYSTEM_PROMPT);
                commit("llm_system_prompt", DEFAULT_LLM_SYSTEM_PROMPT);
              }}
            >
              Reset to default
            </Button>
          </div>
          <Textarea
            id="llm_system_prompt"
            rows={4}
            disabled={llmDisabled}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            onBlur={() => commit("llm_system_prompt", systemPrompt)}
          />
        </div>
      </SettingsSection>
    </div>
  );
}
