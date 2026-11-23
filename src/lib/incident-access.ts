// Explicit identities, not credentials. B is deliberately excluded for denial tests.
export const INCIDENT_PARTICIPANTS = [
  '4JWzwAohF3OjFgq8OdEsvqt4SuOUWCtQ', // Agam, app owner
  '7Cy1xVq1CEhxwTVsKAv594AdKdrZA9cv', // Participant A
] as const

export function canAccessIncidents(userId: string): boolean {
  return INCIDENT_PARTICIPANTS.some((id) => id === userId)
}
