import { test, expect } from '@playwright/test'
import { test as authenticatedTest } from 'deepspace/testing'
import { clientBuild } from 'deepspace'
import { postIncident, readIncidents, recordRequest } from './helpers/incidents'

test.describe('API tests', () => {
  test('auth proxy forwards to auth worker', async ({ request }) => {
    const res = await request.get('/api/auth/ok')
    expect(res.ok()).toBeTruthy()
  })

  test('WebSocket endpoint exists', async ({ page }) => {
    // /home is a dynamic page (under src/pages/(app)/), so mounting it boots
    // the providers and auto-connects the records WebSocket. The static
    // landing at '/' deliberately does neither — see smoke.spec.ts.
    await page.goto('/home')
    // Wait for the app to connect its WebSocket (it auto-connects on mount)
    await page.waitForSelector('[data-testid="app-navigation"]', { timeout: 15000 })
    // If the app loaded and connected, the WS endpoint works
  })
})

const validIncident = { title: 'API outage', service: 'API', severity: 'sev2' }

authenticatedTest('incident action rejects invalid data on the server', async ({ users }) => {
  const [a] = await users(['Participant A'])
  await a.page.goto('/incidents')
  for (const patch of [
    { title: '' }, { title: 'abcd' }, { title: 'x'.repeat(121) },
    { severity: 'sev4' }, { status: 'resolved' }, { createdBy: 'spoof' },
    { participantIds: ['spoof'] }, { description: 'x'.repeat(2001) }, { service: ' ' },
  ]) {
    const result = await postIncident(a.page, { ...validIncident, ...patch })
    expect(result.body, JSON.stringify(patch)).toMatchObject({ success: false, code: 'validation_failed' })
  }
})

authenticatedTest('signed-in nonparticipant cannot create or read incidents', async ({ users }) => {
  const [a, b] = await users(['Participant A', 'Participant B'])
  await a.page.goto('/incidents')
  const title = `__test-${Date.now()}__ private incident`
  expect((await postIncident(a.page, { ...validIncident, title })).body.success).toBe(true)
  await b.page.goto('/incidents')
  await expect(b.page.getByRole('alert')).toHaveText('You are not an incident participant.')
  expect((await postIncident(b.page, validIncident)).body).toMatchObject({ success: false, code: 'forbidden' })
  expect((await readIncidents(b.page)).records).toEqual([])
})

authenticatedTest('even an authorized user cannot bypass validation through direct record writes', async ({ users }) => {
  const [a] = await users(['Participant A'])
  await a.page.goto('/incidents')
  const result = await recordRequest(a.page, clientBuild.put('incidents', `__test-${Date.now()}`, { ...validIncident, title: 'bad', status: 'resolved' }, crypto.randomUUID()), 'records.ack')
  expect(result.success).toBe(false)
})

test('signed-out incident access is denied at page, action and record boundaries', async ({ page, request }) => {
  const result = await request.post('/api/actions/createIncident', { data: validIncident })
  expect(result.status()).toBe(401)
  await page.goto('/incidents')
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create Incident' })).toHaveCount(0)
  expect((await readIncidents(page)).records).toEqual([])
})
