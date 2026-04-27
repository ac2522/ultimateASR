import { DictionaryEditor } from "@/components/dictionary-editor";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";

export function DictionaryPage() {
  const { data: settings } = useSettings();
  const update = useUpdateSettings();

  if (!settings) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Dictionary</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Custom vocabulary biasing — names, jargon, acronyms.
        </p>
      </header>
      <DictionaryEditor
        vocabulary={settings.custom_vocabulary}
        onChange={(next) => update.mutate({ custom_vocabulary: next })}
      />
    </div>
  );
}
