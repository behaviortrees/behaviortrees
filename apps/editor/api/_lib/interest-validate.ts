import { z } from 'zod';

export const commercialInterestSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email('Enter a valid email address').max(320, 'Email address is too long')),
  plan: z.enum(['pro', 'team', 'integration']),
  runtime: z.enum([
    'unity',
    'unreal',
    'godot',
    'behaviortree_cpp_ros2',
    'custom_engine',
    'javascript_web',
    'evaluating',
    'other',
  ]),
  usageMode: z.enum(['solo', 'team_2_5', 'team_6_20', 'team_21_plus']),
  obstacle: z.enum([
    'runtime_integration',
    'testing_debugging',
    'collaboration_review',
    'version_control',
    'tree_validation',
    'runtime_portability',
    'learning',
    'other',
  ]),
  obstacleDetail: z.string().trim().max(1000).optional(),
  sourcePath: z.string().trim().max(500).default('/pricing'),
  contactConsent: z.literal(true, {
    error: 'Confirm that we may contact you about this request',
  }),
  website: z.string().max(200).optional(),
});

export type ValidatedCommercialInterest = z.infer<typeof commercialInterestSchema>;

export function validateCommercialInterest(
  input: unknown
):
  | { ok: true; interest: ValidatedCommercialInterest }
  | { ok: false; error: string } {
  const parsed = commercialInterestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid request',
    };
  }
  return { ok: true, interest: parsed.data };
}
