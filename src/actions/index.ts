import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { incidentInput, incidentTransitionInput, type Incident } from '../lib/incidents'
import { canTransitionIncident } from '../lib/incident-lifecycle'
import { canAccessIncidents, INCIDENT_PARTICIPANTS } from '../lib/incident-access'
import { addRecoveryAction, completeRecoveryAction } from './recovery-actions'
import { postIncidentUpdate } from './incident-activity'

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

export const transitionIncident: ActionHandler<Env> = async ({ userId, params, tools }) => {
  if (!canAccessIncidents(userId)) {
    return { success: false, code: 'forbidden', error: 'You are not an incident participant.' }
  }
  const parsed = incidentTransitionInput.safeParse(params)
  if (!parsed.success) {
    return { success: false, code: 'validation_failed', error: 'Provide a valid incident ID and status only.' }
  }
  const { incidentId, status } = parsed.data
  const current = await tools.get<Incident>('incidents', incidentId)
  if (!current.success) return current
  if (!canTransitionIncident(current.data.record.data.status, status)) {
    return { success: false, code: 'invalid_transition', error: `Cannot change status from ${current.data.record.data.status} to ${status}. Refresh and try the available action.` }
  }
  // get + update are separate calls, NOT a compare-and-swap transaction.
  // The DO stamps resolvedAt on entering resolved; reopening explicitly clears it.
  // Only these fields change; creator/createdAt and other incident data are preserved.
  return tools.update<Incident>('incidents', incidentId, status === 'resolved' ? { status } : { status, resolvedAt: null })
}

export const actions: Record<string, ActionHandler<Env>> = { createIncident, transitionIncident, addRecoveryAction, completeRecoveryAction, postIncidentUpdate }
