# Azure deployment

The shared hackathon resource group already contains the container registry, Container Apps environment and
`frontend` Container App. This repository therefore manages only the application image; it does not attempt to take
ownership of teammates' shared resources. Terraform is unnecessary here.

## Manual deployment

Set the existing resource names in your shell, then run the checked-in deployment script:

```bash
export AZURE_RESOURCE_GROUP=...
export AZURE_ACR_NAME=...
export AZURE_CONTAINER_APP_NAME=...
./scripts/deploy-azure.sh
```

The script refuses uncommitted changes, builds an immutable commit-tagged image in ACR, updates the existing
Container App and verifies `/api/health`.

## Continuous deployment status

`.github/workflows/ci.yml` runs all build, map, sensor, satellite and dependency-vulnerability checks. Azure
deployment remains manual because Container Apps does not expose an App Service-style publish profile or deployment
token.

GitHub CD can only be enabled when an Azure administrator approves the two narrow role assignments represented by
`github-oidc.bicep`:

```bash
az deployment group create \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --template-file infra/github-oidc.bicep \
  --parameters \
    repository=OWNER/REPOSITORY \
    acrName="$AZURE_ACR_NAME" \
    appName="$AZURE_CONTAINER_APP_NAME"
```
