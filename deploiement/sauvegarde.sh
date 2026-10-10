#!/usr/bin/env bash
#
# Sauvegarde quotidienne de la base de l'outil Achats, et d'elle seule.
# À installer dans /home/achats/sauvegarde.sh, lancé par le cron de
# l'utilisateur « achats ».
#
# Les identifiants viennent de /home/achats/.my.cnf (chmod 600) :
#
#   [mysqldump]
#   user=achats_hmgroup
#   password=…
#
set -euo pipefail

BASE="achats_hmgroup"
DOSSIER="/home/achats/sauvegardes"
RETENTION_JOURS=14
IDENTIFIANTS="/home/achats/.my.cnf"

[ -f "$IDENTIFIANTS" ] || { echo "✗ $IDENTIFIANTS est absent." >&2; exit 1; }
mkdir -p "$DOSSIER"

fichier="$DOSSIER/$BASE-$(date +%Y-%m-%d_%H%M).sql.gz"

# --single-transaction : pas de verrou sur les tables, le service continue de
# répondre pendant le dump.
mysqldump --defaults-extra-file="$IDENTIFIANTS" \
  --single-transaction --quick --routines --events \
  "$BASE" | gzip -9 > "$fichier"

# Un dump vide est un échec silencieux : on le refuse plutôt que de le garder.
if [ ! -s "$fichier" ] || [ "$(stat -c %s "$fichier")" -lt 1024 ]; then
  rm -f "$fichier"
  echo "✗ Dump vide ou tronqué : rien n'a été conservé." >&2
  exit 1
fi

find "$DOSSIER" -name "$BASE-*.sql.gz" -type f -mtime "+$RETENTION_JOURS" -delete

echo "✓ $(basename "$fichier") — $(du -h "$fichier" | cut -f1)"
