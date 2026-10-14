# Pirate Battle delivery and learning plan

Prepared on October 12, 2026. All working times are America/Sao_Paulo.

## Goal and constraints

Deliver an understandable, playable submission for the [Jungle challenge](https://github.com/junglegaming/game-developer-challenge), while learning React through the actual interface. The challenge README is the authoritative acceptance contract; this document proposes our execution strategy.

The workspace was empty when inspected. No implementation or executable verification has been performed. Node and Git were discoverable; package-manager availability still needs verification during setup.

Available sessions:

- Monday October 12: approximately 19:30 to Tuesday 02:00.
- Tuesday October 13: 16:00 to Wednesday 02:00.
- Wednesday October 14: submit by 16:00, with no development session available.

This provides roughly 16.5 working-window hours, before breaks. Treat Wednesday 02:00 as the internal completion deadline. Full compliance is an ambitious target within this window, not a guaranteed outcome. Reserve the last three hours for validation and corrections. Do not compensate for delays by silently omitting mandatory technologies or requirements.

The evaluator also asks for a time estimate before implementation. The user should communicate the Wednesday 16:00 target and the planned development window before starting.

## Recommended approach

Use Vite, React, strict TypeScript, direct PixiJS integration, CSS, TanStack Query, Axios, MSW, and Playwright. Confirm compatible versions once, commit the lockfile, and avoid dependency upgrades during the challenge.

Choose one readable arena and a small component hierarchy. Build the complete user journey before decorative polish. Avoid introducing an additional state library, a custom backend, or an elaborate engine framework.

Alternatives considered:

- A Pixi-to-React binding adds another integration layer to learn under the deadline. Prefer a small direct adapter so lifecycle responsibilities remain visible.
- A large entity-component framework could support future growth, but focused TypeScript systems are easier to explain and debug for this submission.

## Proposed ownership and architecture

| Area | Owns | Suggested location |
| --- | --- | --- |
| React UI | Navigation, forms, dialogs and low-frequency summaries | `src/ui/` |
| Simulation | Entities, game clock and rule execution | `src/game/simulation/` |
| Input | Held actions shared by keyboard and touch | `src/game/input/` |
| Pixi renderer | Sprite creation, updates and disposal | `src/game/rendering/` |
| Remote data | HTTP contracts and Query hooks | `src/data/` |
| Mock server | Fixtures, scenarios and persistent records | `src/mocks/` |
| Local storage | Versioned settings, last result and pending submissions | `src/storage/` |
| Verification | Browser scenarios and visual references | `tests/` |

Keep continuous entity positions outside React state. `GameCanvas` should create the runtime through an Effect and dispose it through cleanup. Guard asynchronous initialization against unmounting; a late initialization must also be disposed. Keep Strict Mode enabled. The [React Effect guide](https://react.dev/learn/synchronizing-with-effects) explains this lifecycle, and the [Pixi Application guide](https://pixijs.com/8.x/guides/components/application) explains renderer initialization.

Use a fixed simulation step, initially 1/60 second, with a bounded accumulator. Reset accumulated elapsed time and held actions when pausing or resuming. Render independently and publish HUD summaries only when relevant values change or at a modest rate. A single match clock should drive timers instead of unrelated wall-clock intervals.

Suggested interface: `MainMenu`, `OptionsForm`, `GameScreen`, `GameCanvas`, `Hud`, `TouchControls`, `PauseDialog`, `ResultScreen`, and reusable paginated data panels. Begin with local state and props; introduce a reducer only where transitions become difficult to express clearly.

## Monday session: one complete playable journey

| Window | Work and evidence | Learning activity |
| --- | --- | --- |
| 19:30-20:15 | Establish repository, tooling, required dependencies, basic scripts, MSW bootstrap and an initial public build. Confirm assets can be served. | Read the entry point and explain how a component becomes visible. |
| 20:15-21:00 | Create menu and settings form; define typed configuration and navigation. | User edits JSX, props, controlled inputs, validation and local state. |
| 21:00-21:45 | Mount Pixi safely; load the initial arena and player; add loading/retry UI. Introduce deterministic browser-test seams. | Explain `useRef`, `useEffect` and cleanup using the actual canvas. |
| 21:45-00:15 | Implement movement, geometry, weapons and enemy systems in small increments. Add an observable check after each system. | Follow one input from a key press to a changed position and sprite. |
| 00:15-01:15 | Connect lifecycle transitions, HUD, result flow and touch actions. Exercise a complete round. | User builds the result component and traces callbacks back to the parent. |
| 01:15-02:00 | Run focused smoke tests, verify public build, record defects and commit a known working milestone. | User explains state ownership without reading the implementation. |

The fixed gate for the end of this session is a complete round that can start, play, finish and restart. A collection of disconnected screens does not satisfy this milestone. If this gate is missed, Tuesday must first repair the gameplay foundation; record the resulting delivery risk immediately.

## Tuesday session: data, verification and packaging

| Window | Work and evidence | Learning activity |
| --- | --- | --- |
| 16:00-16:30 | Replay the Monday build and prioritize concrete defects. | User describes the data flow in their own words. |
| 16:30-19:00 | Complete typed HTTP integration, mock persistence, pagination and durable submission recovery. | Implement a Query-driven panel, then explain query keys, mutations and invalidation. |
| 19:00-20:00 | Add reproducible network controls and exercise recovery, including ambiguous submission outcomes. | Diagnose loading, empty and error states in the UI. |
| 20:00-21:00 | Finish responsive behavior, accessibility and visual feedback; resolve remaining functional gaps. | Practice semantic HTML, labels, focus and conditional rendering. |
| 21:00-23:00 | Complete browser and visual coverage, then measure the optimized build. | Read a failing assertion and use its trace to locate the defect. |
| 23:00-01:00 | Freeze features. Fix failures, finish English documentation and rerun affected checks. | User explains one implementation decision and its tradeoff. |
| 01:00-02:00 | Reproduce setup from a clean checkout, deploy the final revision and verify its public URL. Package reports and submission details. | Rehearse a short demonstration without relying on the development server. |

These are target windows. Track actual completion after each block; stop adding decorative work whenever a gate is late. Do not defer all tests until 21:00: that block completes coverage started alongside implementation.

## High-risk design decisions to resolve early

Choose a stable player identity and create the match identifier before submission. Persist an outbox entry before the HTTP request. Make the mock server atomically find-or-create by match ID; a retry after a lost response must return the existing record. Derive both data views from the same confirmed collection. Support several pending matches, not only the latest one.

Generate a canonical key from the complete relevant balance configuration for ranking groups. A proposed tie order is score descending, completion date ascending, then match ID ascending. Include filters and pagination in query keys. Pass cancellation signals through Axios and invalidate related queries after confirmation. See [TanStack Query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation).

Start MSW before rendering consumers in the published build as well as development. Use a seeded scenario controller with documented selection and reset. Preserve the distinction between a request that never reached storage and a request that was stored but whose response was lost.

For geometry, begin with explicit circle/rectangle hitboxes and review them against the visible sprites. Choose projectile speed and collision handling together so fast projectiles cannot skip thin obstacles. Use swept checks when necessary. Route both input devices to the same held-action model and handle pointer cancellation.

For mobile, propose landscape support with letterboxing and usable controls; document the orientation choice. Keep simulation coordinates independent from display pixels. Test a resize during a round.

## Verification strategy

Maintain a traceability checklist against every numbered E2E item and delivery section in the challenge README. Map each item to a test, a manual observation, or a pending gap; do not claim coverage from a screenshot alone.

Add a development/test-only observable runtime snapshot and seeded clock control. Browser combat tests must use actual controls and observe actual rule execution. Do not make test helpers manufacture success. The [Playwright clock guide](https://playwright.dev/docs/clock) can support browser timing, but the simulation also needs a deliberate deterministic clock boundary.

At each milestone run relevant checks. Proposed scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test:e2e`, and `test:e2e:report`. Final validation should include all of them that apply, the full Chromium desktop/mobile suite, reviewed visual baselines, and the public deployment smoke journey.

Collect profiling in the production build with a repeatable workload. Report the actual device, browser, viewport, entity counts, frame distribution and lifecycle resource observations. Never present an unmeasured target as a measured result.

## Learning method

For each block: a short explanation, one user-authored change, browser observation, and a teach-back question. Allow roughly 10-15 minutes of learning inside each block, not a separate course before implementation.

The assistant can focus on geometry, rendering lifecycle and test infrastructure while the user owns visible React exercises. Review every generated change together. If JavaScript basics need attention, insert a short functions/arrays/objects exercise using the same match data and remove optional polish to keep the schedule.

Suggested reading: [Thinking in React](https://react.dev/learn/thinking-in-react). At delivery the user should explain props versus state, controlled forms, lifting state, Effect cleanup, refs, and local state versus query cache.

## Submission gate

By Wednesday 02:00, prepare the exact repository revision, matching public URL, lockfile, documented commands, assets and licenses, English README and architecture notes, test outputs, visual baselines, profiling evidence, and an honest list of limitations. Verify reload and a full round on the public URL, including data recovery.

Wednesday 16:00 is the submission deadline only. No final fixes are budgeted then. Additional sound design, extra maps and decorative animation are optional; mandatory acceptance items remain mandatory even when time is tight.
