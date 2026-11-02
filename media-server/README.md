# PixelMorph media server

Stage 1 of cloud sync: a small local server that stores each user's photos and videos on the owner's PC. Supabase checks who is calling. The server uses only Node built-ins.

## What it stores

- Files go under `data/<sha256 of user id>/<sha256 of project id>/<sha256 of file id>`.
- The user id comes only from Supabase (`GET /auth/v1/user`). Nothing in the URL, headers or body can choose it.
- Routes: `PUT`, `GET` and `DELETE` on `/files/<projectId>/<fileId>`, plus `GET /health`. There is no listing route.
- Another user's files sit at a different path, so they answer 404.

## How to start

```
SUPABASE_URL=https://<project>.supabase.co SUPABASE_KEY=<publishable key> npm start
```

- Only the publishable key is used. Never use the `service_role` key here.
- The server binds to `127.0.0.1` only, never `0.0.0.0`.
- Optional env: `PORT` (default 3000), `DATA_DIR` (default `media-server/data`), `MAX_UPLOAD_BYTES` (default 4 GiB).
- Tests: `npm test`.

## Reaching it from the phone

- Development: `adb reverse tcp:3000 tcp:3000`.
- Demo: `ngrok http 3000`, which gives an HTTPS address.

## Backups and limits

- Nothing backs up `data/`. Copy it yourself if the files matter.
- Known limits: no resumable uploads, no per-user quota, no rate limiting. These are also marked as a `shortcut:` comment in `server.mjs`.
