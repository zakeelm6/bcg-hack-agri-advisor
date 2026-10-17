#!/usr/bin/env bash
# Step 2 of the CD setup (an Azure OWNER of the subscription, once): give the GitHub identity its three narrow rights.
# Owners on 17 Oct 2026: Andres Badilla, Gustavo Iglesias, Karsten Bruhns (BCG). The team account cannot assign roles.
set -euo pipefail
RG="${RG:-CASA-team-2}"
az deployment group create -g "$RG" --template-file "$(dirname "$0")/../infra/github-oidc.bicep" \
  --parameters acrName=growmateacr2026 apiApp=farm-final-api webApp=farm-final-web -o table
echo "Granted: AcrPush on growmateacr2026, Container Apps Contributor on farm-final-api and farm-final-web, to growmate-github."
