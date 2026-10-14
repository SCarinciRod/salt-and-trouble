import { mkdir, cp } from 'node:fs/promises';

await mkdir('reports/tests', { recursive: true });
await cp('playwright-report', 'reports/tests', { recursive: true });
console.log('Archived current browser HTML reports under reports/tests.');
