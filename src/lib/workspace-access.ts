import { canAccessIncidents, INCIDENT_PARTICIPANTS } from './incident-access'

export interface WorkspaceAccess {
  allows: (userId: string) => boolean
  participants: readonly string[]
}
export const privateWorkspace: WorkspaceAccess = { allows: canAccessIncidents, participants: INCIDENT_PARTICIPANTS }

// The server derives this from verified auth, never from request parameters.
export function demoWorkspace(userId: string): WorkspaceAccess {
  return { allows: caller => !!userId && caller === userId, participants: [userId] }
}
export function demoRoomId(appId: string, userId: string): string {
  return `demo:${appId}:${userId}`
}
export function canEnterRecordRoom(roomId: string, appId: string, userId?: string): boolean {
  if (roomId.startsWith('demo:')) return !!userId && roomId === demoRoomId(appId, userId)
  return roomId === `app:${appId}`
}
