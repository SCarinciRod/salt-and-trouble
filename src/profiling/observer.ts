import type { Application, Container, WebGLRenderer } from 'pixi.js';
import type { Simulation } from '../game/simulation/world';

function countViews(root: Container): number {
  return 1 + root.children.reduce((total, child) => total + countViews(child), 0);
}

function entityCounts(world: Simulation) {
  return {
    ships: 1 + world.enemies.length,
    projectiles: world.projectiles.length,
    effects: world.effects.length,
  };
}

export function attachProfile(app: Application, world: Simulation, seed: number) {
  const frameIntervals: number[] = [];
  const samples: {
    elapsed: number;
    ships: number;
    projectiles: number;
    effects: number;
    displayObjects: number;
  }[] = [];
  let previous: number | undefined;
  let sampleAt = 0;
  const gl = (app.renderer as WebGLRenderer).gl;
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = {
    vendor: String(gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR)),
    device: String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER)),
    version: String(gl.getParameter(gl.VERSION)),
    canvasWidth: app.canvas.width,
    canvasHeight: app.canvas.height,
    resolution: app.renderer.resolution,
  };
  const profile = {
    snapshot: (includeFrameData = true) => ({
      seed,
      config: structuredClone(world.config),
      renderer: { ...renderer },
      elapsed: world.elapsed,
      status: world.status,
      reason: world.reason,
      hp: world.player.hp,
      score: world.score,
      entities: entityCounts(world),
      frameIntervals: includeFrameData ? [...frameIntervals] : [],
      samples: includeFrameData ? samples.map((sample) => ({ ...sample })) : [],
    }),
  };
  window.__gameProfile = profile;
  return {
    record(time: number) {
      if (world.status !== 'running') {
        previous = undefined;
        return;
      }
      if (previous !== undefined && frameIntervals.length < 100_000)
        frameIntervals.push(time - previous);
      previous = time;
      if (world.elapsed >= sampleAt) {
        samples.push({
          elapsed: world.elapsed,
          ...entityCounts(world),
          displayObjects: countViews(app.stage),
        });
        sampleAt = world.elapsed + 1;
      }
    },
    destroy() {
      if (window.__gameProfile === profile) delete window.__gameProfile;
    },
  };
}
