FROM node:26-slim AS builder
WORKDIR /workspace

RUN npm install -g pnpm@12.23.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/core ./packages/shared/core
COPY packages/node/runtime ./packages/node/runtime
COPY packages/node/db ./packages/node/db
COPY apis/node/auth/auth ./apis/node/auth/auth

RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --dir packages/shared/core exec tsc --build tsconfig.lib.json \
  && pnpm --dir packages/node/runtime exec tsc --build tsconfig.lib.json \
  && pnpm --dir packages/node/db exec tsc --build tsconfig.lib.json \
  && pnpm --dir apis/node/auth/auth exec tsc --build tsconfig.lib.json
RUN pnpm --filter @aklapper/api-auth deploy --prod --legacy /prod/api-auth \
  && rm -rf /prod/api-auth/dist \
  && cp -r /workspace/apis/node/auth/auth/dist /prod/api-auth/dist \
  && cp -r /workspace/packages/shared/core/dist /prod/api-auth/node_modules/@aklapper/core/dist \
  && cp -r /workspace/packages/node/runtime/dist /prod/api-auth/node_modules/@aklapper/node-runtime/dist \
  && cp -r /workspace/packages/node/db/dist /prod/api-auth/node_modules/@aklapper/db/dist

FROM node:26-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

COPY --from=builder --chown=node:node /prod/api-auth ./

EXPOSE 8080
USER node

CMD ["node", "./dist/main.js"]
