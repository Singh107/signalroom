import type { IncidentStatus } from './incident-lifecycle'

export type IncidentFilter = 'all' | IncidentStatus
export const statusLabels = { all: 'All', open: 'Open', investigating: 'Investigating', resolved: 'Resolved' }

// Derived from the same authorized subscription used to render the list.
export function incidentCounts(records: readonly { data: { status: IncidentStatus } }[]) {
  const counts = { all: records.length, open: 0, investigating: 0, resolved: 0 }
  for (const record of records) counts[record.data.status]++
  return counts
}

export function formatIncidentTime(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Time unavailable'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
  }).format(new Date(value))
}

export function actorLabel(id: string, name?: string | null): string {
  // Never expose an email-shaped profile name as an actor label.
  return name?.trim() && !name.includes('@') ? name.trim() : `Participant ${id.slice(0, 6)}`
}
