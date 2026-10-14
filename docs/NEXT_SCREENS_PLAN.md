# Next milestone: complete screens and match registration

Prepared October 12, 2026. The user requested cannonball/smoke polish first, then planning for the challenge's screens and configuration requirements. The user subsequently approved execution. The audit below preserves the state before implementation; fresh outcome evidence is recorded in `docs/PROGRESS.md`.

## Requirement audit before this milestone

| Requirement | Current evidence | Remaining work |
| --- | --- | --- |
| Main menu | Play, Options and control instructions implemented | Ranking and Match History tabs are missing |
| Options | Validation and refresh persistence covered by desktop/mobile tests | Derive all validation/input limits from one typed source |
| Match | Pixi arena, semantic HUD, input, tutorial and pause implemented | Continue the complete gameplay acceptance suite |
| Result | Score, actual active duration, termination reason, replay/menu and local recovery implemented | Registration is always pending; connect submitting, confirmed and failed states |
| Ranking | No implemented panel or HTTP query | Classification, players, scores, configuration grouping and pagination |
| Match History | Local last result and pending queue exist | Paginated confirmed history for this player with date, score, duration and reason |
| Typed configuration | Balance and per-match snapshot centralized in `src/game/config.ts`; projectile range currently derives from speed × lifetime | Remove the duplicated Shooter/weapon cooldown source; add explicit configurable projectile range and complete the contract schema |
| Persistence and abandonment | Options, last result, multi-record outbox, and abandonment journeys tested | Confirmed API data persistence and refresh recovery of outstanding submissions |
| Language and identity | English UI/code/docs, comic nautical styling and supplied assets | Apply the same design to tables and registration feedback |

## Proposed UI

Keep the existing hero, Play and Options. Add a harbor records section below the controls with semantic tabs named exactly **Ranking** and **Match History**. Include a small section title, **The Captain's Ledger**, for personality; tabs and column labels stay explicit.

Ranking columns: Rank, Captain, Score. Show which configuration is compared: current session duration and spawn interval, with a stable configuration key covering the complete balance snapshot. Rank numbers continue across pages. Initial page size: five rows. Break ties by completion date ascending, then match ID ascending.

History columns: Date, Score, Time at sea, Outcome. Only this player's confirmed matches appear. Use semantic tables on larger screens and readable stacked records on narrow screens. Previous/Next controls expose the current page, disable invalid navigation and retain visible focus.

Each panel must show distinct loading, empty, error/retry and background-refresh states. Previously loaded rows can remain during a refetch if they belong to the same view/configuration. A changed filter/page must never label stale rows as belonging to the new request.

Results show registration status with **Submitting**, **Saved** or **Pending — Retry**. Save the completed record to the outbox before sending it; a retry keeps its original ID. API failure must leave Play Again and Main Menu usable. Multiple outstanding matches remain visible through a small pending-report status in the menu.

## Architecture and contracts

- `src/data/contracts.ts`: validated `MatchRecord` (existing MatchResult plus a canonical config key), `PagedResponse<T> { items, page, pageSize, total }`, ranking entry and supported query parameters.
- `src/data/api.ts`: one Axios client; typed GET `/api/ranking?configKey=...&page=...&pageSize=5`, GET `/api/matches?playerId=...&page=...&pageSize=5`, POST `/api/matches`. GET calls consume AbortSignal; use bounded HTTP timeouts.
- `src/data/queries.ts`: TanStack Query hooks with keys including every filter and page. Mutations invalidate ranking and history together. Re-entering a tab refreshes its relevant data. Cancellation and separate query keys isolate late responses.
- `src/mocks/store.ts`, `fixtures.ts`, `handlers.ts`, `browser.ts`: a persistent mock store and shared deterministic contracts/fixtures/handlers. MSW intercepts real HTTP in development, browser tests and production. The worker starts before the app makes data requests.
- `src/storage/results.ts`: retain the existing per-ID durable outbox and session-memory fallback. Remove a pending entry only after a validated confirmed response. Retry all pending records without blocking another match.
- `src/ui/RecordsPanel.tsx`, `RecordsTabs.tsx`, `RegistrationStatus.tsx`: focused React components for panel state and registration feedback. Keep network orchestration outside layout components.
- `src/ui/NetworkLab.tsx`: a small deliberate scenario selector and reset control, documented in README; remain accessible in the public demonstration.

Use one confirmed mock collection to derive both ranking and history. Store confirmed matches under independent IDs, rather than an array read/modify/write operation that could lose concurrent records. POST finds-or-creates by the supplied match ID and returns the same record on retry. Validate restored and submitted configuration records fully, including legacy snapshots produced before visual settings existed; do not silently rewrite the balance of an old match.

If the mock worker itself fails to start, show a data-service failure and keep Play/Options accessible. Guard data queries until initialization settles; a worker startup problem must not leave a blank application.

Derive a canonical key from an explicitly ordered schema. Document whether cosmetic settings participate; recommend comparing all gameplay balance fields and preserving cosmetic settings in the stored snapshot without fragmenting rankings for purely visual changes. A schema/balance version must make this policy deterministic. Fixtures must use the same comparable settings as the current default match, so the default ranking is populated.

## Dependency-ordered implementation

### 1. Configuration and data contract (25-40 minutes)

- Write tests for config key stability, equivalent key ordering, distinct balance settings, complete record validation, and capture-before-options-change.
- Remove the redundant cooldown source and derive input limits from OPTION_LIMITS. Add explicit per-weapon range, initially equal to the existing speed × lifetime distance, and expire on the first of range or lifetime. Preserve the existing effective balance. Test a short configured range and snapshot behavior directly.
- Implement the shared contracts and stable player identity use. Legacy records may infer a newly introduced range from their original speed × lifetime, and cosmetic defaults may be restored; document that migration and never replace old gameplay values with current defaults. Verify unit tests and type checking.
- Learning: distinguish saved form state, a match snapshot and server-owned records.

### 2. Persistent MSW APIs (45-60 minutes)

- Write failing contract tests for pagination, score order/ties, player/config filtering and idempotent POST.
- Implement deterministic fixtures and one consistent confirmed store. Initialize the service worker and start it in the published application too.
- Test actual HTTP via Axios with shared MSW handlers, not mocked component return values.
- Learning: follow a request, response and typed object through the application.

### 3. React tabs and pagination (40-60 minutes)

- Write browser tests for tab navigation, both tables, paging, loading, empty and query failure/retry.
- Add QueryClientProvider and query hooks, then accessible tabs and responsive records.
- Refresh on tab re-entry and isolate late responses by query identity/cancellation.
- Learning: useState for active tab/page; useQuery for remote records; rendering loading/error/data states.

### 4. Registration and recovery (45-60 minutes)

- Write failing browser scenarios: finish a match and update both panels; keep playing while another record is pending; refresh while offline; retry after the server wrote but the response was lost.
- Implement mutation status, durable outbox retries and confirmation-based removal. Assert one history record and one ranking entry for the same match after repeated attempts.
- Learning: explain useMutation, invalidation and why a match identifier survives retries.

### 5. Scenarios and review (30-45 minutes)

- Expose deterministic success, empty/multiple pages, slow/out-of-order, timeout, connection/HTTP errors, independent ranking/history failures, write-then-timeout, and recovery scenarios.
- Verify Chromium desktop/mobile, English text, accessible tab focus, visual references and production worker behavior.
- Update README and ARCHITECTURE with actual contracts and recovery semantics. Record unfinished items honestly.

Estimated focused effort: roughly 3-4.5 hours, including guided explanations, with extra time if recovery or worker issues appear. This is a planning estimate, not a delivery guarantee. The next milestone has priority over extra decorative changes.

At the October 12, 22:09 planning update, the remaining evening window ends at 02:00. Start with the configuration contract, working APIs and visible tabs, then normal registration. If the complete recovery/scenario work exceeds that window, carry it into Tuesday's 16:00 session; do not label the phase complete or spend Wednesday development time. Keep advanced failure coverage and final validation in the existing Tuesday budget.

## Completion gate

The user can see both required tabs immediately in the menu. A completed match becomes confirmed in both views. An abandoned match appears in neither. Options survive refresh and each match preserves the settings used at its start. Pending/failed registration is truthful and retryable without duplication or blocking gameplay. Pagination and failure states work in desktop/mobile, and the same mocks function in the production build.

## Execution outcome

The records milestone is implemented. Ranking and Match History are visible in the menu ledger, use real Axios/Query calls intercepted by shared MSW handlers, and derive data from the same persistent confirmed store. Five-row pagination, current-gameplay configuration filtering, deterministic ties, player history, registration states and durable retry recovery are covered by browser journeys. The complete suite passed 71 browser/visual cases with one desktop-only touch skip; mobile touch passed. Unit coverage passed 78 cases. Lint and strict TypeScript/build checks passed. Production worker verification passed in desktop/mobile; final evidence and later delivery gaps are tracked in PROGRESS.md.

Independent review's startup timeout, offset-date ordering and exact HTTP 500 findings were reproduced and addressed. Timeout retry reloads the document with an explicit notice; failed registrations preserve their IDs. The complete challenge still requires deeper combat browser acceptance, measured performance/memory evidence and a public deployment.
