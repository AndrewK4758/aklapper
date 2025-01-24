# Use the official Node.js image as the base image
FROM node:latest

# Set the working directory in the container
WORKDIR /api

ARG NODE_ENV

ENV NODE_ENV=${NODE_ENV}

# Install pnpm
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

# Install dependencies using pnpm
RUN pnpm install --frozen-lockfile

COPY libs/prisma .

RUN pnpx prisma generate

# Copy the entire project to the container
COPY dist/apis/crud/crud-api .

EXPOSE 4000

# Define the command to run your application
CMD ["node", "main.js"]
