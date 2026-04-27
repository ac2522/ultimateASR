import { useEffect, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { TranscriptList } from "@/components/transcript-list";
import { useRecordingStore } from "@/store/recording-store";
import { Card } from "@/components/ui/card";

export function HomePage() {
  const state = useRecordingStore((s) => s.state);
  const [pong, setPong] = useState<string | null>(null);
  useEffect(() => { window.api?.ping?.().then(setPong).catch(() => {}); }, []);
  return (
    <div className="p-8 space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Dictation</h2>
        <StatusPill state={state} />
      </header>
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
