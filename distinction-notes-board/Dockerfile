# Task 4.3 Distinction: optimised Dockerfile for the Shift Handover Board.
#
# What makes it optimised, compared with Dockerfile.unoptimised:
#   1. Alpine base image instead of the full Debian image (roughly a tenth of the size).
#   2. Two stages. npm runs in the first stage. Only the finished node_modules folder is
#      copied into the final image, so the npm cache never reaches it.
#   3. package.json and package-lock.json are copied before the source code, so the
#      dependency layer is reused from cache when only server.js changes.
#   4. npm ci installs the exact versions in package-lock.json and skips dev dependencies.
#   5. The app runs as the unprivileged "node" user, not root. The code files stay owned
#      by root, so the running app cannot modify its own code.
#   6. A HEALTHCHECK lets Docker report the container as unhealthy when Redis is unreachable.
#   7. Exec form CMD runs node as PID 1, so "docker stop" reaches the app directly and it
#      shuts down cleanly instead of being killed after 10 seconds.

# ---------- Stage 1: install production dependencies ----------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- Stage 2: runtime image ----------
FROM node:24-alpine
LABEL org.opencontainers.image.title="swe40006-notes-board" \
      org.opencontainers.image.description="SWE40006 Task 4.3 shift handover board"

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json server.js ./
COPY public/ ./public/

USER node
EXPOSE 3000

# busybox wget ships with Alpine, so no extra package is needed for the check.
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health > /dev/null || exit 1

CMD ["node", "server.js"]
