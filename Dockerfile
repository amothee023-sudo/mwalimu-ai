# Step 1: Build the application
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Step 2: Serve the application
FROM node:20-slim
WORKDIR /app
# Install a simple server to serve static files
RUN npm install -g serve
# Copy the build output from the first stage
COPY --from=build /app/dist ./dist
EXPOSE 8080
# Start the server on port 8080 (required by Cloud Run)
CMD ["serve", "-s", "dist", "-l", "8080"]
