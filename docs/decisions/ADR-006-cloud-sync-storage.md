# ADR-006: Cloud sync stores the list in Supabase and the files on the owner's media server

**Date**: 2026-11-02
**Status**: ACCEPTED
**Refines**: ADR-002 (non-destructive editing) · **Relates to**: RNF-002 (HTTPS), RNF-001 (optional login)

## Context

Stage 2 of sync lets a signed-in user see the same projects on more than one device. Two kinds of
data are involved:

- **Project data**: each project's AsyncStorage entries (project, layers, editor images and the
  undo history with all its parts). Small, but it must agree between devices.
- **Media files**: photos and videos a project references. Large, and the owner wants them on their
  own PC, not on a hosted storage bucket.

## Decision

1. **Supabase holds accounts and the project list.** Table `public.project_sync`, row level
   security per user. The app talks to it with the publishable key only.
2. **The owner's media server holds the files.** `media-server/` runs on the owner's PC. Supabase
   checks each request's token (`GET /auth/v1/user`); the server never trusts a user id from the
   request. Each user's files sit under hashed paths.
3. **HTTP only to localhost, in development.** The phone reaches the PC through
   `adb reverse tcp:3000 tcp:3000`. Android allows cleartext for `localhost` alone
   (`network_security_config.xml`); everything else stays HTTPS.
4. **HTTPS for demos and production.** `EXPO_PUBLIC_MEDIA_SERVER_URL` points to an HTTPS address,
   for example one from `ngrok http 3000`. Then the localhost exception is removed.
5. **Conflicts are reported and never merged.** When both sides changed a project, neither copy is
   touched; the user sees the project's name in the result. A local project with changes is never
   deleted or overwritten by sync. Only a download of a project with no local copy writes, and only
   after every file has arrived.
6. **Sync is manual.** It runs when the user taps "Sincronizar agora". Nothing runs on its own.

## Consequences

- Deleting a project on one device removes it from the account (`deleted_at` on its row). Another
  device that still has the project unchanged keeps its local copy and reports the removal once
  ("removido da conta em outro aparelho"). It does not upload the copy back. A device with no copy
  and no record does not download a deleted project. If the user edits the kept copy, it goes back
  to the account, and that upload clears `deleted_at`.
- A file downloaded to a second device keeps the server key of the original file. The phone records
  it per local URI (`fileKeys` in the sync state) and does not upload the file back. A file replaced
  in place (size or time changed) uploads again under the same key; a new file gets a new key.
- Server files of deleted projects stay on the media server. Downloaded media is not removed when
  its project is deleted locally.
- Losing the PC means losing the media: the server has no backup. Stated in `media-server/README.md`.
- The media server has no quota, no rate limit and no resumable uploads (see `shortcut:` in
  `media-server/server.mjs`). It is for the owner's own devices, not a public service.
