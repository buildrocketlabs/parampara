# RELEASE · The public repository, Friday 31 Oct
Prepared by the agent on 28 Oct, approved and run by the founder. Nothing here has been run yet.

**The plan in one line.** The private working repo becomes `buildrocketlabs/parampara-dev` and keeps deploying the live site. A fresh public repo `buildrocketlabs/parampara` is made from a reviewed snapshot of the same commit, with one commit and no history. The README says so.

Why a fresh repo and not "make the private one public": the history holds strategy notes, juror profiles, family messages and session notes (D91 lists them). A public repo made from `git archive` of one commit carries none of that, and nothing untracked or ignored (`.env.local`, `field-private/`) can reach it.

## The rule that matters most
**No commits after 1 Nov 2026, 23:59 IST, in either repo.** A push to `main` of `parampara-dev` deploys to production at once (Vercel for GitHub deploys every push), so a late commit would change what the evaluators assess. After the freeze tag, nobody pushes, merges or redeploys until the results.

## Order of steps (Friday)
Run every command in your own Terminal, in the main checkout (not a worktree), on `main`.

### 1. Freeze and dry run
1. Everything merged to `main`, CI green, deployed, `demo-path` green on the live URL. The README's video and deck links and its Field section are filled and committed (the snapshot only takes committed files).
2. **Warm the sample chips.** After the final `pnpm seed:library` (or `seed:pulse`) and after any card approval, a new card changes the library version and every cached chip answer misses (D87, D89). Run `pnpm warm:chips` and confirm its table: in the `check` pass the three answered chips (letters, numbers, multilevel) say `answered`, `replayed true`, voice `200` and under 3 s, in English and Kannada; safety and no card finish under 8 s. Then `PW_BASE_URL=https://parampara-eta.vercel.app pnpm exec playwright test --project=judge` asserts the same on live. If a chip fails, run `pnpm warm:chips` once more; a second failure is a bug, not a cold cache. Warming spends at most about 30 US cents, nothing when nothing changed.
3. Put the private patterns in `field-private/release-patterns.txt` (never in git), one per line: your personal email, your phone number, the headmaster's phone number, and any real child or teacher name you heard in the field.
4. Dry run:
   ```bash
   ./scripts/release-snapshot.sh
   ```
   It builds `.release/snapshot` (git ignored) from `HEAD`, removes the private files, keeps the 20 screenshots, runs `scripts/check-secrets.mjs` and the extra scans (key shaped strings, personal email addresses, phone numbers, a child named in docs or screens, your private patterns), prints every file that would be published, grouped with counts, and the list of what is left out. It ends with `RESULT: clean` or with the blocking findings.
5. Fix any blocking finding in the private repo, commit, run again. Read the "Read once more on the day" list. Open the 20 screenshots named in the script's `KEEP_DEMOS` once. The full list of published files stays in `.release/files.txt`; the snapshot itself is removed after a dry run (`KEEP_SNAPSHOT=1` keeps it to browse; remove it before `pnpm lint` or `pnpm test`, which would read it as a second copy of the source).

### 2. Rename the private repo
```bash
./scripts/gh.sh repo rename parampara-dev --repo buildrocketlabs/parampara --yes
git remote set-url origin https://github.com/buildrocketlabs/parampara-dev.git
git fetch origin            # proves the new address works
```
What the rename does: GitHub moves the repo, its issues, stars and settings to the new name and redirects the old address to it ([GitHub docs: Renaming a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)). **That redirect ends the moment step 3 creates a new repo with the old name**, so `origin` must point at `parampara-dev` before then. Every other clone and worktree of this repo needs the same `git remote set-url`.

### 3. Check that Vercel still deploys from it
**Not verified from Vercel's documentation.** The Vercel for GitHub docs say only that the connected repository is changed from Project Settings → Git ([vercel.com/docs/git/vercel-for-github](https://vercel.com/docs/git/vercel-for-github), "Changing the GitHub Repository of a Project"). They say nothing about a rename on GitHub's side. Vercel exposes the repository's numeric id to builds (`VERCEL_GIT_REPO_ID`), which suggests the link survives a rename, but community reports show projects falling into "Git Disconnected" after a repo was renamed or deleted ([community.vercel.com thread, Apr 2026](https://community.vercel.com/t/how-to-fix-vercel-git-disconnected-error-after-repository-was-deleted-or-renamed/38014)). So check, and use the fallback if needed:
1. Vercel dashboard (Parampara Chrome profile) → project `parampara` → Settings → Git. **Connected Git Repository** should read `buildrocketlabs/parampara-dev`.
2. If it says disconnected, or still shows the old name: **Disconnect**, then **Connect Git Repository** → GitHub → `buildrocketlabs/parampara-dev`. If the repo is not in the list: GitHub → Settings → Applications → Vercel → Configure → Repository access → add `parampara-dev` (keep "Only select repositories"; never add the public one).
3. Environment variables, domains and the production deployment belong to the Vercel project, not to the repo, so they stay. The site keeps serving the last production deployment throughout.
4. Prove it before the deadline: Deployments → the latest production deployment → Redeploy (same commit, no new commit needed), and watch it go green. Then open the live URL.

If you would rather not rename at all, the script also takes another public name: `PUBLIC_REPO=buildrocketlabs/parampara-open ./scripts/release-snapshot.sh --execute`. Then skip steps 2 and 3 and put that name in the submission form.

### 4. Create the public repo from the snapshot
```bash
./scripts/release-snapshot.sh --execute
```
It refuses unless the working tree is clean, the scans are clean, and `buildrocketlabs/parampara` does not exist yet. It shows the commit, the file count and the author, then asks you to type `publish buildrocketlabs/parampara`. It then commits the snapshot as one commit (author: this repo's local `buildrocketlabs` identity), creates the public repo through `./scripts/gh.sh repo create`, and pushes with the same repo local credential helper as `scripts/setup-accounts.sh`. No global git or gh setting is touched.

Open https://github.com/buildrocketlabs/parampara in a private window: README renders, the mermaid diagram draws, no file from the "Left out" list is there.

### 5. Access for the Tech4Dev evaluators
A public repo is readable by everyone, which covers "read access for the evaluator IDs". If the organisers still ask for named access, add each ID as a read only collaborator (on the public repo, or on `parampara-dev` if they ask for the working history):
```bash
./scripts/gh.sh api -X PUT repos/buildrocketlabs/parampara/collaborators/<github-id> -f permission=pull
```

### 6. Freeze tag
```bash
git tag -a v1.0-submission -m "Submission, 31 Oct 2026"
git push origin v1.0-submission
./scripts/gh.sh release create v1.0-submission --repo buildrocketlabs/parampara --title "Submission" --notes "Snapshot of the submitted build. Live: https://parampara-eta.vercel.app"
```
Note the production deployment URL and its commit (Vercel → Deployments) next to the tag in the submission notes. Both should be the same commit as the snapshot (`Parampara: submission snapshot (private <sha>)`).

### 7. Submit
Hack2skill form: live link, the public repo link, test credentials (README), video and deck links, open source consent **yes**. Screenshot the confirmation into `docs/demos/T11/` locally; do not commit it after the deadline.

## If something goes wrong
- **The snapshot scan blocks:** fix in the private repo, commit, run the dry run again. Never publish over a blocking finding.
- **The public repo was created but the push failed:** run `--execute` again only after deleting the empty repo in the GitHub web UI (Settings → Danger Zone), since the script refuses an existing name.
- **Something private was published:** make the public repo private at once (GitHub → Settings → Change visibility), remove the file in the private repo, and publish a new snapshot. If it was a key, rotate the key first.
- **Vercel stopped deploying after the rename:** step 3.2. The live site keeps serving the last deployment meanwhile.
