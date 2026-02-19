#!/usr/bin/env bash
set -euo pipefail

SCRIPT=${1:-start}

if [[ "${TRANSITIVE_IS_ROBOT:-0}" == "1" ]]; then
  exec npm --prefix robot run "$SCRIPT"
fi

if [[ "${TRANSITIVE_IS_CLOUD:-0}" == "1" ]]; then
  exec npm --prefix cloud run "$SCRIPT"
fi

# local dev fallback
if [[ "$SCRIPT" == "cloud" ]]; then
  exec npm --prefix cloud run start
fi

exec npm --prefix robot run start
