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

The participants list is deliberately static for this small slice. Changing membership later also requires reconciling existing records' participantIds; editing the constant alone does not revoke already-stored read grants. No membership-management workflow is implemented.

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
