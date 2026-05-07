import { QueryCache, MutationCache, QueryClient } from "@tanstack/react-query";

function logFailure(scope: string, key: unknown, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[query] ${scope} ${JSON.stringify(key)}: ${msg}`);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
  queryCache: new QueryCache({
    onError: (err, query) => logFailure("query", query.queryKey, err),
  }),
  mutationCache: new MutationCache({
    onError: (err, _vars, _ctx, mutation) =>
      logFailure("mutation", mutation.options.mutationKey ?? "?", err),
  }),
});
