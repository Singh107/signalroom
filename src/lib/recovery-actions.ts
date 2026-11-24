import { z } from 'zod/v4'

const recordId = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/)

export const addRecoveryActionInput = z.object({
  incidentId: recordId,
  description: z.string().trim().min(3).max(200),
}).strict()

export const completeRecoveryActionInput = z.object({ actionId: recordId }).strict()

export type RecoveryAction = {
  incidentId: string
  description: string
  status: 'pending' | 'complete'
  completedAt?: string | null
  participantIds: string[]
}
