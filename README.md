# Salt & Trouble

Bad decisions. Excellent cannons.

**Play:** https://projeto-jog.vercel.app

**Source:** https://github.com/SCarinciRod/salt-and-trouble

A comic nautical interpretation of the [Jungle Pirate Battle challenge](https://github.com/junglegaming/game-developer-challenge). Implementation status and verification evidence are tracked in [docs/PROGRESS.md](docs/PROGRESS.md). Public publication status is tracked in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Setup

Use Node.js 24 LTS and pnpm 11.25.0. Install pnpm through the documented package-manager setup for your environment, then:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm dev
```

Open http://127.0.0.1:5173. No environment variables are currently needed.

```sh
pnpm test
pnpm lint
pnpm run format:check
pnpm typecheck
pnpm build
pnpm preview
pnpm test:e2e
pnpm test:e2e:report
pnpm build
pnpm test:production
pnpm run profile
pnpm run profile:heaps
pnpm run reports:archive
```

The browser suite runs desktop and mobile Chromium with one worker and writes an HTML report. Failed browser tests retain traces and screenshots. Browser tests use fresh contexts with isolated storage. Playwright starts its own test-mode server with a fresh dependency cache on port 5174, leaving the normal development server on port 5173 available for manual play. `test:production` serves the previously built `dist` on port 5175 and verifies the production worker, record persistence and absence of the test harness. Run these browser suites sequentially. Visual references were reviewed on Windows; platform-specific baselines may require regeneration and review on other operating systems.

`tests/combat.spec.ts` exercises real inputs for rotation, four arena edges, island movement/projectile collisions, frontal/lateral damage, independent cooldowns, unique scoring, natural Chaser/Shooter behavior, spawn timing, death and time completion. It never replaces enemy positions, health, projectiles or scores. The manual clock is compiled only in test mode. Stable seed 42 and fixed simulation steps make combat checks reproducible; each test gets isolated storage and a browser context.

Core menu, stable arena and result baselines for both projects are delivered under `tests/visual.spec.ts-snapshots/`. Run `pnpm test:visual` to compare. Review screenshots before intentionally updating references with `pnpm exec playwright test tests/visual.spec.ts --update-snapshots`; do not update them merely to hide a failure. Open failure traces with `pnpm exec playwright show-trace test-results/<failed-test>/trace.zip`.

After the full E2E suite, run production tests and `pnpm run reports:archive` in that order. This preserves HTML reports and attachments under `reports/tests/`. See [reports/README.md](reports/README.md) for delivered evidence and limits.

## Profiling

Run `pnpm build` followed by `pnpm run profile`, with other browser suites/builds stopped. The script owns port 5176, runs a real three-minute round and five eight-second start/play/exit cycles, then writes raw metrics, a screenshot and compressed before/after heap snapshots to `reports/profiling/`. Use `pnpm run profile -- --headed` for a visible Chromium window when comparing hardware acceleration; keep that window focused throughout.

The measured workload uses duration 180s, spawn 15s, seed 1 and held W/D/Space/Q/E. These are ordinary game settings and real controls. The 15s interval allows this fixed controller to survive; it is lighter than the default 3s interval or the 0.5s stress limit. Memory cycles use the default 3s spawn interval so both enemy kinds are created. `/?profile=1&seed=1` enables a read-only observer in the same optimized build. It observes active ticker intervals, entity counts and renderer identity; it cannot advance time or mutate combat. It is absent on ordinary URLs and removed on exit. Its overhead is included.

The frame-rate target is 60 FPS. Results, hardware, browser, resolution, renderer and limitations are documented in [reports/PROFILING.md](reports/PROFILING.md). JS heap and DOM/listener counts after forced collection do not establish GPU VRAM usage or native driver retention.

To validate an already published build, set `PUBLIC_GAME_URL` to its HTTPS address and run `pnpm test:public`. This variable is for the verification command only; the application needs no environment variables. Public tests use fresh contexts and real time, including an actual completed match, refresh and pending-registration recovery.

## Controls and configuration

W moves forward; A/D turn; Space fires forward. Hold the left/right mouse button over the arena to fire the port/starboard broadside; Q/E remain alternative keyboard shortcuts. Escape pauses. Touch controls use the same actions. Losing focus pauses the match; resume requires an explicit action.

Each round starts with a short controls modal. Any key or pointer press dismisses it with a 220 ms fade (immediate for reduced-motion preferences). The first input only closes the guide. The simulation clock starts after dismissal, and neither movement nor firing leaks through that input.

Options accept a 60-180 second match and an enemy spawn interval of 0.5-15 seconds. The default is 120 seconds with a three-second interval. The lower spawn limit prevents unbounded spawn rates while still allowing stress testing; the upper limit keeps short matches populated. Valid options persist locally. Corrupt or inaccessible storage falls back safely; inaccessible writes are disclosed in the interface.

All gameplay settings are typed in `src/game/config.ts`: health, movement/turn speeds, spawn distribution/distance, weapon damage/range/speed/lifetime/cooldown and Shooter range. A round captures its configuration on Play. Projectile range and lifetime are independent limits; the first reached removes the projectile. Cosmetic cannonball and smoke settings are in the same configuration but do not split the ranking.

## Records and network scenarios

Ranking and Match History appear in **The Captain's Ledger** below the controls. Ranking compares all gameplay settings, orders by score descending, then completion date ascending and match ID ascending, and includes other captains as fixtures. History contains this captain's confirmed voyages, newest first. Both use five records per page. Left/Right and Home/End navigate the tabs. Captain identity is generated and saved on this device; clearing browser storage creates a new identity.

Completing a voyage saves the last result and an independent per-match outbox entry before POSTing. Results display Submitting, Saved or Pending. API failure leaves replay available; pending reports survive refresh when storage is writable and can be retried from the result or menu. Every retry retains the original ID. A valid API confirmation removes the pending entry and refreshes both lists. Confirmed records also persist on this device. These are simulated REST APIs, not a shared online leaderboard. Refreshing or exiting an active match abandons it without a record.

Open **Network conditions** below the ledger and choose **Network scenario**, or use a reproducible URL such as `/?network=write-timeout`. Selection persists after refresh. The production build uses the same MSW worker, contracts and handlers as development and tests; `public/mockServiceWorker.js` is included in the build. No external API account or environment variables are required.

| Scenario ID | Behavior |
| --- | --- |
| `success` | Other captain fixtures; actual confirmed history |
| `empty` | Removes fixtures; actual confirmed reports remain consistent |
| `multiple-pages` | Adds illustrative voyages for this captain as well as ranking fixtures |
| `slow` | Fixed 800 ms latency |
| `variable-latency` | Repeating 90/700/140/450 ms sequence |
| `out-of-order` | Alternating 1000/70 ms responses, captured before the delay |
| `timeout` | 2200 ms latency, exceeding the 1200 ms HTTP timeout |
| `offline` | Connection failure on all records endpoints |
| `http-400`, `http-500` | HTTP request/server errors |
| `ranking-error`, `history-error` | Independent list failure |
| `registration-error` | Submission fails while list queries work |
| `write-timeout` | First POST writes, then responds after 2200 ms; same-ID retry confirms the existing record |

To reproduce recovery, select Connection failure, finish two voyages and refresh. Both reports remain pending. Select Success to submit them automatically, then open Match History. To reproduce an uncertain write, select Timeout after recording, finish a voyage, wait for Pending and click Retry registration. Only one record appears. GET requests retry once for transport/5xx failures, with a fixed 250 ms delay; 4xx responses are not automatically retried. Failed submissions require a manual retry, refresh, or scenario recovery, avoiding uncontrolled write retries.

**Reset demo records** deletes this device's confirmed records, pending reports, confirmation receipts and last result, restores Success, and reloads the page. Options and captain identity remain saved. Multiple pages deliberately includes example history; the standard scenario never invents this player's completed voyages. If worker startup fails, Play and Options remain available. Startup has a ten-second bound; after a stalled startup, Retry data service explicitly reloads the page to discard the unfinished native registration.

## Visual identity and sources

The user selected a comic pirate adventure. The provisional title is Salt & Trouble. Deep blue water, warm parchment, coral highlights and intentionally incompetent-captain jokes form the visual direction. Functional instructions remain direct.

Game art is supplied by the challenge at source revision `315891441be81ca0bff75cf3c2b0cd2f27f119cd`. See [ASSET_SOURCES.md](ASSET_SOURCES.md) for provenance and license status. Fonts are bundled locally through Fontsource, with included license copies; the app does not fetch Google Fonts at runtime.

Only the 22 referenced challenge assets are shipped. All ship damage variants and dynamically selected island tiles remain. The original pack is available upstream; local unused originals are held outside the repository in ignored Temp storage. [Clean-code review](docs/CODE_QUALITY_REVIEW.md) records the measurements and approved cleanup. `pnpm run format` formats source/tests/scripts/configuration; `pnpm run format:check` checks their consistency.

See [DELIVERY_PLAN.md](DELIVERY_PLAN.md) for the approved schedule and [docs/FINAL_ACCEPTANCE_PLAN.md](docs/FINAL_ACCEPTANCE_PLAN.md) for the final acceptance matrix. [Deployment instructions](docs/DEPLOYMENT.md) record the public Vercel URL and reproduction. Git source-repository handoff remains pending separately from the verified deployment.
