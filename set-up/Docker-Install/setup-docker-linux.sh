#!/usr/bin/env bash
#
# Full Docker bootstrap for M9_TCG on Linux.
# Safe to re-run: detects an existing Docker Engine + Compose plugin and skips install.
#
# What it does:
#   1. Detects the distro family (apt / dnf-yum) from /etc/os-release.
#   2. Installs Docker Engine + Compose plugin from Docker's official repo if missing.
#   3. Adds the current user to the 'docker' group.
#   4. Enables and starts the docker service.
#   5. Clones M9_TCG if you're not already inside it.
#   6. Creates .env files from .env.example if missing.
#   7. Builds and starts the stack with docker compose.
#
# Usage:
#   chmod +x setup-docker-linux.sh
#   ./setup-docker-linux.sh

set -euo pipefail

REPO_URL="https://github.com/xpelletier07/M9_TCG.git"
REPO_DIR_NAME="M9_TCG"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

step()  { printf "\n\033[1;36m==> %s\033[0m\n" "$1"; }
ok()    { printf "    \033[1;32m[OK]\033[0m %s\n" "$1"; }
warn()  { printf "    \033[1;33m[!!]\033[0m %s\n" "$1"; }
err()   { printf "    \033[1;31m[XX]\033[0m %s\n" "$1"; }

# ---------------------------------------------------------------------------
# 0. sudo check
# ---------------------------------------------------------------------------
if ! command -v sudo >/dev/null 2>&1; then
    err "sudo est introuvable. Installe-le ou lance ce script en root en adaptant les commandes."
    exit 1
fi

# ---------------------------------------------------------------------------
# 1. Docker already installed?
# ---------------------------------------------------------------------------
step "Verification de Docker"

docker_present=false
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    docker_present=true
    ok "Docker + Compose plugin deja installes - installation ignoree"
fi

# ---------------------------------------------------------------------------
# 2. Install Docker Engine + Compose plugin if missing
# ---------------------------------------------------------------------------
if [ "$docker_present" = false ]; then
    step "Installation de Docker"

    if [ ! -f /etc/os-release ]; then
        err "/etc/os-release introuvable - distribution non reconnue."
        exit 1
    fi
    . /etc/os-release
    distro_id="${ID:-unknown}"
    distro_like="${ID_LIKE:-}"

    if [[ "$distro_id" =~ ^(ubuntu|debian)$ ]] || [[ "$distro_like" =~ (debian|ubuntu) ]]; then
        warn "Distribution basee sur Debian/Ubuntu detectee ($distro_id) - installation via apt"

        sudo apt-get update
        sudo apt-get install -y ca-certificates curl gnupg

        sudo install -m 0755 -d /etc/apt/keyrings
                repo_id="debian"
                if [ "$distro_id" = "ubuntu" ] || [[ "$distro_like" == *ubuntu* ]]; then
                    repo_id="ubuntu"
                fi
                curl -fsSL "https://download.docker.com/linux/${repo_id}/gpg" | \
            sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        sudo chmod a+r /etc/apt/keyrings/docker.gpg

        arch="$(dpkg --print-architecture)"
                codename="${VERSION_CODENAME:-}"
                [ "$repo_id" = "ubuntu" ] && codename="${UBUNTU_CODENAME:-$codename}"
                if [ -z "$codename" ]; then
                        codename="$(lsb_release -cs 2>/dev/null || true)"
                fi
                if [ -z "$codename" ]; then
                        err "Impossible de determiner le codename de la distribution."
                        exit 1
                fi
        echo \
                    "deb [arch=${arch} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${repo_id} ${codename} stable" | \
          sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

        sudo apt-get update
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    elif [[ "$distro_id" =~ ^(fedora)$ ]]; then
        warn "Fedora detecte - installation via dnf"
        sudo dnf -y install dnf-plugins-core
        sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
        sudo dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    elif [[ "$distro_id" =~ ^(rhel|centos|rocky|almalinux)$ ]] || [[ "$distro_like" =~ (rhel|fedora) ]]; then
        warn "Distribution basee sur RHEL/CentOS detectee ($distro_id) - installation via dnf/yum"
        pkgmgr="dnf"
        command -v dnf >/dev/null 2>&1 || pkgmgr="yum"
        sudo "$pkgmgr" -y install ${pkgmgr}-plugins-core 2>/dev/null || true
        sudo "$pkgmgr" config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo 2>/dev/null || \
            sudo yum-config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
        sudo "$pkgmgr" -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    else
        err "Distribution '$distro_id' non prise en charge automatiquement par ce script."
        err "Installe Docker Engine + le plugin Compose manuellement: https://docs.docker.com/engine/install/"
        exit 1
    fi

    ok "Docker Engine + Compose plugin installes"
fi

# ---------------------------------------------------------------------------
# 3. docker group
# ---------------------------------------------------------------------------
step "Verification du groupe 'docker'"
if ! getent group docker >/dev/null 2>&1; then
    sudo groupadd docker
fi
if ! id -nG "$USER" | grep -qw docker; then
    sudo usermod -aG docker "$USER"
    warn "Ajoute au groupe 'docker'. Deconnecte-toi/reconnecte-toi (ou lance 'newgrp docker') pour que ca prenne effet sans sudo."
    NEED_NEWGRP=true
else
    ok "Deja membre du groupe 'docker'"
    NEED_NEWGRP=false
fi

# ---------------------------------------------------------------------------
# 4. Enable & start the docker service
# ---------------------------------------------------------------------------
step "Activation du service Docker"
if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl enable --now docker
    ok "Service docker actif et active au demarrage"
else
    warn "systemctl introuvable - demarre le daemon Docker manuellement selon ta distribution."
fi

# ---------------------------------------------------------------------------
# 5. Verify the engine responds
# ---------------------------------------------------------------------------
step "Verification du moteur Docker"
DOCKER_CMD=(docker)
if [ "${NEED_NEWGRP:-false}" = true ]; then
    DOCKER_CMD=(sudo docker)
fi
if "${DOCKER_CMD[@]}" info >/dev/null 2>&1; then
    ok "Moteur Docker repond"
else
    err "Le moteur Docker ne repond pas. Verifie 'sudo systemctl status docker' pour le detail."
    exit 1
fi

# ---------------------------------------------------------------------------
# 6. Get the repo
# ---------------------------------------------------------------------------
step "Verification du depot M9_TCG"
if [ -d ".git" ]; then
    ok "Deja a la racine du depot"
elif [ -d "$SCRIPT_DIR/../.." ] && [ -d "$SCRIPT_DIR/../../.git" ]; then
    cd "$SCRIPT_DIR/../.."
    ok "Deja a la racine du depot"
else
    if [ -d "$REPO_DIR_NAME" ]; then
        ok "Dossier $REPO_DIR_NAME deja present, on y entre"
        cd "$REPO_DIR_NAME"
    else
        echo "    Clonage de $REPO_URL ..."
        git clone "$REPO_URL"
        cd "$REPO_DIR_NAME"
    fi
fi

# ---------------------------------------------------------------------------
# 7. .env files
# ---------------------------------------------------------------------------
step "Verification des fichiers .env"
while IFS= read -r -d '' example; do
    target="${example%.example}"
    if [ ! -f "$target" ]; then
        cp "$example" "$target"
        ok "Cree: $target"
    else
        ok "Deja present: $target"
    fi
done < <(find . -name ".env.example" -print0)

# ---------------------------------------------------------------------------
# 8. Build & start the stack
# ---------------------------------------------------------------------------
step "Build et lancement des containers (client, server, db)"
"${DOCKER_CMD[@]}" compose build
"${DOCKER_CMD[@]}" compose up -d --force-recreate --renew-anon-volumes

echo ""
ok "Termine. Verifie l'etat avec: ${DOCKER_CMD[*]} compose ps"
ok "Logs en direct: ${DOCKER_CMD[*]} compose logs -f"
if [ "${NEED_NEWGRP:-false}" = true ]; then
    warn "Rappel: deconnecte-toi/reconnecte-toi (ou 'newgrp docker') pour utiliser 'docker' sans sudo la prochaine fois."
fi
