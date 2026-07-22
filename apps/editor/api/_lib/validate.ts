import { z } from 'zod';

// Structural check of the behavior3 project payload. The server stores the
// JSON opaquely, so this only guards the fields sync depends on plus the
// overall shape — full semantic validation stays client-side (parseImportedJson).

const b3ProjectSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    scope: z.literal('project'),
    trees: z.array(z.object({}).passthrough()),
    updatedAt: z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)), 'invalid timestamp'),
  })
  .passthrough();

export type ValidatedProject = z.infer<typeof b3ProjectSchema>;

export const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;

export function validateProjectPayload(
  data: unknown
): { ok: true; project: ValidatedProject } | { ok: false; error: string } {
  const parsed = b3ProjectSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: `Not a behavior3 project: ${parsed.error.issues[0]?.message}` };
  }
  if (JSON.stringify(data).length > MAX_PAYLOAD_BYTES) {
    return { ok: false, error: 'Project exceeds the 2 MB sync limit' };
  }
  return { ok: true, project: parsed.data };
}
