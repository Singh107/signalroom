import { describe, expect, it } from 'vitest'
import { actorLabel, formatIncidentTime, incidentCounts } from './incident-presentation'
import { canEnterRecordRoom, demoRoomId, demoWorkspace, privateWorkspace } from './workspace-access'

describe('dashboard presentation', () => {
  it('counts the subscribed records by status', () => {
    expect(incidentCounts([{ data: { status: 'open' } }, { data: { status: 'resolved' } }, { data: { status: 'open' } }])).toEqual({ all: 3, open: 2, investigating: 0, resolved: 1 })
  })
  it('handles an empty workspace', () => expect(incidentCounts([])).toEqual({ all: 0, open: 0, investigating: 0, resolved: 0 }))
  it.each([undefined, null, '', 'not-a-date'])('handles invalid timestamp %s', value => expect(formatIncidentTime(value)).toBe('Time unavailable'))
  it('formats a server timestamp in explicit UTC', () => expect(formatIncidentTime('2026-11-24T15:04:00Z')).toBe('Nov 24, 2026, 3:04 PM UTC'))
  it('uses a public name', () => expect(actorLabel('abcdefghi', ' Alex ')).toBe('Alex'))
  it.each([undefined, '', 'private@example.com'])('uses safe actor fallback %s', name => expect(actorLabel('abcdefghi', name)).toBe('Participant abcdef'))
})
describe('isolated demo authorization', () => {
  it('derives an exact room from app and identity', () => expect(demoRoomId('app1', 'alice')).toBe('demo:app1:alice'))
  it('allows only the verified demo user', () => {
    expect(demoWorkspace('alice').allows('alice')).toBe(true)
    expect(demoWorkspace('alice').allows('bob')).toBe(false)
    expect(demoWorkspace('').allows('')).toBe(false)
    expect(demoWorkspace('alice').participants).toEqual(['alice'])
    expect(privateWorkspace.allows('alice')).toBe(false)
  })
  it.each(['demo:app1:bob', 'demo:app2:alice', 'demo:app1:alice:extra', 'arbitrary'])('rejects foreign room %s', room => expect(canEnterRecordRoom(room, 'app1', 'alice')).toBe(false))
  it('rejects anonymous demo access while preserving public app transport', () => {
    expect(canEnterRecordRoom('demo:app1:alice', 'app1')).toBe(false)
    expect(canEnterRecordRoom('demo:app1:alice', 'app1', 'alice')).toBe(true)
    expect(canEnterRecordRoom('app:app1', 'app1')).toBe(true)
  })
})
