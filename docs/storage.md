# Object storage

Permanent ticket and internal-message attachments go through `src/lib/storage`. PostgreSQL stores metadata; the configured provider stores object bytes. S3 credentials never go to the browser.

## Configuration

Development defaults to the local adapter (`STORAGE_DRIVER=local`, `STORAGE_LOCAL_DIR=./uploads`). Production should use `STORAGE_DRIVER=s3` and set `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, and `S3_FORCE_PATH_STYLE`.

`S3_ENDPOINT` and `S3_REGION` must match the bucket's actual Hetzner location (for example `https://fsn1.your-objectstorage.com` and `fsn1`). Never use `NEXT_PUBLIC_` for credentials. Put real values only in the deployment secret store or an ignored local `.env` file.

Uploads are authenticated and receive a random normalized key such as `tickets/2026/09/<uuid>-file.pdf`. Clients submit attachment IDs, never S3 keys. Download routes authorize the ID and redirect to a five-minute presigned GET URL when S3 is enabled; the bucket remains private.

Object uploads use compensating cleanup if metadata creation fails. Deletion must authorize first, delete the object, then delete metadata; immutable/audit records require a separate business decision. `storageHealthCheck()` checks connectivity without returning credentials or signed URLs.

Create a private bucket and S3 credentials in the Hetzner Console. Use the bucket's real location rather than assuming `fsn1`. For rotation, create a replacement credential, deploy and verify it, then revoke the old one. Never commit secrets or log signed URLs.

The Excel school import is intentionally in-memory and temporary. There are currently no school-attachment, chat-file, report-file, or avatar-file upload flows; profile avatars remain URL metadata. Future file flows must use this same `StorageProvider`.
