# Playwright end-to-end tests

## Run in one Docker container

From the repository root, build the QA image. Installation requires access to the package and browser registries. The test run uses only loopback networking. PostgreSQL 16 on port 5433, Nest on port 3001, Next on port 3000 and the browser all run inside the container. The Dockerfile uses Linux x86-64 binaries. Each invocation creates a fresh seeded database in the container's writable layer.

```sh
docker build -f frontend/e2e-playwright/docker/Dockerfile -t nandana-pw:local .
```

Run the smoke test and keep its logs and failure screenshots. Choose a different evidence directory for each run.

**PowerShell**

```powershell
$qaEvidence = Join-Path $env:TEMP ('nandana-pw-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $qaEvidence | Out-Null
docker run --rm --network none --shm-size=1g --mount "type=bind,source=$qaEvidence,target=/evidence" nandana-pw:local smoke
```

**Bash**

```bash
qa_evidence=$(mktemp -d)
docker run --rm --network none --shm-size=1g --mount "type=bind,source=$qa_evidence,target=/evidence" nandana-pw:local smoke
```

Use `compare` in place of `smoke` to also run the existing Cypress suite after Playwright. A failing suite returns a nonzero exit code. Inspect `smoke.log`, `cypress.log`, the build and typecheck logs and `test-results/` in the evidence directory.

## Using an existing disposable local stack

Build the frontend with `NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api/v1` and serve it on `http://127.0.0.1:3000`. Use those same hosts for the backend's `FRONTEND_URL` and the browser. Both test URL overrides, `PW_BASE_URL` and `PW_API_URL`, must point to loopback. The runner can then run from `frontend/`.

```sh
npm ci
npx playwright install chromium webkit
npm run test:pw:smoke -- --project=chromium
npm run test:pw -- --list
npx tsc --project e2e-playwright/tsconfig.json --noEmit
```

`npm run test:pw:ui` starts UI mode. `npm run test:pw:headed` shows the browser. CI uses the GitHub and HTML reporters. Use `npm run pw:report` to open a generated HTML report. To generate one locally, append `-- --reporter=html` to `npm run test:pw`. CI captures screenshots on failure and traces on the first retry.

## Adding a test

Import `test` and `expect` from `fixtures/test.ts`. Use a fresh browser context, test-owned data and selectors based on role, label or visible text. The existing stable attribute is `data-testid`. The guest smoke uses a local product-photo placeholder and system fonts for external static assets. Any other off-origin request is blocked and recorded as a failure.

Put the spec under a feature directory in `specs/`. Use `@smoke` for a short health check, `@critical` for a release-critical flow, `@cross-browser` for the WebKit subset and `@mobile` for Pixel 7. Reserve `@a11y`, `@security`, `@slow` and `@ai-live` for the corresponding coverage. Set `PW_FIREFOX=1` to enable the Firefox project after installing that browser. Run `node e2e-playwright/utils/inventory.mjs` from `frontend/` when changing routes.

The guest smoke permits one Chromium resource error for the exact local refresh endpoint only when a corresponding POST received 401 without cookies or an Authorization header. A repeated refresh, an error at another URL, an uncaught exception or another console error fails the test.
