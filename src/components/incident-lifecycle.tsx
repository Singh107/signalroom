import { useWorkspace } from './workspace-context'
import { useState } from 'react'
import { getAuthToken } from 'deepspace'
import { nextIncidentStatus, type IncidentStatus } from '../lib/incident-lifecycle'
import { Button } from './ui'

export function IncidentLifecycle({ recordId, status }: { recordId: string; status: IncidentStatus }) {
  const { actionBase } = useWorkspace()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const next = nextIncidentStatus(status)

  async function transition() {
    if (!next || pending) return
    setPending(true)
    setError('')
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Please sign in again.')
      const response = await fetch(`${actionBase}/transitionIncident`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ incidentId: recordId, status: next }),
      })
      const result = await response.json() as { success?: boolean; error?: string }
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not change status.')
      // No optimistic status: useQuery receives the DO's persisted record update.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not change status.')
    } finally {
      setPending(false)
    }
  }

  return <div className="mt-3 space-y-2">
    {next && <Button type="button" disabled={pending} onClick={transition}>
      {pending ? 'Updating…' : status === 'resolved' ? 'Reopen investigation' : next === 'resolved' ? 'Resolve incident' : 'Start investigating'}
    </Button>}
    {error && <p role="alert">{error}</p>}
  </div>
}
