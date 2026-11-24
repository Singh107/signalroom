import { test, expect } from 'deepspace/testing'
import type { Page } from '@playwright/test'
import { clientBuild } from 'deepspace'
import type { RecoveryAction } from '../src/lib/recovery-actions'
import { postIncident, postIncidentAction, readIncidents, recordRequest } from './helpers/incidents'
import { captureConsoleErrors } from './helpers/errors'

async function createIncident(page: Page) {
  const result = await postIncident(page, { title: `__test-${crypto.randomUUID()} recovery`, service: 'API', severity: 'sev2' })
  expect(result.body.success).toBe(true)
  return result.body.data.recordId as string
}
async function add(page: Page, incidentId: string, description = 'Restart service') {
  const result = await postIncidentAction(page, 'addRecoveryAction', { incidentId, description })
  expect(result.body.success).toBe(true)
  return result.body.data.recordId as string
}
async function read(page: Page, incidentId?: string) {
  const result = await recordRequest(page, clientBuild.subscribe('recovery-test', { collection: 'recoveryActions', ...(incidentId ? { where: { incidentId } } : {}) }), 'core.query_result')
  return result.records as Array<{ recordId: string; createdBy: string; createdAt: string; updatedAt: string; data: RecoveryAction }>
}

test('recovery creation and completion persist and synchronize between two authorized sessions', async ({ users, browser }) => {
  const [a] = await users(['Participant A'])
  await a.page.goto('/incidents')
  // Separate browser contexts, same authorized identity; no credentials leave memory.
  const second = await browser.newContext({ storageState: await a.context.storageState() })
  try {
    const other = await second.newPage()
    const errors = captureConsoleErrors(a.page)
    const otherErrors = captureConsoleErrors(other)
    const id = await createIncident(a.page)
    const otherId = await createIncident(a.page)
    const original = (await readIncidents(a.page)).records as Array<{ recordId: string }>
    const incidentBefore = original.find((record) => record.recordId === id)
    await other.goto(new URL('/incidents', a.page.url()).href)
    const row = a.page.locator(`[data-record-id="${id}"]`)
    const otherRow = other.locator(`[data-record-id="${id}"]`)
    await expect(otherRow.getByText('No recovery actions yet.')).toBeVisible()
    await row.getByLabel('Recovery description').fill('Restart the payment service')
    await row.getByRole('button', { name: 'Add recovery action', exact: true }).click()
    await expect(row.getByRole('status')).toHaveText('Recovery action saved.')
    await expect(otherRow.getByText('Restart the payment service', { exact: true })).toBeVisible()
    const [created] = await read(a.page, id)
    expect(created.createdBy).toBe(a.userId)
    expect(created.data.status).toBe('pending')
    expect(created.data.completedAt ?? null).toBeNull()
    expect(Number.isFinite(Date.parse(created.createdAt))).toBe(true)
    await expect(a.page.locator(`[data-record-id="${otherId}"]`).getByTestId('recovery-action')).toHaveCount(0)
    await otherRow.getByRole('button', { name: 'Mark complete', exact: true }).click()
    await expect(row.getByText(/^Completed:/)).toBeVisible()
    const [completed] = await read(a.page, id)
    expect(completed.data.status).toBe('complete')
    expect(Number.isFinite(Date.parse(completed.data.completedAt!))).toBe(true)
    expect(completed.createdBy).toBe(created.createdBy)
    expect(completed.createdAt).toBe(created.createdAt)
    for (const page of [a.page, other]) {
      await page.reload()
      await expect(page.locator(`[data-action-id="${created.recordId}"]`).getByText(/^Completed:/)).toBeVisible()
    }
    expect((await readIncidents(a.page)).records).toContainEqual(incidentBefore)
    expect(await read(a.page, otherId)).toEqual([])
    expect(errors).toEqual([])
    expect(otherErrors).toEqual([])
  } finally { await second.close() }
})

test('recovery description boundaries and unexpected fields are validated on server', async ({ users }) => {
  const [a] = await users(['Participant A'])
  await a.page.goto('/incidents')
  const id = await createIncident(a.page)
  for (const length of [3, 200]) await add(a.page, id, 'x'.repeat(length))
  for (const patch of [{ description: '' }, { description: 'ab' }, { description: '   ' }, { description: 'x'.repeat(201) }, { incidentId: '' }, { createdBy: 'spoof' }, { createdAt: 'spoof' }, { completedAt: 'spoof' }, { status: 'complete' }, { participantIds: ['spoof'] }]) {
    expect((await postIncidentAction(a.page, 'addRecoveryAction', { incidentId: id, description: 'Valid item', ...patch })).body).toMatchObject({ success: false, code: 'validation_failed' })
  }
  expect(await read(a.page, id)).toHaveLength(2)
})

test('missing parent and missing recovery action are rejected', async ({ users }) => {
  const [a] = await users(['Participant A'])
  await a.page.goto('/incidents')
  const missing = `missing-${crypto.randomUUID()}`
  for (const [name, data] of [['addRecoveryAction', { incidentId: missing, description: 'Restart service' }], ['completeRecoveryAction', { actionId: missing }]] as const) {
    const result = await postIncidentAction(a.page, name, data)
    expect(result.body.success).toBe(false)
    expect(result.body.error).toContain('Record not found')
  }
  expect(await read(a.page, missing)).toEqual([])
})

test('nonparticipant and signed-out recovery reads and operations are denied', async ({ users, page, request }) => {
  const [a, b] = await users(['Participant A', 'Participant B'])
  await a.page.goto('/incidents')
  const id = await createIncident(a.page)
  const actionId = await add(a.page, id)
  const before = await read(a.page, id)
  await b.page.goto('/incidents')
  await page.goto('/incidents')
  for (const [name, data] of [['addRecoveryAction', { incidentId: id, description: 'Unauthorized item' }], ['completeRecoveryAction', { actionId }]] as const) {
    expect((await postIncidentAction(b.page, name, data)).body).toMatchObject({ success: false, code: 'forbidden' })
    expect((await request.post(`/api/actions/${name}`, { data })).status()).toBe(401)
  }
  expect(await read(b.page)).toEqual([])
  expect(await read(page)).toEqual([])
  expect(await read(a.page, id)).toEqual(before)
})

test('native recovery writes and reparenting cannot bypass the actions', async ({ users }) => {
  const [a] = await users(['Participant A'])
  await a.page.goto('/incidents')
  const id = await createIncident(a.page)
  const otherId = await createIncident(a.page)
  const actionId = await add(a.page, id)
  const before = await read(a.page, id)
  for (const [recordId, data] of [[`__test-${crypto.randomUUID()}`, { incidentId: id, description: 'bad', status: 'complete' }], [actionId, { status: 'complete' }], [actionId, { incidentId: otherId }]] as const) {
    const ack = await recordRequest(a.page, clientBuild.put('recoveryActions', recordId, data, crypto.randomUUID()), 'records.ack')
    expect(ack.success).toBe(false)
  }
  for (const patch of [{ incidentId: otherId }, { completedAt: 'spoof' }, { createdBy: 'spoof' }, { status: 'pending' }]) {
    expect((await postIncidentAction(a.page, 'completeRecoveryAction', { actionId, ...patch })).body).toMatchObject({ success: false, code: 'validation_failed' })
  }
  expect(await read(a.page, id)).toEqual(before)
  expect(await read(a.page, otherId)).toEqual([])
})

test('duplicate and competing recovery completions keep the first completion timestamp', async ({ users }) => {
  const [a] = await users(['Participant A'])
  await a.page.goto('/incidents')
  const id = await createIncident(a.page)
  const actionId = await add(a.page, id)
  const results = await Promise.all([1, 2].map(() => postIncidentAction(a.page, 'completeRecoveryAction', { actionId })))
  for (const result of results) expect(result.body.success).toBe(true)
  const completed = await read(a.page, id)
  expect(completed[0].data.status).toBe('complete')
  expect(Number.isFinite(Date.parse(completed[0].data.completedAt!))).toBe(true)
  expect((await postIncidentAction(a.page, 'completeRecoveryAction', { actionId })).body.success).toBe(true)
  expect(await read(a.page, id)).toEqual(completed)
})

test('recovery form shows pending and real server validation errors', async ({ users }) => {
  const [a] = await users(['Participant A'])
  await a.page.goto('/incidents')
  const id = await createIncident(a.page)
  const row = a.page.locator(`[data-record-id="${id}"]`)
  let release!: () => void
  const hold = new Promise<void>((resolve) => { release = resolve })
  await a.page.route('**/api/actions/addRecoveryAction', async (route) => {
    await hold
    await route.continue({ postData: JSON.stringify({ incidentId: id, description: 'ab' }) })
  })
  await row.getByLabel('Recovery description').fill('Restart service')
  await row.getByRole('button', { name: 'Add recovery action', exact: true }).click()
  try { await expect(row.getByRole('button', { name: 'Adding…' })).toBeDisabled() } finally { release() }
  await expect(row.getByRole('alert')).toContainText('3–200 characters')
  expect(await read(a.page, id)).toEqual([])
})
