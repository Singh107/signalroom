import { describe, expect, it } from 'vitest'
import { incidentInput } from './incidents'
import { canAccessIncidents, INCIDENT_PARTICIPANTS, incidentReadPermission } from './incident-access'
import { incidentsSchema } from '../schemas/incidents-schema'

describe('incident boundary rules', () => {
  const valid = { title: ' API outage ', service: ' API ', severity: 'sev1' }
  it('normalizes input and supplies safe defaults', () => {
    expect(incidentInput.parse(valid)).toEqual({ title: 'API outage', service: 'API', severity: 'sev1', description: '', status: 'open' })
  })
  it('allows only the explicit participants', () => {
    for (const id of INCIDENT_PARTICIPANTS) expect(canAccessIncidents(id)).toBe(true)
    expect(canAccessIncidents('someone-else')).toBe(false)
    expect(canAccessIncidents('')).toBe(false)
  })
  it('fails closed for every membership change, including removal of a creator', () => {
    expect(incidentReadPermission()).toBe('collaborator')
    for (const id of INCIDENT_PARTICIPANTS) {
      expect(incidentReadPermission(INCIDENT_PARTICIPANTS.filter((entry) => entry !== id))).toBe(false)
    }
    expect(incidentReadPermission([...INCIDENT_PARTICIPANTS, 'new-user'])).toBe(false)
    expect(incidentReadPermission(['replacement', INCIDENT_PARTICIPANTS[1]])).toBe(false)
    expect(incidentReadPermission([])).toBe(false)
  })
  it('denies all native mutations, including admin writes', () => {
    for (const permissions of Object.values(incidentsSchema.permissions)) {
      expect(permissions).toMatchObject({ create: false, update: false, delete: false })
    }
    expect(incidentsSchema.permissions.member.read).toBe(incidentReadPermission())
  })
  it.each([
    { title: '' }, { title: 'abcd' }, { title: 'x'.repeat(121) },
    { title: '     ' }, { service: ' ' }, { severity: 'sev4' },
    { description: 'x'.repeat(2001) }, { status: 'resolved' },
    { createdBy: 'spoof' }, { participantIds: ['spoof'] }, { createdAt: 'spoof' },
  ])('rejects invalid input %j', (patch) => {
    expect(incidentInput.safeParse({ ...valid, ...patch }).success).toBe(false)
  })
  it('accepts title boundaries', () => {
    for (const length of [5, 120]) expect(incidentInput.safeParse({ ...valid, title: 'x'.repeat(length) }).success).toBe(true)
  })
})
