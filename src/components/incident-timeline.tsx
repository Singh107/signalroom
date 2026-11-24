import { useWorkspace } from './workspace-context'
import { ActorName } from './incident-presentation'
import { formatIncidentTime } from '../lib/incident-presentation'
import { useState, type FormEvent } from 'react'
import { getAuthToken, useQuery } from 'deepspace'
import type { IncidentActivity } from '../lib/incident-activity'
import { Button, Label, Textarea } from './ui'

export function IncidentTimeline({ incidentId }: { incidentId: string }) {
  const { records, status, error } = useQuery<IncidentActivity>('incidentActivity', { where: { incidentId }, orderBy: 'createdAt', orderDir: 'asc' })
  const { actionBase } = useWorkspace()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  // Equal server timestamps have no causal ordering guarantee; ID breaks ties consistently.
  const ordered = [...records].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.recordId.localeCompare(b.recordId))

  async function post(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = event.currentTarget
    setPending(true)
    setMessage('')
    setFailure('')
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Please sign in again.')
      const response = await fetch(`${actionBase}/postIncidentUpdate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ incidentId, message: new FormData(form).get('message') }),
      })
      const result = await response.json() as { success?: boolean; error?: string }
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not post update.')
      form.reset()
      setMessage('Update posted.')
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : 'Could not post update.')
    } finally { setPending(false) }
  }

  return <section aria-label="Activity timeline" className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/50 p-5">
    <h2 className="text-xl font-semibold">Activity timeline</h2>
    <p className="text-sm text-slate-400">Participant updates, oldest first. Automatic incident and recovery history is not recorded yet.</p>
    {status === 'loading' && <p>Loading activity…</p>}
    {status === 'error' && <p role="alert">{error}</p>}
    {status === 'ready' && records.length === 0 && <p>No updates yet.</p>}
    <ol className="space-y-2">{ordered.map((record) => <li key={record.recordId} data-testid="activity-event" data-event-id={record.recordId} className="rounded border p-3">
      <p data-testid="activity-message" className="whitespace-pre-wrap break-words">{record.data.message}</p>
      <p className="text-sm">Update by <ActorName id={record.createdBy} /> · <time dateTime={record.createdAt}>{formatIncidentTime(record.createdAt)}</time></p>
    </li>)}</ol>
    <form onSubmit={post} className="space-y-2">
      <Label htmlFor={`update-${incidentId}`}>Incident update</Label>
      <Textarea id={`update-${incidentId}`} name="message" required minLength={1} maxLength={1000} />
      <Button type="submit" disabled={pending}>{pending ? 'Posting…' : 'Post update'}</Button>
    </form>
    {message && <p role="status">{message}</p>}
    {failure && <p role="alert">{failure}</p>}
  </section>
}
