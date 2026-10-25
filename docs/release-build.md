# Isolated release build

Release builds must start from a new directory outside the repository so that
Next.js cannot discover or copy a developer `.env` file.

1. Run `npm run release:prepare -- <new-external-directory>`.
2. In that directory, install exactly from the lockfile with `npm ci`.
3. Set only synthetic, non-routable values required for validation, set
   `NEXT_DIST_DIR=.next-release`, and run `npm run build`.
4. Run `npm run release:verify-artifact -- .next-release/standalone`.
5. Copy the standalone directory to another external directory and run
   `node scripts/standalone-xlsx-smoke.cjs <artifact-directory>` there.

The preparation command uses an explicit source allowlist and refuses an
existing destination or a destination inside the repository. It never copies
`.env` files, Git metadata, dependencies, caches, uploads, or prior build
artifacts. The artifact verifier rejects environment files, credential files,
private-key filenames and private-key content without printing file contents.

Next.js can inline explicitly referenced `NEXT_PUBLIC_*` values into browser
bundles. Those values are public by design: never assign credentials, signing
keys, database URLs, or other secrets to a `NEXT_PUBLIC_*` variable. Release
validation may use a clearly synthetic `.invalid` application URL.
