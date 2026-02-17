# NearMe Mobile - React Native Expo Development Environment
# This Dockerfile creates a ready-to-use development environment
# Your friend can run this without installing Node.js or any dependencies

FROM node:20-alpine

# Install necessary packages for Expo
RUN apk add --no-cache \
    git \
    bash \
    python3 \
    make \
    g++

# Set working directory
WORKDIR /app

# Copy package files first (for better Docker caching)
COPY package*.json ./

# Configure npm for better network resilience inside Docker
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 60000 && \
    npm config set fetch-retry-maxtimeout 300000 && \
    npm config set fetch-timeout 600000

# Install dependencies
RUN npm install --prefer-offline --no-audit --no-fund

# Copy the rest of the source code
COPY . .

# Expose Expo ports
# 8081 - Metro bundler
# 19000 - Expo dev server
# 19001 - Expo dev tools
# 19002 - Expo tunnel
EXPOSE 8081 19000 19001 19002

# Set environment variables for Expo
ENV EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0
ENV REACT_NATIVE_PACKAGER_HOSTNAME=0.0.0.0

# Default command - start Expo with tunnel for mobile access
CMD ["npx", "expo", "start", "--tunnel"]
