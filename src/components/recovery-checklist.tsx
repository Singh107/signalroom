import { useState, type FormEvent } from 'react'
import { getAuthToken, useQuery } from 'deepspace'
import type { RecoveryAction } from '../lib/recovery-actions'
import { Button, Input, Label } from './ui'

async function callRecoveryAction(name: 'addRecoveryAction' | 'completeRecoveryAction', params: Record<string, unknown>) {
  const token = await getAuthToken()
  if (!token) throw new Error('Please sign in again.')
  const response = await fetch(`/api/actions/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  })
  const result = await response.json() as { success?: boolean; error?: string }
  if (!response.ok || !result.success) throw new Error(result.error || 'Could not save recovery action.')
}

export function RecoveryChecklist({ incidentId }: { incidentId: string }) {
  const { records, status, error } = useQuery<RecoveryAction>('recoveryActions', { where: { incidentId }, orderBy: 'createdAt', orderDir: 'asc' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setSaving(true)
    setFailure('')
    setMessage('')
    try {
      await callRecoveryAction('addRecoveryAction', { incidentId, description: new FormData(form).get('description') })
      form.reset()
      setMessage('Recovery action saved.')
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : 'Could not save recovery action.')
    } finally { setSaving(false) }
  }

  return <section className="mt-4 space-y-2 border-t pt-3" aria-label="Recovery checklist">
    <h3 className="font-semibold">Recovery checklist</h3>
    {status === 'loading' && <p>Loading recovery actions…</p>}
    {status === 'error' && <p role="alert">{error}</p>}
    {status === 'ready' && records.length === 0 && <p>No recovery actions yet.</p>}
    <ul className="space-y-2">{records.map((record) => <RecoveryItem key={record.recordId} actionId={record.recordId} action={record.data} />)}</ul>
    <form onSubmit={add} className="space-y-2">
      <Label htmlFor={`recovery-${incidentId}`}>Recovery description</Label>
      <Input id={`recovery-${incidentId}`} name="description" required minLength={3} maxLength={200} />
      <Button type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add recovery action'}</Button>
    </form>
    {message && <p role="status">{message}</p>}
    {failure && <p role="alert">{failure}</p>}
  </section>
}

function RecoveryItem({ actionId, action }: { actionId: string; action: RecoveryAction }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  async function complete() {
    if (pending) return
    setPending(true)
    setError('')
    try { await callRecoveryAction('completeRecoveryAction', { actionId }) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not complete recovery action.') }
    finally { setPending(false) }
  }
  return <li data-testid="recovery-action" data-action-id={actionId} className="rounded border p-2">
    <p>{action.description}</p>
    {action.status === 'complete' ? <p>Completed{action.completedAt ? `: ${action.completedAt}` : ''}</p> :
      <Button type="button" disabled={pending} onClick={complete}>{pending ? 'Completing…' : 'Mark complete'}</Button>}
    {error && <p role="alert">{error}</p>}
  </li>
}
