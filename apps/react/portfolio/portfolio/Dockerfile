FROM node:latest

ENV NODE_ENV='production'
ENV PRISMA_QUERY_ENGINE_LIBRARY="/portfolio/packages/prisma/chinook/generated/libquery_engine-debian-openssl-3.0.x.so.node"
WORKDIR /portfolio

RUN npm i -g pnpm@latest
RUN pnpm approve-builds -g

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

ENV DOCKER=true

RUN pnpm i --prod --frozen-lockfile
RUN pnpm approve-builds

COPY packages/prisma/chinook ./packages/prisma/chinook
# COPY packages/prisma/src ./libs/prisma/source

COPY apps/react/portfolio/portfolio/dist ./dist/

EXPOSE 4700

CMD [ "node", "dist/server/server.js" ]

