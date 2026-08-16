#!/usr/bin/env bash
# Démarre l'API et l'interface ensemble. Ctrl+C arrête les deux.
set -euo pipefail

cd "$(dirname "$0")/.."

npm --prefix backend run dev &
api=$!
npm --prefix frontend run dev &
web=$!

trap 'kill $api $web 2>/dev/null || true' INT TERM
echo ""
echo "API   → port 3001"
echo "Interface → port 5173  (onglet « Ports » pour l'ouvrir)"
echo ""
wait
