#!/usr/bin/env bash
#
# Builds the production images here and hands them to the Raspberry Pi, which only
# has to load and start them. Building on the Pi itself takes about ninety minutes;
# this takes a couple of minutes plus the transfer.
#
#   ./scripts/deploy.sh pi@192.168.0.201
#   PIXOO_HOST=pixoo.local ./scripts/deploy.sh pi@192.168.0.201
#
# The target needs Docker and nothing else — no source, no Node, no toolchain.
set -euo pipefail

TARGET=${1:-}
REMOTE_DIR=${2:-pixoo-controller}

if [[ -z $TARGET ]]; then
  echo "usage: $0 <user@host> [remote-dir]" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

# The address the browser will use. Defaults to the host being deployed to, which
# is right unless the Pi is reached under a different name than over SSH.
PIXOO_HOST=${PIXOO_HOST:-${TARGET#*@}}
API_PORT=${API_PORT:-3001}
PLATFORM=linux/arm64

echo "==> Building for $PLATFORM (frontend will call http://$PIXOO_HOST:$API_PORT/api)"
docker build --platform "$PLATFORM" --target production -t pixoo-api:prod ./apps/api
docker build --platform "$PLATFORM" --target production -t pixoo-web:prod \
  --build-arg "NEXT_PUBLIC_API_URL=http://$PIXOO_HOST:$API_PORT/api" ./apps/web

echo "==> Sending the compose file"
ssh "$TARGET" "mkdir -p '$REMOTE_DIR'"
scp -q docker-compose.deploy.yml "$TARGET:$REMOTE_DIR/docker-compose.yml"

# .env holds the database password and is not overwritten once it exists.
if ssh "$TARGET" "test -f '$REMOTE_DIR/.env'"; then
  echo "    .env already present, left alone"
else
  scp -q .env.example "$TARGET:$REMOTE_DIR/.env"
  echo "    .env created from .env.example — review it before this goes anywhere real"
fi

# Streamed rather than written to a file, so nothing large lands on either disk.
echo "==> Transferring images (a few hundred MB, compressed)"
docker save pixoo-api:prod pixoo-web:prod | gzip -1 | ssh "$TARGET" "gunzip | docker load"

echo "==> Starting"
ssh "$TARGET" "cd '$REMOTE_DIR' && PIXOO_HOST='$PIXOO_HOST' docker compose up -d"

echo "==> Applying migrations"
ssh "$TARGET" "cd '$REMOTE_DIR' && docker compose exec -T api npm run migration:run:prod"

echo
echo "Done. http://$PIXOO_HOST:${WEB_PORT:-3000}"
