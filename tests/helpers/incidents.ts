import type { Page } from '@playwright/test'
import { clientBuild, type ClientMessage } from 'deepspace'
import { readFileSync } from 'node:fs'

const appId = readFileSync('wrangler.toml', 'utf8').match(/DEEPSPACE_APP_ID = "([^"]+)"/)?.[1]
if (!appId) throw new Error('Missing app ID in test configuration')

// Use the same cookie-to-JWT exchange as the installed getAuthToken implementation.
// Tokens stay inside the browser and are never returned to the test runner.
export async function postIncident(page: Page, data: Record<string, unknown>) {
  return postIncidentAction(page, 'createIncident', data)
}

export async function postIncidentAction(page: Page, name: 'createIncident' | 'transitionIncident' | 'addRecoveryAction' | 'completeRecoveryAction', data: Record<string, unknown>) {
  return page.evaluate(async ({ name, input }) => {
    const auth = await fetch('/api/auth/token', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } })
    const session = await auth.json()
    const response = await fetch(`/api/actions/${name}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}) },
      body: JSON.stringify(input),
    })
    return { status: response.status, body: await response.json() }
  }, { name, input: data })
}

export async function recordRequest(page: Page, message: ClientMessage, expectedType: string) {
  return page.evaluate(async ({ message, expectedType, appId }) => {
    const auth = await fetch('/api/auth/token', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } })
    const session = await auth.json()
    const url = new URL(`/ws/${encodeURIComponent(`app:${appId}`)}`, location.href)
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    if (session.token) url.searchParams.set('token', session.token)
    return await new Promise<Record<string, unknown>>((resolve, reject) => {
      const socket = new WebSocket(url)
      const timeout = setTimeout(() => { socket.close(); reject(new Error('Record request timed out')) }, 10000)
      socket.onopen = () => socket.send(JSON.stringify(message))
      socket.onerror = () => { clearTimeout(timeout); reject(new Error('Record connection failed')) }
      socket.onmessage = (event) => {
        const response = JSON.parse(event.data)
        if (response.type === expectedType) {
          clearTimeout(timeout)
          socket.close()
          resolve(response.payload)
        }
      }
    })
  }, { message, expectedType, appId })
}

export function readIncidents(page: Page) {
  return recordRequest(page, clientBuild.subscribe('incident-test', { collection: 'incidents' }), 'core.query_result')
}
