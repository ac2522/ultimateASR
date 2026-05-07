import { Button } from "@/components/ui/button";

export interface QueryStateProps {
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  loadingLabel?: string;
}

export function QueryState({ isLoading, error, onRetry, loadingLabel = "Loading..." }: QueryStateProps) {
  if (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return (
      <div className="p-8 space-y-3" data-testid="query-error">
        <p className="text-sm font-semibold text-destructive">Failed to load.</p>
        <pre className="rounded bg-muted p-3 text-xs whitespace-pre-wrap break-words">{msg}</pre>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }
  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">{loadingLabel}</div>;
  }
  return null;
}
