import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { incidentInput } from '../lib/incidents'
import { canAccessIncidents, INCIDENT_PARTICIPANTS } from '../lib/incident-access'

export const createIncident: ActionHandler<Env> = async ({ userId, params, tools }) => {
  if (!canAccessIncidents(userId)) {
    return { success: false, code: 'forbidden', error: 'You are not an incident participant.' }
  }
  const parsed = incidentInput.safeParse(params)
  if (!parsed.success) {
    return { success: false, code: 'validation_failed', error: parsed.error.issues.map((issue) => issue.message).join('; ') }
  }
  // Action tools bypass RBAC, so authorize and validate BEFORE calling them.
  // The DO generates recordId and stamps verified caller/timestamps in the envelope.
  return tools.create('incidents', { ...parsed.data, status: 'open', participantIds: [...INCIDENT_PARTICIPANTS] })
}

export const actions: Record<string, ActionHandler<Env>> = { createIncident }
