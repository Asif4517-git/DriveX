# DriveX

DriveX is a browser-based driving prototype using Three.js and cannon-es. It currently includes a single licensed concept car, a garage, free-roam village prototype and circuit time trial. It is **not yet** the complete simulator described in the project vision: see [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) for current limitations and [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md) for third-party licenses and credits.

## Run locally

Requires Node.js 22 and pnpm 11.17.0:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev --host 0.0.0.0
```

Open the Vite URL in a desktop browser. Controls are configurable from Settings. The browser stores local choices and time-trial records.

## Validate and build

```sh
pnpm run typecheck
pnpm test
GITHUB_REPOSITORY=Asif4517-git/DriveX pnpm run build
```

The last command builds for the GitHub Pages `/DriveX/` subpath; serve the resulting `dist` directory at that path to test. A successful local build is not proof of a live deployment. `node_modules/` can be recreated with the install command above.
