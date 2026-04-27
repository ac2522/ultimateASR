import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Settings } from "@shared/settings-shape";
import { api } from "@/lib/ipc";

const KEY = ["settings"] as const;

export function useSettings() {
  return useQuery({ queryKey: KEY, queryFn: () => api.settings.get() });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Settings>) => api.settings.set(patch),
    onSuccess: (next) => qc.setQueryData(KEY, next),
  });
}
