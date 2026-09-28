#Requires -Version 5.1
<##
.SYNOPSIS
    Reinitialise la base PostgreSQL de developpement.

.DESCRIPTION
    Supprime le volume pgdata afin que db.sql soit rejoue au prochain demarrage.
    Toutes les donnees PostgreSQL locales seront perdues.

.USAGE
    powershell -ExecutionPolicy Bypass -File set-up/reset-database.ps1
    powershell -ExecutionPolicy Bypass -File set-up/reset-database.ps1 -NoBuild
#>

param(
    [switch]$NoBuild
)

$ErrorActionPreference = "Stop"

Write-Host "Arret des conteneurs..."
docker compose down
if ($LASTEXITCODE -ne 0) {
    throw "Impossible d'arreter Docker Compose."
}

$volumeName = "m9_tcg_pgdata"
$volumeExists = docker volume ls --quiet --filter "name=^$volumeName$"
if ($volumeExists) {
    Write-Host "Suppression du volume PostgreSQL $volumeName..."
    docker volume rm $volumeName
    if ($LASTEXITCODE -ne 0) {
        throw "Impossible de supprimer le volume PostgreSQL."
    }
} else {
    Write-Host "Le volume PostgreSQL n'existe pas; il sera cree au prochain demarrage."
}

if ($NoBuild) {
    docker compose up
} else {
    docker compose up --build
}