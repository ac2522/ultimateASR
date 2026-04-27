import { useMemo, useState } from "react";
import type { Transcript } from "@shared/transcript";
import { useTranscripts, useClearTranscripts } from "@/hooks/use-transcripts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const fmt = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  day: "2-digit",
});

function formatAt(at: number): string {
  // Settings.transcripts persists epoch seconds; jsdom Date accepts ms — accept either.
  const ms = at < 1e12 ? at * 1000 : at;
  try {
    return fmt.format(new Date(ms));
  } catch {
    return "";
  }
}

export function TranscriptList() {
  const { data } = useTranscripts();
  const clear = useClearTranscripts();
  const [copied, setCopied] = useState<string | null>(null);

  const items = useMemo<Transcript[]>(() => {
    const arr = (data ?? []).slice();
    arr.sort((a, b) => b.at - a.at);
    return arr.slice(0, 10);
  }, [data]);

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard?.writeText?.(text);
      setCopied(id);
      window.setTimeout(() => setCopied((cur) => (cur === id ? null : cur)), 1200);
    } catch {
      // ignore
    }
  }

  if (items.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">No transcripts yet.</Card>
    );
  }

  return (
    <Card className="p-2">
      <div className="flex items-center justify-between px-3 py-2">
        <h3 className="text-sm font-medium">Recent transcripts</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => clear.mutate()}
          disabled={clear.isPending}
        >
          Clear
        </Button>
      </div>
      <ScrollArea className="max-h-80">
        <ul className="divide-y divide-border">
          {items.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => copy(t.text, t.id)}
                className={cn(
                  "block w-full px-3 py-2 text-left transition-colors hover:bg-accent/50",
                  copied === t.id && "bg-accent/40",
                )}
              >
                <div className="text-sm">{t.text}</div>
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>{t.engine}</span>
                  <span>
                    {copied === t.id ? "Copied" : formatAt(t.at)}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </Card>
  );
}
