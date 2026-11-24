import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { canAccessIncidents, INCIDENT_PARTICIPANTS } from '../lib/incident-access'
import { incidentUpdateInput } from '../lib/incident-activity'

export const postIncidentUpdate: ActionHandler<Env> = async ({ userId, params, tools }) => {
  if (!canAccessIncidents(userId)) return { success: false, code: 'forbidden', error: 'You are not an incident participant.' }
  const parsed = incidentUpdateInput.safeParse(params)
  if (!parsed.success) return { success: false, code: 'validation_failed', error: 'Provide an incident ID and an update of 1–1000 characters only.' }
  const parent = await tools.get('incidents', parsed.data.incidentId)
  if (!parent.success) return parent
  // One independent event write; never combined with an incident/recovery mutation.
  // The verified caller and DO clock supply createdBy and createdAt in the envelope.
  return tools.create('incidentActivity', {
    ...parsed.data, eventType: 'user_update', participantIds: [...INCIDENT_PARTICIPANTS],
  })
}
