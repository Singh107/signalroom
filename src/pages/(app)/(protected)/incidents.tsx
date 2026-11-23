import { useState, type FormEvent } from 'react'
import { getAuthToken, useAuth, useQuery } from 'deepspace'
import type { Incident } from '../../../lib/incidents'
import { canAccessIncidents } from '../../../lib/incident-access'
import { Button, Input, Label, Textarea } from '../../../components/ui'

export default function IncidentsPage() {
  const { userId } = useAuth()
  if (!userId || !canAccessIncidents(userId)) return <p className="p-6" role="alert">You are not an incident participant.</p>
  return <IncidentWorkspace />
}

function IncidentWorkspace() {
  const { records, status, error } = useQuery<Incident>('incidents', { orderBy: 'createdAt', orderDir: 'desc' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    setSaving(true)
    setMessage('')
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Please sign in again.')
      const response = await fetch('/api/actions/createIncident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(Object.fromEntries(fields)),
      })
      const result = await response.json() as { success?: boolean; error?: string }
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not save incident.')
      form.reset()
      setMessage('Incident saved.')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not save incident.')
    } finally {
      setSaving(false)
    }
  }

  return <section className="mx-auto max-w-3xl space-y-6 p-6">
    <h1 className="text-2xl font-semibold">Incidents</h1>
    <form onSubmit={submit} className="space-y-3">
      <Label htmlFor="incident-title">Title</Label>
      <Input id="incident-title" name="title" required minLength={5} maxLength={120} />
      <Label htmlFor="incident-service">Service</Label>
      <Input id="incident-service" name="service" required />
      <Label htmlFor="incident-severity">Severity</Label>
      <select id="incident-severity" name="severity" defaultValue="sev2" className="block rounded border bg-background p-2">
        <option value="sev1">SEV 1</option><option value="sev2">SEV 2</option><option value="sev3">SEV 3</option>
      </select>
      <Label htmlFor="incident-description">Description (optional)</Label>
      <Textarea id="incident-description" name="description" maxLength={2000} />
      <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Incident'}</Button>
    </form>
    <p role="status">{message}</p>
    {status === 'loading' && <p>Loading incidents…</p>}
    {status === 'error' && <p role="alert">{error}</p>}
    {status === 'ready' && records.length === 0 && <p>No incidents yet.</p>}
    <ul className="space-y-3">{records.map((record) => <li key={record.recordId} data-testid="incident" data-record-id={record.recordId} className="rounded border p-4">
      <h2 className="font-semibold">{record.data.title}</h2>
      <p>{record.data.service} · {record.data.severity} · {record.data.status}</p>
      <p className="whitespace-pre-wrap">{record.data.description}</p>
      <p className="text-sm">Created: {record.createdAt} · Updated: {record.updatedAt}</p>
      <p className="text-sm">Creator: {record.createdBy}</p>
    </li>)}</ul>
  </section>
}
