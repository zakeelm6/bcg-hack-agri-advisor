# From GitHub to Azure: push, and the site changes

How the pipeline works, what is already in place, the few things an Azure administrator must approve once, and how to check that a push really changed what the farmer sees.

## 1. What happens when you push

```
git push  ->  GitHub Actions "deploy"
                1. test        backend tests, API contract, frontend type check, Darija check, build        (stops here if red)
                2. deploy      environment "production"
                               - logs in to Azure with a short-lived OIDC token (no password stored anywhere)
                               - builds the API image and the web image, tags them with the commit id, pushes them to the registry
                               - updates the two Container Apps to those images (API first, then web)
                               - checks that Azure runs exactly this commit, then calls /api/health and the web page
              -> https://farm-final-web.yellowsmoke-0cdf2834.germanywestcentral.azurecontainerapps.io shows the new version
```
The file is [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml). It runs on every push to `final-project` or `main` (except pushes that only change documentation) and by hand from the Actions tab ("Run workflow").
Each image is tagged with the commit id (`farm-final-web:<commit>`), so Azure always tells you which code runs, and going back is one command (section 6).

## 2. Why no password is stored

GitHub gives each deploy job a one-time identity token. Azure trusts it only if it comes from this repository **and** this GitHub environment (`production`). This was prepared in the resource group `CASA-team-2`: the identity `growmate-github` has a federated credential `github-production` for `repo:zakeelm6/bcg-hack-agri-advisor:environment:production` (checked). That is why the job declares `environment: production` and why the repository must be `zakeelm6/bcg-hack-agri-advisor`: pushed anywhere else, Azure refuses the login.

## 3. What is in place and what is missing (state on 17 October 2026)

| Item | State |
|---|---|
| The workflow `deploy.yml` | written, **never run yet** |
| Trust between GitHub (environment `production`) and the identity `growmate-github` | exists |
| **Rights of that identity** (push images, update the two apps) | **missing: no role is assigned to it yet** |
| GitHub environment `production` and its variables | to create (section 4) |
| The apps `farm-final-api` and `farm-final-web`, the registry `growmateacr2026` | exist |

Until the roles are assigned the first run goes green on tests, then fails at "Log in to the registry" or "Roll out": this is expected, not a bug in the workflow.

## 4. One-time setup

### 4a. In GitHub (repository `zakeelm6/bcg-hack-agri-advisor`)
1. Settings, Environments, **New environment**, name exactly `production`. Optional but wise: add yourself as a required reviewer, so that each deploy waits for your click.
2. In that environment, add these **variables** (Variables, not Secrets: they are identifiers, not passwords):

| Variable | Value |
|---|---|
| `AZURE_CLIENT_ID` | `9bb23084-150f-4333-b839-874a4f40663b` (identity `growmate-github`) |
| `AZURE_TENANT_ID` | `cdd2c4c3-eab5-47da-9e28-dde56d3af48e` |
| `AZURE_SUBSCRIPTION_ID` | `7a66b76e-5d8d-4dce-ab21-0602f1e8be2a` |
| `AZURE_RESOURCE_GROUP` | `CASA-team-2` |
| `AZURE_ACR_NAME` | `growmateacr2026` |
| `AZURE_API_APP` | `farm-final-api` |
| `AZURE_WEB_APP` | `farm-final-web` |
| `AZURE_API_FQDN` | `farm-final-api.yellowsmoke-0cdf2834.germanywestcentral.azurecontainerapps.io` |
| `AZURE_WEB_FQDN` | `farm-final-web.yellowsmoke-0cdf2834.germanywestcentral.azurecontainerapps.io` |

Or from a terminal logged in to GitHub: `gh variable set AZURE_CLIENT_ID --env production --body 9bb23084-150f-4333-b839-874a4f40663b`, and so on.

### 4b. In Azure (an administrator of the subscription, once)
The account used so far can create container apps but not give rights to another identity. An administrator (Owner or User Access Administrator on the resource group `CASA-team-2`) runs one of:

```bash
# A. with the prepared template (three narrow role assignments, nothing else)
az deployment group create -g CASA-team-2 --template-file infra/github-oidc.bicep \
  --parameters acrName=growmateacr2026 apiApp=farm-final-api webApp=farm-final-web

# B. or by hand
ID=$(az identity show -g CASA-team-2 -n growmate-github --query principalId -o tsv)
az role assignment create --assignee-object-id $ID --assignee-principal-type ServicePrincipal \
  --role AcrPush --scope $(az acr show -n growmateacr2026 --query id -o tsv)
for APP in farm-final-api farm-final-web; do
  az role assignment create --assignee-object-id $ID --assignee-principal-type ServicePrincipal \
    --role "Container Apps Contributor" --scope $(az containerapp show -g CASA-team-2 -n $APP --query id -o tsv)
done
```
Why these three and not more: `AcrPush` lets the job push images to the registry; `Container Apps Contributor` on each app lets it change that app's image. It cannot touch the team's own `frontend` app, the Speech resource or anything else. The images are built on the GitHub runner (not with `az acr build`), so no wider registry right is needed.

### 4c. First run
Push to `final-project`, or Actions, deploy, "Run workflow". Watch the two jobs. Green means Azure runs your commit.

## 5. How to check that the display really changed

1. **Actions tab:** the run for your commit is green, and the step "Check that Azure really runs this commit" printed `farm-final-web runs ...:<your commit id>`.
2. **Azure says it:** `az containerapp show -g CASA-team-2 -n farm-final-web --query "properties.template.containers[0].image" -o tsv` ends with your commit id (`git rev-parse HEAD`).
3. **The page itself:** open the web address in a private window (or hard reload, Ctrl+Shift+R: the app keeps an offline copy through its service worker and may show the old version once). For a visible test, change a title in `frontend/lib/i18n.ts`, push, wait for the green run, reload: the new text is there.
4. **The API:** `https://farm-final-api.yellowsmoke-0cdf2834.germanywestcentral.azurecontainerapps.io/api/health` answers `{"ok":true}`; `/docs` lists the routes of the new version.

A rollout takes about 5 to 8 minutes in total (tests, two image builds, two updates). If nothing changed after 15 minutes, read section 7.

## 6. Going back

```bash
az containerapp update -g CASA-team-2 -n farm-final-web --image growmateacr2026.azurecontainerapps.io/farm-final-web:<older commit id>
```
(use `growmateacr2026.azurecr.io/...`) or re-run the workflow on the older commit from the Actions tab. List what exists: `az acr repository show-tags -n growmateacr2026 --repository farm-final-web -o tsv`.

## 7. When it does not work

| What you see | Cause and fix |
|---|---|
| The `deploy` job waits and never starts | the environment `production` has a required reviewer: open the run and approve |
| "Login failed ... AADSTS70025 / no matching federated identity" | the repository or environment name differs from `repo:zakeelm6/bcg-hack-agri-advisor:environment:production`: pushed from another repository, or the environment is not called `production` |
| `az acr login` or the image push is refused (403 / "authorization failed") | the role `AcrPush` is not assigned yet (section 4b) |
| `az containerapp update` says "AuthorizationFailed" | `Container Apps Contributor` is missing on that app (section 4b) |
| Tests fail on `git diff --exit-code openapi.json` | the API changed without regenerating the contract: `cd backend && python scripts/export_openapi.py`, commit `openapi.json` |
| Green run, old page in the browser | the offline copy: hard reload or close all tabs of the app and reopen |
| The page loads but shows no data | the web image was built with a wrong API address: check the variable `AZURE_API_FQDN`, run the workflow again |
| The database seems reset after a deploy | by design for now: the SQLite file lives in the container (see DEPLOY-AZURE.md, section 7) |

## 8. Rules that keep the pipeline safe
- Never put a key in the repository or in a workflow. The Speech key stays a Container App secret; the deploy job never reads it.
- The trust is limited to the environment `production`: keep a reviewer on it if several people can push.
- Deploy only from the branch that is tested: protect `main` and `final-project` (Settings, Branches) so that a failing check cannot be merged.
- The team's own `frontend` app and its `ci.yml` are separate: this pipeline touches only `farm-final-api` and `farm-final-web`.
