# Use the official Node.js image as the base image
FROM node:latest

ENV NODE_ENV='production'

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
