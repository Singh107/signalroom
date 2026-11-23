// Shared pure rules; no server validation library enters the browser bundle.
export const INCIDENT_STATUSES = ['open', 'investigating', 'resolved'] as const
export type IncidentStatus = typeof INCIDENT_STATUSES[number]

export function nextIncidentStatus(status: unknown): IncidentStatus | null {
  switch (status) {
    case 'open': return 'investigating'
    case 'investigating': return 'resolved'
    case 'resolved': return 'investigating'
    default: return null
  }
}

export function canTransitionIncident(current: unknown, requested: unknown): boolean {
  const next = nextIncidentStatus(current)
  return next !== null && next === requested
}
