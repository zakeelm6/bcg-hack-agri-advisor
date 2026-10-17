# Put the project on GitHub

How to publish `finalproject` safely, keep it clean, and work on it with branches and pull requests. Written for this repository: the work is on the branch `ux/pro-polish` (and `chore/deploy-and-clean` for the deployment files), the `main` branch is older, and there is **no remote yet**.

## 1. Before the first push: check there is no secret

A repository on GitHub keeps its whole history. A key pushed once must be treated as leaked, even if you delete it afterwards.

```bash
cd finalproject
git status --short                                   # should be empty or only what you expect
git ls-files | grep -iE "\.env|\.db$|key|secret|\.pem"   # only backend/.env.example may appear
git grep -nIE "AZURE_SPEECH_KEY=[A-Za-z0-9]{10,}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{12,}"   # must print nothing
git log -p --all -S"AZURE_SPEECH_KEY=" -- . ':!*.md' | grep -E "^\+.*KEY=[A-Za-z0-9]{10,}"   # nothing in the history either
```
Checked on 17 October 2026 for this repository: no key in the tracked files or in the history; `backend/.env` is ignored by `.gitignore`. Check again just before pushing, and run the same four commands after any big change.

If one of them prints a real key: do **not** push. Rotate the key first (Azure portal, Speech resource, Keys, Regenerate), then ask for help to rewrite the history.

Other things to look at before publishing: the PDF `docs/reference/BCG_Hackathon.pdf` (is it allowed to be public?), screenshots that show real personal data, and whether the repository should be **private** (safest for a hackathon project until you are sure) or public (good for a portfolio, and your CV links to it).

## 2. Create the repository (once)

Pick a name without spaces, for example `farm-advisor`. In the browser: github.com, "New repository", no README, no .gitignore, no licence (the project already has its files), private or public as decided above.

Or from the terminal, after logging in once:
```bash
gh auth login                      # choose GitHub.com, HTTPS or SSH, log in with the browser
gh repo create farm-advisor --private --source . --remote origin   # use --public for a public one
```
Without `gh`, add the remote by hand (use the address GitHub shows, SSH or HTTPS):
```bash
git remote add origin git@github.com:<your-user>/farm-advisor.git
```

## 3. Choose what goes to `main`

Today the history is: `main` (old) and `ux/pro-polish` (the real, current work, many commits), and `chore/deploy-and-clean` (the deployment files and the cleanup, on top of `ux/pro-polish`). Two clean ways:

**A. Simple, recommended for a project that is yours alone:** make `main` the current work.
```bash
git branch old-main main               # keep a copy of the old main first
git checkout chore/deploy-and-clean
git branch -M main                     # this branch becomes main (the old main is now only old-main)
git push -u origin main                # pushes the current work as main
```
The old main stays available locally as `old-main` (push it too with `git push origin old-main` if you want it on GitHub).

**B. With a pull request:** push `main` as it is, then the work as a branch and merge it on GitHub.
```bash
git push -u origin main
git push -u origin chore/deploy-and-clean
```
Then on GitHub: "Compare and pull request", title "Deployment files and clean-up", merge. The pull request shows exactly what changes for a reviewer.

Choose A if nobody else reviews; B if you want a visible history of reviews.

## 4. After the push

1. **Look at the repository page** as a visitor: the README must say what it is in the first lines, with how to run it (it does) and its honest status (it does).
2. **Actions tab:** the two workflows (`backend`, `frontend`) run on pushes that touch their folders. A red cross means a check failed: open it, read the log, fix, push again. They run the backend tests, check that `backend/openapi.json` is current, type-check the frontend, check the Darija texts and build.
3. **Settings, Branches:** protect `main` (require a pull request and the checks to pass) once you work with other people.
4. **Settings, Secrets and variables, Actions:** this is where deployment secrets go later (see [DEPLOY-AZURE.md](DEPLOY-AZURE.md) section 12). Never in the code.
5. **About box** (the gear on the right of the repository page): a one-line description, the topics (`agritech`, `fastapi`, `nextjs`, `sentinel-2`, `darija`), and the website link once it is deployed.

## 5. Daily work: branches and pull requests

```bash
git checkout main && git pull               # start from the latest main
git checkout -b feature/short-name          # one branch per piece of work
# ...edit, test...
git add <files>                             # prefer named files to `git add .`
git commit -m "area: what changed and why, in one line"
git push -u origin feature/short-name
```
Then open a pull request on GitHub, wait for the checks, merge ("Squash and merge" keeps `main` readable), delete the branch.

Commit messages in this repository use a prefix: `ux:`, `backend:`, `docs:`, `chore:`. Do not add tool or assistant signatures to commits or pull requests.

## 6. Keep the repository clean

- **Never commit:** `.env` files, `*.db`, `node_modules`, `.next`, `.venv`, big screenshots you can regenerate. The `.gitignore` covers these.
- **Run before each push:** `cd backend && python -m pytest -q`, `cd frontend && npx tsc --noEmit && node lib/i18n.check.mjs && npm run build`.
- **One topic per commit and per pull request.** If a pull request changes both the engine and the colours, split it.
- **Big binary files** (more than a few MB) slow every clone for ever. The documentation screenshots already weigh about 60 MB in the history: do not add more without need. If the repository must be slimmed one day, `git filter-repo` can drop the old images, but that rewrites history, do it before sharing the link, not after.
- **Releases:** when a version is demo-ready, tag it (`git tag v0.1-demo && git push --tags`) so you can always come back to exactly what you showed.

## 7. If something goes wrong

| Problem | What to do |
|---|---|
| `git push` says "permission denied" | `gh auth status`; with SSH, add your public key in GitHub Settings, SSH keys |
| `git push` says "rejected, non-fast-forward" | someone (or you, elsewhere) pushed first: `git pull --rebase`, then push |
| You committed a secret | rotate it at once, then rewrite history (`git filter-repo`), never just delete the file |
| You pushed the wrong branch as `main` | on a private repository with no other user: `git push --force-with-lease origin <right-branch>:main` after you are sure; otherwise ask first |
| The Actions are red because of the contract check | `cd backend && python scripts/export_openapi.py`, commit `openapi.json` |
