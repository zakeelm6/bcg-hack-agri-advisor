#!/usr/bin/env bash
# Step 1 of the CD setup (you, once): create the GitHub environment "production" and its variables.
# Needs the GitHub CLI logged in as a repository admin:  gh auth login
set -euo pipefail
REPO="${REPO:-zakeelm6/bcg-hack-agri-advisor}"
gh api -X PUT "repos/$REPO/environments/production" --silent
declare -A V=(
  [AZURE_CLIENT_ID]=9bb23084-150f-4333-b839-874a4f40663b
  [AZURE_TENANT_ID]=cdd2c4c3-eab5-47da-9e28-dde56d3af48e
  [AZURE_SUBSCRIPTION_ID]=7a66b76e-5d8d-4dce-ab21-0602f1e8be2a
  [AZURE_RESOURCE_GROUP]=CASA-team-2
  [AZURE_ACR_NAME]=growmateacr2026
  [AZURE_API_APP]=farm-final-api
  [AZURE_WEB_APP]=farm-final-web
  [AZURE_API_FQDN]=farm-final-api.yellowsmoke-0cdf2834.germanywestcentral.azurecontainerapps.io
  [AZURE_WEB_FQDN]=farm-final-web.yellowsmoke-0cdf2834.germanywestcentral.azurecontainerapps.io
)
for k in "${!V[@]}"; do gh variable set "$k" --repo "$REPO" --env production --body "${V[$k]}"; echo "set $k"; done
echo "Done. Now an Azure owner must run scripts/azure-grant.sh (step 2), then push or 'Run workflow'."
