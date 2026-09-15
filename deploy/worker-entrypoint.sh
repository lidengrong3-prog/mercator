#!/bin/sh
set -eu

mkdir -p /app/data
if [ ! -f /app/data/market_scope.json ]; then
  cp -a /opt/mercator-data-seed/. /app/data/
fi

# A replacement instance must restore the complete private state before it can
# advertise a heartbeat or claim work. The persistent volume marker makes
# ordinary restarts fast and avoids repeatedly downloading the same artifacts.
python3 /app/scripts/bootstrap_worker_data.py --required

exec "$@"
