import { useEffect, useState } from "react";
import { SettingsSection } from "@/components/settings-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import { useDevices } from "@/hooks/use-devices";
import type { Settings } from "@shared/settings-shape";

const ENGINE_OPTIONS: { value: Settings["engine_kind"]; label: string }[] = [
  { value: "auto", label: "Auto (recommended)" },
  { value: "whisper-local", label: "Whisper (local)" },
  { value: "parakeet-local", label: "Parakeet (local)" },
  { value: "cloud-openai", label: "OpenAI Cloud" },
];
const BACKEND_OPTIONS: { value: Settings["compute_backend"]; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "cuda", label: "CUDA" },
  { value: "metal", label: "Metal" },
  { value: "vulkan", label: "Vulkan" },
  { value: "coreml", label: "CoreML" },
  { value: "cpu", label: "CPU" },
];
const MODE_OPTIONS: { value: Settings["recording_mode"]; label: string }[] = [
  { value: "silence", label: "Silence-detected" },
  { value: "button", label: "Push-to-talk" },
];

export function SettingsPage() {
  const { data: settings } = useSettings();
  const { data: devices } = useDevices();
  const update = useUpdateSettings();

  // Local mirrors for text inputs so commit-on-blur works smoothly.
  const [hotkey, setHotkey] = useState("");
  const [breakLength, setBreakLength] = useState<number>(5);
  const [padding, setPadding] = useState<number>(1000);

  useEffect(() => {
    if (!settings) return;
    setHotkey(settings.hotkey);
    setBreakLength(settings.break_length);
    setPadding(settings.padding_duration_ms);
  }, [settings]);

  if (!settings) {
    return <div className="p-8 text-sm text-muted-foreground">Loading settings...</div>;
  }

  function commit<K extends keyof Settings>(key: K, value: Settings[K]) {
    update.mutate({ [key]: value } as Partial<Settings>);
  }

  return (
    <div className="p-8 space-y-6">
      <h2 className="text-2xl font-semibold">Settings</h2>

      <SettingsSection title="Engine" description="Pick the speech-to-text engine and compute backend.">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="engine_kind">Engine</Label>
            <select
              id="engine_kind"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={settings.engine_kind}
              onChange={(e) => commit("engine_kind", e.target.value as Settings["engine_kind"])}
            >
              {ENGINE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="compute_backend">Compute backend</Label>
            <select
              id="compute_backend"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={settings.compute_backend}
              onChange={(e) => commit("compute_backend", e.target.value as Settings["compute_backend"])}
            >
              {BACKEND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Audio" description="Microphone and voice activity detection.">
        <div className="space-y-2">
          <Label htmlFor="audio_device_index">Input device</Label>
          <select
            id="audio_device_index"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={settings.audio_device_index ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : Number(e.target.value);
              commit("audio_device_index", v);
            }}
          >
            <option value="">System default</option>
            {(devices ?? []).map((d) => (
              <option key={d.index} value={d.index}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="recording_mode">Recording mode</Label>
            <select
              id="recording_mode"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={settings.recording_mode}
              onChange={(e) => commit("recording_mode", e.target.value as Settings["recording_mode"])}
            >
              {MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vad_aggressiveness">VAD aggressiveness ({settings.vad_aggressiveness})</Label>
            <input
              id="vad_aggressiveness"
              type="range"
              min={0}
              max={3}
              step={1}
              value={settings.vad_aggressiveness}
              onChange={(e) => commit("vad_aggressiveness", Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="break_length">Silence break (s)</Label>
            <Input
              id="break_length"
              type="number"
              min={1}
              value={breakLength}
              onChange={(e) => setBreakLength(Number(e.target.value))}
              onBlur={() => commit("break_length", breakLength)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="padding_duration_ms">Padding (ms)</Label>
            <Input
              id="padding_duration_ms"
              type="number"
              min={0}
              value={padding}
              onChange={(e) => setPadding(Number(e.target.value))}
              onBlur={() => commit("padding_duration_ms", padding)}
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Hotkey & paste" description="Global activation and clipboard behavior.">
        <div className="space-y-2">
          <Label htmlFor="hotkey">Hotkey</Label>
          <Input
            id="hotkey"
            value={hotkey}
            onChange={(e) => setHotkey(e.target.value)}
            onBlur={() => commit("hotkey", hotkey)}
          />
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="auto_paste"
            checked={settings.auto_paste}
            onCheckedChange={(v) => commit("auto_paste", v)}
          />
          <Label htmlFor="auto_paste">Auto-paste</Label>
        </div>
      </SettingsSection>
    </div>
  );
}
