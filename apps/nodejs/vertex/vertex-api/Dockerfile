# Use the official Node.js image as the base image
FROM node:latest

# Set the working directory in the container
WORKDIR /api

# Install pnpm
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies using pnpm
RUN pnpm install --prod --frozen-lockfile
RUN pnpm approve-builds

ENV NODE_ENV='production'

# Copy the entire project to the container
COPY apps/nodejs/vertex/vertex-api/dist .

# Expose port 3000 (or the port your app uses)
EXPOSE 5000

# Define the command to run your application
CMD ["node", "main.js"]
