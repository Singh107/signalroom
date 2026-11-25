# SignalRoom submission draft

Status: READY to submit with the limitations below disclosed. Nothing has been submitted on the user's behalf. No separate official application form/field limits were supplied; this covers the provided project instructions, PRD and Task 9 fields.

## Submission text

SignalRoom is an incident coordination workspace for small engineering teams. It brings incident status, recovery checklists and persistent participant updates into one place.

Live application: https://signalroom-singh107.app.space

Source: https://github.com/Singh107/signalroom

To evaluate it, choose **Try the demo**, sign in with Google or GitHub, and create the prefilled synthetic incident. Open its detail page, investigate/resolve/reopen it, complete a recovery action and post an update. Refresh to check persistence. Open the same incident in two sessions of the same identity to observe realtime updates. Each demo identity is isolated; the private shared workspace has a separate explicit participant allowlist.

The app uses the official DeepSpace scaffold, React/TypeScript, native authentication, Durable Object-backed records, native permissions and realtime subscriptions, server actions, timestamp triggers and CLI hosting. GitHub is its permanent source authority. The server derives demo rooms from verified identity and validates every mutation; clients cannot choose another user's room or bypass validation through native writes.

The main engineering tradeoff was keeping persistence and authorization simple while being honest about consistency. Incident transitions use separate read/validate/write operations and can race under concurrent requests. The timeline contains participant-authored updates, not an automatic audit log: status/recovery changes and reopening do not create automatic events. There are no assignees, demo quotas/cleanup UI or pagination.

On November 24, 2026, the full local suite passed 114 unit and 40 browser/API tests (154 total, zero failed/skipped), alongside TypeScript, lint and build. Six additional tests against the actual production app passed, covering demo workflows, persistence, same-identity synchronization, mobile usability and isolation between two distinct test identities. These use supported email/password test accounts. Separately, I personally opened the production app and completed the manual acceptance checklist, including the sign-in flow; everything appeared to work correctly in my end-user testing. Collaboration between two distinct private participants remains unverified.

Codex assisted with implementation, documentation research, tests, debugging, release preparation and documentation. I helped define the project idea, requirements, MVP scope and roadmap. I reviewed implementation reports and important code excerpts, discussed architectural decisions and tradeoffs, directed priorities, and approved authorization, persistence, realtime, reviewer-access and deployment decisions. I personally tested the deployed application's functionality, navigation and usability through the manual acceptance checklist. ChatGPT assisted with planning, technical review, explanations and evaluating implementation decisions. Codex executed the automated tests. I do not claim to have independently written every line or performed a comprehensive security audit.

## Requirements reconciliation

| Supplied requirement | Status |
| --- | --- |
| Live app.space application and public GitHub repository | Complete; serving release and public repository independently checked |
| Official scaffold, React/TypeScript, native persistence/auth/realtime/deploy | Implemented; no separate backend/auth/database |
| Dashboard, validated creation, lifecycle/reopening, incident detail | Implemented and production-tested |
| Recovery action creation/completion | Implemented and production-tested |
| Assignees where supported | Not implemented; explicitly deferred |
| Persistent participant updates | Implemented and production-tested |
| Automatic status/recovery/reopen history in original PRD | Not implemented; later task scope explicitly deferred it |
| Two authorized sessions synchronize | Same-identity sessions verified locally and in production |
| Two distinct private users collaborate / original two-user evidence | Not verified; do not equate this with same-identity sessions |
| Secure, self-service reviewer access | Isolated model production-tested; owner reports successful manual production acceptance/sign-in |
| README with setup, architecture, testing and tradeoffs | Provided in repository root |
| Honest AI/person contribution statement and unfinished-work list | Included above; owner-reported review/manual testing distinguished from Codex automation |
| Separate official form fields or word limits | No additional fields/limits known to the owner; supplied requirements covered |

## Interview practice

1. **Why are counts derived rather than stored?** The subscription already contains the authorized incidents. Deriving counts avoids another value that can become inconsistent.
2. **How is a demo user's room secured?** The server constructs its room ID from verified authentication; WebSocket routing checks the exact room. A client-supplied room or ownership field cannot override it.
3. **Why validate actions when native permissions exist?** Privileged server action tools bypass record RBAC. The action must authorize and validate before using them; native client writes remain denied.
4. **What does a realtime test prove?** A second independent session observed a persisted update without refreshing. It does not prove distinct-user authorization, OAuth, exactly-once delivery or race-free transitions.
5. **Why is there no automatic audit timeline?** Updating an incident and separately appending an event can partially fail. Without a verified atomic operation, claiming consistent automatic history would be misleading.
