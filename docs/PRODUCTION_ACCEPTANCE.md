# Production acceptance - November 24, 2026

Live app: https://signalroom-singh107.app.space

Public source: https://github.com/Singh107/signalroom

## Release identity

- App: `app_01M83E7BTRFAXJ6AFYG5Y1C068` (unchanged).
- Authority: GitHub `singh107/signalroom`, source revision **1**.
- Serving release: sequence **1**, `rel_01M875ZMK43Z2EPJQ9RSQJNH2P`.
- Deployed clean checkout: `188d2237d85e1c6e525b0a987ef4d895c9ce7874`.
- Platform `commitOid:null` is the GitHub-source convention; the Git commit was verified separately.
- Starting local/GitHub HEAD: `78f08ac`; only BUILD_LOG/LEARNING_NOTES differed from the deployed checkout. Task 9 adds documentation, screenshots and a production-test configuration, with no runtime changes or redeployment.

## Evidence categories

**Independent production evidence:** read-only CLI source/status, unauthenticated HTTP checks, and six Playwright tests against the HTTPS live origin using the official SDK test-identity fixture. All six passed in 25.5 seconds, zero failed/skipped, command exit 0. No local server or auth bypass was used. Credentials remained in the SDK-managed store. Synthetic records remain in the test identities' isolated demo rooms; no cleanup bypass was added.

**Local automated evidence:** Task 8 full suite on November 24: 114 unit and 40 browser/API tests passed, zero failed/skipped. TypeScript/lint/build passed. Not rerun for documentation/test-configuration-only changes.

**User-reported evidence:** on November 24, the owner reported opening the deployed app and completing the Task 8 manual acceptance checklist, with everything appearing to work correctly, including end-user functionality, navigation and usability. The specific OAuth provider was not named. This supports the manual sign-in check; it is not an independently observed OAuth trace or comprehensive security audit.

| Production acceptance item | Result | Evidence / boundary |
| --- | --- | --- |
| Public entry loads | PASS | HTTP 200; browser content/console/static-contract tests |
| Try the demo discoverable | PASS | Public HTML contains demo link and entry text; visible demo navigation in screenshots |
| Google or GitHub sign-in | PASS (user-reported) | Owner reports successful Task 8 manual acceptance checklist; provider not specified; not automated OAuth coverage |
| Correct isolated demo room | PASS | Authenticated demo access and distinct-identity isolation tests |
| Synthetic incident creation | PASS | Real UI submission and saved incident detail |
| Dashboard counts and filters | PASS | Total/open/resolved counts, status selection and filtered-empty assertions |
| Detail navigation | PASS | View incident link and expected demo detail URL |
| Full lifecycle including reopen | PASS | Open -> investigating -> resolved -> investigating |
| Recovery create/complete | PASS | Real actions, completion indicator, 1/1 progress |
| Timeline persists | PASS | Posted update remains after reload |
| Refresh preserves records | PASS | Incident state, completed checklist and update restored |
| Same-identity two-session realtime | PASS | Separate authenticated browser contexts; update appears without refresh |
| Mobile usability | PASS | 390x844 flow, no horizontal overflow; production screenshots inspected |
| Unauthorized access | PASS | Signed-out page/action rejected; foreign-room read and foreign mutations denied; forged grants rejected; native update denied; nonparticipant private create denied |
| Distinct demo identities isolated | PASS | Two supported test identities; foreign incident/recovery operations fail |
| Two distinct private participants collaborate | NOT VERIFIED | Only one private participant is an available test identity; owner session was not used |

PASS applies to the stated assertions, not every browser, permission path or concurrency condition. The production suite did not exercise every local invalid-input case. Existing full local regressions remain separate evidence. The UI flow recorded no console/page errors. Desktop 1440x1000 and mobile 390x844 screenshots were reviewed; only synthetic content and fixture display names are published.

## Reviewer/manual reproduction steps

1. Open the live app in a normal browser, select **Try the demo**, and complete Google or GitHub sign-in.
2. Confirm the personal demo banner; create the prefilled synthetic incident and open it.
3. Refresh and verify the same incident remains. Optionally repeat lifecycle/checklist/timeline and same-account two-tab synchronization.
4. Report which OAuth provider worked and what was observed. Do not send credentials or session data.

No browser safety restriction was bypassed. Task 8's native browser control stopped on a URL-policy error; Task 9 used the separately documented and explicitly requested SDK production test workflow. Real user OAuth is supported by the owner's separate manual report, not inferred from test-account authentication.

**Recommendation: READY to submit the disclosed MVP.** Independent production checks passed and the owner reported successful manual acceptance. No submission-blocking defect was found. Distinct-private-user collaboration remains NOT VERIFIED, and automatic audit history/assignees remain incomplete; do not represent every original PRD item as delivered.
