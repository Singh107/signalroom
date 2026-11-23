// Explicit identities, not credentials. B is deliberately excluded for denial tests.
export const INCIDENT_PARTICIPANTS = [
  '4JWzwAohF3OjFgq8OdEsvqt4SuOUWCtQ', // Agam, app owner
  '7Cy1xVq1CEhxwTVsKAv594AdKdrZA9cv', // Participant A
] as const

// Frozen baseline for existing stored collaborator AND creator grants.
// Do not update this alongside the allowlist: membership changes require an
// access migration/review (see LEARNING_NOTES). A mismatch disables all reads.
const STORED_GRANT_BASELINE = [
  '4JWzwAohF3OjFgq8OdEsvqt4SuOUWCtQ',
  '7Cy1xVq1CEhxwTVsKAv594AdKdrZA9cv',
] as const

export function incidentReadPermission(participants: readonly string[] = INCIDENT_PARTICIPANTS): false | 'collaborator' {
  return participants.length === STORED_GRANT_BASELINE.length &&
    STORED_GRANT_BASELINE.every((id) => participants.includes(id)) ? 'collaborator' : false
}

export function canAccessIncidents(userId: string): boolean {
  return incidentReadPermission() !== false && INCIDENT_PARTICIPANTS.some((id) => id === userId)
}
