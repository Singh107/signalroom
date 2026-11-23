import type { CollectionSchema, RolePermissions } from 'deepspace/schema'
import { incidentReadPermission } from '../lib/incident-access'
import { INCIDENT_STATUSES } from '../lib/incident-lifecycle'

const participantReadOnly: RolePermissions = {
  read: incidentReadPermission(), create: false, update: false, delete: false,
}

export const incidentsSchema: CollectionSchema = {
  name: 'incidents',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true, maxLength: 120 },
    { name: 'description', storage: 'text', interpretation: 'plain', maxLength: 2000, default: '' },
    { name: 'service', storage: 'text', interpretation: 'plain', required: true },
    { name: 'severity', storage: 'text', interpretation: { kind: 'select', options: ['sev1', 'sev2', 'sev3'] }, required: true },
    { name: 'status', storage: 'text', interpretation: { kind: 'select', options: [...INCIDENT_STATUSES] }, default: 'open' },
    { name: 'resolvedAt', storage: 'text', interpretation: { kind: 'datetime' }, timestampTrigger: { field: 'status', value: 'resolved' } },
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
