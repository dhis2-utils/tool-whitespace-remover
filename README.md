# Whitespace Remover Tool

Tool to remove trailing, leading and double white space in metadata (name, shortName, description, code properties).

> **WARNING**
> This tool is intended to be used by system administrators to perform specific tasks, it is not intended for end users. It is available as a DHIS2 app, but has not been through the same rigorous testing as normal core apps. It should be used with care, and always tested in a development environment.

This app is built on the [DHIS2 App Platform](https://developers.dhis2.org/docs/app-platform/getting-started) (React + `@dhis2/app-runtime` + `@dhis2/ui`). It supports DHIS2 2.41 and later.

## License

© Copyright University of Oslo 2024

## Getting started

### Install dependencies

```
pnpm install
```

### Start dev server

```
pnpm start --proxy http://localhost:8080
```

Point `--proxy` at the DHIS2 instance you develop against. The dev server handles authentication and CORS via the proxy.

### Build for production

```
pnpm run build
```

The deployable `.zip` is written to `build/bundle/`, ready to install via App Management in DHIS2.

### Test

End-to-end acceptance tests (live DHIS2 instance required): see [`test/e2e/`](test/e2e/README.md).
User manual: [`docs/MANUAL.md`](docs/MANUAL.md).

### Lint and type-check

```
pnpm run lint
pnpm exec tsc --noEmit
```
