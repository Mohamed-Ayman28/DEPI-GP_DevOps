# ----------------------------
# Stage 1: Build Angular App
# ----------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Copy package.json & package-lock.json
COPY package*.json ./
RUN npm install

# Copy all source files
COPY . .

# Build Angular (browser only)
RUN npx ng run EventPalnner-FrontEnd:build:production --output-path=dist/browser

# ----------------------------
# Stage 2: Serve with Nginx (OpenShift SAFE)
# ----------------------------
FROM nginxinc/nginx-unprivileged:alpine

# Copy the built browser output
COPY --from=build /app/dist/browser/browser /usr/share/nginx/html

# Copy complete nginx configuration (replaces main config)
COPY nginx.conf /etc/nginx/nginx.conf

# Create writable nginx temp directories for OpenShift
RUN mkdir -p /tmp/nginx/client_temp \
    /tmp/nginx/proxy_temp \
    /tmp/nginx/fastcgi_temp \
    /tmp/nginx/uwsgi_temp \
    /tmp/nginx/scgi_temp

# OpenShift-safe port
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
