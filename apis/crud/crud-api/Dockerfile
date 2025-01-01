# Use the official Node.js image as the base image
FROM node:latest

# Set the working directory in the container
WORKDIR /api

# Install pnpm
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

# Install dependencies using pnpm
RUN pnpm install --frozen-lockfile

ENV NODE_ENV='production'

COPY ../../../libs/prisma .

RUN pnpx prisma generate

# Copy the entire project to the container
COPY dist/apis/crud-api .

# Expose port 3000 (or the port your app uses)
EXPOSE 4000

# Define the command to run your application
CMD ["node", "main.js"]
