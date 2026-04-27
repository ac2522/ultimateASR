import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Transcript } from "@shared/transcript";
import { api } from "@/lib/ipc";

const KEY = ["transcripts"] as const;

export function useTranscripts() {
  return useQuery({ queryKey: KEY, queryFn: () => api.transcripts.list() });
}

export function useClearTranscripts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.transcripts.clear(),
    onSuccess: () => qc.setQueryData<Transcript[]>(KEY, []),
  });
}
