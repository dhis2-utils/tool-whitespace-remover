# Whitespace Remover Tool

> ![Maturity: Validated](https://img.shields.io/badge/maturity-Validated-yellow)  
> Intended use: remove leading, trailing and double whitespace from metadata names, short names, codes and descriptions.  
> Maintainers: HISP Centre implementation team.

> [!WARNING]
> This tool is intended to be used by system administrators to perform specific tasks, it is not intended for end users. It is available as a DHIS2 app, but has not been through the same rigorous testing as normal core apps. It should be used with care, and always tested in a development environment.

The Whitespace Remover Tool finds metadata with extra whitespace in its name, short name, code or description, checks that removing it creates no duplicates, and removes it. The [user documentation](docs/user/tool-whitespace-remover.md) explains how to use it and lists its known limitations.

## Supported DHIS2 versions

2.41 and later. Version 1.0.1 was tested on 2.41, 2.42 and 2.43.

## Development

The app is built on the [DHIS2 App Platform](https://developers.dhis2.org/docs/app-platform/getting-started) (React, TypeScript, `@dhis2/app-runtime` and `@dhis2/ui`).

### Prerequisites

- Node.js 22.
- pnpm, in the version set by `packageManager` in `package.json`. With Corepack enabled (`corepack enable`), the right version is used automatically.
- A DHIS2 instance, 2.41 or later, to develop against. To start one locally, see [DHIS2 in Docker](https://developers.dhis2.org/docs/tutorials/dhis2-docker/).

### Install dependencies

```
pnpm install
```

### Start the app against a local instance

```
pnpm start --proxy http://localhost:8080
```

Point `--proxy` at the DHIS2 instance you develop against. The dev server handles authentication and CORS through the proxy.

### Test, lint and build

```
pnpm test
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
```

`pnpm test` runs the unit tests in `src/`. `pnpm run build` writes the installable zip to `build/bundle/`.

The end-to-end suite in [`e2e/`](e2e/README.md) drives the built app on a live instance. It changes and deletes data, so read its README before you run it.

### Release

Releases follow the [release workflow](https://github.com/dhis2-utils/reference-tool-conventions/blob/main/RELEASE-WORKFLOW.md) of the tool conventions: bump `version` in `package.json`, add a section to `CHANGELOG.md`, merge to `main`, and push a `vX.Y.Z` tag. The Release workflow builds the app and attaches the zip to a GitHub release.

## License

BSD-3-Clause. © Copyright University of Oslo 2026.
