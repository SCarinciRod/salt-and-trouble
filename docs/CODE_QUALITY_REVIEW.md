# Clean code and dead code review

Reviewed October 13, 2026 against the delivered game, challenge requirements and actual import/call/style consumers. This review does not equate required test/network infrastructure with dead code.

## Findings

| Priority | Finding | Evidence | Safe direction |
| --- | --- | --- | --- |
| P2 footprint | Full upstream asset pack copied into public output | 505 files / 15,968,971 bytes; only 22 files / 685,083 bytes referenced by menu and complete texture manifest | Keep the 22 used files, including all damage variants and dynamically selected island tiles. Preserve originals in ignored local storage/upstream provenance. Rebuild/redeploy and run asset/visual checks. |
| P3 | Unused `isMatchResult` wrapper | `src/storage/results.ts`; repo search finds its declaration only; JSON parsing uses `parseMatchResult` directly | Remove the wrapper, retain the actual runtime parser. |
| P3 | Unused `ProfileSnapshot` type alias | `src/profiling/observer.ts`; no consumer anywhere in source/tests/scripts | Remove the alias; retain the read-only observer and global contract. |
| P3 | Orphan `.harbor-notice` CSS | `src/styles.css`; no component creates the class | Remove the rule. |
| P3 readability | Compressed source CSS | `src/styles.css`: about 19k characters across 20 lines, some approaching 3900 characters | Format while preserving selector/declaration order and cascade. Verify existing visual references. |
| P3 ownership | `.storage-warning` styles span two files | Base styles in styles.css plus tutorial.css | Consolidate into shared styles only if the existing cascade remains identical. Avoid changing appearance as part of cleanup. |
| P3 tooling | Heap signatures refer to minified constructor names | `scripts/analyze-heaps.mjs` observes `e`, `a`, `Y` for the saved build | Keep existing evidence valid; structural property matching is more robust for later builds. |

The 483 unused assets occupy 15,283,888 bytes (approximately 14.58 MiB). This is disk/upload/output weight, not 15MB of extra runtime downloads: the browser requests only referenced assets. Retaining all supplied files was convenient during development, but it is not required for this implementation.

## Confirmed strengths and necessary infrastructure

- No orphan production module was identified through import tracing; TypeScript noUnusedLocals/noUnusedParameters and ESLint pass.
- Every declared dependency has an application or verification consumer. PixiJS, React, Axios, TanStack Query and MSW are mandated by the challenge.
- Simulation, rendering, input and UI ownership are separate; removing their boundaries to reduce line count would harm readability and requirements compliance.
- Network scenarios, shared contracts/fixtures, durable outbox/receipts and retries are live features required by the challenge.
- The manual-clock observer is excluded from production. The optional production profiler is read-only and needed to reproduce evidence.
- Test utilities, regression baselines and delivered reports belong in the source submission; they do not become shipped application modules merely because they are in the repository.
- `registration-saved` is dynamically generated and used; broad text searches alone can misclassify it as unused.
- Health-state ship textures and the nine interpolated tile URLs are used even though not every URL appears as a complete source literal.

## Scope and verdict

The main code issue is readability of compressed styling, not an accumulation of abandoned game systems. Safe cleanup is small; asset selection is the meaningful reduction in output size. No speculative framework replacement, package upgrade, broad rules rewrite or removal of required failure handling is justified before submission.

Recommended verification after cleanup: lint, strict types, unit suite, full isolated Chromium/visual suite, optimized build, public byte-equality/recovery checks after redeploy. Existing performance evidence describes its recorded build hash; retain it as historical if a changed build needs a fresh profile.

## Approved cleanup applied

The user approved cleanup before commits. Public assets now contain the 22 referenced files (685,083 bytes). The 483 originals were moved to ignored `Temp/unused-original-assets/` with both source/destination roots checked inside the workspace. The initial optimized output shrank from 534 files / 17,593,779 bytes to 51 files / 2,309,747 bytes (about 86.9% less). All health variants and interpolated island textures remain.

Removed the unused wrapper, type alias and orphan style. Added a reproducible Prettier formatter and formatted source/tests/scripts/configuration. The shared storage-warning rules now live together in styles.css, preserving the effective values observed in the previous compiled cascade. Heap analysis identifies Batcher/BindGroup/emitter-listener property shapes rather than fixed minified names.

No gameplay, balance, contracts, retries or required instrumentation were removed. Post-cleanup unit, lint and build checks pass; final browser/public/profile checks are recorded in docs/PROGRESS.md. Cold starts with four browser workers stalled before modules/assets became ready. The issue also reproduced against an experimental static build, so cache contention is not established as the cause. The final suite uses one worker, an isolated test cache and forced cold optimization; it retains the development build and React Strict Mode. Experimental dependency/build/probe changes were reverted.
