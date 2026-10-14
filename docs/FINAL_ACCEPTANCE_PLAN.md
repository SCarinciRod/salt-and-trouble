# Final acceptance and delivery plan

**Goal:** Complete the challenge sections 8–11 against the existing game, then deliver reproducible evidence and a public build.

**Authority:** User request on October 13 authorizes verification and implementation. Existing visual design and game architecture remain approved. Execute inline. The user subsequently authorized creating the public solution repository, commits and safe cleanup on October 13.

**Approach:** Add browser characterization tests using natural seeded spawns, real controls and the existing observer/manual clock. Never inject damage, enemies, positions, score or finish events. Profile the optimized production build without its test harness, in real time. Prepare public hosting and clean-install instructions; external account login depends on the user.

## Tasks

- [x] Map all 12 E2E requirements; fill combat gaps using real inputs and clock-only observation, including separate death/time results.
- [x] Run desktop/mobile combat, complete regression and unchanged visual comparisons. Preserve HTML reports and reference PNGs for source handoff. Git versioning remains pending with the repository handoff below.
- [x] Run a three-minute optimized real-time profile and five cycles; document actual renderer, entity samples, heap/DOM evidence and limitations.
- [x] Archive test HTML and profiling artifacts with reproduction instructions. Verify frozen-lockfile installation/build in a fresh source-only directory.
- [x] Publish the validated build on Vercel and check MSW, refresh, actual completed-report recovery and byte equality through ten anonymous public cases.
- [ ] Hand off/version the source repository after the previously declined Git action is authorized.

## Review focus

- Time result must survive without replacing player health or disabling enemy behavior.
- Combat evidence must use input dispatch, not simulation state writes.
- Scoring and completion must remain single events across extra time/replay.
- Profiling must avoid concurrent test/build loads and disclose browser/renderer limitations.
- Confirmed/pending records and scenario selection must work after public refresh.

## Initial evidence map

| Requirement | Existing evidence | Remaining action |
| --- | --- | --- |
| 8.1 Navigation/options | options.spec.ts | Full regression |
| 8.2 Assets/failure/retry | gameplay.spec.ts, runtime.spec.ts | Full regression |
| 8.3 Movement/turn/bounds/islands | Movement only in E2E; other rules unit-tested | Add real-input E2E |
| 8.4 Fire/damage/cooldown/score | Fire inputs in E2E; other rules unit-tested | Add real-input E2E |
| 8.5 Enemies/spawn | Unit tests | Add natural-spawn E2E |
| 8.6 Death/time/clean restart | Result/replay tested without separate reason assertions | Add separate endings |
| 8.7 Pause/focus/resume | gameplay.spec.ts, runtime.spec.ts | Full regression |
| 8.8 Result/refresh | gameplay.spec.ts, records.spec.ts | Assert exact result |
| 8.9 Abandon/repeat/touch | gameplay.spec.ts, network.spec.ts, runtime.spec.ts | Full regression |
| 8.10 Lists/paging/errors | records.spec.ts, network.spec.ts | Full regression |
| 8.11 Registration/pending | records.spec.ts, network.spec.ts | Full regression |
| 8.12 Timeout/races | records.spec.ts, network.spec.ts | Full regression |
| 8 Visual/report/traces | Six platform-specific core baselines; HTML/retain-on-failure | Deliver report artifacts |
| 9 Performance | Exposed resource lifecycle tests only | Real-time optimized profile |
| 11 Clean checkout/docs | Source, lockfile, assets, mocks present | Fresh install/build, document evidence |
| 11 Public deploy | Local production checks only | Vercel account and public validation |

## Final executable evidence

All twelve E2E behavior groups now have direct browser checks. The full isolated desktop/mobile suite passes 125 cases plus one deliberate desktop touch skip; the corresponding actual mobile touch case passes. The 26 combat cases use natural spawns and real controls. Visual references pass without regeneration. Unit tests: 78 passed; lint, strict types and optimized build pass.

The real-time optimized profile completes 180 active seconds; 59.96 FPS, frame p95 16.70ms, sampled entity peak 21. Five eight-second cycles create both enemy kinds with 3s spawns. Memory interpretation and observed 0.61MiB growth are documented with snapshots, not hidden. The actual measured renderer is SwiftShader software; no physical GPU/native VRAM guarantee is made.

A fresh source-only directory installs the frozen lockfile and builds identical output, without existing node_modules/dist/Git metadata. Local optimized smoke checks pass, including a real-time completed round and pending recovery. Ten anonymous public desktop/mobile checks pass at https://projeto-jog.vercel.app, including byte equality of the entry, worker and main script. HTML reports are archived in reports/tests.

The remaining delivery action is handing off the source repository/history. Git writes were previously declined and have not been performed. Public deployment and source repository publication are separate requirements; the former is complete.
