# Salt & Trouble Implementation Plan

> For agentic workers: implement inline with superpowers:executing-plans, following the user-approved DELIVERY_PLAN.md. Track fresh evidence in docs/PROGRESS.md.

**Goal:** Deliver Pirate Battle with an openly comic nautical identity and teach React through its real interface.

**Architecture:** React owns screens and forms; a TypeScript runtime owns continuous simulation; Pixi owns sprites. Query and Axios consume persistent MSW APIs. Test actual controls against seeded simulation.

**Tech stack:** Vite, React, strict TypeScript, PixiJS, TanStack Query, Axios, MSW, Playwright, Vitest and ESLint.

**Spec:** DELIVERY_PLAN.md, user approval on October 12, and the challenge README at source revision 315891441be81ca0bff75cf3c2b0cd2f27f119cd.

## Global constraints

- English product text, code identifiers and solution documentation.
- Final development deadline: October 14 at 02:00 America/Sao_Paulo; submission at 16:00.
- Comic adventure, deep blue water, parchment and bright coral; supplied assets are the visual foundation.
- Keep React Strict Mode enabled and simulation outside per-frame React state.
- All mandatory challenge technologies must participate in the finished solution.
- No abandoned match submission. Durable, idempotent submission for finished matches.

## Review focus

1. Corrupt or unavailable local storage must not break startup.
2. Async renderer initialization finishing after unmount must release its resources.
3. Held keyboard or touch actions must clear on pause, blur and pointer cancellation.
4. A server write followed by a lost response must recover without duplication.
5. Rapid screen changes must not leave duplicate listeners, tickers or canvases.

## Task 1: working menu and settings

Create `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/game/config.ts`, `src/storage/settings.ts`, `src/ui/MainMenu.tsx`, `src/ui/OptionsForm.tsx`, tooling and README.

Interfaces: `PlayerOptions { sessionSeconds: number; spawnSeconds: number }`; `validateOptions(options): Partial<Record<keyof PlayerOptions, string>>`; `loadOptions(): PlayerOptions`; `saveOptions(options): boolean`.

- [ ] Install compatible dependencies and configure development, build, lint, typecheck, unit and browser test commands.
- [ ] Write settings tests: accept 60/180 seconds; reject 59/181 and nonfinite values; accept spawn interval 0.5-15 seconds; reject zero; restore valid persisted settings and fall back on malformed storage. Run to see missing behavior fail.
- [ ] Implement validation and defensive persistence; rerun tests.
- [ ] Write browser tests using Options, Save and refresh; prove settings persist and invalid values cannot be saved. Run against a blank app to observe missing UI behavior.
- [ ] Implement comic menu, controlled form, accessible focus and responsive layout. Run browser tests, lint, typecheck and build.
- [ ] Record evidence and commit the verified slice.

## Task 2: complete game loop

Create `src/game/types.ts`, `src/game/simulation/`, `src/game/input/`, `src/game/rendering/`, `src/ui/GameScreen.tsx`, `src/ui/GameCanvas.tsx`, `src/ui/ResultScreen.tsx`, and `tests/gameplay.spec.ts`.

Interfaces: `GameRuntime(config, callbacks)` owns `start`, `pause`, `resume`, `destroy`; `Simulation.step(seconds, actions)` returns events; `HudSnapshot` contains health, score, remaining time and status. Capture configuration at match creation.

- [ ] Write failing tests for deterministic movement, collision, all weapons, both enemies, spawn safety, lifecycle, score and clock invariants; implement incrementally.
- [ ] Write browser controls tests and add renderer with asset progress, retry and asynchronous cleanup protection.
- [ ] Connect semantic HUD, responsive arena, pause/focus behavior, result persistence, clean restart and touch controls.
- [ ] Run the round lifecycle in desktop/mobile Chromium; inspect console errors and repeat navigation.

## Task 3: consistent remote data

Create `src/data/contracts.ts`, `src/data/api.ts`, `src/data/queries.ts`, `src/mocks/`, `src/storage/outbox.ts`, `src/ui/RecordsPanel.tsx`, `src/ui/NetworkLab.tsx`, and `tests/network.spec.ts`.

Interfaces: `MatchRecord` includes identity, player, completion date, score, played seconds, reason and configuration. HTTP API: paginated GET `/api/ranking`, GET `/api/matches`, and idempotent POST `/api/matches`.

- [ ] Write failing contract/recovery tests; implement stable identities, persistent confirmed storage and durable multiple-item outbox.
- [ ] Implement Axios cancellation and Query keys, mutation, retries and invalidation.
- [ ] Add seeded scenarios, selection/reset and English loading, empty, error and retry UI.
- [ ] Test delayed responses, timeout after commit, refresh recovery, repeated submission and another match during an outstanding submission.

## Task 4: delivery evidence

Create `tests/visual.spec.ts`, versioned baseline images, profiling tooling and English `ARCHITECTURE.md`. Complete README and asset provenance.

- [ ] Complete all twelve challenge E2E groups and visual snapshots, with isolated test state.
- [ ] Measure optimized gameplay over three minutes and resources across five lifecycle cycles.
- [ ] Run clean-checkout setup, lint, typecheck, unit, browser and build checks. Record actual outcomes and limitations.
- [ ] Obtain a fresh final review, correct material findings with reproducing tests, and package evidence.
- [ ] Prepare and verify a matching public deployment within authorized delivery scope.
