import { Link, useParams } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { canAccessIncidents } from '../../../../lib/incident-access'
import type { Incident } from '../../../../lib/incidents'
import { IncidentLifecycle } from '../../../../components/incident-lifecycle'
import { RecoveryChecklist } from '../../../../components/recovery-checklist'
import { IncidentTimeline } from '../../../../components/incident-timeline'

export default function IncidentDetailPage() {
  const { userId } = useAuth()
  const { incidentId } = useParams()
  if (!userId || !canAccessIncidents(userId)) return <p className="p-6" role="alert">You are not an incident participant.</p>
  if (!incidentId) return <p role="alert">Incident not found.</p>
  return <IncidentDetail key={incidentId} incidentId={incidentId} />
}

function IncidentDetail({ incidentId }: { incidentId: string }) {
  const { records, status, error } = useQuery<Incident>('incidents', { where: { recordId: incidentId } })
  const record = records[0]
  return <section className="mx-auto max-w-3xl space-y-4 p-6">
    <Link to="/incidents" className="underline">Back to incidents</Link>
    {status === 'loading' && <p>Loading incident…</p>}
    {status === 'error' && <p role="alert">{error}</p>}
    {status === 'ready' && !record && <p role="alert">Incident not found.</p>}
    {record && <>
      <h1 className="text-2xl font-semibold">{record.data.title}</h1>
      <p>{record.data.service} · {record.data.severity} · {record.data.status}</p>
      <p className="whitespace-pre-wrap">{record.data.description}</p>
      <p className="text-sm">Creator: {record.createdBy} · Created: {record.createdAt} · Updated: {record.updatedAt}</p>
      {record.data.resolvedAt && <p className="text-sm">Resolved: {record.data.resolvedAt}</p>}
      <IncidentLifecycle recordId={record.recordId} status={record.data.status} />
      <RecoveryChecklist incidentId={record.recordId} />
      <IncidentTimeline incidentId={record.recordId} />
    </>}
  </section>
}
