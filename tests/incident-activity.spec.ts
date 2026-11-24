import { test, expect } from 'deepspace/testing'
import type { Page } from '@playwright/test'
import { clientBuild } from 'deepspace'
import type { IncidentActivity } from '../src/lib/incident-activity'
import { postIncident, postIncidentAction, readIncidents, recordRequest } from './helpers/incidents'
import { captureConsoleErrors } from './helpers/errors'

async function create(page: Page) {
  const title = `__test-${crypto.randomUUID()} timeline`
  const result = await postIncident(page, { title, service: 'API', severity: 'sev2' })
  expect(result.body.success).toBe(true)
  return { id: result.body.data.recordId as string, title }
}
async function read(page: Page, incidentId?: string) {
  const result = await recordRequest(page, clientBuild.subscribe('activity-test', { collection: 'incidentActivity', ...(incidentId ? { where: { incidentId } } : {}), orderBy: 'createdAt', orderDir: 'asc' }), 'core.query_result')
  return result.records as Array<{ recordId: string; createdBy: string; createdAt: string; data: IncidentActivity }>
}

test('detail timeline preserves actors, ordering and updates across sessions and refresh', async ({ users, browser }) => {
  const [a] = await users(['Participant A'])
  const errors = captureConsoleErrors(a.page)
  await a.page.goto('/incidents')
  const { id, title } = await create(a.page)
  const isolated = await create(a.page)
  const before = (await readIncidents(a.page)).records as Array<{ recordId: string }>
  const parent = before.find((record) => record.recordId === id)
  await a.page.locator(`[data-record-id="${id}"]`).getByRole('link', { name: 'View incident' }).click()
  await expect(a.page).toHaveURL(new RegExp(`/incidents/${id}$`))
  await expect(a.page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await expect(a.page.getByText('API · sev2 · open', { exact: true })).toBeVisible()
  await expect(a.page.getByText('No updates yet.', { exact: true })).toBeVisible()
  const second = await browser.newContext({ storageState: await a.context.storageState() })
  try {
    const other = await second.newPage()
    const otherErrors = captureConsoleErrors(other)
    await other.goto(a.page.url())
    await expect(other.getByText('No updates yet.', { exact: true })).toBeVisible()
    await a.page.getByLabel('Incident update', { exact: true }).fill('  First investigation update  ')
    await a.page.getByRole('button', { name: 'Post update', exact: true }).click()
    await expect(a.page.getByText('Update posted.', { exact: true })).toBeVisible()
    await expect(other.getByTestId('activity-message')).toHaveText(['First investigation update'])
    await other.getByLabel('Incident update', { exact: true }).fill('Second investigation update')
    await other.getByRole('button', { name: 'Post update', exact: true }).click()
    await expect(a.page.getByTestId('activity-message')).toHaveText(['First investigation update', 'Second investigation update'])
    const events = await read(a.page, id)
    expect(events).toHaveLength(2)
    expect(Date.parse(events[0].createdAt)).toBeLessThanOrEqual(Date.parse(events[1].createdAt))
    for (const event of events) {
      expect(event.createdBy).toBe(a.userId)
      expect(Number.isFinite(Date.parse(event.createdAt))).toBe(true)
      expect(event.data).toMatchObject({ incidentId: id, eventType: 'user_update' })
    }
    for (const page of [a.page, other]) {
      await page.reload()
      await expect(page.getByTestId('activity-message')).toHaveText(['First investigation update', 'Second investigation update'])
      for (const event of events) await expect(page.locator(`[data-event-id="${event.recordId}"]`)).toBeVisible()
    }
    expect((await readIncidents(a.page)).records).toContainEqual(parent)
    expect(await read(a.page, isolated.id)).toEqual([])
    await other.goto(new URL(`/incidents/${isolated.id}`, a.page.url()).href)
    await expect(other.getByText('No updates yet.', { exact: true })).toBeVisible()
    await expect(other.getByTestId('activity-event')).toHaveCount(0)
    expect(errors).toEqual([])
    expect(otherErrors).toEqual([])
  } finally { await second.close() }
})

test('update boundaries and forged fields are validated by the server', async ({ users }) => {
  const [a] = await users(['Participant A'])
  await a.page.goto('/incidents')
  const { id } = await create(a.page)
  for (const length of [1, 1000]) {
    expect((await postIncidentAction(a.page, 'postIncidentUpdate', { incidentId: id, message: 'x'.repeat(length) })).body.success).toBe(true)
  }
  for (const patch of [{ message: '' }, { message: ' \n ' }, { message: 'x'.repeat(1001) }, { incidentId: '' }, { incidentId: '../wrong' }, { actor: 'spoof' }, { timestamp: 'spoof' }, { createdBy: 'spoof' }, { createdAt: 'spoof' }, { eventType: 'incident_created' }, { participantIds: ['spoof'] }]) {
    expect((await postIncidentAction(a.page, 'postIncidentUpdate', { incidentId: id, message: 'Valid update', ...patch })).body).toMatchObject({ success: false, code: 'validation_failed' })
  }
  expect(await read(a.page, id)).toHaveLength(2)
})

test('missing incident cannot receive updates and detail shows not found', async ({ users }) => {
  const [a] = await users(['Participant A'])
  const id = `missing-${crypto.randomUUID()}`
  await a.page.goto(`/incidents/${id}`)
  await expect(a.page.getByRole('alert')).toHaveText('Incident not found.')
  await expect(a.page.getByRole('button', { name: 'Post update' })).toHaveCount(0)
  const result = await postIncidentAction(a.page, 'postIncidentUpdate', { incidentId: id, message: 'Update' })
  expect(result.body.success).toBe(false)
  expect(result.body.error).toContain('Record not found')
  expect(await read(a.page, id)).toEqual([])
})

test('unauthorized users cannot read timeline or post updates through any tested boundary', async ({ users, page, request }) => {
  const [a, b] = await users(['Participant A', 'Participant B'])
  await a.page.goto('/incidents')
  const { id } = await create(a.page)
  const data = { incidentId: id, message: 'Private update' }
  expect((await postIncidentAction(a.page, 'postIncidentUpdate', data)).body.success).toBe(true)
  await b.page.goto(`/incidents/${id}`)
  await expect(b.page.getByRole('alert')).toHaveText('You are not an incident participant.')
  expect((await postIncidentAction(b.page, 'postIncidentUpdate', data)).body).toMatchObject({ success: false, code: 'forbidden' })
  expect((await request.post('/api/actions/postIncidentUpdate', { data })).status()).toBe(401)
  await page.goto(`/incidents/${id}`)
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
  for (const denied of [b.page, page]) {
    expect(await read(denied)).toEqual([])
    await expect(denied.getByRole('button', { name: 'Post update' })).toHaveCount(0)
  }
  expect(await read(a.page, id)).toHaveLength(1)
})

test('direct native event creation and rewriting are denied', async ({ users }) => {
  const [a] = await users(['Participant A'])
  await a.page.goto('/incidents')
  const { id } = await create(a.page)
  const result = await postIncidentAction(a.page, 'postIncidentUpdate', { incidentId: id, message: 'Original update' })
  expect(result.body.success).toBe(true)
  const before = await read(a.page, id)
  for (const recordId of [`__test-${crypto.randomUUID()}`, result.body.data.recordId]) {
    const ack = await recordRequest(a.page, clientBuild.put('incidentActivity', recordId, { incidentId: id, message: 'Forged update', eventType: 'user_update', participantIds: [] }, crypto.randomUUID()), 'records.ack')
    expect(ack.success).toBe(false)
  }
  expect(await read(a.page, id)).toEqual(before)
})

test('detail reuses lifecycle and recovery controls without inventing automatic events', async ({ users }) => {
  const [a] = await users(['Participant A'])
  await a.page.goto('/incidents')
  const { id } = await create(a.page)
  await a.page.goto(`/incidents/${id}`)
  await a.page.getByRole('button', { name: 'Start investigating', exact: true }).click()
  await expect(a.page.getByText('API · sev2 · investigating', { exact: true })).toBeVisible()
  await a.page.getByLabel('Recovery description').fill('Restart worker')
  await a.page.getByRole('button', { name: 'Add recovery action', exact: true }).click()
  await a.page.getByRole('button', { name: 'Mark complete', exact: true }).click()
  await expect(a.page.getByText(/^Completed:/)).toBeVisible()
  expect(await read(a.page, id)).toEqual([])
  await a.page.getByRole('link', { name: 'Back to incidents', exact: true }).click()
  await expect(a.page.locator(`[data-record-id="${id}"]`).getByText('API · sev2 · investigating', { exact: true })).toBeVisible()
})

test('timeline form shows pending and a real server rejection while retaining input', async ({ users }) => {
  const [a] = await users(['Participant A'])
  await a.page.goto('/incidents')
  const { id } = await create(a.page)
  await a.page.goto(`/incidents/${id}`)
  let release!: () => void
  const hold = new Promise<void>((resolve) => { release = resolve })
  await a.page.route('**/api/actions/postIncidentUpdate', async (route) => {
    await hold
    await route.continue({ postData: JSON.stringify({ incidentId: id, message: ' ' }) })
  })
  await a.page.getByLabel('Incident update', { exact: true }).fill('Keep this draft')
  await a.page.getByRole('button', { name: 'Post update', exact: true }).click()
  try { await expect(a.page.getByRole('button', { name: 'Posting…' })).toBeDisabled() } finally { release() }
  await expect(a.page.getByRole('alert')).toContainText('1–1000 characters')
  await expect(a.page.getByLabel('Incident update', { exact: true })).toHaveValue('Keep this draft')
  expect(await read(a.page, id)).toEqual([])
})
