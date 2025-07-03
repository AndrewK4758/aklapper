# Use the official Node.js image as the base image
FROM node:latest

ENV INSTANCE_CONNECTION_NAME=games-424800:us-central1:aklapper

ENV DB_URL_PROD=postgresql://postgres:11560000@localhost/aklapper?host=/cloudsql/games-424800:us-central1:aklapper/
ENV NODE_ENV='production'

RUN apt-get update -y && apt-get install -y openssl
ENV PRISMA_QUERY_ENGINE_LIBRARY=/api/packages/generated/libquery_engine-debian-openssl-3.0.x.so.node
# Set the working directory in the container
WORKDIR /api

# Install pnpm
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies using pnpm
RUN pnpm install --prod --frozen-lockfile
RUN pnpm approve-builds

COPY packages/prisma/chinook ./packages

COPY apps/nodejs/crud/crud-api/dist .

EXPOSE 4000

# Define the command to run your application
CMD ["node", "./main.js"]
