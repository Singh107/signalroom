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

## Task 6 — Recovery actions (November 23, 2026)

### Bounded atomicity investigation

Rechecked current official server-action, schema and real-time documentation, SDK 0.44.2 ActionTools types, and the scaffold's tools factory. The supported record update signature is still update(collection, recordId, patch). There is no expected-version/expected-state argument, compare-and-swap method or exposed record transaction in that interface. The guide's introductory mention of atomic orchestration does not supply an API that makes this scaffold's separate requests atomic. No documented small replacement was found, so lifecycle transitions remain unchanged. Concurrent lifecycle requests can validate stale state and overwrite an intervening move. No custom database, backend, undocumented method or process-local locking was introduced.

### One incident has many recovery records

The new native recoveryActions collection stores incidentId, description, status (pending or complete), completedAt, and server-selected participantIds. Its record envelope supplies recordId, createdBy, createdAt and updatedAt. A required immutable incidentId points to exactly one incident. Reference interpretation supplies relationship metadata; the action explicitly checks that the parent exists rather than assuming it is a database foreign key.

A separate collection lets each checklist item be created and completed independently. Storing an array inside an incident would require replacing the array and risk overwriting another person's item. Recovery operations never update the incident, so its status, resolution timestamp, creator and other fields remain untouched. No assignees, deletion, reparenting, editing or reopening of recovery items are implemented.

### Server functions and access

addRecoveryAction checks the existing participant predicate before any privileged record access. Its strict Zod input allows only incidentId and a description trimmed to 3–200 characters. It loads the parent, then creates pending state and collaborator grants chosen by the server. No client record ID, creator, creation time, completion state or timestamp is accepted.

completeRecoveryAction accepts only actionId. After authorization it loads the item and its stored parent, refuses failed lookups, returns success without writing if already complete, rejects unknown stored states, and otherwise patches only status:complete. Completion cannot move the item to a caller-specified incident. The RecordRoom text timestampTrigger stamps completedAt when status first changes to complete. The creator/creation time and parent remain unchanged.

The collection uses the same guarded collaborator read policy as incidents and denies native create/update/delete for all roles. Filtering a query by incidentId is for correct checklist membership, not authorization. Both supported identities share all incidents; the native record permissions still enforce who receives data. The Task 5 membership-change safeguard also applies to recovery reads/actions. Future revocation migration must reconcile recovery participantIds and creator grants as well as incidents, while preserving historical metadata.

### Completion and concurrency

Completion is idempotent in its business meaning: calling it again leaves the item complete with the original completedAt. Sequential duplicates return success without writing. If two callers both read pending, both may submit the same complete patch. Installed SDK putRecord synchronously loads the latest row and triggers the timestamp only when old status differs from new status. Thus the second identical patch preserves completedAt; updatedAt may change for a competing write. This is not an exactly-once execution guarantee or an atomic multi-record transaction. The simultaneous-request test exercises competing calls but does not force every possible scheduling interleaving.

Parent lookup plus child creation is also two calls. There is currently no parent-delete operation and native incident deletes are denied. If deletion is later introduced, orphan prevention/cascades need a separate consistency design. Retrying an uncertain ADD request can create another item because creation has no idempotency key; only completion is idempotent.

### UI, queries and updates

RecoveryChecklist uses useQuery('recoveryActions', { where: { incidentId }, orderBy: 'createdAt', orderDir: 'asc' }) for each incident. It renders loading, empty and error states plus the subscribed items. Its add handler gathers the form, calls the server, reports success/failure and clears the form only after success. callRecoveryAction obtains the token, POSTs the action and checks both HTTP status and success:true. RecoveryItem's complete handler disables its button while pending and reports failures. Completed text/time comes from the persisted subscription, not optimistic local status. One subscription per displayed incident is sufficient for this small slice; large lists would need a separate pagination/query review.

The browser test opens two separate authenticated browser contexts using Participant A's existing session state in memory. Session A adds an item and session B observes it without navigation or refresh; B completes it and A observes completion without refresh. Both then refresh and retain the same action ID/state. This proves cross-session sync for one authorized identity, not collaboration between two different allowed identities. Participant B remains a separate unauthorized negative-control identity.

### Manual verification

1. Restart a current official local runtime with npx.cmd deepspace dev start; open /incidents and sign in as Agam.
2. Create two incidents. Under one, enter a recovery description such as Restart payment worker and click Add recovery action. Wait for Recovery action saved.
3. Confirm the item appears only under that incident. Click Mark complete and check the Completed timestamp; refresh and verify it remains.
4. Open another signed-in browser session before adding/completing another item. Check that changes appear there without refresh. Automated evidence uses two contexts of Participant A, as described above.
5. A signed-out visitor should see the sign-in gate; a signed-in nonparticipant should be denied. Server/API tests cover forged fields, nonexistent parents and native-write attempts that HTML controls alone cannot prevent.

### Five interview questions

1. Why use a separate collection rather than an array on the incident?
2. Why does a reference column still need an explicit parent-existence check?
3. What does idempotent completion mean, and how is it different from exactly-once execution?
4. Why is filtering by incidentId not an authorization boundary?
5. Which concurrency guarantees hold for one record write, and which fail across get → validate → update?

## Task 7 — Participant updates and incident detail (November 24, 2026)

### Consistency contract: updates are independent records

This task deliberately implements the permitted user-authored-update fallback. Automatic incident-created, status-changed, recovery-added and recovery-completed events are NOT recorded. We do not reconstruct historical events from current state, attribute old transitions to a guessed actor, or call this a complete audit log. The UI says that automatic history is not recorded yet.

Official record/subscription docs and installed SDK 0.44.2 support a native activity collection and create/get/query operations. The action-tools signature still exposes no atomic transaction joining a business mutation and an event write. A best-effort second write could be lost after the business operation commits; a process crash can also occur between writes. Reversing the writes could record an event for an operation that later fails. No durable outbox or exactly-once claim is invented. Existing incident and recovery handlers do not call the timeline handler, so timeline failure cannot turn a committed lifecycle/recovery operation into a reported failure.

Posting a user update has only one write, to incidentActivity, after a read that verifies the parent. Its result describes that write, not a second business operation. A lost network response can still leave the caller unsure whether it committed; retrying may create a duplicate. This is not exactly-once posting. The existing lifecycle race and parent-read/child-create gap remain. No parent-delete action exists; any future deletion feature must address references/orphans.

### Model and trust

incidentActivity stores one required immutable incidentId, eventType:user_update, message, and server-selected participantIds. The explicit single supported category avoids pretending other event types exist. Message and eventType are immutable, and no edit/delete action exists. The record envelope supplies createdBy (verified caller) and createdAt (RecordRoom clock); there are no duplicate actor/timestamp fields that the browser can forge.

incidentUpdateInput permits only incidentId and message. It trims the message and requires 1–1000 characters. The bounded ID format matches existing operations. strict() refuses actor, timestamps, event types, record IDs and participant grants from the client. postIncidentUpdate checks canAccessIncidents before reading, parses input, loads the parent, and returns tools.create('incidentActivity', ...) directly. Lookup/write failures remain failures and never mutate an incident or recovery item.

Native activity reads use the same guarded collaborator policy. All roles, including admin, are denied native create/update/delete. This is an append-only application interface, not tamper-proof storage against a trusted server operator. Future membership migrations must include activity collaborator AND creator grants alongside incident/recovery grants; changing only the baseline is still unsafe. Both current participants share the whole workspace. A where filter is not a replacement for authorization.

### Detail route and functions

Generouted discovers src/pages/(app)/(protected)/incidents/[incidentId].tsx as /incidents/:incidentId. The list moved from incidents.tsx to incidents/index.tsx so it is an index sibling, not an implicit parent that hides the detail page. The existing protected layout supplies the sign-in gate. IncidentDetailPage uses the same participant predicate, reads the route parameter, and mounts IncidentDetail keyed by that ID so form state is not reused when changing incidents. IncidentDetail subscribes to incidents with where:{recordId:incidentId}; it shows loading/error/not-found states and mounts child controls only for a returned record. The list retains its creation form and controls, adding a View incident link.

IncidentLifecycle and its transition handler were extracted unchanged into a shared component; both views use it. RecoveryChecklist is reused unchanged. There is no second business-rule or authorization implementation for the detail page.

IncidentTimeline subscribes to incidentActivity with where:{incidentId}, orderBy:createdAt, orderDir:asc. It sorts equal timestamps by recordId for stable display across refresh; that tie-breaker is not causal order. Older timestamps display first. Each item shows its literal message, verified creator ID and an ISO server time. It provides loading, empty, error, pending and success states. Its post handler obtains getAuthToken, sends incidentId/message, checks HTTP and success:true, then clears the form. Failed requests retain the draft. React displays messages as text, not HTML.

### Browser → server → storage → subscription

The user posts from the detail form. The existing action route verifies the bearer token and supplies its userId. The action authorizes and validates before writing. RecordRoom persists the native event and stamps metadata. Authorized matching subscribers receive a record update; useQuery updates React. No optimistic local event is inserted. The persisted broadcast may arrive before the HTTP acknowledgement, but it represents a stored event. Reload obtains a fresh snapshot from persistent local storage.

Realtime verification uses two separate browser contexts of Participant A, not two distinct authorized identities. A posts and B sees it without refresh; B posts and A sees both in order. Both reload and retain the same event IDs. A different incident remains empty. No production verification is implied.

### Manual verification

1. Start a current runtime with npx.cmd deepspace dev start (restart any old process so it loads the new schema/routes).
2. Sign in as Agam, create an incident at /incidents, and click View incident. The address should be /incidents/<recordId>.
3. Check title/service/severity/status, lifecycle control and recovery checklist. Post an update, wait for Update posted, and verify its creator ID/time in the timeline. Reload and find it again.
4. Open the same incident in another signed-in browser context. Post another update and observe it in the first without refresh. Check another incident has no copy of these updates.
5. Empty/whitespace or oversized messages should be rejected. Nonparticipants must be denied; signed-out visitors see the sign-in gate. An unknown incident shows Incident not found and no update form.
6. Lifecycle and checklist controls still work, but deliberately do not add automatic timeline entries. Those event categories remain a documented MVP gap pending a reliable consistency design.

### Interview questions

1. Why can a second event write make an operation's reported outcome misleading?
2. Why are createdBy and createdAt taken from the record envelope?
3. Why is an incidentId query filter insufficient to protect private activity?
4. How does a persistent subscription update two browsers and survive refresh?
5. What is the difference between chronological timestamps, causal ordering and exactly-once delivery?

References: https://docs.deep.space/guides/server-actions.md, https://docs.deep.space/sdk-reference/client/records.md, https://docs.deep.space/concepts/realtime-sync.md, and installed SDK ActionTools/record-envelope definitions and write implementation.

Final Task 7 verification: npm.cmd run type-check, npm.cmd run lint and npm.cmd run build each exited 0. npx.cmd deepspace test run all --port 5180 exited 0 with 96 unit and 37 browser/API tests passed, zero failed and zero skipped. Earlier runs exposed the index-route nesting mistake and a 100 ms loading-state race in an existing test; both were corrected without removing assertions or increasing timeouts. BUILD_LOG records each run and the actual browser evidence.


## November 24, 2026 - Task 8: dashboard and isolated reviewer demo

The dashboard is a view of one authorized `useQuery('incidents')` subscription. `incidentCounts` groups those records by status; filtering selects from that same array. Loading counts show Loading instead of a misleading zero. Buttons expose aria-pressed, and an empty filter explains how to recover. Existing quick lifecycle/recovery controls remain available; detail links use the active workspace route.

`formatIncidentTime` checks invalid/missing values before formatting with an explicit UTC timezone. `ActorNamesProvider` requests the SDK's authorized public identity roster once per page, then `ActorName` consumes that lookup. It never requests unrestricted users records or displays email-shaped names. Mounting the lookup per incident caused excessive roster requests; sharing it removed that load. Status badges include text as well as color. Recovery progress derives from persisted checklist records.

### Reviewer boundary

The user approved a public Singh107/signalroom repository and a minimal self-service isolated demo. The original supplied request/PRD requires an evaluable app and GitHub source; no verified reviewer identity or special internship access mechanism was supplied. Official auth supports Google/GitHub sign-in. Email/password is existing-account sign-in, not public signup. Platform collaborator invitations grant deploy/secrets access and are unsuitable for product reviewers.

The separate `/demo` route reuses the incident UI and existing validation/state machine. Each authenticated identity gets a native RecordRoom named `demo:<appId>:<verifiedUserId>`. `DemoLayout` mounts a nested RecordScope. `useWorkspace` chooses the UI links and action endpoint; this is UI plumbing, not the security boundary. The Worker verifies the caller, chooses demo versus private policy from the registered route, and constructs the room ID itself. No request field can choose the owner, participant grants, or room. Action factories reuse the same operations with a server-selected WorkspaceAccess policy. The demo policy permits only its verified identity and sets participantIds to that identity. Record IDs from another room cannot be loaded by these tools.

`canEnterRecordRoom` validates the exact requested room against the verified user before forwarding a native WebSocket. Foreign and anonymous demo connections fail before touching the DO. Existing native collaborator reads and create/update/delete denials remain unchanged. The private allowlist and frozen baseline were not modified, and no private data was migrated/copied. A future private membership change still needs the documented grant/creator migration; the shared schema's fail-closed baseline would also stop demo reads until deliberately reviewed.

This is an application demo built on documented RecordScope/RecordRoom isolation, not a special platform demo credential. A new reviewer opens the landing page, chooses Try the demo, signs in through Google/GitHub, and creates the prefilled synthetic incident. The sample is a draft until explicitly submitted, avoiding automatic duplicate seed writes. They can transition, add/complete recovery, and post updates. Refresh preserves that user's records. Two tabs or browser sessions of the SAME account can demonstrate realtime changes; different reviewer identities intentionally cannot collaborate with each other. Private-team collaboration remains separate.

### Verification and limits

New tests cover derived counts, safe timestamp/name fallback, exact room authorization, mobile overflow, filters/empty results, demo lifecycle/recovery/timeline persistence, same-user multi-session updates, foreign-room native reads, foreign incident/recovery mutations, forged fields, native update denial and signed-out rejection. All prior tests remain intact. Full results and actual visual/deployment evidence are in BUILD_LOG.

The demo has no quotas, reset/cleanup UI, cross-user invitations or pagination. Use synthetic data only. It does not fix the documented lifecycle read/validate/write race, ambiguous network retries or missing automatic history. Platform Google/GitHub availability is still required. A local passing test is not proof of live OAuth or deployed persistence.

GitHub source is permanent on first accepted deploy reservation, including a deploy whose later phase fails. Verify the registered app, sole selected remote and sourceInference before that command. Ordinary Git pushes publish history; DeepSpace's GitHub deploy uploads the local tree. Therefore push the reviewed commit and deploy a clean tree so those two artifacts agree.

References: https://docs.deep.space/guides/authentication.md, https://docs.deep.space/guides/collaborators, https://docs.deep.space/sdk-reference/client/records, https://docs.deep.space/concepts/data-model.md, https://docs.deep.space/guides/source-control.md, https://docs.deep.space/guides/app-identity, https://docs.deep.space/concepts/deployment.md; installed SDK 0.44.2 types/CLI and useUserLookup/selectGitHubRemote implementations.


Task 8 result: 114 unit + 40 browser/API tests passed (154 total, zero failed/skipped), with TypeScript/lint/build exit 0. The first hostname was taken; changing the hostname preserved the app ID and the already-latched GitHub source. Release sequence 1 is live at https://signalroom-singh107.app.space from clean checkout 188d223. The source revision (1), release sequence (1), and Git commit are different identifiers. GitHub-source commitOid is null; do not invent lineage. Browser automation stopped on a URL-policy verification error, so actual production sign-in/create/retrieve remain manual checks, despite the CLI confirming edge/data-plane readiness.
