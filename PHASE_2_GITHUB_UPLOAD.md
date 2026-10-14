# PHASE 2 — Replace old GitHub project safely

Repository: https://github.com/RonnMendoza0505/TINDIGCHECK

1. Extract the new ZIP into a folder `TINDIGCHECK-READY` alongside a fresh clone.
2. Open PowerShell in the parent folder and run:
```powershell
git clone https://github.com/RonnMendoza0505/TINDIGCHECK.git TINDIGCHECK-PUSH
cd TINDIGCHECK-PUSH
git switch main
```
If the remote repository has no `main` branch yet, use `git switch -c main` instead.

3. If there is an existing commit, back up the branch:
```powershell
git branch backup-before-medical-fix
git push origin backup-before-medical-fix
```
Skip backup only if the repository is truly empty (no commits).

4. Verify the source exists BEFORE removing anything:
```powershell
Test-Path '..\TINDIGCHECK-READY\frontend\package.json'
Test-Path '..\TINDIGCHECK-READY\backend\supabase\functions\manage-learner-medical\index.ts'
```
Both MUST be True. If False, STOP: you may have an extra nested extraction folder.

5. Remove old tracked files in the clone, copy clean files, and verify:
```powershell
git rm -r --ignore-unmatch .
Copy-Item -Path '..\TINDIGCHECK-READY\*' -Destination . -Recurse -Force
Test-Path '.\frontend\package.json'
Test-Path '.\backend\supabase\functions\manage-learner-medical\index.ts'
```
Both MUST be True.

6. Ensure `.gitignore` excludes `node_modules/`, `dist/`, `.env`, `.env.*` (except `.env.example`), and logs. Check for secrets and private files before committing.
```powershell
git add -A
git status
git diff --cached --name-only
git commit -m 'Clean TINDIGCHECK medical upload to Supabase and Cloudinary'
git push -u origin HEAD:main
```
If the push is rejected, DO NOT force push. Share the error. If `nothing to commit`, inspect the files in the cloned folder and the current branch.

7. Refresh GitHub and select branch `main`.

Pushing source to GitHub DOES NOT deploy the Supabase SQL or Edge Function. Complete PHASE 1 separately.
