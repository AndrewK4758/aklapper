# Use the official Node.js image as the base image
FROM node:latest

# Set the working directory in the container
WORKDIR /api

# Install pnpm
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

# Install dependencies using pnpm
RUN pnpm install --frozen-lockfile --prod
RUN pnpm approve-builds

COPY packages/prisma/prisma ./libs/prisma/prisma
COPY packages/prisma/src ./libs/prisma/source

RUN pnpx prisma generate

# Copy the entire project to the container
COPY apps/apis/crud/crud-api/dist .

ENV NODE_ENV='production'

EXPOSE 4000

# Define the command to run your application
CMD ["node", "main.js"]
