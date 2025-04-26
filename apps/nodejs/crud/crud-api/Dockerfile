# Use the official Node.js image as the base image
FROM node:latest

# Set the working directory in the container
WORKDIR /api

# Install pnpm
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies using pnpm
RUN pnpm install --frozen-lockfile --prod
RUN pnpm approve-builds


COPY packages/prisma/chinook/src ./libs/prisma/src
COPY packages/prisma/chinook/dist ./libs/prisma/dist
COPY packages/prisma/chinook/prisma ./libs/prisma/prisma
COPY packages/prisma/chinook/scripts ./libs/prisma/scripts
COPY packages/prisma/chinook/generated ./libs/prisma/generated


# Copy the entire project to the container
COPY apps/nodejs/crud/crud-api/dist .

ENV NODE_ENV='production'

EXPOSE 4000

# Define the command to run your application
CMD ["node", "main.js"]
