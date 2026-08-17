# Today Meal Offline

Expo React Native household meal management app backed by local SQLite. The app reads and writes locally at all times; its owned Django API is used only for sign-in and cross-device synchronization.

## Mobile development

1. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`. Android emulators can use `http://10.0.2.2:8000`; physical devices need the server's LAN or HTTPS address.
2. Install packages with `pnpm install`.
3. Start Expo with `pnpm start`.
4. Validate with `pnpm typecheck` and `pnpm doctor`.

The first account setup requires the server. Afterward, cached identity and SQLite data remain available without connectivity or a local lock. Sync runs on launch, app resume, and network reconnection; the Sync status bar also provides manual synchronization.

## Owned server development

Create a Python virtual environment, install `server/requirements.txt`, configure PostgreSQL using `.env.example`, then run:

```sh
python server/manage.py migrate
python server/manage.py createsuperuser
python server/manage.py runserver 0.0.0.0:8000
```

## VPS deployment

1. Install Docker and Docker Compose on a Linux VPS.
2. Copy `.env.example` to `.env`, use strong unique secrets, and configure your API hostname.
3. Run `docker compose up -d --build`.
4. Put Caddy, Nginx, or another TLS reverse proxy in front of `127.0.0.1:8000`.
5. Point `EXPO_PUBLIC_API_URL` at the public HTTPS API URL before building the mobile app.

Create an administrator with `docker compose exec api python manage.py createsuperuser`.

Back up with `docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql`. Restore into an empty database with `docker compose exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB" < backup.sql`.

## APK

Use `pnpm build:apk` for an EAS preview APK or `pnpm build:apk:local` with the local EAS prerequisites installed.

## Production configuration checklist

Everything below must be reviewed before a production release. No secrets belong in the repository; only the deployment platform holds real values.

| What to change | Where | How | Why |
| --- | --- | --- | --- |
| Backend URL for APK builds | `eas.json` → `build.preview.env.EXPO_PUBLIC_API_URL` and `build.production.env.EXPO_PUBLIC_API_URL` | Replace with your deployed HTTPS backend origin (no trailing slash). JSON cannot hold comments, so this table is the reference. | The APK is compiled with this value baked in; a stale URL makes every request fail after install. Release builds reject non-HTTPS URLs. |
| `DJANGO_SECRET_KEY` | Hosting environment variables (Vercel project or VPS `.env`) | Generate with `python -c "import secrets; print(secrets.token_urlsafe(64))"`. | Signs JWTs and cookies. The server refuses to boot in production without it, and rotating it invalidates all sessions. |
| `DATABASE_URL` | Hosting environment variables | Set to a PostgreSQL connection string with `sslmode=require`. | Required in production; the SQLite fallback only exists for local development. |
| `DJANGO_DEBUG` | Hosting environment variables | Must stay `false` in production. | `true` disables HSTS/secure cookies, enables permissive CORS, and leaks tracebacks. |
| `DJANGO_ALLOWED_HOSTS` | Hosting environment variables | Comma-separated hostnames for the deployment. Vercel hosts are appended automatically. | Blocks Host header attacks. |
| `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` | Hosting environment variables | List real client origins if any browser client is added. Leave empty for the mobile-only app. | Empty lists mean no cross-origin browser access is granted in production. |
| `JWT_ACCESS_MINUTES` / `JWT_REFRESH_DAYS` | Hosting environment variables | Defaults: 15 minutes and 30 days. | Controls session lifetime; refresh tokens rotate and are blacklisted on reuse. |
| Android release identity | `app.json` → `expo.android.package`, `expo.android.versionCode`, `expo.version`, `expo.owner`, `expo.extra.eas.projectId` | Bump `version`/`versionCode` for each store or internal release; set `owner`/`projectId` to your own EAS account when forking. | Play Store rejects duplicate version codes, and builds fail against another account's EAS project. |
| Reverse proxy TLS | VPS only (`docker-compose.yml` exposes `127.0.0.1:8000`) | Terminate TLS in Caddy/Nginx and forward `X-Forwarded-Proto`. | Django trusts that header to detect HTTPS; without it secure cookies and redirects misbehave. |

Optional hardening: set `SECURE_HSTS_INCLUDE_SUBDOMAINS` and `SECURE_HSTS_PRELOAD` in `server/config/settings.py` once every subdomain of the API domain is HTTPS-only. `python server/manage.py check --deploy` reports these as the only remaining warnings.
