#!/usr/bin/env bash
# Manual deployment of the current commit to Azure (works with the team account, no extra right needed).
# Use it until the GitHub pipeline is allowed to deploy (docs/CI-CD.md). Refuses an uncommitted tree; tags images with the commit.
set -euo pipefail
cd "$(dirname "$0")/.."
RG="${RG:-CASA-team-2}"; ACR="${ACR:-growmateacr2026}"; API="${API:-farm-final-api}"; WEB="${WEB:-farm-final-web}"
[ -z "$(git status --porcelain)" ] || { echo "Commit or stash your changes first." >&2; exit 1; }
SHA=$(git rev-parse --short HEAD)
API_FQDN=$(az containerapp show -g "$RG" -n "$API" --query properties.configuration.ingress.fqdn -o tsv)
echo "Building $SHA ..."
az acr build -r "$ACR" -t "$API:$SHA" ./backend --no-logs -o none
az acr build -r "$ACR" -t "$WEB:$SHA" --build-arg "NEXT_PUBLIC_API_URL=https://$API_FQDN" ./frontend --no-logs -o none
echo "Rolling out ..."
az containerapp update -g "$RG" -n "$API" --image "$ACR.azurecr.io/$API:$SHA" -o none
az containerapp update -g "$RG" -n "$WEB" --image "$ACR.azurecr.io/$WEB:$SHA" -o none
for APP in "$API" "$WEB"; do echo "$APP runs $(az containerapp show -g "$RG" -n "$APP" --query 'properties.template.containers[0].image' -o tsv)"; done
curl --fail --silent --retry 12 --retry-delay 10 --retry-all-errors "https://$API_FQDN/api/health"; echo
echo "Deployed $SHA. Hard-reload the web app (Ctrl+Shift+R) to bypass its offline copy."
