# Use the official Node.js image as the base image
FROM node:latest

# Set the working directory in the container
WORKDIR /api

# Install pnpm
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies using pnpm
RUN pnpm install --frozen-lockfile
RUN pnpm approve-builds

ENV NODE_ENV='production'

# Copy the entire project to the container
COPY apps/nodejs/portfolio/portfolio-api/dist .

# Expose port 3000 (or the port your app uses)
EXPOSE 4758

# Define the command to run your application
CMD ["node", "main.js"]
