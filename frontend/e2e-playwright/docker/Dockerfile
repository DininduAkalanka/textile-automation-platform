ARG QA_DEPENDENCIES=dependencies
FROM postgres:16-alpine@sha256:e013e867e712fec275706a6c51c966f0bb0c93cfa8f51000f85a15f9865a28cb AS pg
FROM cypress/included:15.20.1@sha256:327d62ee6d1c9bd7b4b490bb2772c1b70d37d56647953a4ec3105a939b7c61ff AS dependencies
COPY --from=pg /lib/ /opt/qa-pg/lib/
COPY --from=pg /usr/lib/ /opt/qa-pg/usr/lib/
COPY --from=pg /usr/local/ /opt/qa-pg/usr/local/
RUN ln -s /opt/qa-pg/lib/ld-musl-x86_64.so.1 /lib/ld-musl-x86_64.so.1 && echo '/opt/qa-pg/lib:/opt/qa-pg/usr/lib:/opt/qa-pg/usr/local/lib' > /etc/ld-musl-x86_64.path && /opt/qa-pg/usr/local/bin/postgres --version
ENV CYPRESS_INSTALL_BINARY=0 NEXT_TELEMETRY_DISABLED=1 CHECKPOINT_DISABLE=1 CYPRESS_CRASH_REPORTS=0
WORKDIR /qa/backend
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm ci --no-audit --no-fund && npx --no-install prisma generate
WORKDIR /qa/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund && npx --no-install playwright install chromium webkit

# Reuse a prepared dependency image when verifying this lockfile locally.
FROM ${QA_DEPENDENCIES} AS runner
WORKDIR /qa/frontend
RUN npx --no-install playwright install-deps chromium webkit
COPY frontend/package*.json /qa/frontend/
COPY backend/nest-cli.json backend/tsconfig*.json /qa/backend/
COPY backend/src /qa/backend/src
COPY frontend/*.config.* frontend/tsconfig.json /qa/frontend/
COPY frontend/src /qa/frontend/src
COPY frontend/public /qa/frontend/public
COPY frontend/cypress /qa/frontend/cypress
COPY frontend/e2e-playwright /qa/frontend/e2e-playwright
WORKDIR /qa
COPY --from=pg /usr/share/icu/ /usr/share/icu/
ENTRYPOINT ["bash", "/qa/frontend/e2e-playwright/docker/run.sh"]
