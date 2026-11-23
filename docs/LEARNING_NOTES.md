# SignalRoom Learning Notes

## Current status

The incident create/read feature is not implemented. These notes describe the planned approach, not a working feature. Implementation paused at the user's authentication prerequisite: zero usable test accounts.

## 1. Database schema

A schema is the rulebook for fields, constraints and access to stored records. DeepSpace schemas live in src/schemas/ and are registered in src/schemas.ts. TypeScript checking alone cannot reject a malicious network request; server validation must enforce the rules too. Installed SDK 0.44.2 supports required and maxLength, but no minLength column option. Research the server validation path before implementing the five-character title minimum.

## 2. DeepSpace records

DeepSpace stores records in Durable Objects using typed SQL columns. A record is an envelope: metadata surrounds application fields under record.data. Reuse platform recordId and verified creator/timestamp metadata instead of trusting browser-supplied identity or duplicating metadata.

## 3. Planned React read/create flow

Form values -> server-validated write -> persisted record -> subscribed React list. useQuery subscribes to collection records. useMutations provides createConfirmed, which waits for the server acknowledgement and rejects denied writes. Plain create can return an ID before acceptance; that is not proof of a saved record.

Hooks need the existing (app) provider boundary; the planned authenticated page belongs inside (app)/(protected). No incident form or function exists yet. Verify exact signatures and validation behavior before coding.

## 4. Authentication and authorization

Authentication establishes who someone is. Authorization decides what that identity may do. Developer CLI login is separate from app-browser login. A sign-in gate does not replace server permissions. DeepSpace normally gives authenticated users member role; decide explicit private-team admission before allowing incident access. Creator identity must come from verified server identity, not a form field.

## 5. Persistence after refresh

React state disappears on reload. Stored records remain, and the reloaded page queries them again. Test by waiting for an accepted write, refreshing, and finding the same record. Seeing an item immediately after clicking Create is insufficient evidence.

## 6. Manual verification

Today: visit http://127.0.0.1:5173/ and /home. Confirm the starter renders and signed-out navigation offers sign-in. Inspect DevTools Console for unexpected errors. CLI login does not sign the app browser in.

For authenticated automated checks, create two dedicated @deepspace.test accounts using the official test accounts create command and --password-stdin. Keep passwords out of source, command arguments and chat. Confirm with npx.cmd deepspace test accounts list --usable, then run npx.cmd deepspace test run all --port 5180 while 5173 is occupied.

After implementation, test valid creation/reload, empty/short/oversized titles, invalid severity, forced non-open status, spoofed creator and unauthorized writes against the actual server. None of those incident tests has executed yet.

## 7. Interview questions

1. Why are browser form checks insufficient? Explain that a caller can send requests directly, so the server must validate.
2. Why await a confirmed mutation? Explain the difference between sending a request and receiving acceptance.
3. How would you prove persistence and permissions? Describe reload tests and real authorized/unauthorized sessions. Explain why skipped tests are not passes.

## Sources

- https://docs.deep.space/guides/data-storage
- https://docs.deep.space/concepts/permissions
- https://docs.deep.space/guides/testing
- Installed node_modules/deepspace/dist/schema.d.ts and testing.d.ts
