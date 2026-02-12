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

# Install dependencies
RUN npm install

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

# Default command - start Expo
CMD ["npx", "expo", "start", "--tunnel"]
