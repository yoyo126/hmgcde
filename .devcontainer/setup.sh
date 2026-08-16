#!/usr/bin/env bash
# Prépare l'environnement de test : dépendances, base de données, compte
# administrateur. Lancé automatiquement à la création du Codespace.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "→ Installation des dépendances…"
npm --prefix backend install --no-audit --no-fund
npm --prefix frontend install --no-audit --no-fund

if [ ! -f backend/.env ]; then
  echo "→ Configuration (backend/.env)…"
  cat > backend/.env <<'ENV'
NODE_ENV=development
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=hmgcde-dev
DB_NAME=hmgcde
SESSION_SECRET=codespace-dev-secret
SEED_ADMIN_EMAIL=admin@hmgroup.fr
SEED_ADMIN_PASSWORD=achats-hm-2026
ENV
fi

echo "→ Attente de MySQL…"
for _ in $(seq 1 60); do
  if node -e "require('/workspaces/hmgcde/backend/node_modules/mysql2/promise').createConnection({host:'127.0.0.1',user:'root',password:'hmgcde-dev'}).then(c=>c.end()).catch(()=>process.exit(1))" 2>/dev/null; then
    break
  fi
  sleep 2
done

echo "→ Création du schéma et des données de départ…"
npm --prefix backend run setup

cat <<'MESSAGE'

──────────────────────────────────────────────────────────────
  Environnement prêt.

  Pour démarrer l'application :      bash .devcontainer/start.sh
  Puis ouvrez le port 5173 (onglet « Ports »).

  Connexion :  admin@hmgroup.fr
  Mot de passe : achats-hm-2026
  (mot de passe de test, valable uniquement dans ce Codespace)
──────────────────────────────────────────────────────────────

MESSAGE
