# Production Deployment Runbook

Ubuntu/Linux · Expo SDK 57 · EAS Build · Android APK · GitHub

This project is **already largely production-configured**. Verified state at the time of writing:

| Item | Status |
| --- | --- |
| Backend deployed | `https://base44-rust.vercel.app` — `/api/health` returns `200 {"status":"ok"}` |
| Backend auth | signup → `/auth/me` → `/households` round trip verified against production |
| `eas.json` | `preview` (APK) + `production` (AAB) profiles configured, API URL set |
| `app.json` | package `com.todaymeal.app`, version `2.0.2`, versionCode `4` |
| Icons | `icon.png` 1024×1024, `adaptive-icon.png` 1024×1024, `splash.png` 1242×2436 |
| Tests | 9 Vitest (`src/services/api.test.ts`) + 8 Django (`server/syncapi/tests.py`) passing |
| GitHub | pushed to `Code-Mithu/today_meal` (`main` + `develop`) |

So treat steps below as **verify** rather than **create**, except Step 3 (EAS login), Step 4 (build) and Step 8 (proper git remote), which still need action.

Package manager is **pnpm** — `pnpm-lock.yaml` is the only lockfile. Do not use `npm install`; it will create a competing lockfile and EAS will install different versions than you tested.

---

## Step 1 — Prepare the Project

### 1.1 Check the toolchain

```bash
node -v && npm -v && pnpm -v
```

*Does:* prints installed versions.
*Expect:* Node `v20.x` or newer (this sandbox verified `v24.16.0`), pnpm `10.x`.

If Node is missing or too old, do **not** use `apt install nodejs` (Ubuntu ships an ancient version). Use nvm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
exec $SHELL
nvm install 20 && nvm use 20
```

If pnpm is missing:

```bash
corepack enable && corepack prepare pnpm@10.34.3 --activate
```

*Why that exact version:* `eas.json` pins `EAS_BUILD_PNPM_VERSION: 10.34.3`. Matching locally means your local install resolves identically to the cloud build.

**Do not install `expo-cli` globally.** It is deprecated and will produce confusing errors on SDK 57. The modern CLI ships inside the project (`npx expo`). EAS CLI is likewise invoked per-command via `npx eas-cli@latest` — already wired into the `package.json` scripts.

**Common errors**

| Error | Cause | Fix |
| --- | --- | --- |
| `expo: command not found` | expecting a global CLI | use `npx expo …` or `pnpm start` |
| `Unsupported engine` | Node too old | `nvm install 20` |
| `ERR_PNPM_BAD_PM_VERSION` | Corepack version mismatch | `corepack prepare pnpm@10.34.3 --activate` |

### 1.2 Install dependencies

```bash
pnpm install --frozen-lockfile
```

*Does:* installs exactly what the lockfile specifies.
*Expect:* `Done in …s`, no `WARN` about peer conflicts blocking install.
*Why `--frozen-lockfile`:* it **fails** rather than silently rewriting `pnpm-lock.yaml`. This is what you want before a release build — a mutated lockfile means the APK contains untested dependency versions.

**Common errors**

- `ERR_PNPM_OUTDATED_LOCKFILE` → `package.json` and lockfile disagree. Run plain `pnpm install`, then commit the updated lockfile, then re-run tests.
- `EACCES` → you ran a previous install with `sudo`. Fix with `sudo chown -R $USER:$USER ~/.local/share/pnpm node_modules`.

### 1.3 Validate the Expo project

```bash
pnpm doctor
```

*Does:* runs `expo-doctor` — checks SDK/dependency version alignment, config validity, and asset problems.
*Expect:* all checks passed. Warnings about unmaintained transitive packages are safe to ignore; **version mismatch** warnings are not.

If it reports mismatched native package versions:

```bash
npx expo install --check
```

This aligns native modules to the versions SDK 57 expects. Mismatches here are the single most common cause of an APK that builds fine but crashes instantly on launch.

### 1.4 Verify `app.json`

This project uses static `app.json` (there is no `app.config.js`). Confirm the release identity:

```bash
cat app.json
```

The fields that matter for a production release:

| Field | Current | Rule |
| --- | --- | --- |
| `android.package` | `com.todaymeal.app` | **Permanent.** Changing it after Play Store publication creates a different app; existing users get no update path. |
| `android.versionCode` | `4` | **Must increase every upload.** Play rejects a duplicate integer. |
| `version` | `2.0.2` | Human-facing string shown in Play and settings. |
| `owner` | `mtdk_mitthu` | EAS account owning the project. If you forked this, change it or builds fail with a permission error. |
| `extra.eas.projectId` | `cae463d9-…` | Ties the repo to an EAS project. Must belong to `owner`. |
| `icon` / `splash.image` | 1024×1024 / 1242×2436 | Verified correct. A non-square icon fails the build. |

Bump both version fields together for each release:

```bash
# in app.json: "version": "2.0.3"  and  "android": { "versionCode": 5 }
```

*Why manual:* `eas.json` sets `"appVersionSource": "local"`, meaning EAS reads versions from `app.json` and never auto-increments. This is deliberate — it keeps the version in git history rather than in remote EAS state.

### 1.5 Android permissions (optional hardening)

`app.json` declares no `android.permissions` array, so the build inherits Expo's defaults. The app only needs network access (`INTERNET`) — it uses SQLite, SecureStore, printing, and sharing, none of which require runtime permissions.

To see exactly what will ship:

```bash
npx expo prebuild --platform android --no-install
grep uses-permission android/app/src/main/AndroidManifest.xml
rm -rf android
```

*Does:* generates the native project, prints the real permission list, then discards it.
*Why discard:* this is a managed workflow. A committed `/android` directory means `app.json` changes stop taking effect — a notorious source of "my config change did nothing". `/android` and `/ios` are gitignored to prevent this.

If the list contains permissions you don't want (Play Store shows these to users), pin it explicitly in `app.json`:

```json
"android": { "permissions": ["android.permission.INTERNET"] }
```

Then re-run the prebuild check above to confirm before building. Do not set this blind — verify first, because stripping a permission a dependency needs causes a silent runtime failure.

### 1.6 Production API URL

Already set, in two places in `eas.json`:

```bash
grep -n EXPO_PUBLIC_API_URL eas.json
```

*Expect:* `https://base44-rust.vercel.app` under both `preview.env` and `production.env`.

**This is the highest-risk value in the whole project.** `EXPO_PUBLIC_*` variables are inlined into the JS bundle at build time, not read at runtime. An APK built with a wrong or missing URL can never reach the backend — you must rebuild and reinstall. There is no way to fix it on-device.

`src/services/api.ts` enforces this:

- missing URL in a release build → "This build is missing its server address."
- non-HTTPS URL in a release build → "The app server must use a secure HTTPS connection."
- in `__DEV__` only, falls back to `http://10.0.2.2:8000` (Android emulator loopback to your host)

Confirm the backend is actually live before building:

```bash
curl -s https://base44-rust.vercel.app/api/health
```

*Expect:* `{"status":"ok"}`

### 1.7 Environment variables

Two separate environments — do not mix them up.

**Mobile app (build-time, public).** Only `EXPO_PUBLIC_API_URL`. Anything prefixed `EXPO_PUBLIC_` is **visible to anyone who unzips your APK**. Never put a secret behind that prefix.

For local development create `.env` (gitignored):

```bash
cp .env.example .env
```

**Django backend (runtime, secret).** Set these in the Vercel project dashboard, never in the repo:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"   # DJANGO_SECRET_KEY
```

| Variable | Value | Why |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | 64 random chars | Signs JWTs. Server refuses to boot in production without it. Rotating invalidates all sessions. |
| `DATABASE_URL` | Postgres URL with `sslmode=require` | Provisioned by the Neon integration. |
| `DJANGO_DEBUG` | `false` | `true` disables HSTS/secure cookies and leaks tracebacks. |
| `DJANGO_ALLOWED_HOSTS` | your API hostnames | Blocks Host-header attacks. |
| `JWT_ACCESS_MINUTES` / `JWT_REFRESH_DAYS` | `15` / `30` | Session lifetime. |

### 1.8 Confirm no hardcoded secrets

```bash
git grep -nIE "(SECRET_KEY|PASSWORD|TOKEN|API_KEY|ghp_|github_pat_)[\"']?[[:space:]]*[:=][[:space:]]*[\"'][A-Za-z0-9_/+-]{16,}"
```

*Does:* scans **tracked files only** for assigned secret-shaped literals.
*Expect:* one hit in `server/config/settings.py` — a development-only `DJANGO_SECRET_KEY` fallback. Read the surrounding lines: it is gated behind `DEBUG`, and the server raises on boot if the real key is absent in production. That is correct and safe.

Also confirm no env file is tracked:

```bash
git ls-files | grep -E "^\.env" 
```

*Expect:* only `.env.example`.

---

## Step 2 — Test the Application

Test against a **local** backend first, then against production. Testing only against production hides the "wrong API URL" class of bug.

### 2.1 Start the Django backend

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
DJANGO_DEBUG=true SQLITE_PATH=./server/db.sqlite3 .venv/bin/python server/manage.py migrate
DJANGO_DEBUG=true SQLITE_PATH=./server/db.sqlite3 .venv/bin/python server/manage.py runserver 0.0.0.0:8000
```

*Expect:* `Starting development server at http://0.0.0.0:8000/`
*Why `0.0.0.0` not `127.0.0.1`:* `127.0.0.1` is unreachable from the emulator/device. `0.0.0.0` binds all interfaces.

Verify in a second terminal:

```bash
curl -s http://localhost:8000/api/health
```

**Common errors**

- `ImproperlyConfigured: DJANGO_SECRET_KEY` → you omitted `DJANGO_DEBUG=true`.
- `no such table` → you skipped `migrate`.
- `Address already in use` → `kill $(lsof -t -i:8000)`.

### 2.2 Start Expo

```bash
pnpm start
```

*Does:* starts Metro bundler, prints a QR code.
*Expect:* `Metro waiting on exp://192.168.x.x:8081`

If the bundler serves stale code after a config change:

```bash
npx expo start --clear
```

### 2.3 Test on Android

**Emulator** (needs Android Studio + a running AVD):

```bash
pnpm android
```

The `__DEV__` fallback `http://10.0.2.2:8000` reaches your host's port 8000 automatically — no `.env` needed.

**Physical device** (Expo Go, same Wi-Fi): scan the QR code. `10.0.2.2` is emulator-only, so point the app at your LAN IP:

```bash
ip addr show | grep "inet 192"          # find your LAN IP
echo "EXPO_PUBLIC_API_URL=http://192.168.1.50:8000" > .env
```

Restart with `npx expo start --clear` (env changes require a bundler restart), and allow the host in Django:

```bash
DJANGO_DEBUG=true DJANGO_ALLOWED_HOSTS=192.168.1.50 SQLITE_PATH=./server/db.sqlite3 \
  .venv/bin/python server/manage.py runserver 0.0.0.0:8000
```

**Common errors**

| Symptom | Cause | Fix |
| --- | --- | --- |
| "Server could not be reached" | wrong host / firewall | verify `curl` from the phone's network; `sudo ufw allow 8000` |
| `DisallowedHost` in Django log | LAN IP not allowed | add it to `DJANGO_ALLOWED_HOSTS` |
| App works on emulator, not device | using `10.0.2.2` | switch to LAN IP |
| `adb: no devices` | USB debugging off | enable Developer options → USB debugging |

### 2.4 Test signup / login

In the app: create an account, then sign out and sign back in.

Verify the same flow at the API level:

```bash
curl -s -X POST http://localhost:8000/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"passw0rd123","name":"Test"}'
```

*Expect:* JSON containing `user`, `access`, `refresh`.

Check that a wrong password is rejected cleanly:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"test@example.com","password":"wrong"}'
```

*Expect:* `401` — not `500`. A `500` means an unhandled exception; fix before shipping.

### 2.5 Test backend connectivity and session handling

```bash
ACCESS="<paste access token>"
curl -s http://localhost:8000/api/auth/me -H "Authorization: Bearer $ACCESS"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/auth/me   # no token
```

*Expect:* user JSON, then `401`.

**Session persistence.** Tokens live in `expo-secure-store` (Android Keystore), not AsyncStorage. Test:

1. Sign in, force-close the app, reopen → still signed in (`hasStoredSession` finds the refresh token).
2. Leave the app idle past `JWT_ACCESS_MINUTES` (15), then act → `api.ts` transparently refreshes via a single-flight `refreshPromise` and retries once.
3. Sign out → `revokeSession` blacklists the refresh token server-side, then clears local storage. Reopen → login screen.
4. Airplane mode → sign out still works locally (logout must never strand a user).

Confirm a revoked refresh token cannot be replayed:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/api/auth/refresh \
  -H 'Content-Type: application/json' -d '{"refresh":"<the token you just logged out>"}'
```

*Expect:* `401`.

### 2.6 Run the automated suites and fix errors before building

```bash
pnpm typecheck
pnpm test
DJANGO_DEBUG=true SQLITE_PATH=/tmp/t.sqlite3 .venv/bin/python server/manage.py test syncapi
DJANGO_DEBUG=false DJANGO_SECRET_KEY=$(python3 -c "import secrets;print(secrets.token_urlsafe(64))") \
  DATABASE_URL=postgresql://u:p@h/d?sslmode=require .venv/bin/python server/manage.py check --deploy
```

*Expect:* no TS errors; 9 Vitest passing (`Test Files 1 passed (1) / Tests 9 passed (9)`); 8 Django passing; `check --deploy` reporting only the two optional HSTS-subdomain warnings.

**All four must be green before Step 4.** An EAS build takes 10–20 minutes; a type error caught here saves a full build cycle.

---

## Step 3 — Configure EAS

### 3.1 Log in

```bash
npx eas-cli@latest login
npx eas-cli@latest whoami
```

*Expect:* `whoami` prints the account that owns `app.json`'s `owner` field (`mtdk_mitthu`).

*Why not install EAS globally:* the CLI updates frequently and a stale global version is a common build failure. `npx …@latest` always matches the service.

**Common errors**

- `Not logged in` → run `login`; on a headless server use `EXPO_TOKEN=<token> npx eas-cli@latest build …` with a token from expo.dev → Access Tokens.
- `You don't have permission to access project` → your account isn't `owner`. Either log in as `mtdk_mitthu`, or change `owner` + `extra.eas.projectId` to your own account.

### 3.2 `eas build:configure`

```bash
npx eas-cli@latest build:configure
```

*Does:* creates `eas.json` and links the repo to an EAS project (writes `extra.eas.projectId`).

**This project already has both**, so you can skip it. Running it is harmless but it may reformat `eas.json` — if it does, re-check that `EXPO_PUBLIC_API_URL` survived in both profiles. Only run it if you forked the project to a new EAS account, in which case first delete the stale `extra.eas.projectId` from `app.json`.

### 3.3 Understanding `eas.json`

Current configuration:

```json
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "local" },
  "build": {
    "preview": {
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_URL": "https://base44-rust.vercel.app" },
      "android": { "buildType": "apk" }
    },
    "production": {
      "env": { "EXPO_PUBLIC_API_URL": "https://base44-rust.vercel.app" },
      "android": { "buildType": "app-bundle" }
    }
  }
}
```

| Key | Meaning |
| --- | --- |
| `distribution: internal` | Produces a directly installable artifact with a shareable install link, bypassing the store. |
| `buildType: apk` | One universal APK containing all CPU architectures — installable by double-tap. |
| `buildType: app-bundle` | An `.aab`, **not installable on a phone**. Play Store only. |
| `appVersionSource: local` | Versions come from `app.json`, not remote EAS state. |

### 3.4 The three build profiles

| Profile | Artifact | Contains JS? | Purpose |
| --- | --- | --- | --- |
| `development` | APK (dev client) | No — loads from Metro | Debugging native modules with hot reload. Useless without a running dev server. Not defined in this project; you don't need it unless you add custom native code. |
| `preview` | **APK** | Yes, bundled | **Release-mode build you can sideload.** Real production behavior, installable directly. This is what you want. |
| `production` | **AAB** | Yes, bundled | Play Store submission. Cannot be installed directly. |

The key distinction: `preview` and `production` both compile in release mode with the JS bundled — the app is self-contained and needs no dev server. They differ only in **packaging**.

### 3.5 Android APK profile

Already configured — `preview` is the installable-APK profile, exposed as:

```bash
pnpm build:apk          # cloud build
pnpm build:apk:local    # local build
```

---

## Step 4 — Build the APK

### 4.1 Cloud build (recommended)

```bash
pnpm build:apk
```

Equivalent to `npx eas-cli@latest build --platform android --profile preview`.

*Does:* uploads your project, builds on EAS infrastructure, returns a download URL.

First run prompts for a **release keystore**. Choose **"Generate new keystore"** and let EAS manage it.

> **Critical:** this keystore is the permanent identity of your app. If you later publish to Play and then lose it, you can never update that listing again. Back it up with `npx eas-cli@latest credentials` → download. Never commit it — `.gitignore` now blocks `*.keystore`, `*.jks`, and `credentials.json`.

*Expect:*

```
✔ Build finished
🤖 Android app: https://expo.dev/artifacts/eas/xxxx.apk
```

### 4.2 Monitor the build

The command streams logs and blocks until done (10–20 min). If you close the terminal the build continues.

```bash
npx eas-cli@latest build:list --platform android --limit 5
npx eas-cli@latest build:view          # detail for the latest build
```

Or watch the web dashboard link the CLI prints.

**Common build failures**

| Error | Cause | Fix |
| --- | --- | --- |
| `Gradle build failed` | native dependency mismatch | `npx expo install --check`, rebuild |
| `Lockfile is not up to date` | `package.json` ≠ lockfile | `pnpm install`, commit lockfile |
| `Invalid UUID appId` | `projectId` not owned by you | fix `owner` / `extra.eas.projectId` |
| `Icon must be square` | bad asset | regenerate 1024×1024 |
| Build succeeds, app crashes at launch | SDK/native version mismatch | `pnpm doctor`, then `npx expo install --check` |

### 4.3 Local build (optional)

```bash
pnpm build:apk:local
```

Requires JDK 17, Android SDK, and `ANDROID_HOME` exported. Writes a `.apk` into the project root (gitignored). Faster iteration, no queue, but the environment is yours to maintain — prefer the cloud build for the artifact you actually ship.

### 4.4 Download and install

Download from the printed URL, or:

```bash
npx eas-cli@latest build:download --platform android --latest --output ./today-meal.apk
```

Install over USB:

```bash
adb devices
adb install -r ./today-meal.apk
```

*Expect:* `Success`
*`-r`:* reinstalls while keeping app data.

**Common install errors**

| Error | Meaning | Fix |
| --- | --- | --- |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | installed copy signed with a different key | `adb uninstall com.todaymeal.app` first (erases local data) |
| `INSTALL_FAILED_VERSION_DOWNGRADE` | lower `versionCode` than installed | bump `versionCode` |
| `INSTALL_FAILED_NO_MATCHING_ABIS` | arch mismatch | ensure `buildType: apk` (universal) |

Or transfer the file to the phone and tap it, enabling "Install unknown apps" for your file manager.

### 4.5 Test the final APK

This is a **release** build — no dev server, no `__DEV__` fallback. It talks to `https://base44-rust.vercel.app`.

1. Launch from the home screen (not via Expo Go).
2. Sign up with a fresh account → confirms production DB writes.
3. Force-close, reopen → confirms SecureStore persistence in release mode.
4. Turn off Wi-Fi and mobile data → confirms offline SQLite behavior and clean error copy.
5. Reconnect → confirms sync.
6. Sign out → confirms server-side token revocation.

*If you see "This build is missing its server address":* `EXPO_PUBLIC_API_URL` was absent at build time. Fix `eas.json` and rebuild — this cannot be fixed on-device.

### 4.6 `preview` APK vs. `production` AAB

```bash
npx eas-cli@latest build --platform android --profile preview      # → .apk
npx eas-cli@latest build --platform android --profile production   # → .aab
```

| | `preview` (APK) | `production` (AAB) |
| --- | --- | --- |
| File | `.apk` | `.aab` |
| Install directly | **Yes** | **No** — Play only |
| Contains | all ABIs (larger) | Play generates per-device splits (~30% smaller downloads) |
| Distribution | link / USB / file transfer | Play Store |
| Use for | testers, internal rollout, no store account needed | public store release |

Both are release builds with identical app behavior. Choose APK unless you are uploading to Play. Note Play Store **requires** AAB for new apps — APK upload is rejected.

---

## Step 5 — Production Verification

Run against the **installed APK**, not the dev server.

```bash
# Backend reachable over HTTPS
curl -s https://base44-rust.vercel.app/api/health

# Bad credentials rejected cleanly (401, never 500)
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://base44-rust.vercel.app/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"nobody@example.com","password":"x"}'

# Production URL is the one compiled in
grep -n EXPO_PUBLIC_API_URL eas.json

# Debug mode is off in production (must NOT print a traceback page)
curl -s https://base44-rust.vercel.app/api/nonexistent | head -c 200
```

Checklist:

- [ ] Signup creates an account; duplicate email is rejected with a readable message
- [ ] Login succeeds; wrong password shows a clear error, not a crash
- [ ] Session survives force-close; expired access token refreshes silently
- [ ] Logout revokes server-side — old refresh token returns `401`
- [ ] API URL is HTTPS in both `eas.json` profiles
- [ ] Backend `/api/health` returns `200`
- [ ] All navigation tabs/screens open; back button behaves
- [ ] UI correct on a small screen; no clipped text; safe-area respected on notched devices
- [ ] APK launches cold in a few seconds with no red screen
- [ ] No `__DEV__`-only config: `DJANGO_DEBUG=false`, no `10.0.2.2` reachable in release, no `console.log` of sensitive data
- [ ] `git grep` secret scan clean; `.env` untracked; no `*.keystore` / `*.jks` committed

---

## Step 6 — Prepare the Git Repository

```bash
git status
git remote -v
git branch --show-current
```

*Current state of this project:*

- `git status` → clean
- `git branch --show-current` → **`master`**
- `git remote -v` → `origin` points at a temporary local bundle, **not GitHub**

Both are addressed in Step 8.

If git were not initialized:

```bash
git init && git add . && git commit -m "Initial commit"
```

### Verify `.gitignore`

```bash
cat .gitignore
```

Already covers `node_modules/`, `.expo/`, `dist/`, `.env*` (with `!.env.example`), `__pycache__/`, `.venv/`, `server/db.sqlite3`, and now `*.keystore`, `*.jks`, `credentials.json`, `/android`, `/ios`, `*.apk`, `*.aab`.

Confirm nothing sensitive is tracked:

```bash
git ls-files | grep -E "\.env$|\.keystore$|\.jks$|node_modules|__pycache__"
```

*Expect:* no output.

**Do not over-ignore.** These must stay committed:

| Keep | Why |
| --- | --- |
| `pnpm-lock.yaml` | reproducible builds; EAS fails without it |
| `app.json`, `eas.json` | build configuration |
| `.env.example` | documents required variables (no real values) |
| `assets/` | icons and splash — build fails without them |
| `server/syncapi/migrations/` | schema history; the DB cannot be rebuilt without it |

A common mistake is ignoring all of `*.json` or the whole `assets/` folder — both break the build.

If something sensitive was already committed, ignoring it now does **nothing** — it stays in history. Remove it from tracking and rotate the secret:

```bash
git rm --cached .env
git commit -m "Stop tracking .env"
# then rotate the leaked credential — assume it is compromised
```

---

## Step 7 — Commit

```bash
git add -A
git status
git diff --cached --stat
```

*Review before committing.* `git status` lists what is staged; `git diff --cached --stat` shows per-file line counts. Read this list every time — it is the last checkpoint before a secret becomes permanent.

Inspect the full staged content when in doubt:

```bash
git diff --cached
```

Unstage anything unexpected:

```bash
git restore --staged <file>
```

Then commit:

```bash
git commit -m "Prepare production Expo app"
```

*Expect:* `[master abc1234] Prepare production Expo app` with a sane file count.

**Common errors**

- `Please tell me who you are` → `git config --global user.email "you@example.com"` and `user.name`.
- `nothing to commit` → already committed; proceed to Step 8.
- Accidentally committed a secret → `git reset --soft HEAD~1`, remove the file, rotate the credential, recommit. If it was already pushed, rotate first; history rewriting is secondary.

---

## Step 8 — Connect to GitHub

The current `origin` points at a temp bundle, so repoint it.

### If the repository already exists (this project's case)

```bash
git remote remove origin
git remote add origin https://github.com/Code-Mithu/today_meal.git
git remote -v
git fetch origin
git branch -a
```

*Expect:* `origin` on both fetch and push lines; `fetch` retrieves `origin/main` and `origin/develop`.

Rename the local branch to match the remote default, then push:

```bash
git branch -M main
git push -u origin main
```

*`-M`:* renames `master` → `main` (force, in case `main` already exists locally).
*`-u`:* sets upstream tracking so later `git push` / `git pull` need no arguments.
*Expect:* `branch 'main' set up to track 'origin/main'`.

**Authentication.** GitHub does not accept passwords. Use a Personal Access Token as the password at the prompt, or the `gh` CLI:

```bash
gh auth login
```

To avoid re-entering the token:

```bash
git config --global credential.helper store   # plaintext in ~/.git-credentials
```

Prefer a **fine-grained** PAT scoped to this one repository with Contents: read/write. A classic `repo`-scope token can write to every repo you own — unnecessary blast radius.

### If the repository does not exist

Create it on github.com (**do not** initialize with a README — that creates a conflicting commit), then:

```bash
git remote add origin https://github.com/<user>/<repo>.git
git branch -M main
git push -u origin main
```

Or with the CLI:

```bash
gh repo create <repo> --private --source=. --remote=origin --push
```

### On `--force`

**Do not use `git push --force` as a habit.** It overwrites remote history; any commit only on the remote is destroyed, and collaborators who pulled it get a corrupted local state requiring manual recovery.

If you get `Updates were rejected because the remote contains work you do not have`, the correct first move is to integrate:

```bash
git pull --rebase origin main
git push origin main
```

Force is justified only when you are certain the remote history is worthless — for example when it holds a single placeholder commit unrelated to your project (which was the case for this repo's initial delivery, where the remote had one unrelated commit and force-pushing was the deliberate, approved choice). Even then prefer:

```bash
git push --force-with-lease origin main
```

*Why:* `--force-with-lease` aborts if the remote moved since your last fetch, so you cannot silently destroy a teammate's push. Plain `--force` has no such guard.

For unrelated histories you want to *keep*, merge explicitly instead:

```bash
git pull origin main --allow-unrelated-histories
```

---

## Step 9 — Verify GitHub

```bash
git status
git log --oneline -5
git remote -v
git branch -vv
```

*Expect:*

- `status` → `working tree clean`, `Your branch is up to date with 'origin/main'`
- `log` → your production commit at the top
- `remote -v` → the GitHub HTTPS URL
- `branch -vv` → `* main abc1234 [origin/main] …` with **no** `[ahead N]` or `[behind N]`

Confirm the remote really has your commit:

```bash
git ls-remote --heads origin
git rev-parse HEAD
```

*Expect:* the `refs/heads/main` SHA matches local `HEAD` exactly. This is the authoritative check — `git status` only reports what your last fetch knew.

Compare file counts:

```bash
git ls-files | wc -l
gh api repos/Code-Mithu/today_meal/git/trees/main?recursive=1 \
  --jq '[.tree[] | select(.type=="blob")] | length'
```

*Expect:* identical numbers (96 at time of writing).

Finally, browse the repo in a browser and confirm: `app.json`, `eas.json`, `pnpm-lock.yaml`, `assets/`, and `server/` are present — and `.env`, `node_modules/`, `*.keystore` are **absent**.

---

## Step 10 — Repeatable Workflow

```text
Code changes
   ↓
pnpm typecheck && pnpm test          ← fail fast, before any build
   ↓
Test locally (emulator + local Django)
   ↓
Fix login / API / navigation issues
   ↓
Bump app.json version + versionCode   ← Play rejects duplicates
   ↓
Verify eas.json EXPO_PUBLIC_API_URL   ← baked in at build time
   ↓
pnpm build:apk                        ← preview profile → installable APK
   ↓
adb install -r today-meal.apk
   ↓
Test the real APK (auth, offline, sync, logout)
   ↓
git grep secret scan + git ls-files check
   ↓
git add -A && git status && git diff --cached --stat
   ↓
git commit -m "…"
   ↓
git push origin main                  ← never --force by default
   ↓
git ls-remote --heads origin          ← verify SHA matches HEAD
```

### One-shot pre-release gate

```bash
set -e
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
DJANGO_DEBUG=true SQLITE_PATH=/tmp/t.sqlite3 .venv/bin/python server/manage.py test syncapi
curl -sf https://base44-rust.vercel.app/api/health
if git grep -qIE "ghp_|github_pat_"; then echo "SECRET FOUND — STOP"; exit 1; fi
echo "READY TO BUILD"
```

Save as `scripts/pre-release.sh` and run with `bash scripts/pre-release.sh`.

*Why `set -e` and an explicit `if` rather than a one-line `&&`/`||` chain:* in `cmd_a && git grep -q … && echo "STOP" || echo "READY"`, a failure in `cmd_a` short-circuits past the `git grep` straight into the `||` branch, printing "READY TO BUILD" when nothing was actually checked. `set -e` aborts on the first real failure, and the `if` block keeps the secret check independent of the preceding exit codes.

### Release-to-Play variant

Replace the build step with:

```bash
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest submit --platform android --latest
```

`submit` uploads the `.aab` to Play. It needs a Google Play service account JSON — keep that file out of git (`credentials.json` is gitignored).
