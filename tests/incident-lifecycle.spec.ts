import { test, expect } from 'deepspace/testing'
import { captureConsoleErrors } from './helpers/errors'
import type { Page } from '@playwright/test'
import { clientBuild } from 'deepspace'
import { postIncident, postIncidentAction, readIncidents, recordRequest } from './helpers/incidents'

async function create(page: Page) {
  const result = await postIncident(page, { title: `__test-${crypto.randomUUID()} lifecycle`, service: 'API', severity: 'sev2' })
  expect(result.body.success).toBe(true)
  return result.body.data.recordId as string
}

async function read(page: Page, id: string) {
  const result = await readIncidents(page)
  const records = result.records as Array<{ recordId: string; createdBy: string; createdAt: string; updatedAt: string; data: { status: string; resolvedAt?: string | null } }>
  const record = records.find((entry) => entry.recordId === id)
  expect(record).toBeDefined()
  return record!
}

test('lifecycle controls persist all three transitions and preserve creation metadata', async ({ users }) => {
  const [a] = await users(['Participant A'])
  const errors = captureConsoleErrors(a.page)
  await a.page.goto('/incidents')
  const id = await create(a.page)
  const before = await read(a.page, id)
  const row = a.page.locator(`[data-record-id="${id}"]`)
  let firstResolution = ''
  for (const [button, status] of [
    ['Start investigating', 'investigating'], ['Resolve incident', 'resolved'], ['Reopen investigation', 'investigating'],
  ]) {
    await row.getByRole('button', { name: button, exact: true }).click()
    await expect(row.getByText(`API · sev2 · ${status}`, { exact: true })).toBeVisible()
    await a.page.reload()
    await expect(row.getByText(`API · sev2 · ${status}`, { exact: true })).toBeVisible()
    const after = await read(a.page, id)
    expect(after.createdBy).toBe(before.createdBy)
    expect(after.createdAt).toBe(before.createdAt)
    expect(after.data.status).toBe(status)
    expect(Date.parse(after.updatedAt)).toBeGreaterThanOrEqual(Date.parse(before.updatedAt))
    if (status === 'resolved') {
      expect(Number.isFinite(Date.parse(after.data.resolvedAt!))).toBe(true)
      firstResolution = after.data.resolvedAt!
    } else expect(after.data.resolvedAt ?? null).toBeNull()
  }
  // A second resolution stamps a new time rather than retaining the first one.
  expect((await postIncidentAction(a.page, 'transitionIncident', { incidentId: id, status: 'resolved' })).body.success).toBe(true)
  expect(Date.parse((await read(a.page, id)).data.resolvedAt!)).toBeGreaterThan(Date.parse(firstResolution))
  expect(errors).toEqual([])
})

test('server rejects skipped, backward and repeated transitions without changing records', async ({ users }) => {
  const [a] = await users(['Participant A'])
  await a.page.goto('/incidents')
  const id = await create(a.page)
  for (const [current, rejected] of [
    ['open', ['open', 'resolved']], ['investigating', ['open', 'investigating']], ['resolved', ['open', 'resolved']],
  ] as const) {
    if (current !== 'open') expect((await postIncidentAction(a.page, 'transitionIncident', { incidentId: id, status: current })).body.success).toBe(true)
    const before = await read(a.page, id)
    for (const status of rejected) {
      expect((await postIncidentAction(a.page, 'transitionIncident', { incidentId: id, status })).body).toMatchObject({ success: false, code: 'invalid_transition' })
      expect(await read(a.page, id)).toEqual(before)
    }
  }
})

test('server rejects unknown status, malformed IDs and metadata spoofing', async ({ users }) => {
  const [a] = await users(['Participant A'])
  await a.page.goto('/incidents')
  const id = await create(a.page)
  const before = await read(a.page, id)
  for (const patch of [{ status: 'closed' }, { incidentId: '' }, { incidentId: '../wrong' }, { createdBy: 'spoof' }, { createdAt: 'spoof' }, { resolvedAt: 'spoof' }, { participantIds: ['spoof'] }]) {
    expect((await postIncidentAction(a.page, 'transitionIncident', { incidentId: id, status: 'investigating', ...patch })).body).toMatchObject({ success: false, code: 'validation_failed' })
  }
  expect(await read(a.page, id)).toEqual(before)
})

test('server rejects a well-formed unknown incident ID', async ({ users }) => {
  const [a] = await users(['Participant A'])
  await a.page.goto('/incidents')
  const result = await postIncidentAction(a.page, 'transitionIncident', { incidentId: `missing-${crypto.randomUUID()}`, status: 'investigating' })
  expect(result.body.success).toBe(false)
  expect(result.body.error).toContain('Record not found')
})

test('nonparticipant and signed-out callers cannot transition an existing incident', async ({ users, request }) => {
  const [a, b] = await users(['Participant A', 'Participant B'])
  await a.page.goto('/incidents')
  const id = await create(a.page)
  const before = await read(a.page, id)
  await b.page.goto('/incidents')
  const data = { incidentId: id, status: 'investigating' }
  expect((await postIncidentAction(b.page, 'transitionIncident', data)).body).toMatchObject({ success: false, code: 'forbidden' })
  expect((await request.post('/api/actions/transitionIncident', { data })).status()).toBe(401)
  expect(await read(a.page, id)).toEqual(before)
  expect((await readIncidents(b.page)).records).toEqual([])
})

test('direct native record update cannot bypass the transition action', async ({ users }) => {
  const [a] = await users(['Participant A'])
  await a.page.goto('/incidents')
  const id = await create(a.page)
  const before = await read(a.page, id)
  const ack = await recordRequest(a.page, clientBuild.put('incidents', id, { status: 'resolved' }, crypto.randomUUID()), 'records.ack')
  expect(ack.success).toBe(false)
  expect(await read(a.page, id)).toEqual(before)
})

test('pending lifecycle control is disabled and a genuine server rejection is shown', async ({ users }) => {
  const [a] = await users(['Participant A'])
  await a.page.goto('/incidents')
  const id = await create(a.page)
  const row = a.page.locator(`[data-record-id="${id}"]`)
  let release!: () => void
  const hold = new Promise<void>((resolve) => { release = resolve })
  await a.page.route('**/api/actions/transitionIncident', async (route) => {
    await hold
    // Send an invalid transition to the actual server; do not mock its response.
    await route.continue({ postData: JSON.stringify({ incidentId: id, status: 'resolved' }) })
  })
  await row.getByRole('button', { name: 'Start investigating' }).click()
  try { await expect(row.getByRole('button', { name: 'Updating…' })).toBeDisabled() } finally { release() }
  await expect(row.getByRole('alert')).toContainText('Cannot change status from open to resolved')
  await expect(row.getByText('API · sev2 · open', { exact: true })).toBeVisible()
  await expect(row.getByRole('button', { name: 'Start investigating' })).toBeEnabled()
})
