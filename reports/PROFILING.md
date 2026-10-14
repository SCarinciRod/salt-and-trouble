# Combat performance and memory investigation

## Reference environment

Measured October 14, 2026 after approved cleanup with the optimized `pnpm build` output. Node 24.19.0, pnpm 11.25.0, Windows 11 (win32 10.0.26200), Intel Core i7-14700KF (20 cores / 28 logical processors), 16,948,068,352 bytes physical RAM. Installed GPU: NVIDIA GeForce RTX 5070, driver 32.0.16.1714.

Browser: Playwright Chromium 156.0.8078.4, headless, viewport 1365×900, DPR 1. Canvas: 1070×668 physical pixels. **The measured WebGL 2 renderer was ANGLE Vulkan SwiftShader, a software backend. The installed RTX GPU was not the measured rendering device.** No physical-phone or hardware-GPU performance claim follows from this result.

Measured build entry SHA-256: `02748a6e9e0a9517a65ea139582310fe9682972e4f356c9d141210a8d7592670`. The public Git clone with LF-normalized source generated the identical entry and asset names. Raw renderer/driver metadata and frame intervals are in `profiling/latest.json`. The final delivery subsequently changes only the profiling collector and its command: lightweight progress snapshots and a 100,000-interval bound. Gameplay and rendering rules are unchanged. Current release entry SHA-256: `d75fb2431cd3c828992b8bd49f44ddcab0d9358844cab582f27887b3c87625c5`.

## Three-minute workload

Use `pnpm build` then `pnpm run profile`, with other tests/builds stopped. A fresh browser context uses `?profile=1&seed=1&network=success`; Options sets 180s duration and 15s spawn interval. The script holds W, D, Space, Q and E through real keyboard input. Natural enemies, collisions, damage and scoring remain enabled. The read-only observer is dynamically imported into the same optimized build and records active ticker intervals; it cannot advance the clock or change combat.

The first seed-42 fixed-control attempt died at 154.57s and did not satisfy the three-minute gate. Its failed raw evidence remains in `profiling/initial-workload-failure.json`. A pure-simulation exploratory probe selected seed 1 for survival; that probe is not counted as E2E or performance evidence. The successful real-time run ended by time at exactly 180 active seconds, 180.11 wall seconds, 13 HP and score 7.

| Metric | Observed |
| --- | ---: |
| Target | 60 FPS |
| Aggregate active FPS | 57.35 |
| Frame interval p95 | 16.80 ms |
| Peak sampled logical entities (ships + projectiles + effects) | 21 |
| Peak sampled Pixi display objects, including smoke/decorations | 266 |
| Unhandled page errors | 0 |

FPS = recorded frame intervals / their total duration; p95 is the nearest-rank 95th percentile. Every recorded active ticker interval is included, including startup. Logical entities and display objects are sampled once per active second, so sub-second entity peaks may be missed. The 15s spawn interval is a valid low-pressure configuration, not a worst-case load at the 0.5s option limit. Observer overhead is included.

## Five-cycle memory investigation

After the full round, change spawn to the default 3s interval. Each of five cycles starts a fresh voyage, plays eight seconds with the same real inputs, pauses and exits to Main Menu. These cycles allocate both enemy types plus player, projectiles and smoke. Wait 500ms at the menu and force collection with Chrome HeapProfiler before sampling JS heap and DOM counters.

| Menu checkpoint | JS heap after GC (MiB) | DOM nodes | DOM JS listeners | Combat canvases |
| --- | ---: | ---: | ---: | ---: |
| Warm baseline | 7.74 | 326 | 199 | 0 |
| Cycle 1 | 7.89 | 325 | 199 | 0 |
| Cycle 2 | 8.03 | 325 | 199 | 0 |
| Cycle 3 | 8.11 | 325 | 199 | 0 |
| Cycle 4 | 8.18 | 325 | 199 | 0 |
| Cycle 5 | 8.25 | 325 | 199 | 0 |

Heap increased 533,404 bytes (0.51 MiB). This is **not a zero-growth result**. Before/after compressed Chrome heap snapshots are delivered. `pnpm run profile:heaps` produces `heap-comparison.json` and object signatures to investigate the difference without relying on a single heap total.

The largest increases are V8 code/compilation structures: InstructionStream +386,816 bytes, TrustedByteArray +71,708, FeedbackVector +42,132 and Code +28,872. Smaller increases include shader-source strings, five Pixi batcher wrappers, five bind groups and five resource-emitter listener objects. Source inspection identifies Pixi's global batch pool, shared default shader and string-to-program-ID cache as retention mechanisms; this is an inference about SDK/pool retention, not a proof of an eventual plateau. The wrappers' minified constructor names alone are not used as evidence; their property signatures are included in the analysis artifact.

Measured WebGL texture, buffer, vertex-array, program and shader wrapper counts remained one each; HTMLCanvasElement wrappers remained two, including browser/internal caches. Actual combat canvases and the profiling observer were absent at every menu checkpoint. DOM listeners did not accumulate. These results support teardown of the exposed combat UI/resources, while the modest SDK/V8 growth remains an explicitly observed limitation. Longer-run plateau behavior and native/GPU VRAM retention are not established by these five cycles.

## Limits and reproduction

- The measured software renderer misses the 60 FPS target in this run (57.35 FPS aggregate, maximum frame interval 33.5ms). For a visible run in installed Google Chrome, use `pnpm run profile -- --chrome --headed`, keep Chrome focused and verify the actual renderer identity in the new report; do not infer it from the installed GPU.
- No mobile device performance, extreme spawn stress, GPU VRAM measurement or multi-minute visible-tab stall/catch-up benchmark was performed.
- Vite reports a 619.81 kB initial JS chunk (190.36 kB gzip). The size warning remains; combat FPS does not establish network startup speed.
- Heap snapshots include browser and automation infrastructure. Code-cache growth is not automatically an application leak, and stable native wrapper counts do not prove native allocations are zero.
- Re-running replaces `latest.json` and the two snapshots. Preserve any evidence you need before running another scenario.

## Software versus GPU diagnosis

A focused comparison used the same optimized build, viewport, seed, settings and real W/D/Space/Q/E controls for 45 seconds per browser. Both browsers ran without a visible window. Frame buffers were read only at the boundaries; a DevTools CPU sampling profile ran during each interval. The two browsers differ in version and rendering environment, so this is an environment comparison, not a controlled isolation of every cause of the earlier 57.35 FPS result.

| Browser / actual renderer | FPS | Frame p95 | Renderer task time over 45s | JavaScript time |
| --- | ---: | ---: | ---: | ---: |
| Chromium headless shell 156 / SwiftShader software | 59.94 | 16.70ms | 36.80s | 0.93s |
| Google Chrome 155 / RTX 5070, ANGLE Direct3D11 | 119.91 | 8.40ms | 3.09s | 1.74s |

Both runs reported zero unhandled page errors. The GPU run exceeds the 60 FPS target during this interval. Its lower renderer task time is consistent with software/native rendering overhead in the earlier environment; JavaScript game rules did not dominate the short software CPU sample. The default software browser is not representative of normal execution using the installed GPU. A three-minute hardware or visible-window measurement was not completed; the full three-minute and five-cycle evidence above remains the software baseline.

Raw comparison metadata is in `profiling/renderer-comparison.json`. Decompress `chrome.cpuprofile.gz` and `headless-shell.cpuprofile.gz` and load the profiles in Chrome DevTools Performance. The headless-shell bound previously retained 20,000 frames; the final collector allows 100,000 and exports full samples only once, allowing longer high-refresh measurements without repeated growing-array transfers. These instrumentation changes are not claimed as a gameplay speedup.
