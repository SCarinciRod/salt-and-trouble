import { Application } from 'pixi.js';
import type { GameConfig } from '../config';
import type { Action, HudSnapshot } from '../types';
import { Simulation } from '../simulation/world';
import { createControls } from '../input/controls';
import { BattleScene, loadTextures } from './scene';

export interface RuntimeHandle {
  world: Simulation;
  advance: (seconds: number) => void;
  pause: () => void;
  resume: () => void;
  setTouch: (action: Action, pressed: boolean) => void;
  destroy: () => void;
}

interface RuntimeCallbacks {
  onProgress: (progress: number) => void;
  onHud: (snapshot: HudSnapshot) => void;
  onFinish: (world: Simulation) => void;
  signal: AbortSignal;
}

export async function createRuntime(
  host: HTMLElement,
  config: GameConfig,
  callbacks: RuntimeCallbacks,
): Promise<RuntimeHandle | null> {
  const { signal } = callbacks;
  await loadTextures((progress) => {
    if (!signal.aborted) callbacks.onProgress(progress);
  });
  if (signal.aborted) return null;
  const app = new Application();
  let initialized = false;
  let disposed = false;
  let scene: BattleScene | undefined;
  let controls: ReturnType<typeof createControls> | undefined;
  let observer: ResizeObserver | undefined;
  let densityQuery: MediaQueryList | undefined;
  let removeHarness: (() => void) | undefined;
  let profile: ReturnType<(typeof import('../../profiling/observer'))['attachProfile']> | undefined;
  const resolution = () => Math.min(window.devicePixelRatio || 1, 2);

  function destroy() {
    if (disposed) return;
    disposed = true;
    signal.removeEventListener('abort', destroy);
    window.removeEventListener('resize', resize);
    densityQuery?.removeEventListener('change', densityChanged);
    controls?.destroy();
    observer?.disconnect();
    removeHarness?.();
    profile?.destroy();
    scene?.destroy();
    app.ticker?.stop();
    if (initialized)
      app.destroy({ removeView: true }, { children: true, texture: false, textureSource: false });
    else {
      // Application.destroy assumes all plugins initialized. Release only the
      // resources actually exposed if initialization failed before that point.
      app.ticker?.destroy();
      app.stage?.destroy({ children: true, texture: false, textureSource: false });
      app.renderer?.destroy({ removeView: true });
    }
  }

  function resize() {
    if (disposed || !scene) return;
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    app.renderer.resize(width, height, resolution());
    app.stage.scale.set(width / config.arena.width, height / config.arena.height);
    scene.render();
  }

  function watchDensity() {
    densityQuery?.removeEventListener('change', densityChanged);
    densityQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    densityQuery.addEventListener('change', densityChanged);
  }
  function densityChanged() {
    if (disposed) return;
    resize();
    watchDensity();
  }

  try {
    await app.init({
      width: config.arena.width,
      height: config.arena.height,
      background: 0x14788b,
      antialias: true,
      autoDensity: true,
      resolution: resolution(),
      autoStart: false,
      preference: 'webgl',
    });
    initialized = true;
    app.ticker.remove(app.render, app);
    if (signal.aborted) {
      destroy();
      return null;
    }
    signal.addEventListener('abort', destroy, { once: true });
    app.canvas.setAttribute('aria-label', 'Naval battle arena');
    app.canvas.setAttribute('role', 'img');
    host.appendChild(app.canvas);
    const testMode = import.meta.env.MODE === 'test';
    const params = new URLSearchParams(location.search);
    const requestedSeed = Number(params.get('seed') ?? 42);
    const profiling = params.get('profile') === '1';
    const seed =
      testMode || profiling ? requestedSeed : crypto.getRandomValues(new Uint32Array(1))[0]!;
    const world = new Simulation(config, seed);
    world.pause();
    const battleScene = (scene = new BattleScene(app, world));
    let ended = false;
    let accumulator = 0;
    let lastActiveTime: number | undefined;
    const manual = testMode && params.get('testClock') === 'manual';
    let lastHud = '';

    function publish() {
      if (disposed) return;
      const hud = {
        hp: world.player.hp,
        maxHp: world.player.maxHp,
        score: world.score,
        remaining: Math.max(0, Math.ceil(config.sessionSeconds - world.elapsed)),
        status: world.status,
      };
      const signature = JSON.stringify(hud);
      if (signature !== lastHud) {
        lastHud = signature;
        callbacks.onHud(hud);
      }
      if (world.status === 'finished' && !ended) {
        ended = true;
        input.clear();
        callbacks.onFinish(world);
      }
    }

    const input = (controls = createControls(
      () => !disposed && world.status === 'running',
      () => handle.pause(),
      host,
    ));
    const handle: RuntimeHandle = {
      world,
      advance(seconds) {
        if (disposed || world.status !== 'running' || !Number.isFinite(seconds) || seconds <= 0)
          return;
        accumulator += seconds;
        while (accumulator >= 1 / 60 - 1e-9 && world.status === 'running') {
          world.step(1 / 60, input.read());
          accumulator -= 1 / 60;
        }
        battleScene.render();
        publish();
      },
      pause() {
        if (disposed || world.status !== 'running') return;
        advanceActiveTo(performance.now());
        input.clear();
        lastActiveTime = undefined;
        world.pause();
        publish();
      },
      resume() {
        if (disposed || world.status !== 'paused') return;
        input.clear();
        lastActiveTime = performance.now();
        world.resume();
        publish();
      },
      setTouch: input.setTouch,
      destroy,
    };
    observer = new ResizeObserver(resize);
    window.addEventListener('resize', resize);
    watchDensity();
    observer.observe(host);
    resize();
    if (testMode) {
      const { attachHarness } = await import('../../testing/harness');
      if (signal.aborted) {
        handle.destroy();
        return null;
      }
      removeHarness = attachHarness(handle);
    }
    if (profiling) {
      const { attachProfile } = await import('../../profiling/observer');
      if (signal.aborted) {
        handle.destroy();
        return null;
      }
      profile = attachProfile(app, world, seed);
    }
    function advanceActiveTo(time: number) {
      if (
        manual ||
        disposed ||
        world.status !== 'running' ||
        lastActiveTime === undefined ||
        time <= lastActiveTime
      )
        return;
      const seconds = (time - lastActiveTime) / 1000;
      lastActiveTime = time;
      handle.advance(seconds);
    }
    app.ticker.add((ticker) => {
      if (disposed) return;
      // Some browsers/emulation modes change DPR without resize/media events.
      // This scalar check also covers that case, including a paused arena.
      if (app.renderer.resolution !== resolution()) {
        resize();
        watchDensity();
      }
      // Pixi updates lastTime after emitting listeners. Its raw elapsedMS gives
      // this frame's timestamp without the minFPS clamp applied to deltaMS.
      profile?.record(ticker.lastTime + ticker.elapsedMS);
      advanceActiveTo(ticker.lastTime + ticker.elapsedMS);
    });
    battleScene.render();
    publish();
    app.ticker.start();
    return handle;
  } catch (error) {
    destroy();
    throw error;
  }
}
