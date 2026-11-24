FROM node:26-slim AS builder
WORKDIR /workspace

RUN npm install -g pnpm@12.23.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/core ./packages/shared/core
COPY packages/shared/ui ./packages/shared/ui
COPY packages/node/db ./packages/node/db
COPY packages/node/runtime ./packages/node/runtime
COPY packages/tooling ./packages/tooling
COPY apps/admin/admin ./apps/admin/admin

RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --dir packages/shared/core exec tsc --build tsconfig.lib.json \
  && pnpm --dir packages/node/runtime exec tsc --build tsconfig.lib.json \
  && pnpm --dir packages/node/db exec tsc --build tsconfig.lib.json \
  && pnpm --dir packages/tooling exec tsc --build tsconfig.lib.json \
  && pnpm --dir packages/shared/ui exec vite build \
  && pnpm --dir apps/admin/admin exec react-router build --mode production
RUN pnpm --filter @aklapper/admin deploy --prod --legacy /prod/admin \
  && rm -rf /prod/admin/dist \
  && cp -r /workspace/apps/admin/admin/dist /prod/admin/dist \
  && mkdir -p /prod/admin/src \
  && cp /workspace/apps/admin/admin/src/server.ts /prod/admin/src/server.ts \
  && cp -r /workspace/packages/shared/core/dist /prod/admin/node_modules/@aklapper/core/dist \
  && cp -r /workspace/packages/node/db/dist /prod/admin/node_modules/@aklapper/db/dist \
  && cp -r /workspace/packages/node/db/drizzle /prod/admin/node_modules/@aklapper/db/drizzle \
  && cp -r /workspace/packages/node/runtime/dist /prod/admin/node_modules/@aklapper/node-runtime/dist

FROM node:26-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

COPY --from=builder --chown=node:node /prod/admin ./

EXPOSE 8080
USER node

CMD ["node", "./src/server.ts"]
