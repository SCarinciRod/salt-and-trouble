# Deployment

## Vercel

Create a Vercel account with your GitHub identity, then import the repository containing this solution. The challenge repository is the specification; deploy your own solution repository.

The included `vercel.json` selects Vite, installs the committed lockfile with `pnpm install --frozen-lockfile`, runs `pnpm build` and publishes `dist`. Select Node.js 24 in project settings. No environment variables, private backend, API token or external database are required by the game. Keep deployment access public so the evaluator can open it without authentication.

MSW intercepts ranking/history calls in the published browser. The worker is served at `/mockServiceWorker.js` with caching disabled; sprites and bundled fonts are served from this deployment. All screens use the root document, so refresh works without a client-route rewrite. Records persist on each browser/device, not globally.

Before publishing, run the clean-install/build procedure in README and the browser suites. The deployment must use that same source/lockfile. Record the URL, source commit and date below only after verifying them. Do not substitute localhost for the required public URL.

## Public validation gate

1. Open the public URL in fresh desktop and mobile Chromium contexts.
2. Confirm assets load, Play starts real combat, movement/firing work and focus loss pauses.
3. Save options, refresh and confirm persistence.
4. Check both record tabs, select failure scenarios and finish a real match.
5. Confirm failed submission becomes Pending; refresh, recover, retry and check one record in both views.
6. Reload the root; verify the worker is JavaScript and there are no unhandled page errors.
7. Store the public smoke-test HTML report with delivery evidence.

## Publication status

Published at https://projeto-jog.vercel.app on October 13, 2026 under the user's Vercel Hobby team. The user created/logged into the account. The validated `dist` folder was uploaded through Vercel's Drop to Deploy UI (534 files, 17.6 MB); no Git credentials or source history were changed. This manual static deployment serves the already optimized files and does not run the Git-import build configuration above.

Fresh unauthenticated public desktop/mobile checks pass all ten smoke cases, including real completion under API outage, recovery after refresh and SHA-256 equality of the published entry, worker and main script with the validated local build. No login is needed to play. The public HTML report is delivered under reports/tests/public/index.html. Source-repository handoff remains pending separately from this functional deployment.

To repeat the public gate in PowerShell:

```powershell
$env:PUBLIC_GAME_URL = 'https://projeto-jog.vercel.app'
pnpm test:public
```

On macOS/Linux: `PUBLIC_GAME_URL=https://projeto-jog.vercel.app pnpm test:public`. Run after `pnpm build`, since the exact-byte check compares the public release against local dist. New source changes require redeploying the new build before this gate will pass.
