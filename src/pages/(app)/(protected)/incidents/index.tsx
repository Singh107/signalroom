import { useWorkspace } from '../../../../components/workspace-context'
import { useState, type FormEvent } from 'react'
import { getAuthToken, useAuth, useQuery } from 'deepspace'
import type { Incident } from '../../../../lib/incidents'
import { canAccessIncidents } from '../../../../lib/incident-access'
import { IncidentLifecycle } from '../../../../components/incident-lifecycle'
import { Link } from 'react-router-dom'
import { Button, Input, Label, Textarea } from '../../../../components/ui'
import { incidentCounts, statusLabels, formatIncidentTime, type IncidentFilter } from '../../../../lib/incident-presentation'
import { ActorName, ActorNamesProvider, IncidentBadges } from '../../../../components/incident-presentation'
import { RecoveryChecklist } from '../../../../components/recovery-checklist'

export default function IncidentsPage() {
  const { demo } = useWorkspace()
  const { userId } = useAuth()
  if (!userId || (!demo && !canAccessIncidents(userId))) return <p className="p-6" role="alert">You are not an incident participant.</p>
  return <ActorNamesProvider><IncidentWorkspace /></ActorNamesProvider>
}

function IncidentWorkspace() {
  const { demo, basePath, actionBase } = useWorkspace()
  const { records, status, error } = useQuery<Incident>('incidents', { orderBy: 'createdAt', orderDir: 'desc' })
  const [filter, setFilter] = useState<IncidentFilter>('all')
  const counts = incidentCounts(records)
  const visible = records.filter(record => filter === 'all' || record.data.status === filter)
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
      const response = await fetch(`${actionBase}/createIncident`, {
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

  return <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-8">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-300">SignalRoom / {demo ? 'Personal demo' : 'Overview'}</p>
        <h1 className="text-3xl font-semibold tracking-tight">Incidents</h1>
        <p className="mt-2 text-slate-400">One shared view of what needs attention.</p></div>
      <a href="#create-incident" className="rounded-lg bg-teal-300 px-4 py-2.5 font-semibold text-slate-950">+ New incident</a>
    </header>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Incident summary">
      {(Object.keys(statusLabels) as IncidentFilter[]).map(key => <div key={key} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <p className="text-sm text-slate-300">{key === 'all' ? 'Total incidents' : statusLabels[key]}</p>
        <p data-testid={`count-${key}`} className="mt-2 text-3xl font-semibold tabular-nums">{status === 'ready' ? counts[key] : 'Loading'}</p>
      </div>)}
    </div>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
    <aside id="create-incident" className="min-w-0 rounded-xl border border-slate-700 bg-slate-900 p-5 lg:order-2">
    <h2 className="mb-4 text-lg font-semibold">Create incident</h2>
    {demo && <p className="mb-4 text-sm text-slate-300">A synthetic example is filled in. Create it to explore the full workflow, or enter your own sample.</p>}
    <form onSubmit={submit} className="space-y-3">
      <Label htmlFor="incident-title">Title</Label>
      <Input id="incident-title" defaultValue={demo ? 'Demo: elevated API latency' : undefined} name="title" required minLength={5} maxLength={120} />
      <Label htmlFor="incident-service">Service</Label>
      <Input id="incident-service" defaultValue={demo ? 'Example API' : undefined} name="service" required />
      <Label htmlFor="incident-severity">Severity</Label>
      <select id="incident-severity" name="severity" defaultValue="sev2" className="block rounded border bg-background p-2">
        <option value="sev1">SEV 1</option><option value="sev2">SEV 2</option><option value="sev3">SEV 3</option>
      </select>
      <Label htmlFor="incident-description">Description (optional)</Label>
      <Textarea id="incident-description" defaultValue={demo ? 'Synthetic scenario: investigate slow responses, add a recovery step, and post an update.' : undefined} name="description" maxLength={2000} />
      <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Incident'}</Button>
    </form>
    <p role="status">{message}</p>
    </aside>
    <div className="min-w-0 space-y-4">
    <div className="flex flex-wrap gap-2" aria-label="Filter incidents">
      {(Object.keys(statusLabels) as IncidentFilter[]).map(key => <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)} className={`rounded-lg border px-3 py-2 text-sm ${filter === key ? 'border-teal-300 bg-teal-300/10 text-teal-200' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}>{statusLabels[key]}</button>)}
    </div>
    {status === 'ready' && records.length > 0 && visible.length === 0 && <p className="rounded-xl border border-dashed border-slate-600 p-8 text-slate-300">No {statusLabels[filter].toLowerCase()} incidents. Choose another status to see more.</p>}
    {status === 'loading' && <p>Loading incidents…</p>}
    {status === 'error' && <p role="alert">{error}</p>}
    {status === 'ready' && records.length === 0 && <p>No incidents yet.</p>}
    <ul className="space-y-3">{visible.map((record) => <li key={record.recordId} data-testid="incident" data-record-id={record.recordId} className="min-w-0 space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-5">
      <h2 className="break-words text-xl font-semibold">{record.data.title}</h2>
      <Link to={`${basePath}/${encodeURIComponent(record.recordId)}`} className="underline">View incident</Link>
      <IncidentBadges incident={record.data} />
      <p className="whitespace-pre-wrap">{record.data.description}</p>
      <p className="text-sm">Created: {formatIncidentTime(record.createdAt)} · Updated: {formatIncidentTime(record.updatedAt)}</p>
      <p className="text-sm">Creator: <ActorName id={record.createdBy} /></p>
      {record.data.resolvedAt && <p className="text-sm">Resolved: {formatIncidentTime(record.data.resolvedAt)}</p>}
      <IncidentLifecycle recordId={record.recordId} status={record.data.status} />
      <RecoveryChecklist incidentId={record.recordId} />
    </li>)}</ul>
    </div></div>
  </section>
}
