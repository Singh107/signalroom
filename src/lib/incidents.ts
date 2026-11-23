import { z } from 'zod/v4'
import { INCIDENT_STATUSES, type IncidentStatus } from './incident-lifecycle'

// Strict input rejects creator/ACL/timestamp spoofing as well as unknown fields.
export const incidentInput = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().max(2000).optional().default(''),
  service: z.string().trim().min(1),
  severity: z.enum(['sev1', 'sev2', 'sev3']),
  status: z.literal('open').optional().default('open'),
}).strict()

export const incidentTransitionInput = z.object({
  incidentId: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  status: z.enum(INCIDENT_STATUSES),
}).strict()

export type Incident = Omit<z.infer<typeof incidentInput>, 'status'> & {
  status: IncidentStatus
  participantIds: string[]
  resolvedAt?: string | null
}
