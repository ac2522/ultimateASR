import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ModelRowProps {
  name: string;
  sizeMb?: number;
  description?: string;
  downloaded: boolean;
  progress?: number; // 0-100, undefined when not downloading
  onDownload(): void;
  onDelete(): void;
  busy?: boolean;
}

function formatSize(sizeMb?: number): string {
  if (sizeMb == null) return "";
  if (sizeMb >= 1024) return `${(sizeMb / 1024).toFixed(1)} GB`;
  return `${sizeMb} MB`;
}

export function ModelRow({
  name, sizeMb, description, downloaded, progress, onDownload, onDelete, busy,
}: ModelRowProps) {
  const isDownloading = typeof progress === "number" && progress < 100;
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{name}</span>
          {sizeMb != null && (
            <span className="text-xs text-muted-foreground">{formatSize(sizeMb)}</span>
          )}
          {downloaded && <Badge variant="secondary">Downloaded</Badge>}
        </div>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
        {isDownloading && (
          <div className="mt-2 flex items-center gap-2">
            <progress
              max={100}
              value={progress}
              aria-label={`download progress for ${name}`}
              className="h-2 w-full"
            />
            <span className="text-xs tabular-nums text-muted-foreground">{progress}%</span>
          </div>
        )}
      </div>
      <div className="shrink-0">
        {downloaded ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={busy}
            aria-label={`Delete ${name}`}
          >
            Delete
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onDownload}
            disabled={busy || isDownloading}
            aria-label={`Download ${name}`}
          >
            {isDownloading ? "Downloading..." : "Download"}
          </Button>
        )}
      </div>
    </div>
  );
}
