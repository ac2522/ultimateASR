import { z } from "zod";
export const TranscriptSchema = z.object({
  id: z.string(), at: z.number(), text: z.string(), engine: z.string(),
});
export type Transcript = z.infer<typeof TranscriptSchema>;
