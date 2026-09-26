# SWE40006 Task 4: Docker Containerisation

Rahul Raju (105143065). SWE40006 Software Deployment and Evolution, Semester 2 2026.

Two containerised web applications and the scripts used to deploy them to an Amazon Linux 2023 EC2 host.

## Contents

| Folder | What it is |
|---|---|
| `credit-flask-app/` | Flask app served by Gunicorn. Shows which host and container it is running on |
| `distinction-notes-board/` | Express app (Node 24) that stores shift handover notes in a Redis container |
| `scripts/` | Docker install and deployment scripts for the Amazon Linux 2023 EC2 host |

## Images on Docker Hub

- `<dockerhub-username>/swe40006-flask-app:1.0`
- `<dockerhub-username>/swe40006-notes-board:1.0`

## Build and run locally

```bash
# Flask app
cd credit-flask-app
docker build -t swe40006-flask-app:1.0 .
docker run -d --name flask-app -p 8080:5000 swe40006-flask-app:1.0
# open http://localhost:8080

# Notes board
cd distinction-notes-board
docker build -t swe40006-notes-board:1.0 .
docker network create notes-net
docker run -d --name notes-redis --network notes-net -v notes-data:/data redis:8-alpine redis-server --appendonly yes
docker run -d --name notes-board --network notes-net -p 8081:3000 -e REDIS_URL=redis://notes-redis:6379 swe40006-notes-board:1.0
# open http://localhost:8081
```

## Deployment scripts

Run on the EC2 host, in this order.

| Script | What it does |
|---|---|
| `scripts/ec2-install-docker.sh` | Installs and enables Docker, and adds `ec2-user` to the `docker` group. Reconnect afterwards so the group change takes effect |
| `scripts/deploy-credit.sh <dockerhub-username>` | Pulls the Flask image and runs it on port 8080 |
| `scripts/deploy-notes-board.sh <dockerhub-username>` | Creates the `notes-net` network and `notes-data` volume, then runs Redis and the notes board on port 80. Redis stays private to the network |

## Notes board environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port the app listens on inside the container |
| `REDIS_URL` | `redis://localhost:6379` | Redis address. On the Docker network this is `redis://notes-redis:6379` |
| `APP_ENV` | `development` | Shown in the header bar |
| `SITE_NAME` | `Northside General Hospital` | Header text |
| `BOARD_TITLE` | `Shift Handover Board` | Header text and page title |
| `DISPLAY_TIMEZONE` | `Australia/Sydney` | Time zone used to display note times |
| `WARDS` | `Ward 3, Ward 5, Emergency, Radiology, Theatre 2` | Comma separated ward list for the form |

## Endpoints

| App | Path | Returns |
|---|---|---|
| Flask | `/` | Host and container details |
| Flask | `/health` | JSON, always 200 while the app is up |
| Notes board | `/` | Board and form |
| Notes board | `/api/notes` | Latest 25 notes as JSON |
| Notes board | `/health` | JSON. 200 when Redis is reachable, 503 when it is not. Used by the Docker HEALTHCHECK |
