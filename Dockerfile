FROM node:latest

WORKDIR /portfolio

RUN npm i -g pnpm@latest
RUN pnpm approve-builds -g

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

ENV DOCKER=true

RUN pnpm i --prod --frozen-lockfile
RUN pnpm approve-builds

COPY packages/prisma/prisma ./libs/prisma/prisma
COPY packages/prisma/src ./libs/prisma/source

RUN pnpx prisma generate

COPY apps/react/portfolio/portfolio/dist ./dist/

EXPOSE 4700

CMD [ "node", "dist/server/server.js" ]

