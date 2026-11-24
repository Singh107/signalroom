import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { privateWorkspace, type WorkspaceAccess } from '../lib/workspace-access'
import { incidentUpdateInput } from '../lib/incident-activity'

export function createActivityActions(access: WorkspaceAccess = privateWorkspace) {
  const postIncidentUpdate: ActionHandler<Env> = async ({ userId, params, tools }) => {
    if (!access.allows(userId)) return { success: false, code: 'forbidden', error: 'You are not an incident participant.' }
    const parsed = incidentUpdateInput.safeParse(params)
    if (!parsed.success) return { success: false, code: 'validation_failed', error: 'Provide an incident ID and an update of 1–1000 characters only.' }
    const parent = await tools.get('incidents', parsed.data.incidentId)
    if (!parent.success) return parent
    // One independent event write; never combined with an incident/recovery mutation.
    // The verified caller and DO clock supply createdBy and createdAt in the envelope.
    return tools.create('incidentActivity', {
      ...parsed.data, eventType: 'user_update', participantIds: [...access.participants],
    })
  }

  return { postIncidentUpdate }
}
export const { postIncidentUpdate } = createActivityActions()
