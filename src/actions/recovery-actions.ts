import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { privateWorkspace, type WorkspaceAccess } from '../lib/workspace-access'
import { addRecoveryActionInput, completeRecoveryActionInput, type RecoveryAction } from '../lib/recovery-actions'

export function createRecoveryActions(access: WorkspaceAccess = privateWorkspace) {
  const addRecoveryAction: ActionHandler<Env> = async ({ userId, params, tools }) => {
    if (!access.allows(userId)) return { success: false, code: 'forbidden', error: 'You are not an incident participant.' }
    const parsed = addRecoveryActionInput.safeParse(params)
    if (!parsed.success) return { success: false, code: 'validation_failed', error: 'Provide an incident ID and a description of 3–200 characters only.' }
    // Reference metadata is not a foreign-key guarantee: verify the parent ourselves.
    const parent = await tools.get('incidents', parsed.data.incidentId)
    if (!parent.success) return parent
    return tools.create('recoveryActions', {
      ...parsed.data, status: 'pending', participantIds: [...access.participants],
    })
  }

  const completeRecoveryAction: ActionHandler<Env> = async ({ userId, params, tools }) => {
    if (!access.allows(userId)) return { success: false, code: 'forbidden', error: 'You are not an incident participant.' }
    const parsed = completeRecoveryActionInput.safeParse(params)
    if (!parsed.success) return { success: false, code: 'validation_failed', error: 'Provide a valid recovery action ID only.' }
    const { actionId } = parsed.data
    const current = await tools.get<RecoveryAction>('recoveryActions', actionId)
    if (!current.success) return current
    // Use the stored relationship, never a parent ID supplied with completion.
    const parent = await tools.get('incidents', current.data.record.data.incidentId)
    if (!parent.success) return parent
    if (current.data.record.data.status === 'complete') return { success: true, data: { recordId: actionId } }
    if (current.data.record.data.status !== 'pending') return { success: false, code: 'invalid_state', error: 'Recovery action has an invalid completion state.' }
    // The DO's timestamp trigger runs only on a status change. Repeated complete
    // patches preserve completedAt, including competing requests that read pending.
    return tools.update<RecoveryAction>('recoveryActions', actionId, { status: 'complete' })
  }

  return { addRecoveryAction, completeRecoveryAction }
}
export const { addRecoveryAction, completeRecoveryAction } = createRecoveryActions()
