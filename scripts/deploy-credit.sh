#!/bin/bash
# Pull the Flask image from Docker Hub and run it on the secondary host (EC2).
# Usage: ./deploy-credit.sh <dockerhub-username>
set -e
DH="${1:?Usage: ./deploy-credit.sh <dockerhub-username>}"
docker pull "$DH/swe40006-flask-app:1.0"
docker rm -f flask-app 2>/dev/null || true
docker run -d --name flask-app \
  --restart unless-stopped \
  -p 8080:5000 \
  -e HOST_LABEL="AWS EC2 (secondary Docker host)" \
  "$DH/swe40006-flask-app:1.0"
docker ps --filter name=flask-app
