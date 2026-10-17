#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

: "${AZURE_RESOURCE_GROUP:?Set AZURE_RESOURCE_GROUP}"
: "${AZURE_ACR_NAME:?Set AZURE_ACR_NAME}"
: "${AZURE_CONTAINER_APP_NAME:?Set AZURE_CONTAINER_APP_NAME}"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Refusing to deploy an uncommitted working tree." >&2
  exit 1
fi

IMAGE_TAG="$(git rev-parse HEAD)"
if [[ ! "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Could not resolve an immutable Git commit tag." >&2
  exit 1
fi

az account show --output none
az acr build \
  --registry "$AZURE_ACR_NAME" \
  --image "frontend:$IMAGE_TAG" \
  frontend \
  --output none

LOGIN_SERVER="$(az acr show --name "$AZURE_ACR_NAME" --query loginServer --output tsv)"
if [[ ! "$LOGIN_SERVER" =~ ^[a-z0-9-]+\.azurecr\.io$ ]]; then
  echo "Azure returned an unexpected registry host." >&2
  exit 1
fi

az containerapp update \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$AZURE_CONTAINER_APP_NAME" \
  --image "$LOGIN_SERVER/frontend:$IMAGE_TAG" \
  --output none

FQDN="$(az containerapp show \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$AZURE_CONTAINER_APP_NAME" \
  --query properties.configuration.ingress.fqdn \
  --output tsv)"
if [[ ! "$FQDN" =~ ^[a-z0-9.-]+\.azurecontainerapps\.io$ ]]; then
  echo "Azure returned an unexpected application host." >&2
  exit 1
fi

curl --fail --silent --show-error --retry 12 --retry-delay 10 \
  "https://$FQDN/api/health" >/dev/null
echo "Deployment completed and passed its health check."
