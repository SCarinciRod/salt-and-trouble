import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { platform, release, cpus, totalmem } from 'node:os';
import { gzipSync } from 'node:zlib';
import { setTimeout as delay } from 'node:timers/promises';

const baseURL = 'http://127.0.0.1:5176';
const seconds = 180;
const directory = 'reports/profiling';
await mkdir(directory, { recursive: true });
const buildHash = createHash('sha256')
  .update(await readFile('dist/index.html'))
  .digest('hex');
const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '5176',
    '--strictPort',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
);
let serverLog = '';
server.stdout.on('data', (data) => {
  serverLog += data;
});
server.stderr.on('data', (data) => {
  serverLog += data;
});
let browser;
const report = {
  createdAt: new Date().toISOString(),
  buildHash,
  targetFPS: 60,
  run: {},
  memory: [],
  errors: [],
  limitations: [],
};
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`Preview failed: ${serverLog}`);
    try {
      if ((await fetch(baseURL)).ok) break;
    } catch {
      /* server warming */
    }
    if (attempt === 59) throw new Error('Preview did not start');
    await delay(250);
  }
  const channel = process.argv.includes('--chrome') ? 'chrome' : undefined;
  browser = await chromium.launch({ headless: !process.argv.includes('--headed'), channel });
  const context = await browser.newContext({
    viewport: { width: 1365, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const system = await browser.newBrowserCDPSession();
  const gpu = (await system.send('SystemInfo.getInfo')).gpu;
  let hardware = {};
  if (platform() === 'win32') {
    try {
      hardware = JSON.parse(
        execFileSync(
          'powershell.exe',
          [
            '-NoProfile',
            '-Command',
            '[pscustomobject]@{cpu=(Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors);memory=(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory;gpu=(Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion)} | ConvertTo-Json -Depth 4',
          ],
          { encoding: 'utf8', windowsHide: true },
        ),
      );
    } catch {
      hardware = { note: 'Hardware inventory unavailable; OS fields remain available.' };
    }
  }
  report.environment = {
    os: `${platform()} ${release()}`,
    cpu: cpus()[0]?.model,
    logicalProcessors: cpus().length,
    memoryBytes: totalmem(),
    hardware,
    browser: browser.version(),
    channel: channel ?? 'chromium-headless-shell',
    headless: !process.argv.includes('--headed'),
    viewport: { width: 1365, height: 900 },
    deviceScaleFactor: 1,
    gpu,
  };
  await page.goto(`${baseURL}/?profile=1&seed=1&network=success`);
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await page.getByLabel('Game session time').fill('180');
  await page.getByLabel('Enemy spawn time').fill('15');
  await page.getByRole('button', { name: 'Save options' }).click();
  await page.getByLabel('Close options').click();

  async function sail() {
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('button', { name: 'Set sail', exact: true }).click();
    await page.getByLabel('Match status').filter({ hasText: 'Running' }).waitFor();
  }
  const keys = ['w', 'd', 'Space', 'q', 'e'];
  async function press() {
    for (const key of keys) await page.keyboard.down(key);
  }
  async function releaseKeys() {
    for (const key of keys) await page.keyboard.up(key);
  }

  await sail();
  if (await page.evaluate(() => !!window.__gameTest))
    throw new Error('Profiling must not use the test clock');
  const profile = await page.evaluateHandle(() => window.__gameProfile);
  await press();
  const started = performance.now();
  for (let interval = 0; interval < 200; interval++) {
    await delay(1000);
    const state = await profile.evaluate((observer) => observer.snapshot(false));
    if (interval % 15 === 0)
      console.log(
        `Combat: ${state.elapsed.toFixed(1)}s, ${state.hp} HP, ${state.entities.ships} ships, ${state.entities.projectiles} projectiles`,
      );
    if (state.status === 'finished') break;
    if (interval === 199) throw new Error('Round did not finish after 200 wall seconds');
  }
  await releaseKeys();
  const measured = await profile.evaluate((observer) => observer.snapshot());
  await profile.dispose();
  const intervals = measured.frameIntervals.filter((value) => value > 0);
  const ordered = [...intervals].sort((a, b) => a - b);
  const milliseconds = intervals.reduce((sum, value) => sum + value, 0);
  report.run = {
    ...measured,
    wallSeconds: (performance.now() - started) / 1000,
    workload:
      'Hold W, D, Space, Q and E; natural seed-1 spawns, 180s duration, 15s spawn interval.',
    fps: (intervals.length * 1000) / milliseconds,
    frameP95MS: ordered[Math.ceil(ordered.length * 0.95) - 1],
    peakEntities: measured.samples.reduce(
      (max, sample) => Math.max(max, sample.ships + sample.projectiles + sample.effects),
      0,
    ),
    peakDisplayObjects: measured.samples.reduce(
      (max, sample) => Math.max(max, sample.displayObjects),
      0,
    ),
  };
  await page.screenshot({ path: `${directory}/result.png`, fullPage: true });
  if (measured.elapsed !== seconds || measured.reason !== 'time')
    throw new Error(
      `Workload failed to survive three minutes: ${measured.elapsed}s, ${measured.reason}`,
    );
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
  // Exercise both enemy kinds in the short memory cycles, rather than spending
  // five cycles on player/projectile allocation only.
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await page.getByLabel('Enemy spawn time').fill('3');
  await page.getByRole('button', { name: 'Save options' }).click();
  await page.getByLabel('Close options').click();

  async function collect(cycle) {
    await delay(500); // Allow menu, query and effect cleanup before collection.
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage');
    const dom = await cdp.send('Memory.getDOMCounters');
    const metrics = (await cdp.send('Performance.getMetrics')).metrics;
    const selected = Object.fromEntries(
      metrics
        .filter(({ name }) =>
          ['JSHeapUsedSize', 'JSHeapTotalSize', 'Documents', 'Nodes', 'JSEventListeners'].includes(
            name,
          ),
        )
        .map(({ name, value }) => [name, value]),
    );
    const state = await page.evaluate(() => ({
      canvases: document.querySelectorAll('canvas').length,
      observer: !!window.__gameProfile,
      testHarness: !!window.__gameTest,
    }));
    report.memory.push({ cycle, ...heap, ...dom, ...selected, ...state });
    console.log(
      `Memory cycle ${cycle}: ${(heap.usedSize / 1048576).toFixed(2)} MiB, ${dom.nodes} DOM nodes, ${dom.jsEventListeners} listeners, ${state.canvases} canvases`,
    );
  }
  async function heapSnapshot(label) {
    const chunks = [];
    const listener = ({ chunk }) => chunks.push(chunk);
    cdp.on('HeapProfiler.addHeapSnapshotChunk', listener);
    await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
    cdp.off('HeapProfiler.addHeapSnapshotChunk', listener);
    const raw = chunks.join('');
    await writeFile(`${directory}/${label}.heapsnapshot.gz`, gzipSync(raw));
    const heap = JSON.parse(raw);
    const fields = heap.snapshot.meta.node_fields;
    const nameIndex = fields.indexOf('name');
    const typeIndex = fields.indexOf('type');
    const objectType = heap.snapshot.meta.node_types[typeIndex].indexOf('object');
    const retained = {};
    for (let index = 0; index < heap.nodes.length; index += fields.length) {
      if (heap.nodes[index + typeIndex] !== objectType) continue;
      const name = heap.strings[heap.nodes[index + nameIndex]];
      if (/WebGL|HTMLCanvas|ResizeObserver|Texture|Ticker|BattleScene|Simulation/.test(name))
        retained[name] = (retained[name] ?? 0) + 1;
    }
    return retained;
  }
  await collect(0);
  const retainedBefore = await heapSnapshot('menu-before');
  for (let cycle = 1; cycle <= 5; cycle++) {
    await sail();
    await press();
    await delay(8000);
    await releaseKeys();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
    await collect(cycle);
  }
  const retainedAfter = await heapSnapshot('menu-after-five');
  report.retainedObjects = { before: retainedBefore, after: retainedAfter };
  report.memoryGrowthBytes = report.memory.at(-1).usedSize - report.memory[0].usedSize;
  report.limitations = [
    'One desktop Chromium run at 1365x900, DPR 1. Mobile browser functional tests are separate; no physical phone performance claim.',
    'Valid low-pressure 15s spawn configuration chosen so this fixed-input workload survives 180s. It is not a worst-case 0.5s spawn stress test. Memory cycles use the default 3s spawn interval for eight seconds each, exercising both enemy kinds.',
    'Read-only profiling observer enabled in the same optimized build via ?profile=1&seed=1. Observer overhead is included; no clock, HP or world mutation interface.',
    'Entity peaks are sampled once per active second; brief sub-second peaks can be missed. Frame p95 uses every recorded active ticker interval, including startup.',
    'Forced-GC JS heap, DOM listeners, exposed canvases and heap object counts are measured. These do not quantify GPU VRAM or native driver allocations.',
    'Renderer identity in the report establishes whether hardware acceleration or software fallback was actually used. A headless software result is not evidence for the installed physical GPU.',
    'Vite initial JS chunk exceeds 500 kB; network/load-time optimization is separate from the combat frame-rate measurement.',
  ];
  console.log(
    `Finished: ${report.run.fps.toFixed(2)} FPS, frame p95 ${report.run.frameP95MS.toFixed(2)} ms`,
  );
} catch (error) {
  report.failure = String(error);
  process.exitCode = 1;
  console.error(error);
} finally {
  // Keep metadata readable without putting each frame sample on its own line.
  const serialized = JSON.stringify(report, null, 2).replace(
    /("frameIntervals":\s*)\[[\s\S]*?\]/,
    (_, key) => `${key}${JSON.stringify(report.run.frameIntervals)}`,
  );
  await writeFile(`${directory}/latest.json`, serialized);
  if (browser) await browser.close();
  server.kill();
}
