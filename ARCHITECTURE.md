# Salt & Trouble architecture

This document describes the game, records integration and reproducible verification boundaries. Deployment and final verification are summarized in README.md; delivered reports are listed in reports/README.md.

## React and state ownership

`App` owns the active screen, saved options, the current match identity/configuration and the last result. `MainMenu` receives values and action callbacks through props. `OptionsForm` owns unsaved text fields; it validates and passes a typed value to the parent on Save.

The form is intentionally an approachable learning example: controlled inputs use local state, the parent owns shared committed state, and local storage persists that state across refreshes. Options changes only affect subsequently created match configurations.

`GameScreen` receives a configuration snapshot. `GameCanvas` creates the Pixi runtime through an Effect, cancels stale initialization with an AbortSignal and disposes the runtime on unmount. Strict Mode stays enabled. Shared asset textures remain in Pixi's cache across rounds; each runtime destroys its canvas, stage objects, ticker, observers and input listeners without destroying shared texture sources or releasing Pixi's global pools. The same idempotent disposal handles abort and initialization exceptions, so Retry cannot append a second canvas behind a failed one. If Application initialization rejects, cleanup releases the stage, ticker and renderer actually exposed at that point; allocations hidden inside the SDK before assignment are outside this ownership guarantee.

## Simulation and rendering

`Simulation` owns ships, projectiles, transient effects, spawn schedule, weapon cooldowns and active time. It has no React, DOM or Pixi dependency. A seeded linear congruential generator makes spawn positions reproducible. Enemy types alternate through a configurable spawn pattern.

The runtime integrates fixed 1/60-second steps from monotonic active timestamps. Pixi's raw `elapsedMS` identifies the current frame timestamp; its FPS-capped `deltaMS` is never used as active time. Low frame rates cause more simulation steps per render instead of slowing movement, spawns, damage or the session clock. Long visible-tab stalls catch up until the match ends; the normal three-minute profile does not characterize an extreme visible-tab stall. The runtime publishes only changed HUD summaries; ship positions never enter React state. A browser check observes at most two HUD publications over 60 movement steps while time and movement really advance. `BattleScene` reuses display objects keyed by entity ID. Health bars are rebuilt only when health changes. The normal automatic Pixi render callback is removed so each simulated frame is rendered once by the scene adapter.

Cannonballs use the supplied metal projectile sprite. Smoke is a rendering-only model sampled at fixed spatial intervals and aged by the simulation's active clock. It expands, drifts slightly backwards and fades over 0.42 seconds, with at most 180 retained particles. Pixi smoke graphics are reused from a bounded pool. Pause and resize cannot advance or duplicate the trail; disposal clears its tracking data and the application destroys the pooled graphics. Damage and projectile physics are unaffected.

Ship movement uses circular hitboxes, arena clamping and circle-to-rectangle island tests. Visual ship bounds fit inside the movement circle. Projectile collision uses swept segment-to-circle and segment-to-expanded-rectangle tests, selecting the closest hit before applying damage. Projectiles are consumed once; dead enemies cannot absorb later damage or award additional points.

Chasers turn toward the player, use visible obstacle corner waypoints when their direct path is obstructed, and deal contact damage without scoring. Shooters approach a standoff distance, turn toward the player and use range, facing and cooldown checks before firing. Both use the same movement/obstacle rules. This is a small arena steering implementation, not a general pathfinding engine.

## Input and lifecycle

Keyboard keys, mouse buttons and touch pointers feed the same held-action model. Mouse presses over the arena map left/right buttons to port/starboard; release is handled at the window so leaving the canvas cannot stick an attack. Touch capture supports holding an action, and release/cancel/lost-capture clears it. Manual pause, blur and hidden-page events flush the active interval up to the pause event, clear all actions and suspend the simulation. Resume anchors the active clock at the actual resume instant; the first active frame is counted and no paused interval enters the accumulator. An unfinished fraction of a fixed step represents earlier active time and is preserved across pause. Resume requires an explicit player action. Automatic keyboard repeat cannot rearm a key that was cleared during pause.

Every runtime starts paused for a native tutorial dialog. A capture-phase listener consumes the first key or pointer press; the guide fades over 220 ms and resumes gameplay only afterwards. Reduced-motion preferences dismiss immediately. The component removes listeners and its timer on cleanup, including Strict Mode remounts.

Native dialogs provide keyboard focus containment. Menu inputs do not capture game keys. Browser navigation or refresh abandons an in-progress round; only the finish callback persists a result. Match completion is emitted once per runtime.

## Persistence and testability

Options and the last finished result use versioned local storage keys. The outbox stores each completed match under its own v2 key, so concurrent additions cannot overwrite a shared array. Older v1 arrays migrate safely to these keys. Failed writes preserve multiple records, the newest result and confirmation receipts in memory for this session and display a refresh-loss warning with a persistence retry action. Each completed report is queued before submission; abandonment never enters this path. Durable receipts identify confirmed reports across refreshes. If a receipt cannot be saved, same-ID POST recovery remains idempotent on the next visit.

Restored and submitted records pass complete runtime validation in `data/contracts.ts`; TypeScript types alone do not validate JSON. The parser normalizes known fields, rejects malformed gameplay settings and checks score, duration and termination reason. Older snapshots may restore missing cosmetic defaults and infer range from their original speed × lifetime. A legacy Shooter cooldown becomes the effective enemy-weapon cooldown without replacing historical gameplay values with current defaults. Malformed individual confirmed records are isolated, while unreadable storage returns a service error.

## HTTP, cache and recovery

`data/api.ts` uses one Axios instance with a 1200 ms timeout. TanStack Query owns the remote data lifecycle. The REST contract is:

| Method / path | Request | Response |
| --- | --- | --- |
| GET `/api/ranking` | `configKey`, `page`, `pageSize` | `{ items: RankingEntry[], page, pageSize, total }` |
| GET `/api/matches` | `playerId`, `page`, `pageSize` | `{ items: MatchRecord[], page, pageSize, total }` |
| POST `/api/matches` | Completed `MatchResult` | Confirmed `MatchRecord`, 201 on creation or 200 on same-ID recovery |

A record contains match/player IDs, captain name, completion date, score, active duration, termination reason, the configuration snapshot and `configKey`. Ranking adds a continuous one-based rank. Queries validate page metadata, row membership and ranking positions; registration validates the whole returned payload against the submitted result. Reusing an ID with a different payload produces HTTP 409.

`balance-v2:` keys encode canonical JSON of every gameplay setting with sorted object keys; array order remains significant. Cosmetic visuals are preserved in snapshots but excluded from comparisons. Ranking sorts by score descending, completion date ascending and ID ascending. History filters by stable device captain ID and sorts newest first with ID as a deterministic tie-breaker. One confirmed collection supplies both views. Per-ID local storage keys and a browser Web Lock around find-or-create prevent same-ID races between tabs; fixtures are deterministic and use the default balance.

Query keys include resource, every filter, page and page size. GETs consume Axios AbortSignal, and inactive queries are cancelled. Data are stale immediately and refetch on tab re-entry and window focus. Loaded records may remain visible during a background refetch only for that same query. First-load and background errors use distinct messages; bounded automatic retries apply once to transport/5xx errors and never to 4xx errors. No placeholder rows label a previous configuration as current.

The global `useMatchSubmission` hook survives screen changes. A per-ID in-flight map and attempted set prevent duplicate requests from repeated clicks or React Strict Mode. Confirmed submissions persist a receipt, remove the matching outbox entry and explicitly cancel old ranking/history requests before invalidation; invalidation alone can reuse an initial fetch without cached data. This cancellation also handles a query snapshot taken before a concurrently completing POST. Failed reports remain pending, can coexist with new voyages, and are attempted again on manual retry, refresh or scenario recovery. Request version checks prevent a delayed scenario's unconfirmed write from silently committing under a new scenario.

MSW intercepts real network calls through the same `mocks/handlers.ts` in the browser and Node HTTP tests. Development, E2E and production initialize the bundled worker. Bootstrap renders the UI before worker readiness and guards queries until initialization succeeds. A rejected start stops the worker before retry. Native registration has no cancellation API; a ten-second startup timeout offers a documented reload-based retry so late work from an abandoned document cannot race a new attempt. Network scenarios and Reset demo records are accessible from a compact menu disclosure.

The test-mode-only runtime harness observes snapshots and advances the real simulation clock. Input, collision, damage and rendering remain real. Browser tests use real keyboard and touch controls. Production builds omit the harness branch. Visual references use a stable seed and manual clock.

## Responsive layout and limitations

The arena uses logical 1024×640 coordinates. A ResizeObserver adjusts renderer dimensions and stage scale; display density is capped at 2×. Resize and a rearmed resolution media query track density changes. A scalar check in the existing ticker covers browsers/emulation that change DPR without emitting resize/media events, including a paused arena. Only a mismatch triggers a resize, and the simulation coordinates remain unchanged. Disposal removes the observer and both event listeners. Its aspect ratio is maintained. Portrait layouts remain playable, and landscape maximizes usable arena space. Touch controls are separate semantic buttons.

Browser combat tests drive real controls and natural seeded spawns for the mandatory combat rules. Runtime diagnostics cover exposed-resource cleanup, five enter/exit cycles, texture reuse, low FPS, pause boundaries and density changes. The optimized production build also supports an opt-in read-only profiling observer (`?profile=1&seed=1`), dynamically imported before combat. It records active ticker intervals and samples logical entities/display objects once per second; ordinary sessions incur only an undefined optional callback check. It exposes no input or clock mutation methods and is removed on teardown.

The separate real-time profiling script measures three minutes and five replay/exit cycles with forced-GC heap and DOM counters, preserving before/after heap snapshots. Numeric frame arrays are compact in JSON; the complete samples remain available for analysis. See reports/PROFILING.md for observed results and limits, including modest SDK/V8 heap growth. These measurements do not establish GPU VRAM retention or worst-case catch-up cost after a long visible-tab stall. The main bundle still emits a Vite size warning; load-time optimization is separate from combat FPS. README.md records the public deployment and ten anonymous verification cases. Recurring weapon cooldowns live in the typed configuration; the Shooter's initial 0.5s firing delay remains a simulation constant.
