# Stage 1: build frontend (need devDependencies for vite build)
# Platform is set by docker-compose (e.g. linux/amd64) so native deps match the run environment
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend .
RUN npm run build

# Stage 2: production image
FROM node:20-alpine
WORKDIR /app/backend

# Install backend deps (no native modules)
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev

COPY backend .
COPY --from=frontend /app/frontend/dist ./public

# Default port (override with PORT env)
ENV NODE_ENV=production
EXPOSE 3030

CMD ["node", "src/index.js"]
