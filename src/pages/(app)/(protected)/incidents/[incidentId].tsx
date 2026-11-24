import { useWorkspace } from '../../../../components/workspace-context'
import { formatIncidentTime } from '../../../../lib/incident-presentation'
import { ActorName, ActorNamesProvider, IncidentBadges } from '../../../../components/incident-presentation'
import { Link, useParams } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { canAccessIncidents } from '../../../../lib/incident-access'
import type { Incident } from '../../../../lib/incidents'
import { IncidentLifecycle } from '../../../../components/incident-lifecycle'
import { RecoveryChecklist } from '../../../../components/recovery-checklist'
import { IncidentTimeline } from '../../../../components/incident-timeline'

export default function IncidentDetailPage() {
  const { demo } = useWorkspace()
  const { userId } = useAuth()
  const { incidentId } = useParams()
  if (!userId || (!demo && !canAccessIncidents(userId))) return <p className="p-6" role="alert">You are not an incident participant.</p>
  if (!incidentId) return <p role="alert">Incident not found.</p>
  return <ActorNamesProvider><IncidentDetail key={incidentId} incidentId={incidentId} /></ActorNamesProvider>
}

function IncidentDetail({ incidentId }: { incidentId: string }) {
  const { basePath } = useWorkspace()
  const { records, status, error } = useQuery<Incident>('incidents', { where: { recordId: incidentId } })
  const record = records[0]
  return <section className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-8">
    <Link to={basePath} className="underline">Back to incidents</Link>
    {status === 'loading' && <p>Loading incident…</p>}
    {status === 'error' && <p role="alert">{error}</p>}
    {status === 'ready' && !record && <p role="alert">Incident not found.</p>}
    {record && <>
      <h1 className="break-words text-3xl font-semibold tracking-tight">{record.data.title}</h1>
      <IncidentBadges incident={record.data} />
      <p className="whitespace-pre-wrap break-words text-slate-300">{record.data.description}</p>
      <p className="text-sm">Creator: <ActorName id={record.createdBy} /> · Created: {formatIncidentTime(record.createdAt)} · Updated: {formatIncidentTime(record.updatedAt)}</p>
      {record.data.resolvedAt && <p className="text-sm">Resolved: {formatIncidentTime(record.data.resolvedAt)}</p>}
      <IncidentLifecycle recordId={record.recordId} status={record.data.status} />
      <RecoveryChecklist incidentId={record.recordId} />
      <IncidentTimeline incidentId={record.recordId} />
    </>}
  </section>
}
