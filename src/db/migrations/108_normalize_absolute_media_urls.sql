-- 108_normalize_absolute_media_urls.sql
--
-- Normalize stored media URLs from absolute (https://<host>/api/media/file/...)
-- to same-origin relative (/api/media/file/...). Legacy rows held the full
-- workers.dev origin, which is a DIFFERENT origin from the app (pages.dev): the
-- browser does not forward the pitchey-session cookie cross-origin, and a frontend
-- guard that ran new URL(value) silently dropped relative URLs. The only writer
-- (media-access.ts generateSignedUrl) already emits relative URLs; this backfills
-- the historical rows so storage matches.
--
-- Audited 2026-06-17: only these columns held absolute /api/media/file URLs
--   pitch_documents.file_url (26), pitches.title_image (6), users.profile_image (1).
-- pitches.thumbnail_url had 0 such rows but is included defensively.
-- request_logs.endpoint matched the relative pattern only — it is request-path
-- log data, NOT a stored media URL — and is deliberately excluded.
--
-- Idempotent: the WHERE guard means a re-run is a no-op once rows are relative.
-- Only the scheme+host prefix is stripped; relative and non-media values are
-- untouched.

UPDATE pitches
   SET title_image = regexp_replace(title_image, '^https?://[^/]+(/api/media/file/)', '\1')
 WHERE title_image ~ '^https?://[^/]+/api/media/file/';

UPDATE pitches
   SET thumbnail_url = regexp_replace(thumbnail_url, '^https?://[^/]+(/api/media/file/)', '\1')
 WHERE thumbnail_url ~ '^https?://[^/]+/api/media/file/';

UPDATE pitch_documents
   SET file_url = regexp_replace(file_url, '^https?://[^/]+(/api/media/file/)', '\1')
 WHERE file_url ~ '^https?://[^/]+/api/media/file/';

UPDATE users
   SET profile_image = regexp_replace(profile_image, '^https?://[^/]+(/api/media/file/)', '\1')
 WHERE profile_image ~ '^https?://[^/]+/api/media/file/';
