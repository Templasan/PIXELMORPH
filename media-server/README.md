# PixelMorph media server

Stage 1 of cloud sync: a small local server that stores each user's photos and videos on the owner's PC. Supabase checks who is calling. The server uses only Node built-ins.

## What it stores

- Files go under `data/<sha256 of user id>/<sha256 of project id>/<sha256 of file id>`.
- The user id comes only from Supabase (`GET /auth/v1/user`). Nothing in the URL, headers or body can choose it.
- Routes: `PUT`, `GET` and `DELETE` on `/files/<projectId>/<fileId>`, plus `GET /health`. There is no listing route.
- Another user's files sit at a different path, so they answer 404.
- Who may use it: the Supabase account must be confirmed and its e-mail must be in `ALLOWED_EMAILS`. Anyone else gets 403 on every `/files` route, and nothing is written for them.

## How to start

```
ALLOWED_EMAILS=you@example.com SUPABASE_URL=https://<project>.supabase.co SUPABASE_KEY=<publishable key> npm start
```

- `ALLOWED_EMAILS` is required, a comma-separated list. The server fails closed: without it (or with it empty) it prints a message and exits with code 1. Set it before using ngrok, because anyone can sign up on the Supabase project.
- `ALLOW_ANY_CONFIRMED_USER=1` replaces the list with "any confirmed Supabase user". It prints a warning. Do not use it with ngrok.
- Only the publishable key is used. Never use the `service_role` key here.
- The server binds to `127.0.0.1` only, never `0.0.0.0`.
- Optional env: `PORT` (default 3000), `DATA_DIR` (default `media-server/data`), `MAX_UPLOAD_BYTES` (default 4 GiB), `MAX_USER_BYTES` (default 20 GiB, all of one user's files together).
- Tests: `npm test`.

## Reaching it from the phone

- Development: `adb reverse tcp:3000 tcp:3000`.
- Demo: `ngrok http 3000`, which gives an HTTPS address. Start the server with `ALLOWED_EMAILS` first.

## Backups and limits

- Nothing backs up `data/`. Copy it yourself if the files matter.
- Quota: an upload that would take a user past `MAX_USER_BYTES` gets 507 `quota_exceeded`, and the earlier version of that file stays. Replacing a file counts only the new size.
- Known limits: no resumable uploads, no rate limiting. These are also marked as a `shortcut:` comment in `server.mjs`.
