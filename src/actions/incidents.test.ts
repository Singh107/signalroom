import { describe, expect, it, vi } from 'vitest'
import type { ActionContext } from 'deepspace/worker'
import type { Env } from '../../worker'
import { transitionIncident } from './index'
import { INCIDENT_PARTICIPANTS } from '../lib/incident-access'
import { nextIncidentStatus } from '../lib/incident-lifecycle'

function context(current = 'open', params: Record<string, unknown> = { incidentId: 'incident-1', status: 'investigating' }, userId: string = INCIDENT_PARTICIPANTS[1]) {
  const get = vi.fn().mockResolvedValue({ success: true, data: { record: {
    recordId: 'incident-1', createdBy: 'original-creator', createdAt: '2026-11-23T00:00:00.000Z',
    data: { status: current, title: 'Original title' },
  } } })
  const update = vi.fn().mockResolvedValue({ success: true, data: { recordId: 'incident-1' } })
  return { ctx: { userId, params, tools: { get, update } } as unknown as ActionContext<Env>, get, update }
}

describe('server incident transitions', () => {
  it.each([
    ['open', 'investigating', true], ['investigating', 'resolved', true], ['resolved', 'investigating', true],
    ['open', 'resolved', false], ['investigating', 'open', false], ['resolved', 'open', false],
    ['open', 'open', false], ['investigating', 'investigating', false], ['resolved', 'resolved', false],
  ])('%s -> %s allowed=%s', async (current, status, allowed) => {
    const { ctx, get, update } = context(current, { incidentId: 'incident-1', status })
    const result = await transitionIncident(ctx)
    expect(get).toHaveBeenCalledWith('incidents', 'incident-1')
    expect(result.success).toBe(allowed)
    if (allowed) {
      // Exact patch also proves creator, creation time, title and ACL are not overwritten.
      expect(update).toHaveBeenCalledExactlyOnceWith('incidents', 'incident-1', status === 'resolved' ? { status } : { status, resolvedAt: null })
    } else {
      expect(result).toMatchObject({ code: 'invalid_transition' })
      expect(update).not.toHaveBeenCalled()
    }
  })

  it.each([
    { incidentId: '', status: 'investigating' },
    { incidentId: '../incident', status: 'investigating' },
    { incidentId: 'x'.repeat(129), status: 'investigating' },
    { incidentId: 123, status: 'investigating' },
    { incidentId: 'incident-1', status: 'unknown' },
    { incidentId: 'incident-1', status: null },
    { incidentId: 'incident-1' },
    { incidentId: 'incident-1', status: 'investigating', createdBy: 'spoof' },
    { incidentId: 'incident-1', status: 'resolved', resolvedAt: 'spoof' },
  ])('rejects malformed or spoofed input %j before reading', async (params) => {
    const { ctx, get, update } = context('open', params)
    expect(await transitionIncident(ctx)).toMatchObject({ success: false, code: 'validation_failed' })
    expect(get).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it.each(['outsider', ''])('denies unauthorized caller %j before reading', async (userId) => {
    const { ctx, get, update } = context('open', undefined, userId)
    expect(await transitionIncident(ctx)).toMatchObject({ success: false, code: 'forbidden' })
    expect(get).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('rejects an unknown stored status', async () => {
    const { ctx, update } = context('corrupt')
    expect(await transitionIncident(ctx)).toMatchObject({ success: false, code: 'invalid_transition' })
    expect(update).not.toHaveBeenCalled()
    expect(nextIncidentStatus('corrupt')).toBeNull()
  })

  it('preserves a failed lookup and never updates', async () => {
    const { ctx, get, update } = context()
    get.mockResolvedValue({ success: false, error: 'Record not found' })
    expect(await transitionIncident(ctx)).toEqual({ success: false, error: 'Record not found' })
    expect(update).not.toHaveBeenCalled()
  })

  it('reports a failed write as failure', async () => {
    const { ctx, update } = context()
    update.mockResolvedValue({ success: false, error: 'Storage unavailable' })
    expect(await transitionIncident(ctx)).toEqual({ success: false, error: 'Storage unavailable' })
  })
})
