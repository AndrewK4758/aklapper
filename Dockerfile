FROM node:latest

WORKDIR /portfolio

RUN npm i -g pnpm

COPY package.json pnpm-lock.yaml ./

RUN pnpm i --prod --frozen-lockfile

COPY packages/prisma/prisma ./libs/prisma/prisma
COPY packages/prisma/src ./libs/prisma/source

RUN pnpx prisma generate

COPY apps/react/portfolio/portfolio/dist ./dist/
COPY apps/react/portfolio/portfolio/index.html ./

EXPOSE 4700

CMD [ "node", "dist/server/server.js" ]

