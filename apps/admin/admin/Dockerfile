FROM node:26-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY apps/admin/admin/package.json ./package.json
COPY apps/admin/admin/dist ./dist
COPY apps/admin/admin/src/server.ts ./src/server.ts
EXPOSE 4301
CMD ["node", "./src/server.ts"]
