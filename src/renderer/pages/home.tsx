import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatusPill } from "@/components/status-pill";
import { TranscriptList } from "@/components/transcript-list";
import { useRecordingStore } from "@/store/recording-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/hooks/use-settings";
import { useDownloadedModels } from "@/hooks/use-models";

/**
 * Onboarding banner shown when the user has finished the first-run wizard
 * but ultimateASR still has nothing to transcribe with — no local model on
 * disk and no cloud API key configured. Encourages them to either download
 * a model or paste a key in.
 */
function OnboardingBanner() {
  const navigate = useNavigate();
  return (
    <Card
      className="border-amber-300 bg-amber-50 p-6 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <h3 className="text-base font-semibold">You need a model or a cloud key</h3>
      <p className="mt-1 text-sm">
        ultimateASR can transcribe locally (download a model) or via the
        OpenAI Whisper API (paste a key).
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => navigate("/models")}>Download a model</Button>
        <Button variant="outline" onClick={() => navigate("/llm")}>
          Add a cloud key
        </Button>
      </div>
    </Card>
  );
}

export function HomePage() {
  const state = useRecordingStore((s) => s.state);
  const [pong, setPong] = useState<string | null>(null);
  useEffect(() => { window.api?.ping?.().then(setPong).catch(() => {}); }, []);

  const { data: settings } = useSettings();
  const { data: downloaded } = useDownloadedModels();

  const showBanner =
    settings?.first_run_done === true &&
    (downloaded?.length ?? 0) === 0 &&
    !settings?.cloud_api_key;

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Dictation</h2>
        <StatusPill state={state} />
      </header>
      {showBanner && <OnboardingBanner />}
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          The tray icon is the operating UI. This window is mostly settings and configuration.
        </p>
        {pong && <p className="text-xs mt-2 text-muted-foreground">Sidecar: {pong}</p>}
      </Card>
      <TranscriptList />
    </div>
  );
}
