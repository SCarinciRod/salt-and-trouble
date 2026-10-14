import { test, expect, type Page } from '@playwright/test';
import type { Application } from 'pixi.js';
import type { Simulation } from '../src/game/simulation/world';

interface CapturedScene {
  app: Application;
  world: Simulation;
}
declare global {
  interface Window {
    __runtimeAudit: { scenes: CapturedScene[]; failedApp?: Application };
  }
}

async function captureScenes(page: Page, failFirstRender = false) {
  await page.evaluate(async (fail) => {
    const moduleUrl = '/src/game/rendering/scene.ts';
    const { BattleScene } = (await import(
      moduleUrl
    )) as typeof import('../src/game/rendering/scene');
    const render = BattleScene.prototype.render;
    let shouldFail = fail;
    window.__runtimeAudit = { scenes: [] };
    BattleScene.prototype.render = function () {
      const scene = this as unknown as CapturedScene;
      if (!window.__runtimeAudit.scenes.includes(scene)) window.__runtimeAudit.scenes.push(scene);
      if (shouldFail) {
        shouldFail = false;
        throw new Error('Injected renderer failure');
      }
      return render.call(this);
    };
  }, failFirstRender);
}

async function sail(page: Page) {
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Set sail', exact: true }).click();
  await expect(page.getByLabel('Match status')).toHaveText('Running');
}

test('cleans up a failed first render before retrying and leaving the arena', async ({ page }) => {
  await page.goto('/?testClock=manual&seed=42');
  await captureScenes(page, true);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('could not load');
  await expect(page.getByLabel('Naval battle arena')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry loading' }).click();
  await page.getByRole('button', { name: 'Set sail', exact: true }).click();
  await expect(page.getByLabel('Match status')).toHaveText('Running');
  await expect(page.getByLabel('Naval battle arena')).toHaveCount(1);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
  expect(
    await page.evaluate(() =>
      window.__runtimeAudit.scenes.every(({ app }) => !app.stage && !app.renderer),
    ),
  ).toBe(true);
});

for (const fps of [60, 5, 2]) {
  test(`preserves one active second and movement at ${fps} FPS`, async ({ page }) => {
    await page.goto('/?seed=42');
    await captureScenes(page);
    await sail(page);
    await page.keyboard.down('w');
    const observed = await page.evaluate((fps) => {
      const { app, world } = window.__runtimeAudit.scenes.at(-1)!;
      app.ticker.stop();
      const start = performance.now();
      app.ticker.update(start);
      const before = world.snapshot();
      for (let frame = 1; frame <= fps; frame++) app.ticker.update(start + (frame * 1000) / fps);
      return { elapsed: world.elapsed - before.elapsed, moved: world.player.x - before.player.x };
    }, fps);
    expect(observed.elapsed).toBeCloseTo(1, 6);
    expect(observed.moved).toBeCloseTo(180, 4);
    await page.keyboard.up('w');
  });
}

test('updates pixel density during resize without changing simulation coordinates', async ({
  page,
  context,
}) => {
  await page.goto('/?testClock=manual&seed=42');
  await captureScenes(page);
  await sail(page);
  const before = await page.evaluate(() => window.__gameTest!.snapshot());
  const cdp = await context.newCDPSession(page);
  const initial = await page.evaluate(() => devicePixelRatio);
  const next = initial === 1 ? 2 : 1;
  for (const density of [next, next === 1 ? 2 : 1, 3]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1100,
      height: 700,
      deviceScaleFactor: density,
      mobile: !!test.info().project.use.isMobile,
    });
    await expect
      .poll(() => page.evaluate(() => window.__runtimeAudit.scenes.at(-1)!.app.renderer.resolution))
      .toBe(Math.min(density, 2));
  }
  expect(await page.evaluate(() => window.__gameTest!.snapshot())).toEqual(before);
  const pixels = await page.evaluate(() => {
    const { app } = window.__runtimeAudit.scenes.at(-1)!;
    return { physicalWidth: app.canvas.width, logicalWidth: app.screen.width };
  });
  expect(pixels.physicalWidth).toBeCloseTo(pixels.logicalWidth * 2, 0);
});

for (const initialized of [false, true]) {
  test(`cleans up when Application.init rejects ${initialized ? 'after' : 'before'} renderer allocation`, async ({
    page,
  }) => {
    await page.goto('/?testClock=manual&seed=42');
    await captureScenes(page);
    await page.evaluate(async (initialized) => {
      const moduleUrl = '/tests/runtimeProbe.ts';
      const { Application } = (await import(moduleUrl)) as typeof import('./runtimeProbe');
      const init = Application.prototype.init;
      let failOnce = true;
      Application.prototype.init = async function (options) {
        if (failOnce) {
          failOnce = false;
          window.__runtimeAudit.failedApp = this;
          if (initialized) await init.call(this, options);
          throw new Error('Injected Application.init rejection');
        }
        return init.call(this, options);
      };
    }, initialized);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('could not load');
    expect(await page.evaluate(() => window.__runtimeAudit.failedApp!.stage.destroyed)).toBe(true);
    await page.getByRole('button', { name: 'Retry loading' }).click();
    await page.getByRole('button', { name: 'Set sail', exact: true }).click();
    await expect(page.getByLabel('Match status')).toHaveText('Running');
    await expect(page.getByLabel('Naval battle arena')).toHaveCount(1);
  });
}

test('reuses textures and releases scene resources across five voyages', async ({ page }) => {
  let waterRequests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/assets/png/default/tiles/tile_73.png')) waterRequests++;
  });
  await page.goto('/?testClock=manual&seed=42');
  await captureScenes(page);
  for (let voyage = 0; voyage < 5; voyage++) {
    await sail(page);
    await page.evaluate(() => window.__gameTest!.advance(0.5));
    await expect(page.getByLabel('Naval battle arena')).toHaveCount(1);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
    await expect(page.getByLabel('Naval battle arena')).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        window.__runtimeAudit.scenes.every(({ app }) => !app.stage && !app.renderer),
      ),
    ).toBe(true);
  }
  expect(waterRequests).toBe(1);
  const textureAlive = await page.evaluate(async () => {
    const moduleUrl = '/tests/runtimeProbe.ts';
    const { Assets } = (await import(moduleUrl)) as typeof import('./runtimeProbe');
    const texture = Assets.get<import('pixi.js').Texture>('/assets/png/default/tiles/tile_73.png');
    return !texture.destroyed && !texture.source.destroyed;
  });
  expect(textureAlive).toBe(true);
});

test('publishes changed HUD values instead of one UI update per simulation frame', async ({
  page,
}) => {
  await page.goto('/?testClock=manual&seed=42');
  const observed = await page.evaluate(async () => {
    const runtimeUrl = '/src/game/rendering/runtime.ts';
    const configUrl = '/src/game/config.ts';
    const { createRuntime } = (await import(
      runtimeUrl
    )) as typeof import('../src/game/rendering/runtime');
    const { makeGameConfig } = (await import(configUrl)) as typeof import('../src/game/config');
    const host = document.createElement('div');
    host.style.cssText = 'width:640px;height:400px';
    document.body.append(host);
    const updates: import('../src/game/types').HudSnapshot[] = [];
    const runtime = await createRuntime(
      host,
      makeGameConfig({ sessionSeconds: 120, spawnSeconds: 3 }),
      {
        onProgress: () => {},
        onHud: (hud) => updates.push(hud),
        onFinish: () => {},
        signal: new AbortController().signal,
      },
    );
    try {
      runtime!.resume();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      const before = updates.length;
      for (let frame = 0; frame < 60; frame++) runtime!.advance(1 / 60);
      return {
        updates: updates.length - before,
        x: runtime!.world.player.x,
        elapsed: runtime!.world.elapsed,
      };
    } finally {
      runtime?.destroy();
      host.remove();
    }
  });
  expect(observed.elapsed).toBeCloseTo(1, 6);
  expect(observed.x).toBeCloseTo(300, 4);
  expect(observed.updates).toBeGreaterThanOrEqual(1);
  expect(observed.updates).toBeLessThanOrEqual(2);
});

test('counts the first active interval after resume and excludes time spent paused', async ({
  page,
}) => {
  await page.goto('/?seed=42');
  await captureScenes(page);
  const observed = await page.evaluate(async () => {
    const runtimeUrl = '/src/game/rendering/runtime.ts';
    const configUrl = '/src/game/config.ts';
    const { createRuntime } = (await import(
      runtimeUrl
    )) as typeof import('../src/game/rendering/runtime');
    const { makeGameConfig } = (await import(configUrl)) as typeof import('../src/game/config');
    const host = document.createElement('div');
    host.style.cssText = 'width:640px;height:400px';
    document.body.append(host);
    const runtime = await createRuntime(
      host,
      makeGameConfig({ sessionSeconds: 120, spawnSeconds: 3 }),
      {
        onProgress: () => {},
        onHud: () => {},
        onFinish: () => {},
        signal: new AbortController().signal,
      },
    );
    const originalNow = performance.now.bind(performance);
    try {
      const { app } = window.__runtimeAudit.scenes.at(-1)!;
      app.ticker.stop();
      app.ticker.lastTime = 0;
      Object.defineProperty(performance, 'now', { value: () => 1000, configurable: true });
      runtime!.resume();
      Object.defineProperty(performance, 'now', { value: originalNow, configurable: true });
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      for (let frame = 1; frame <= 5; frame++) app.ticker.update(1000 + frame * 200);
      return { elapsed: runtime!.world.elapsed, x: runtime!.world.player.x };
    } finally {
      Object.defineProperty(performance, 'now', { value: originalNow, configurable: true });
      runtime?.destroy();
      host.remove();
    }
  });
  expect(observed.elapsed).toBeCloseTo(1, 6);
  expect(observed.x).toBeCloseTo(300, 4);
});

test('preserves active fractions at pause while excluding a long paused interval', async ({
  page,
}) => {
  await page.goto('/?seed=42');
  await captureScenes(page);
  const observed = await page.evaluate(async () => {
    const runtimeUrl = '/src/game/rendering/runtime.ts';
    const configUrl = '/src/game/config.ts';
    const { createRuntime } = (await import(
      runtimeUrl
    )) as typeof import('../src/game/rendering/runtime');
    const { makeGameConfig } = (await import(configUrl)) as typeof import('../src/game/config');
    const host = document.createElement('div');
    host.style.cssText = 'width:640px;height:400px';
    document.body.append(host);
    const runtime = await createRuntime(
      host,
      makeGameConfig({ sessionSeconds: 120, spawnSeconds: 3 }),
      {
        onProgress: () => {},
        onHud: () => {},
        onFinish: () => {},
        signal: new AbortController().signal,
      },
    );
    const originalNow = performance.now.bind(performance);
    let now = 1000;
    try {
      const { app } = window.__runtimeAudit.scenes.at(-1)!;
      app.ticker.stop();
      app.ticker.lastTime = 0;
      Object.defineProperty(performance, 'now', { value: () => now, configurable: true });
      runtime!.resume();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      app.ticker.update(1025);
      now = 1040;
      runtime!.pause();
      const pausedElapsed = runtime!.world.elapsed;
      now = 5040;
      runtime!.resume();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      app.ticker.update(5100);
      return { pausedElapsed, elapsed: runtime!.world.elapsed, x: runtime!.world.player.x };
    } finally {
      Object.defineProperty(performance, 'now', { value: originalNow, configurable: true });
      runtime?.destroy();
      host.remove();
    }
  });
  expect(observed.pausedElapsed).toBeCloseTo(0.0333333333, 6);
  expect(observed.elapsed).toBeCloseTo(0.1, 6);
  expect(observed.x).toBeCloseTo(138, 4);
});

for (const trigger of ['escape', 'blur', 'hidden'] as const) {
  test(`flushes held movement before the ${trigger} pause clears input`, async ({ page }) => {
    await page.goto('/?seed=42');
    await captureScenes(page);
    const observed = await page.evaluate(async (trigger) => {
      const runtimeUrl = '/src/game/rendering/runtime.ts';
      const configUrl = '/src/game/config.ts';
      const { createRuntime } = (await import(
        runtimeUrl
      )) as typeof import('../src/game/rendering/runtime');
      const { makeGameConfig } = (await import(configUrl)) as typeof import('../src/game/config');
      const host = document.createElement('div');
      host.style.cssText = 'width:640px;height:400px';
      document.body.append(host);
      const runtime = await createRuntime(
        host,
        makeGameConfig({ sessionSeconds: 120, spawnSeconds: 3 }),
        {
          onProgress: () => {},
          onHud: () => {},
          onFinish: () => {},
          signal: new AbortController().signal,
        },
      );
      const originalNow = performance.now.bind(performance);
      let now = 1000;
      try {
        const { app } = window.__runtimeAudit.scenes.at(-1)!;
        app.ticker.stop();
        app.ticker.lastTime = 0;
        Object.defineProperty(performance, 'now', { value: () => now, configurable: true });
        runtime!.resume();
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        app.ticker.update(1025);
        now = 1040;
        if (trigger === 'escape')
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
        else if (trigger === 'blur') window.dispatchEvent(new Event('blur'));
        else {
          Object.defineProperty(document, 'hidden', { value: true, configurable: true });
          document.dispatchEvent(new Event('visibilitychange'));
        }
        const paused = runtime!.world.snapshot();
        now = 5040;
        runtime!.resume();
        app.ticker.update(5100);
        return {
          status: paused.status,
          pausedX: paused.player.x,
          resumedX: runtime!.world.player.x,
        };
      } finally {
        if (trigger === 'hidden') Reflect.deleteProperty(document, 'hidden');
        Object.defineProperty(performance, 'now', { value: originalNow, configurable: true });
        runtime?.destroy();
        host.remove();
      }
    }, trigger);
    expect(observed.status).toBe('paused');
    expect(observed.pausedX).toBeCloseTo(126, 4);
    expect(observed.resumedX).toBeCloseTo(126, 4);
  });
}
