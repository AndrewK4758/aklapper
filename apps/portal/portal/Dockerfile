FROM node:26-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY apps/portal/portal/package.json ./package.json
COPY apps/portal/portal/dist ./dist
COPY apps/portal/portal/src/server.ts ./src/server.ts
EXPOSE 4300
CMD ["node", "./src/server.ts"]
