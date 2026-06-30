FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json drizzle.config.ts ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/testkit/package.json packages/testkit/package.json

RUN pnpm config set dangerouslyAllowAllBuilds true
RUN pnpm install --no-frozen-lockfile

COPY . .

ARG SERVICE_URL_API
ARG WEB_API_BASE_URL

ENV WEB_API_BASE_URL=${WEB_API_BASE_URL:-$SERVICE_URL_API}
ENV NEXT_PUBLIC_API_BASE_URL=${WEB_API_BASE_URL:-$SERVICE_URL_API}

RUN pnpm build:web:container

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.API_PORT || process.env.PORT || '4000') + '/health').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["pnpm", "start:container"]
