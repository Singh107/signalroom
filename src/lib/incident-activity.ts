import { z } from 'zod/v4'

export const incidentUpdateInput = z.object({
  incidentId: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  message: z.string().trim().min(1).max(1000),
}).strict()

export type IncidentActivity = {
  incidentId: string
  eventType: 'user_update'
  message: string
  participantIds: string[]
}
