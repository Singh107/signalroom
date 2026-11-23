import { z } from 'zod/v4'

// Strict input rejects creator/ACL/timestamp spoofing as well as unknown fields.
export const incidentInput = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().max(2000).optional().default(''),
  service: z.string().trim().min(1),
  severity: z.enum(['sev1', 'sev2', 'sev3']),
  status: z.literal('open').optional().default('open'),
}).strict()

export type Incident = z.infer<typeof incidentInput> & { participantIds: string[] }
