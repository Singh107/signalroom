import { describe, expect, it, vi } from 'vitest'
import type { ActionContext } from 'deepspace/worker'
import type { Env } from '../../worker'
import { addRecoveryAction, completeRecoveryAction } from './recovery-actions'
import { INCIDENT_PARTICIPANTS, incidentReadPermission } from '../lib/incident-access'
import { recoveryActionsSchema } from '../schemas/recovery-actions-schema'

function context(params: Record<string, unknown>, status = 'pending', userId: string = INCIDENT_PARTICIPANTS[1]) {
  const get = vi.fn().mockImplementation(async (collection: string) => ({ success: true, data: { record: {
    recordId: collection === 'incidents' ? 'parent-1' : 'action-1',
    createdBy: 'original', createdAt: '2026-11-23T00:00:00.000Z',
    data: collection === 'incidents' ? { status: 'open' } : { incidentId: 'parent-1', status },
  } } }))
  const create = vi.fn().mockResolvedValue({ success: true, data: { recordId: 'action-1' } })
  const update = vi.fn().mockResolvedValue({ success: true, data: { recordId: 'action-1' } })
  return { ctx: { userId, params, tools: { get, create, update } } as unknown as ActionContext<Env>, get, create, update }
}

describe('recovery actions', () => {
  it.each([3, 200])('creates a trimmed description at boundary %i with server-owned fields', async (length) => {
    const description = 'x'.repeat(length)
    const { ctx, get, create, update } = context({ incidentId: 'parent-1', description: ` ${description} ` })
    expect((await addRecoveryAction(ctx)).success).toBe(true)
    expect(get).toHaveBeenCalledExactlyOnceWith('incidents', 'parent-1')
    expect(create).toHaveBeenCalledExactlyOnceWith('recoveryActions', { incidentId: 'parent-1', description, status: 'pending', participantIds: [...INCIDENT_PARTICIPANTS] })
    expect(update).not.toHaveBeenCalled()
  })
  it.each([
    { description: '' }, { description: 'ab' }, { description: '   ' }, { description: 'x'.repeat(201) },
    { description: 123 }, { incidentId: '' }, { incidentId: '../parent' }, { incidentId: ['parent-1'] },
    { createdBy: 'spoof' }, { createdAt: 'spoof' }, { completedAt: 'spoof' }, { status: 'complete' }, { participantIds: ['spoof'] },
  ])('rejects invalid creation %j before accessing records', async (patch) => {
    const { ctx, get, create } = context({ incidentId: 'parent-1', description: 'Restart service', ...patch })
    expect(await addRecoveryAction(ctx)).toMatchObject({ success: false, code: 'validation_failed' })
    expect(get).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
  it.each([addRecoveryAction, completeRecoveryAction])('denies nonparticipants before record access', async (handler) => {
    const { ctx, get, create, update } = context({}, 'pending', 'outsider')
    expect(await handler(ctx)).toMatchObject({ success: false, code: 'forbidden' })
    expect(get).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })
  it('rejects a nonexistent parent on creation', async () => {
    const { ctx, get, create } = context({ incidentId: 'missing', description: 'Restart service' })
    get.mockResolvedValue({ success: false, error: 'Record not found' })
    expect(await addRecoveryAction(ctx)).toMatchObject({ success: false, error: 'Record not found' })
    expect(create).not.toHaveBeenCalled()
  })
  it('completes with a status-only patch and verifies the stored parent', async () => {
    const { ctx, get, update } = context({ actionId: 'action-1' })
    expect((await completeRecoveryAction(ctx)).success).toBe(true)
    expect(get.mock.calls).toEqual([['recoveryActions', 'action-1'], ['incidents', 'parent-1']])
    expect(update).toHaveBeenCalledExactlyOnceWith('recoveryActions', 'action-1', { status: 'complete' })
  })
  it('returns success without writing for duplicate completion', async () => {
    const { ctx, update } = context({ actionId: 'action-1' }, 'complete')
    expect(await completeRecoveryAction(ctx)).toEqual({ success: true, data: { recordId: 'action-1' } })
    expect(update).not.toHaveBeenCalled()
  })
  it.each([{}, { actionId: '' }, { actionId: '../wrong' }, { actionId: 'x'.repeat(129) }, { actionId: 'action-1', incidentId: 'other' }, { actionId: 'action-1', completedAt: 'spoof' }, { actionId: 'action-1', status: 'pending' }])('rejects malformed completion %j', async (params) => {
    const { ctx, get, update } = context(params)
    expect(await completeRecoveryAction(ctx)).toMatchObject({ success: false, code: 'validation_failed' })
    expect(get).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })
  it.each([1, 2])('does not update when lookup %i fails', async (failedLookup) => {
    const { ctx, get, update } = context({ actionId: 'action-1' })
    if (failedLookup === 2) get.mockResolvedValueOnce({ success: true, data: { record: { data: { incidentId: 'missing', status: 'pending' } } } })
    get.mockResolvedValueOnce({ success: false, error: 'Record not found' })
    expect(await completeRecoveryAction(ctx)).toMatchObject({ success: false })
    expect(update).not.toHaveBeenCalled()
  })
  it('rejects corrupt completion state', async () => {
    const { ctx, update } = context({ actionId: 'action-1' }, 'unknown')
    expect(await completeRecoveryAction(ctx)).toMatchObject({ success: false, code: 'invalid_state' })
    expect(update).not.toHaveBeenCalled()
  })
  it('propagates a write failure', async () => {
    const { ctx, update } = context({ actionId: 'action-1' })
    update.mockResolvedValue({ success: false, error: 'Write failed' })
    expect(await completeRecoveryAction(ctx)).toMatchObject({ success: false, error: 'Write failed' })
  })
  it('guards native reads and denies every direct mutation with an immutable parent', () => {
    for (const [role, permissions] of Object.entries(recoveryActionsSchema.permissions)) {
      expect(permissions).toEqual({ read: role === '*' ? false : incidentReadPermission(), create: false, update: false, delete: false })
    }
    expect(recoveryActionsSchema.columns.find((column) => column.name === 'incidentId')).toMatchObject({ required: true, immutable: true })
  })
})
