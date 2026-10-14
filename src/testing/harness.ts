import type { RuntimeHandle } from '../game/rendering/runtime';

export function attachHarness(runtime: RuntimeHandle) {
  const harness = {
    advance: (seconds: number) => runtime.advance(seconds),
    snapshot: () => runtime.world.snapshot(),
  };
  window.__gameTest = harness;
  return () => {
    if (window.__gameTest === harness) delete window.__gameTest;
  };
}
