import { test, expect } from 'deepspace/testing'
import { clientBuild } from 'deepspace'
import { readFileSync } from 'node:fs'
import { postIncidentAction, recordRequest } from './helpers/incidents'
import { captureConsoleErrors } from './helpers/errors'

const appId = readFileSync('wrangler.toml', 'utf8').match(/DEEPSPACE_APP_ID = "([^"]+)"/)![1]

test('reviewer demo supports counts, filters, detail, recovery, timeline and persistence on mobile', async ({ users, browser }, testInfo) => {
  const [b] = await users(['Participant B'])
  const page = b.page
  const errors = captureConsoleErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/demo')
  const title = `__test-${Date.now()}__ Reviewer sample`
  await page.getByLabel('Title', { exact: true }).fill(title)
  await page.getByRole('button', { name: 'Create Incident', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Incident saved.')
  const row = page.getByTestId('incident').filter({ hasText: title })
  await expect(row).toBeVisible()
  const id = (await row.getAttribute('data-record-id'))!
  const all = await page.getByTestId('incident').count()
  await expect(page.getByTestId('count-all')).toHaveText(String(all))
  await page.getByRole('button', { name: 'Resolved', exact: true }).click()
  await expect(row).toHaveCount(0)
  await expect(page.getByText('No resolved incidents. Choose another status to see more.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resolved', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('count-resolved')).toHaveText(String(await page.getByTestId('incident').count()))
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await expect(row).toBeVisible()
  await expect(page.getByTestId('count-open')).toHaveText(String(await page.getByTestId('incident').count()))
  await page.screenshot({ path: testInfo.outputPath('dashboard-mobile.png'), fullPage: true })
  await row.getByRole('link', { name: 'View incident' }).click()
  await expect(page).toHaveURL(new RegExp(`/demo/${id}$`))
  await page.getByRole('button', { name: 'Start investigating', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Resolve incident', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Resolve incident', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Reopen investigation', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reopen investigation', exact: true }).click()
  await page.getByLabel('Recovery description').fill('Restart synthetic worker')
  await page.getByRole('button', { name: 'Add recovery action', exact: true }).click()
  await page.getByRole('button', { name: 'Mark complete', exact: true }).click()
  await expect(page.getByText('1 / 1 completed', { exact: true })).toBeVisible()
  const second = await browser.newContext({ storageState: await b.context.storageState() })
  try {
    const other = await second.newPage()
    await other.goto(page.url())
    await expect(other.getByText('No updates yet.', { exact: true })).toBeVisible()
    await page.getByLabel('Incident update').fill('Synthetic recovery verified')
    await page.getByRole('button', { name: 'Post update', exact: true }).click()
    await expect(other.getByTestId('activity-message')).toHaveText('Synthetic recovery verified')
    await page.reload()
    await expect(page.getByTestId('activity-message')).toHaveText('Synthetic recovery verified')
    await expect(page.getByText('1 / 1 completed', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Resolve incident', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('detail-mobile.png'), fullPage: true })
    await page.getByRole('region', { name: 'Activity timeline' }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath('timeline-mobile.png'), fullPage: true })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.screenshot({ path: testInfo.outputPath('detail-desktop.png'), fullPage: true })
    await page.getByRole('link', { name: 'Back to incidents' }).click()
    await expect(page.getByTestId('count-all')).toHaveText(String(all))
    await page.screenshot({ path: testInfo.outputPath('dashboard-desktop.png'), fullPage: true })
    expect(errors).toEqual([])
  } finally { await second.close() }
})

test('demo rooms reject foreign reads, actions, forged ownership and native writes', async ({ users }) => {
  const [a, b] = await users(['Participant A', 'Participant B'])
  await a.page.goto('/demo')
  await b.page.goto('/demo')
  const created = await postIncidentAction(a.page, 'createIncident', { title: 'Synthetic isolated incident', service: 'Example', severity: 'sev2' }, true)
  expect(created.body.success).toBe(true)
  const id = created.body.data.recordId as string
  const recovery = await postIncidentAction(a.page, 'addRecoveryAction', { incidentId: id, description: 'Synthetic owner action' }, true)
  expect(recovery.body.success).toBe(true)
  expect((await postIncidentAction(b.page, 'completeRecoveryAction', { actionId: recovery.body.data.recordId }, true)).body.success).toBe(false)
  for (const [name, input] of [
    ['transitionIncident', { incidentId: id, status: 'investigating' }],
    ['addRecoveryAction', { incidentId: id, description: 'Foreign write attempt' }],
    ['postIncidentUpdate', { incidentId: id, message: 'Foreign update attempt' }],
  ] as const) expect((await postIncidentAction(b.page, name, input, true)).body.success).toBe(false)
  const forged = await postIncidentAction(b.page, 'createIncident', { title: 'Forged incident', service: 'Example', severity: 'sev2', participantIds: [a.userId], roomId: `demo:${appId}:${a.userId}` }, true)
  expect(forged.body.success).toBe(false)
  await expect(recordRequest(b.page, clientBuild.subscribe('foreign', { collection: 'incidents' }), 'core.query_result', `demo:${appId}:${a.userId}`)).rejects.toThrow('Record connection failed')
  const own = await recordRequest(b.page, clientBuild.subscribe('own', { collection: 'incidents' }), 'core.query_result', `demo:${appId}:${b.userId}`)
  expect((own.records as Array<{ recordId: string }>).some(record => record.recordId === id)).toBe(false)
  await b.page.goto(`/demo/${id}`)
  await expect(b.page.getByRole('alert')).toHaveText('Incident not found.')
  const denied = await recordRequest(a.page, clientBuild.put('incidents', id, { status: 'resolved' }, crypto.randomUUID()), 'records.ack', `demo:${appId}:${a.userId}`)
  expect(denied.success).toBe(false)
  expect((await postIncidentAction(b.page, 'createIncident', { title: 'Private bypass', service: 'Example', severity: 'sev2' })).body.code).toBe('forbidden')
})

test('demo requires browser authentication', async ({ page }) => {
  await page.goto('/demo')
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
  expect((await postIncidentAction(page, 'createIncident', { title: 'Anonymous attempt', service: 'Example', severity: 'sev2' }, true)).status).toBe(401)
})
