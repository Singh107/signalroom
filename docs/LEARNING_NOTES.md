# SignalRoom Learning Notes

## Implemented slice (Task 4, November 23, 2026)

The /incidents route creates and reads native records. Authorization is intentionally limited to Agam and Participant A. Participant B is an authenticated negative-control account. User IDs in src/lib/incident-access.ts are identifiers, not passwords. Account credentials remain in the CLI-managed local store.

## 1. Schema and validation

src/schemas/incidents-schema.ts describes the native incidents collection, columns and permissions; src/schemas.ts registers it with the existing Worker and React providers. Every client role has create/update/delete denied. Reads use collaborator permissions against server-owned participantIds.

src/lib/incidents.ts uses the already-installed Zod package to enforce title length 5–120 after trimming, nonempty trimmed service, description at most 2,000 characters, allowed severity, and only open initial status. strict() rejects unknown fields, including creator, timestamps and participant IDs. This parser runs in the server action; browser HTML validation is only a convenience.

## 2. Record storage and metadata

The existing AppRecordRoom stores typed SQLite records in a Durable Object. The action uses tools.create without a recordId: the platform generates it and stamps verified creator and timestamps. React receives an envelope with recordId, createdBy, createdAt, updatedAt and data. Incident fields live in record.data. Local testing persists in the existing ignored Wrangler state; this is not proof of a production deployment.

## 3. Browser-to-server flow

IncidentsPage uses useAuth().userId and the shared access predicate to show the workspace or denial message. This UI gate is not the security boundary.

IncidentWorkspace subscribes through useQuery('incidents'). Its submit handler receives a form event, reads FormData, obtains getAuthToken(), and POSTs to /api/actions/createIncident. It waits for both a successful HTTP response and success:true before clearing the form and saying Saved. Failure shows an error; finally re-enables the button. It returns a Promise<void>.

createIncident receives the verified userId, untrusted params and native action tools. It first checks the participant allowlist, then parses input. It returns a failure result without writing if either check fails. Otherwise tools.create persists the validated data plus server-selected open status and participantIds, returning the record ID result. The existing action route verifies the JWT and constructs tools with that caller identity.

createConfirmed is deliberately not used: direct client mutations are denied so they cannot bypass the minimum-length/business validation action. The HTTP action awaits the native write result instead. useQuery receives the accepted record over the existing RecordProvider WebSocket; we did not build a WebSocket server.

## 4. Authentication versus authorization

Authentication proves identity. Authorization grants access. The native CLI test accounts exercise real app sessions; developer CLI login alone cannot do that. canAccessIncidents takes a user ID and returns a boolean based on exactly two allowed IDs.

Server actions bypass collection RBAC, which makes their explicit allowlist and validation mandatory. Native reads still apply collaborator RBAC. No role, including admin, gets general client mutation permission on incidents. An unauthorized signed-in user cannot turn membership into incident access. The caller cannot choose creator identity or participant IDs.

The participants list is deliberately static. Task 5 adds a fail-closed baseline check: changing the allowlist disables native incident reads for all roles and disables incident actions. Existing collaborator and creator grants still need a separately reviewed migration; see the revocation procedure below. No membership-management workflow is implemented.

## 5. Refresh persistence

Browser memory is disposable. The persistence test creates through the actual form, waits for Saved and the subscribed row, captures its record ID, reloads, and asserts that the same ID remains. It also queries the real record protocol and checks server creator, timestamps and open status. This checks storage rather than optimistic UI alone.

## 6. Manual verification

Start the official runtime from the project root with npx.cmd deepspace dev start (use an available --port if needed; do not kill an unrelated server). Open /incidents and sign in as Agam. Enter a title such as Payment API errors, service Payments API, severity SEV 2 and an optional description. Create, wait for Incident saved, reload and find the same record.

Signed out, the protected route should show Sign in to continue. Participant B should see You are not an incident participant. Automated API tests send malformed requests directly to prove that HTML controls are not the only validation.

Run npx.cmd deepspace test run all --port 5180 with port 5180 free. Keep CLI-managed credential and storage-state files out of Git. Test records use __test- prefixes and remain in local storage: no delete feature or permissive cleanup endpoint was added solely for tests.

## 7. Five interview questions

1. Why use a server action instead of direct createConfirmed here? Explain the minimum-length check and denial of bypass writes.
2. Why does authentication not imply permission? Trace Participant B through UI denial, action denial and filtered record reads.
3. How is creator spoofing prevented? Trace the verified JWT userId through action tools and explain strict input rejection.
4. How does a reload recover the same record? Distinguish React state, WebSocket subscriptions and persistent Durable Object SQLite.
5. What would changing the participant list require? Discuss existing stored read grants and why membership revocation needs migration/verification.

## Sources consulted

https://docs.deep.space/guides/testing
https://docs.deep.space/guides/server-actions.md
https://docs.deep.space/guides/authentication
https://docs.deep.space/concepts/permissions
https://docs.deep.space/concepts/realtime-sync
https://docs.deep.space/sdk-reference/worker/schemas
Installed SDK 0.44.2 index.d.ts/worker.d.ts/schema.d.ts and record/client implementations.

## Task 5 — Lifecycle and security review (November 23, 2026)

### A state machine is a small map of legal moves

An incident has one current state. `nextIncidentStatus` returns its only legal next state: open → investigating, investigating → resolved, resolved → investigating. An unknown stored state returns null. `canTransitionIncident` compares that permitted next state to the requested state. Self-transitions are rejected too. The UI uses the same pure map to choose its button; sharing a map avoids two different definitions of the workflow.

Creation remains restricted to open by `incidentInput`. The stored `Incident` type now supports all three statuses. `incidentTransitionInput` separately validates an ID (1–128 letters, digits, underscores or hyphens), an exact supported status, and no extra fields. A caller cannot submit creator, ACL or timestamp fields.

### Why the server checks again

A user can bypass buttons and send an HTTP request. The existing action route verifies the JWT and passes its userId to `transitionIncident`. That function checks `canAccessIncidents` before any privileged read, parses the input, calls `tools.get('incidents', incidentId)`, and checks the stored status. A failed lookup is returned unchanged; a forbidden edge returns `invalid_transition`. Only then does it call `tools.update<Incident>` with a narrow patch. This is essential because action tools bypass native collection permissions. Both allowed participants share the entire incident workspace; there are no per-incident teams.

`tools.update` patches an existing record and returns a recordId, not the updated record. It does not create a missing incident. We send only status and, on entering investigating, resolvedAt:null. We never copy request input into the stored envelope. The platform retains createdBy and createdAt and updates updatedAt. A text `resolvedAt` column with `timestampTrigger: { field: 'status', value: 'resolved' }` makes the RecordRoom stamp an ISO date when status enters resolved. The trigger alone does not clear the old time on reopening, so the action clears it explicitly. SDK reads can omit a SQL NULL column; treat absent resolvedAt as null. Resolving again generates a new timestamp. This is the current resolution time, not a history of past resolutions.

### What the browser does

`IncidentLifecycle` receives the record ID and current subscribed status. Its `transition` handler gets the auth token, POSTs the next state, checks HTTP success AND the result's success flag, and displays server/network failures. While the request is pending, the button says Updating… and is disabled. `finally` clears pending. It never changes the displayed status optimistically: `useQuery` receives the persisted RecordRoom update and React renders the new state and next button. The record update can arrive before the HTTP acknowledgement because these are separate transports, but it still comes from a committed server write. A refresh reconnects the subscription and reads the stored state again.

### Revocation: fail closed, then migrate deliberately

Security finding: SDK 0.44.2's collaborator permission means creator OR listed collaborator. Removing an ID from only the allowlist, or even from all participantIds, is insufficient for records that person created.

`incidentReadPermission` compares the current allowlist with a frozen `STORED_GRANT_BASELINE` of the two supported identities. A removal, addition or replacement returns false. The native schema uses that result for viewer/member/admin read permissions; the wildcard always denies reads. `canAccessIncidents` also checks the safeguard, so incident actions stop during a mismatch. A unit regression exercises removals of either identity, addition, replacement and empty membership; schema tests verify the guard is wired in and all native writes remain denied. This mitigation intentionally causes an outage rather than leaving stale access active. It is not automatic ACL migration or a dynamic membership system.

For a future membership change:

1. Change the allowlist only; DO NOT update the frozen baseline to silence the safeguard. Restart the local runtime (or, in a future deployed app, activate the new Worker and ensure old connections/runtimes are drained). Verify native incident reads are denied, including from the former participant. Merely editing a local file cannot revoke access in an already-running old binary.
2. Keep reads disabled while designing and testing the access migration. Reconcile every existing participantIds list AND replace creator-based authorization with an explicit, revocable policy while preserving createdBy as historical metadata. Never erase or rewrite creator history merely to revoke access.
3. Verify old creators, old collaborators, active subscriptions and alternate native read/tool paths cannot read, then deliberately re-enable an audited policy. This migration and its runtime revocation tests are not part of Task 5. Do not change the baseline before they exist.

Already-delivered data cannot be recalled from another person's browser. Local developer debug/Explorer facilities are trusted development tools, not a shared hosting environment; keep the dev server on loopback. No debug bypass was added for tests.

### Concurrency is still a limitation

Official real-time docs describe serialized individual writes and last-write field merging. Installed ActionTools has `get` and `update`, but no expected-version, conditional-update or transaction parameter; the scaffold sends each as a separate DO request. Therefore load → check → update is NOT atomic. Two requests can both validate an old status and both succeed. A delayed request can overwrite a later lifecycle change; duplicate clicks in different clients are not prevented by one disabled button. A narrow patch protects unrelated fields, not the state-machine invariant under contention.

Before relying on this for simultaneous operators, implement a verified DO-side conditional transition that checks and writes within one atomic operation (or use a documented conditional-update API if the platform adds one), then add contention tests. No process-local lock or second read is presented as a solution. Current tests prove sequential server validation and persistence, not race safety. The PRD's future transition-plus-history atomicity requirement also remains unfinished; no timeline is implemented here.

### Manual lifecycle check and interview practice

Start a current official local runtime, sign in as Agam, open /incidents, create an incident, Start investigating, Resolve incident, then Reopen investigation. Refresh after each move. Confirm creator/creation time do not change, resolvedAt appears on resolution and disappears on reopen, and only one next-action button is offered.

1. What is a state machine, and why is open → resolved rejected?
2. Why must the server validate a transition even if the UI offers only valid buttons?
3. How do tools.get and tools.update preserve creation metadata, and who stamps resolvedAt?
4. Why does a status survive refresh, and how does another subscription receive it?
5. Why do serialized writes not make get → check → update atomic, and what would fix that?

Additional references: https://docs.deep.space/guides/server-actions.md, https://docs.deep.space/sdk-reference/worker/schemas.md, https://docs.deep.space/concepts/permissions.md, https://docs.deep.space/concepts/realtime-sync.md. Verified against installed SDK types and implementation rather than inferring atomicity from general documentation wording.
