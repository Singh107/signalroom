import { describe, expect, it, vi } from 'vitest'
import type { ActionContext } from 'deepspace/worker'
import type { Env } from '../../worker'
import { postIncidentUpdate } from './incident-activity'
import { INCIDENT_PARTICIPANTS, incidentReadPermission } from '../lib/incident-access'
import { incidentActivitySchema } from '../schemas/incident-activity-schema'

function context(params: Record<string, unknown>, userId: string = INCIDENT_PARTICIPANTS[1]) {
  const get = vi.fn().mockResolvedValue({ success: true, data: { record: { recordId: 'parent-1' } } })
  const create = vi.fn().mockResolvedValue({ success: true, data: { recordId: 'event-1' } })
  const update = vi.fn()
  return { ctx: { userId, params, tools: { get, create, update } } as unknown as ActionContext<Env>, get, create, update }
}

describe('incident activity', () => {
  it.each([1, 1000])('posts trimmed message boundary %i with server-selected type and grants', async (length) => {
    const message = 'x'.repeat(length)
    const { ctx, get, create, update } = context({ incidentId: 'parent-1', message: ` ${message} ` })
    expect(await postIncidentUpdate(ctx)).toMatchObject({ success: true })
    expect(get).toHaveBeenCalledExactlyOnceWith('incidents', 'parent-1')
    expect(create).toHaveBeenCalledExactlyOnceWith('incidentActivity', { incidentId: 'parent-1', message, eventType: 'user_update', participantIds: [...INCIDENT_PARTICIPANTS] })
    expect(update).not.toHaveBeenCalled()
  })
  it.each([
    { message: '' }, { message: ' \n\t ' }, { message: 'x'.repeat(1001) }, { message: 42 },
    { incidentId: '' }, { incidentId: '../parent' }, { incidentId: 'x'.repeat(129) }, { incidentId: ['parent-1'] },
    { actor: 'spoof' }, { createdBy: 'spoof' }, { timestamp: 'spoof' }, { createdAt: 'spoof' },
    { eventType: 'status_changed' }, { participantIds: ['spoof'] }, { recordId: 'spoof' },
  ])('rejects malformed or forged input %j before accessing storage', async (patch) => {
    const { ctx, get, create } = context({ incidentId: 'parent-1', message: 'Investigating', ...patch })
    expect(await postIncidentUpdate(ctx)).toMatchObject({ success: false, code: 'validation_failed' })
    expect(get).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
  it.each(['outsider', ''])('denies caller %j before reading', async (userId) => {
    const { ctx, get, create } = context({}, userId)
    expect(await postIncidentUpdate(ctx)).toMatchObject({ success: false, code: 'forbidden' })
    expect(get).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
  it('rejects missing parent without creating an event', async () => {
    const { ctx, get, create } = context({ incidentId: 'missing', message: 'Update' })
    get.mockResolvedValue({ success: false, error: 'Record not found' })
    expect(await postIncidentUpdate(ctx)).toMatchObject({ success: false, error: 'Record not found' })
    expect(create).not.toHaveBeenCalled()
  })
  it('returns event write failure without updating the incident', async () => {
    const { ctx, create, update } = context({ incidentId: 'parent-1', message: 'Update' })
    create.mockResolvedValue({ success: false, error: 'Storage unavailable' })
    expect(await postIncidentUpdate(ctx)).toEqual({ success: false, error: 'Storage unavailable' })
    expect(update).not.toHaveBeenCalled()
  })
  it('denies native mutations and protects parent and event content', () => {
    for (const [role, permissions] of Object.entries(incidentActivitySchema.permissions)) {
      expect(permissions).toEqual({ read: role === '*' ? false : incidentReadPermission(), create: false, update: false, delete: false })
    }
    for (const name of ['incidentId', 'eventType', 'message']) {
      expect(incidentActivitySchema.columns.find((column) => column.name === name)).toMatchObject({ required: true, immutable: true })
    }
  })
})
