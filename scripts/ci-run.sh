#!/usr/bin/env bash
# Vérification complète, jouée par l'intégration continue.
# Tout passe par un journal unique, publié ensuite sur la branche ci-logs :
# c'est ce qui permet de diagnostiquer un échec sans accès aux logs GitHub.
set -uo pipefail

cd "$(dirname "$0")/.."

step() {
  echo ""
  echo "══════════════════════════════════════════════════════════════"
  echo "▶ $1"
  echo "══════════════════════════════════════════════════════════════"
}

fail() {
  echo ""
  echo "✗ ÉCHEC à l'étape : $1"
  exit 1
}

step "Versions"
node --version
npm --version

step "Installation des dépendances du backend"
npm --prefix backend install --no-audit --no-fund || fail "installation backend"

step "Installation des dépendances de l'interface"
npm --prefix frontend install --no-audit --no-fund || fail "installation interface"

step "Contrôle des types TypeScript"
npm --prefix frontend run typecheck || fail "types TypeScript"

step "Compilation de l'interface"
npm --prefix frontend run build || fail "compilation interface"

step "Création du schéma MySQL"
npm --prefix backend run migrate || fail "migrations"

step "Amorçage des données"
npm --prefix backend run seed || fail "amorçage"

step "Démarrage de l'API"
npm --prefix backend start > api.log 2>&1 &
api_pid=$!
ready=""
for _ in $(seq 1 40); do
  if curl -sf http://127.0.0.1:3001/api/health > /dev/null 2>&1; then
    ready="oui"
    break
  fi
  sleep 1
done
if [ -z "$ready" ]; then
  echo "--- journal du serveur ---"
  cat api.log
  fail "démarrage de l'API"
fi
echo "API démarrée."

step "Parcours métier de bout en bout"
node backend/scripts/smoke-test.js
result=$?

echo ""
echo "--- journal du serveur ---"
cat api.log
kill $api_pid 2>/dev/null || true

[ $result -eq 0 ] || fail "parcours métier"

echo ""
echo "✓ TOUT EST VERT"
