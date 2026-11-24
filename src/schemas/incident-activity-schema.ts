import type { CollectionSchema, RolePermissions } from 'deepspace/schema'
import { incidentReadPermission } from '../lib/incident-access'

const participantReadOnly: RolePermissions = {
  read: incidentReadPermission(), create: false, update: false, delete: false,
}

export const incidentActivitySchema: CollectionSchema = {
  name: 'incidentActivity',
  columns: [
    { name: 'incidentId', storage: 'text', interpretation: { kind: 'reference', targetTable: 'incidents', displayColumn: 'title' }, required: true, immutable: true },
    { name: 'eventType', storage: 'text', interpretation: { kind: 'select', options: ['user_update'] }, required: true, immutable: true },
    { name: 'message', storage: 'text', interpretation: 'plain', required: true, maxLength: 1000, immutable: true },
    { name: 'participantIds', storage: 'text', interpretation: { kind: 'json' }, required: true },
  ],
  collaboratorsField: 'participantIds',
  permissions: {
    '*': { read: false, create: false, update: false, delete: false },
    viewer: participantReadOnly,
    member: participantReadOnly,
    admin: participantReadOnly,
  },
}
