import { z } from "zod";
import { SCAM_TYPES } from "@/domain/types";

export const JudgementSchema = z.object({
  level: z.enum(["low", "medium", "high"]),
  scamType: z.enum(SCAM_TYPES),
  reasons: z.array(z.string().min(1).max(240)).max(10),
  impersonatedRequester: z
    .object({ kind: z.enum(["person", "organisation"]), name: z.string().min(1).max(80) })
    .nullable(),
});
