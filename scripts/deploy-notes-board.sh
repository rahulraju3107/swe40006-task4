#!/bin/bash
# Run the Shift Handover Board and its Redis store on EC2.
# Redis is only reachable on the private notes-net network. Only the web app publishes a port.
# Usage: ./deploy-notes-board.sh <dockerhub-username>
set -e
DH="${1:?Usage: ./deploy-notes-board.sh <dockerhub-username>}"

docker network inspect notes-net >/dev/null 2>&1 || docker network create notes-net
docker volume inspect notes-data >/dev/null 2>&1 || docker volume create notes-data

docker pull redis:8-alpine
docker pull "$DH/swe40006-notes-board:1.0"

docker rm -f notes-redis notes-board 2>/dev/null || true

docker run -d --name notes-redis \
  --network notes-net \
  --restart unless-stopped \
  -v notes-data:/data \
  redis:8-alpine redis-server --appendonly yes

docker run -d --name notes-board \
  --network notes-net \
  --restart unless-stopped \
  -p 80:3000 \
  -e APP_ENV=production \
  -e REDIS_URL=redis://notes-redis:6379 \
  -e SITE_NAME="Northside General Hospital" \
  -e BOARD_TITLE="Shift Handover Board" \
  -e DISPLAY_TIMEZONE=Australia/Sydney \
  "$DH/swe40006-notes-board:1.0"

docker ps --filter name=notes-
