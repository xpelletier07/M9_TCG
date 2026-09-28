#!/usr/bin/env bash
#
# Reinitialise la base PostgreSQL de developpement.
# Le volume pgdata est supprime afin que db.sql soit rejoue au prochain demarrage.
# Toutes les donnees PostgreSQL locales seront perdues.
#
# Usage depuis la racine du depot:
#   chmod +x set-up/reset-database.sh
#   ./set-up/reset-database.sh
#   ./set-up/reset-database.sh --no-build

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
VOLUME_NAME="m9_tcg_pgdata"
BUILD=true

case "${1:-}" in
    "") ;;
    --no-build) BUILD=false ;;
    *)
        printf 'Option inconnue: %s\n' "$1" >&2
        printf 'Usage: %s [--no-build]\n' "$0" >&2
        exit 1
        ;;
esac

cd "$REPO_DIR"

DOCKER_CMD=(docker)
if ! docker info >/dev/null 2>&1; then
    if sudo docker info >/dev/null 2>&1; then
        DOCKER_CMD=(sudo docker)
    else
        printf "Le moteur Docker ne repond pas. Verifiez que Docker est demarre.\n" >&2
        exit 1
    fi
fi

printf 'Arret des conteneurs...\n'
"${DOCKER_CMD[@]}" compose down

if "${DOCKER_CMD[@]}" volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
    printf 'Suppression du volume PostgreSQL %s...\n' "$VOLUME_NAME"
    "${DOCKER_CMD[@]}" volume rm "$VOLUME_NAME"
else
    printf 'Le volume PostgreSQL n existe pas; il sera cree au prochain demarrage.\n'
fi

if [ "$BUILD" = true ]; then
    "${DOCKER_CMD[@]}" compose up --build
else
    "${DOCKER_CMD[@]}" compose up
fi
