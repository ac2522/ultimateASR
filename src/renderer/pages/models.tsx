import { useEffect, useState } from "react";
import { ModelRow } from "@/components/model-row";
import {
  useAvailableModels,
  useDownloadedModels,
  useDownloadModel,
  useDeleteModel,
} from "@/hooks/use-models";

interface ProgressEvent {
  name: string;
  percent: number;
}

export function ModelsPage() {
  const { data: available } = useAvailableModels();
  const { data: downloaded } = useDownloadedModels();
  const download = useDownloadModel();
  const remove = useDeleteModel();
  const [progress, setProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    const off = window.api?.events?.on?.("progress", (payload: ProgressEvent) => {
      if (!payload || typeof payload.name !== "string") return;
      setProgress((cur) => ({ ...cur, [payload.name]: payload.percent }));
    });
    return () => {
      try { off?.(); } catch { /* ignore */ }
    };
  }, []);

  const downloadedNames = new Set((downloaded ?? []).map((m: any) => m.name));

  return (
    <div className="space-y-6 p-8">
      <header>
        <h2 className="text-2xl font-semibold">Models</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Download local models. Progress shown in real time.
        </p>
      </header>
      <div className="space-y-3">
        {(available ?? []).map((m: any) => {
          const isDownloaded = downloadedNames.has(m.name);
          const pct = progress[m.name];
          return (
            <ModelRow
              key={m.name}
              name={m.name}
              sizeMb={m.size_mb}
              description={m.description}
              downloaded={isDownloaded}
              progress={pct}
              onDownload={() => download.mutate(m.name)}
              onDelete={() => remove.mutate(m.name)}
              busy={download.isPending || remove.isPending}
            />
          );
        })}
        {(available ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No models available.</p>
        )}
      </div>
    </div>
  );
}
