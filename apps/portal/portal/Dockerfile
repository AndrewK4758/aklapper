FROM node:26-slim AS builder
WORKDIR /workspace

RUN npm install -g pnpm@12.23.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/node/ssr-server ./packages/node/ssr-server
COPY apps/portal/portal ./apps/portal/portal

RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --dir packages/shared/contracts exec tsc --build tsconfig.lib.json \
  && pnpm --dir packages/shared/utils exec tsc --build tsconfig.lib.json \
  && pnpm --dir packages/shared/analytics exec tsc --build tsconfig.lib.json \
  && pnpm --dir packages/node/ssr-server exec tsc --build tsconfig.lib.json \
  && pnpm --dir packages/shared/ui exec vite build \
  && pnpm --dir apps/portal/portal exec react-router build --mode production
RUN pnpm --filter @aklapper/portal deploy --prod --legacy /prod/portal \
  && rm -rf /prod/portal/dist \
  && cp -r /workspace/apps/portal/portal/dist /prod/portal/dist \
  && mkdir -p /prod/portal/src \
  && cp /workspace/apps/portal/portal/src/server.ts /prod/portal/src/server.ts \
  && cp -r /workspace/packages/node/ssr-server/dist /prod/portal/node_modules/@aklapper/ssr-server/dist

FROM node:26-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

COPY --from=builder --chown=node:node /prod/portal ./

EXPOSE 8080
USER node

CMD ["node", "./src/server.ts"]
