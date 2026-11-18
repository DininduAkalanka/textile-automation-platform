#!/usr/bin/env bash
set -euo pipefail
trap 'echo "QA runner stopped at line $LINENO. See the step log in /evidence." >&2' ERR
export PATH="/opt/qa-pg/usr/local/bin:$PATH"
export LC_ALL=C
export NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api/v1 INTERNAL_BACKEND_URL=http://127.0.0.1:3001
export CYPRESS_API_URL="$NEXT_PUBLIC_API_URL" CYPRESS_BASE_URL=http://127.0.0.1:3000
export NEXT_PUBLIC_SITE_URL="$CYPRESS_BASE_URL" FRONTEND_URL="$CYPRESS_BASE_URL" PORT=3001
export DATABASE_URL='postgresql://qa@127.0.0.1:5433/pw_qa?schema=public' DIRECT_URL='postgresql://qa@127.0.0.1:5433/pw_qa?schema=public'
export ALLOW_DEV_OTP_BYPASS=true JWT_SECRET=ci-only-secret-not-used-outside-github-actions JWT_EXPIRATION=7d
export PAYHERE_MODE=sandbox PAYHERE_MERCHANT_ID=1221149 PAYHERE_MERCHANT_SECRET=ci-only-sandbox-secret
export PAYHERE_NOTIFY_URL="$NEXT_PUBLIC_API_URL/payments/payhere/notify" AI_SERVICE_URL=http://127.0.0.1:1
export CI=true
case "${1:-smoke}" in smoke|compare) ;; *) echo "Expected smoke or compare" >&2; exit 2;; esac
for interface in /sys/class/net/*; do
  if [[ "${interface##*/}" != lo ]]; then echo "Start the QA container with --network none" >&2; exit 2; fi
done
mkdir -p /evidence /tmp/qa-socket
install -o node -g node -d /tmp/qa-database
chown node:node /tmp/qa-socket
runuser -u node -- initdb --no-locale -A trust -U qa -D /tmp/qa-database >/evidence/init.log
runuser -u node -- pg_ctl -D /tmp/qa-database -l /tmp/qa-database/server.log -o "-k /tmp/qa-socket -p 5433 -h 127.0.0.1" -w start
createdb -p 5433 -h 127.0.0.1 -U qa pw_qa
cd /qa/backend
npx --no-install prisma migrate deploy >/evidence/migrate.log
npm run db:seed >/evidence/seed.log
npm run build >/evidence/backend-build.log
NODE_ENV=test node dist/main.js >/evidence/backend.log 2>&1 &
ready() {
  node - "$1" <<'JS'
const { expect } = require('/qa/frontend/node_modules/@playwright/test');
const url = process.argv[2];
expect.poll(async () => {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(2000) })).status;
  } catch {
    return 0;
  }
}, { timeout: 90000, message: 'Waiting for ' + url }).toBe(200)
  .catch((error) => { console.error(error); process.exitCode = 1; });
JS
}
ready "$NEXT_PUBLIC_API_URL/health/ready"
psql -h 127.0.0.1 -p 5433 -U qa -d pw_qa -c 'SELECT count(*) AS seeded_products FROM products;'
cd /qa/frontend
npm run build >/evidence/frontend-build.log 2>&1
npx --no-install tsc --noEmit >/evidence/typecheck.log 2>&1
npx --no-install tsc -p e2e-playwright/tsconfig.json --noEmit >/evidence/test-typecheck.log 2>&1
npx --no-install eslint . >/evidence/eslint.log 2>&1
node e2e-playwright/utils/inventory.mjs >/evidence/routes.md
npm run start -- -p 3000 -H 127.0.0.1 >/evidence/frontend.log 2>&1 &
ready "$CYPRESS_BASE_URL"
smoke_status=0
npm run test:pw:smoke -- --project=chromium --retries=0 --reporter=list --output=/evidence/test-results > /evidence/smoke.log 2>&1 || smoke_status=$?
cat /evidence/smoke.log
if [[ "${1:-smoke}" == compare ]]; then
  started=$SECONDS
  cypress_status=0
  npm run test:e2e -- --config screenshotsFolder=/evidence/screenshots >/evidence/cypress.log 2>&1 || cypress_status=$?
  printf 'Cypress exit %s, elapsed %ss\n' "$cypress_status" "$((SECONDS-started))"
  tail -n 24 /evidence/cypress.log
  if [[ $cypress_status != 0 ]]; then exit "$cypress_status"; fi
fi
exit "$smoke_status"
