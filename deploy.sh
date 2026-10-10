#!/usr/bin/env bash
#
# Déploiement de l'outil Achats filiales, sur le VPS, sous l'utilisateur
# « achats ». Le serveur héberge aussi le CRM HM Group et l'outil compta : ce
# script ne nomme jamais que ses propres ressources, et refuse de tourner
# ailleurs que là où il doit.
#
#   cd /home/achats/app && ./deploy.sh
#
set -euo pipefail

UTILISATEUR_ATTENDU="achats"
DOSSIER="/home/achats/app"
BRANCHE="refactor/node-mysql"
PROCESS_PM2="achats-filiales"
PORT="${PORT:-3001}"

etape() {
  echo ""
  echo "▶ $1"
}

refus() {
  echo "✗ $1" >&2
  exit 1
}

# --- Garde-fous ------------------------------------------------------------
# Tourner en root écrirait des fichiers que l'application ne pourra plus lire ;
# tourner sous « ubuntu » toucherait au PM2 du CRM.
[ "$(id -un)" = "$UTILISATEUR_ATTENDU" ] \
  || refus "À lancer sous l'utilisateur « $UTILISATEUR_ATTENDU », pas « $(id -un) »."
[ "$(id -u)" -ne 0 ] || refus "Ne jamais lancer ce script en root."
[ "$PWD" = "$DOSSIER" ] || refus "À lancer depuis $DOSSIER."

# Ce drapeau produit l'aperçu public : l'authentification y est court-circuitée
# et le visiteur est connecté d'office en administrateur. Il n'a rien à faire
# dans un build de production.
[ -z "${VITE_DEMO:-}" ] \
  || refus "VITE_DEMO est défini ($VITE_DEMO) : ce build servirait la démonstration."

[ -f backend/.env ] || refus "backend/.env est absent."

etape "Code à jour depuis GitHub"
git fetch --quiet origin "$BRANCHE"
git checkout --quiet "$BRANCHE"
git reset --hard --quiet "origin/$BRANCHE"
echo "  $(git log --oneline -1)"

etape "Dépendances"
npm --prefix backend install --omit=dev --no-audit --no-fund
npm --prefix frontend install --no-audit --no-fund

etape "Compilation de l'interface"
# VITE_DEMO explicitement vide, en plus du garde-fou ci-dessus : le drapeau ne
# peut pas se glisser dans le build par un environnement hérité.
#
# On ne cherche pas de marqueur de démonstration dans le bundle : les chaînes
# du mode démo peuvent survivre à un build de production selon ce que
# l'optimiseur élimine, et un contrôle qui refuse à tort un build sain est
# pire que pas de contrôle. La vérification qui compte est fonctionnelle :
# l'application doit demander un mot de passe.
VITE_DEMO= npm --prefix frontend run build
[ -f frontend/dist/index.html ] || refus "frontend/dist/index.html n'a pas été produit."
echo "  interface compilée dans frontend/dist"

etape "Rechargement de $PROCESS_PM2"
# Les migrations s'appliquent au démarrage du serveur (AUTO_MIGRATE).
if pm2 describe "$PROCESS_PM2" > /dev/null 2>&1; then
  pm2 reload "$PROCESS_PM2" --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

etape "Contrôle de santé"
for essai in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" > /dev/null 2>&1; then
    echo "  l'API répond sur 127.0.0.1:$PORT"
    echo ""
    echo "✓ DÉPLOYÉ — $(git log --oneline -1)"
    exit 0
  fi
  sleep 1
done

echo ""
echo "✗ L'API ne répond pas après 15 secondes. Dernières lignes du journal :" >&2
pm2 logs "$PROCESS_PM2" --lines 25 --nostream >&2 || true
exit 1
