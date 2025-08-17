#!/bin/sh
# Normalize line endings and make executable (no failure if dos2unix missing)
if command -v dos2unix >/dev/null 2>&1; then
  dos2unix /app/mvnw || true
fi
chmod +x /app/mvnw || true

# exec the CMD from Dockerfile / compose
exec "$@"