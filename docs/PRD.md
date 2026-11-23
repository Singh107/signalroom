# SignalRoom — Product Requirements

Version 1.0 · November 22, 2026 · DeepSpace Software Engineering Internship

## Purpose

SignalRoom is a real-time incident coordination workspace for small engineering teams and student developers. It brings incident status, recovery actions, and a persistent activity timeline together. Tagline: **Incident response, without the chaos.** Benefits are intended outcomes, not measured claims.

## MVP

- Dashboard: list incidents, filter by status, show summary counts, create incidents, and open their command rooms.
- Incident creation: title required (5–120 characters), description optional (maximum 2,000 characters), service required, severity SEV 1/2/3, initial status Open. Enforce validation on the server as well as in the UI.
- Command room: incident title, severity, status, timestamps, recovery checklist, and chronological activity history. History is inside the command room, not a separate analytics screen.
- Lifecycle: Open → Investigating → Resolved; Resolved → Investigating reopens an incident. Reject all other transitions, including Open → Resolved. “Identified” in the supplied illustrative wireframe is not an MVP status.
- Recovery actions: create and complete actions; assign to authorized team members where supported by the verified platform APIs.
- Timeline: post updates and record meaningful changes with timestamps and authenticated actors where available. Reopening must produce a history event.
- Collaboration: two authorized sessions see changes without refreshing. Records and history survive reloads.
- Reviewer experience: clear demo introduction and prepared sample data or documented sign-in flow, without hardcoded credentials or unrestricted private writes.

## Access and consistency

Use DeepSpace native authentication and server-enforced permissions. Signed-out visitors may view a demo introduction; unauthorized users cannot read or modify protected incident records. UI visibility alone is not authorization. Persist status changes and their history events consistently in one operation where supported; investigate guarantees before selecting an implementation.

## Architecture and conceptual data

Preserve the official scaffold. Use React, TypeScript, scaffold Tailwind and UI primitives, scaffold routing, DeepSpace Worker, native record collections, synchronization, authentication, CLI deployment, and GitHub source control. Use the installed SDK definitions and official docs for exact APIs. Do not add a separate backend, database, auth provider, or WebSocket server.

- Incident: title, description, service, severity, status, creator, creation/update timestamps, nullable resolution timestamp.
- Recovery action: incident reference, title, nullable assignee, completion flag, creation and nullable completion timestamps.
- Timeline event: incident reference, actor, event type, message, timestamp.

These are conceptual fields, not implemented collections. Adapt IDs and metadata to DeepSpace's record envelope rather than duplicating platform fields blindly. Exact validation and transactional APIs remain to be verified.

## Design

Professional developer workspace: charcoal background, restrained typography, subtle borders, and meaningful severity colors. Include accessible controls, responsive layouts, and empty/loading/error states. Supplied wireframes and counts are illustrative, not working product screenshots or real data.

## Acceptance and verification

A feature is complete only when its interaction works, validation is enforced, persistence survives reload, and behavior has been tested. Cover incident creation/detail, allowed and rejected transitions, recovery actions, timeline updates, protected access, and reviewer onboarding. Use scaffold Vitest and official DeepSpace/Playwright tools; determine exact commands from installed scripts.

Critical collaboration test: open the same incident in two authorized sessions; change status in A and observe B without refresh; complete an action in B and observe A; reload both and confirm persistence. Also test empty titles, oversized descriptions, invalid statuses, and unauthorized reads/writes.

## Scope and schedule

Exclude production monitoring, automated detection, Slack/PagerDuty, payments, attachments, video, advanced analytics, AI summaries, and complex organization management.

Planned work: November 23 foundation/persistence proof; November 24 lifecycle/actions; November 25 timeline, auth, two-session verification and first deployment; November 26 testing/polish; November 27 final checks and submission. Estimated effort: 24–30 focused hours. Prioritize correctness over new features if collaboration or tests fail.

Deliver a working available app.space URL, public GitHub repository, README with setup/architecture/tradeoffs, testing evidence, honest unfinished-work list, and a submission note distinguishing generated work from personally reviewed/verified work. The signalroom subdomain is not reserved.

## Current task boundary

Task 1 only: inspect environment, research official setup, generate and verify scaffold, and document results. Do not implement incident collections or UI, deploy, push, or create a GitHub repository. Stop for browser login when needed. Review and explain each subsequent change in small steps suitable for live interview discussion.
