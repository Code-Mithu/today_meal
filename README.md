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
