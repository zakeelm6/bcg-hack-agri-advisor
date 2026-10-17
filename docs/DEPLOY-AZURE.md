# Deploy Farm Advisor on Azure

A step-by-step guide, from nothing to a public HTTPS address. It uses two Azure Container Apps (the API and the web app), Azure Container Registry for the images, and the Azure AI Speech resource you already have for the voice. Read section 1 first: it lists what costs money and what must be decided before you start.

## 1. Read this before you start

**What costs money (rough, check the Azure price calculator for your region):**

| Resource | Why | Cost |
|---|---|---|
| Container Registry, Basic | stores the two images | about 5 USD a month |
| Container Apps environment | runs the two apps | pay for use; with 1 small replica each, a few USD a month |
| Azure AI Speech, F0 | voice | free tier (limited hours a month); you already have one in West Europe |
| PostgreSQL flexible server (optional, section 7) | a database that survives restarts | about 15 USD a month at the smallest size |
| Log Analytics (created with the environment) | logs | small, see the budget alert below |

**Decisions to make:**
1. **Is this a demo for a jury or a product for farmers?** The API has **no login** and one shared farmer. For a demo link that only you and the jury open, it is acceptable. For anything public, add a login or a device token first, otherwise every visitor edits the same field.
2. **Database.** The default SQLite file is fine for a demo if you accept that it resets when the app is redeployed or restarted (section 7 explains the two ways to keep data).
3. **Region.** Use the same region as your Speech resource (`westeurope`) to keep voice fast.

**Never put a key in git.** The Speech key goes into the Container App as a secret (section 6), not into a file of the repository.

## 2. Install and log in (once)

```bash
# Azure CLI (Debian, Ubuntu, Kali)
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
az login                      # opens the browser; pick your account
az account list -o table      # see your subscriptions
az account set --subscription "<name or id>"
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
```
Docker is only needed to test locally (section 3); the images are built in the cloud.

## 3. Test it on your machine first

```bash
cd finalproject
cp backend/.env.example backend/.env      # optional: add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION to test the voice
docker compose up --build
```
Open http://localhost:3000 (the app) and http://127.0.0.1:8000/api/health (should answer `{"ok":true}`). If this works locally, the cloud only changes addresses. Stop with `Ctrl+C`, then `docker compose down` (add `-v` to also erase the database volume).

## 4. Names and variables

Choose them once and reuse them. Names of the registry and the apps must be unique worldwide: add a suffix.

```bash
RG=farm-advisor-rg
LOC=westeurope
ACR=faradvisor$RANDOM          # lowercase letters and digits only; note the value, you need it later
ENVNAME=farm-advisor-env
API=farm-api
WEB=farm-web
```
Create the resource group and the registry:
```bash
az group create -n $RG -l $LOC
az acr create -g $RG -n $ACR --sku Basic --admin-enabled false
```

## 5. Build the images in Azure (no local Docker needed)

```bash
az acr build -r $ACR -t farm-api:1 ./backend
```
The web app needs the **public address of the API at build time** (the browser calls it directly), so create the API first, read its address, then build the web image.

### 5a. The environment and the API
```bash
az containerapp env create -n $ENVNAME -g $RG -l $LOC

az containerapp create -n $API -g $RG --environment $ENVNAME \
  --image $ACR.azurecr.io/farm-api:1 \
  --registry-server $ACR.azurecr.io --registry-identity system \
  --ingress external --target-port 8000 \
  --min-replicas 1 --max-replicas 1 \
  --cpu 0.5 --memory 1.0Gi
```
`--min-replicas 1` keeps the API warm: a cold start in the middle of a voice question feels broken. `--max-replicas 1` is required while the rate limits and the SQLite file live inside one process.

If `--registry-identity system` is refused on your CLI version, grant the pull right by hand:
```bash
az containerapp identity assign -n $API -g $RG --system-assigned
PRINCIPAL=$(az containerapp show -n $API -g $RG --query identity.principalId -o tsv)
az role assignment create --assignee $PRINCIPAL --role AcrPull --scope $(az acr show -n $ACR --query id -o tsv)
az containerapp registry set -n $API -g $RG --server $ACR.azurecr.io --identity system
```
Read the address:
```bash
API_FQDN=$(az containerapp show -n $API -g $RG --query properties.configuration.ingress.fqdn -o tsv)
echo https://$API_FQDN/api/health
```

### 5b. The web app
```bash
az acr build -r $ACR -t farm-web:1 --build-arg NEXT_PUBLIC_API_URL=https://$API_FQDN ./frontend

az containerapp create -n $WEB -g $RG --environment $ENVNAME \
  --image $ACR.azurecr.io/farm-web:1 \
  --registry-server $ACR.azurecr.io --registry-identity system \
  --ingress external --target-port 3000 \
  --min-replicas 1 --max-replicas 2 --cpu 0.5 --memory 1.0Gi
WEB_FQDN=$(az containerapp show -n $WEB -g $RG --query properties.configuration.ingress.fqdn -o tsv)
echo https://$WEB_FQDN
```
(The same `--registry-identity` fallback as above applies to `$WEB`.)

## 6. Configuration and secrets

The API must accept calls from the web address, and it needs the voice key. Secrets are stored in the Container App, never in git.

```bash
az containerapp secret set -n $API -g $RG --secrets speech-key=<YOUR_AZURE_SPEECH_KEY>
az containerapp update -n $API -g $RG --set-env-vars \
  FA_CORS_ORIGINS=https://$WEB_FQDN \
  AZURE_SPEECH_KEY=secretref:speech-key \
  AZURE_SPEECH_REGION=westeurope
```
Where to find the key: Azure portal, your Speech resource, "Keys and Endpoint". Optional model key for the Copilot (otherwise the rule engine words every answer): add `ANTHROPIC_API_KEY` (or the `FA_LLM_*` variables of `backend/.env.example`) the same way, as a secret.

The browser asks for the microphone only on HTTPS: Container Apps gives you HTTPS by default.

## 7. Keep the data (choose one)

- **Demo, simplest:** do nothing. The SQLite file is inside the container and is recreated with demo data when the app restarts. Say so in the demo.
- **Azure Files share (keeps the SQLite file):** create a storage account and a file share, add it to the environment (`az containerapp env storage set`) and mount it at `/data` in the API (a volume mount in the app YAML). Keep one replica.
- **PostgreSQL (the real answer):** create an Azure Database for PostgreSQL flexible server (Burstable B1ms), add `psycopg[binary]` to `backend/requirements.txt`, rebuild the API image, and set the secret `FA_DATABASE_URL=postgresql+psycopg://user:password@host:5432/farmadvisor`. The migrations run when the API starts. They were only tested on SQLite: test them on a throwaway database first.

## 8. Check it works from a phone

1. `https://$API_FQDN/api/health` answers `{"ok":true}`.
2. `https://$API_FQDN/api/speech/status` answers `"available": true`.
3. Open `https://$WEB_FQDN` on a phone: onboarding, the "Do this now" card, a task marked done.
4. Press the microphone, speak in Arabic or Darija: the Azure voice answers.
5. Switch on airplane mode after loading once: the app still opens (service worker).

Logs when something is wrong:
```bash
az containerapp logs show -n $API -g $RG --follow
az containerapp logs show -n $WEB -g $RG --follow
```
Typical problems: a CORS error in the browser console (the `FA_CORS_ORIGINS` value does not match the web address exactly, with `https://` and no trailing slash); the web app calls `127.0.0.1` (the image was built without `--build-arg NEXT_PUBLIC_API_URL`, rebuild it); voice says "not available" (secret or region wrong).

## 9. Update after a code change

```bash
az acr build -r $ACR -t farm-api:2 ./backend
az containerapp update -n $API -g $RG --image $ACR.azurecr.io/farm-api:2
az acr build -r $ACR -t farm-web:2 --build-arg NEXT_PUBLIC_API_URL=https://$API_FQDN ./frontend
az containerapp update -n $WEB -g $RG --image $ACR.azurecr.io/farm-web:2
```
Use a new tag every time (`:2`, `:3`...), so Azure really pulls the new image.

## 10. Protect your wallet and your data

- **Budget alert:** portal, Cost Management, Budgets, create a monthly budget (for example 20 USD) with an e-mail alert at 80 percent.
- **The Speech and Copilot routes cost money per call.** The API already limits them (30 Copilot and 60 voice calls a minute for the whole server). Lower them with `FA_COPILOT_CALLS_PER_MINUTE` and `FA_VOICE_CALLS_PER_MINUTE` if the link is shared widely.
- **No login:** until there is one, share the link only with people you trust, or restrict it (Container Apps ingress `--ip-restrictions`, or put Azure Front Door with access rules in front).
- **Rotate the Speech key** if it ever appears in a screenshot, a log or a chat: portal, Speech resource, Keys, "Regenerate", then update the secret.

## 11. Remove everything when you are done

One command deletes the apps, the registry, the environment and the logs, and stops all charges:
```bash
az group delete -n $RG --yes --no-wait
```
Your Speech resource is not touched if it lives in another resource group.

## 12. Automatic deployment from GitHub (optional, later)

After the repository is on GitHub (see [GITHUB.md](GITHUB.md)): create a service principal restricted to the resource group (`az ad sp create-for-rbac --role Contributor --scopes /subscriptions/<id>/resourceGroups/$RG --json-auth`), store its JSON as the GitHub secret `AZURE_CREDENTIALS`, and add a workflow that, on a push to `main`, runs the tests, then `az acr build` and `az containerapp update` as in section 9. Prefer OIDC (`azure/login` with a federated credential) so that no secret is stored at all.
