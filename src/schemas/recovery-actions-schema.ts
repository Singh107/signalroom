import type { CollectionSchema, RolePermissions } from 'deepspace/schema'
import { incidentReadPermission } from '../lib/incident-access'

const participantReadOnly: RolePermissions = {
  read: incidentReadPermission(), create: false, update: false, delete: false,
}

export const recoveryActionsSchema: CollectionSchema = {
  name: 'recoveryActions',
  columns: [
    { name: 'incidentId', storage: 'text', interpretation: { kind: 'reference', targetTable: 'incidents', displayColumn: 'title' }, required: true, immutable: true },
    { name: 'description', storage: 'text', interpretation: 'plain', required: true, maxLength: 200 },
    { name: 'status', storage: 'text', interpretation: { kind: 'select', options: ['pending', 'complete'] }, required: true, default: 'pending' },
    { name: 'completedAt', storage: 'text', interpretation: { kind: 'datetime' }, timestampTrigger: { field: 'status', value: 'complete' } },
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
