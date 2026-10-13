#!/bin/sh
# Production entrypoint (Docker / Railway).
# - Stores the SQLite database on the persistent volume (Railway sets RAILWAY_VOLUME_MOUNT_PATH).
# - Applies pending migrations, then starts Next.js on $PORT.
set -e

if [ -z "$DATABASE_URL" ]; then
  DATA_DIR="${RAILWAY_VOLUME_MOUNT_PATH:-/data}"
  mkdir -p "$DATA_DIR"
  export DATABASE_URL="file:${DATA_DIR}/nexus.db"
fi

if [ -z "$NEXUS_PASSWORD" ]; then
  echo "WARNING: NEXUS_PASSWORD is not set. Anyone who can reach this server can read and change all data." >&2
fi

if [ -z "$RAILWAY_VOLUME_MOUNT_PATH" ] && [ -n "$RAILWAY_ENVIRONMENT" ]; then
  echo "WARNING: no Railway volume is attached. Data will be lost on every redeploy. Attach a volume mounted at /data." >&2
fi

echo "Using database ${DATABASE_URL}"
npx prisma migrate deploy
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
