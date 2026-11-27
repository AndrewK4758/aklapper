FROM node:26-slim AS builder
WORKDIR /workspace

RUN npm install -g pnpm@12.23.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/core ./packages/shared/core
COPY packages/shared/ui ./packages/shared/ui
COPY packages/node/runtime ./packages/node/runtime
COPY packages/tooling ./packages/tooling
COPY apps/portal/portal ./apps/portal/portal

RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --dir packages/shared/core exec tsc --build tsconfig.lib.json \
  && pnpm --dir packages/node/runtime exec tsc --build tsconfig.lib.json \
  && pnpm --dir packages/tooling exec tsc --build tsconfig.lib.json \
  && pnpm --dir packages/shared/ui exec vite build \
  && pnpm --dir apps/portal/portal exec react-router build --mode production
RUN pnpm --config.shamefully-hoist=true --filter @aklapper/portal deploy --prod --legacy /prod/portal \
  && rm -rf /prod/portal/dist \
  && cp -r /workspace/apps/portal/portal/dist /prod/portal/dist \
  && mkdir -p /prod/portal/src \
  && cp /workspace/apps/portal/portal/src/server.ts /prod/portal/src/server.ts \
  && cp -r /workspace/packages/shared/core/dist /prod/portal/node_modules/@aklapper/core/dist \
  && cp -r /workspace/packages/node/runtime/dist /prod/portal/node_modules/@aklapper/node-runtime/dist

FROM node:26-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

COPY --from=builder --chown=node:node /prod/portal ./

EXPOSE 8080
USER node

CMD ["node", "./src/server.ts"]
