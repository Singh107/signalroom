import { useUserLookup } from 'deepspace'
import { createContext, useContext, type ReactNode } from 'react'
import type { Incident } from '../lib/incidents'
import { actorLabel } from '../lib/incident-presentation'

const ActorNames = createContext<(id: string) => string | null>(() => null)
export function ActorNamesProvider({ children }: { children: ReactNode }) {
  const { getName } = useUserLookup()
  return <ActorNames.Provider value={getName}>{children}</ActorNames.Provider>
}
export function ActorName({ id }: { id: string }) {
  const getName = useContext(ActorNames)
  return <>{actorLabel(id, getName(id))}</>
}

export function IncidentBadges({ incident }: { incident: Incident }) {
  const severity = { sev1: 'border-rose-400/40 bg-rose-400/10 text-rose-200', sev2: 'border-amber-400/40 bg-amber-400/10 text-amber-200', sev3: 'border-sky-400/40 bg-sky-400/10 text-sky-200' }
  return <p className="flex flex-wrap items-center gap-2 text-sm">
    <span className="break-all text-slate-300">{incident.service}</span>{' · '}
    <span className={`rounded border px-2 py-0.5 ${severity[incident.severity]}`}>{incident.severity}</span>{' · '}
    <span className={`rounded border px-2 py-0.5 ${incident.status === 'resolved' ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-slate-600 bg-slate-800 text-slate-100'}`}>{incident.status}</span>
  </p>
}
