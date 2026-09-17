#!/usr/bin/env bash
#
# Toggle script for M9_TCG (Linux).
#   - Aucun container existant       -> build + up (creation)
#   - Containers existants, arretes  -> start (ouverture)
#   - Containers existants, en cours -> stop  (fermeture)
#
# Usage:
#   chmod +x docker-toggle-linux.sh
#   ./docker-toggle-linux.sh

set -euo pipefail

REPO_DIR_NAME="M9_TCG"

step()  { printf "\n\033[1;36m==> %s\033[0m\n" "$1"; }
ok()    { printf "    \033[1;32m[OK]\033[0m %s\n" "$1"; }
warn()  { printf "    \033[1;33m[!!]\033[0m %s\n" "$1"; }
err()   { printf "    \033[1;31m[XX]\033[0m %s\n" "$1"; }

# ---------------------------------------------------------------------------
# 0. Se positionner a la racine du depot
# ---------------------------------------------------------------------------
if [ ! -d ".git" ]; then
    if [ -d "$REPO_DIR_NAME" ]; then
        cd "$REPO_DIR_NAME"
    else
        err "Pas dans le depot et dossier '$REPO_DIR_NAME' introuvable ici."
        err "Lance ce script depuis la racine du repo, ou a cote du dossier $REPO_DIR_NAME."
        exit 1
    fi
fi

# ---------------------------------------------------------------------------
# 1. Determiner comment appeler docker (avec ou sans sudo)
# ---------------------------------------------------------------------------
DOCKER_CMD="docker"
if ! docker info >/dev/null 2>&1; then
    if sudo docker info >/dev/null 2>&1; then
        DOCKER_CMD="sudo docker"
    else
        err "Le moteur Docker ne repond pas. Verifie 'sudo systemctl status docker'."
        exit 1
    fi
fi
ok "Moteur Docker actif"

# ---------------------------------------------------------------------------
# 2. Etat actuel de la stack
# ---------------------------------------------------------------------------
total_count=$($DOCKER_CMD compose ps -a -q | grep -c . || true)
running_count=$($DOCKER_CMD compose ps -q | grep -c . || true)

# ---------------------------------------------------------------------------
# 3. Action selon l'etat
# ---------------------------------------------------------------------------
if [ "$total_count" -eq 0 ]; then
    step "Aucun container trouve - creation et lancement de la stack"
    $DOCKER_CMD compose up -d --build
    ok "Stack creee et demarree"
elif [ "$running_count" -eq 0 ]; then
    step "Containers presents mais arretes - ouverture"
    $DOCKER_CMD compose start
    ok "Stack demarree"
else
    step "Containers en cours d'execution - fermeture"
    $DOCKER_CMD compose stop
    ok "Stack arretee"
fi

echo ""
$DOCKER_CMD compose ps
