import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

const MAX_IMPORT_BYTES = 1024 * 1024; // 1 MB

export interface DictionaryEditorProps {
  vocabulary: string[];
  onChange(next: string[]): void;
}

export function DictionaryEditor({ vocabulary, onChange }: DictionaryEditorProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function add() {
    const v = draft.trim();
    if (!v) return;
    if (vocabulary.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...vocabulary, v]);
    setDraft("");
  }

  function remove(entry: string) {
    onChange(vocabulary.filter((e) => e !== entry));
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(vocabulary, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ultimateasr-dictionary.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    if (file.size > MAX_IMPORT_BYTES) {
      setError("File too large (max 1 MB).");
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        onChange(parsed);
        setError(null);
      } else {
        setError("Expected a JSON array of strings.");
      }
    } catch {
      setError("Invalid JSON file.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Word or phrase..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" onClick={add}>Add</Button>
      </div>

      <div className="flex flex-wrap gap-2 rounded-md border p-3 min-h-12">
        {vocabulary.length === 0 && (
          <span className="text-sm text-muted-foreground">
            No custom vocabulary yet.
          </span>
        )}
        {vocabulary.map((entry) => (
          <Badge key={entry} variant="secondary" className="gap-1 pr-1">
            <span>{entry}</span>
            <button
              type="button"
              aria-label={`Remove ${entry}`}
              onClick={() => remove(entry)}
              className="ml-1 rounded p-0.5 hover:bg-muted-foreground/20"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={handleExport}>
          Export
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileRef.current?.click()}
        >
          Import
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          aria-label="Import dictionary file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            // Reset so picking the same file twice still triggers change.
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
