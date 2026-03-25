# Cheetah Cheat Sheets

A TanStack Start app for building one-page math cheat sheets from a curated JSON formula library. Users can select formulas, choose `1/2/3` columns, add plain-text notes, preview the generated PDF, and download the matching `.tex` source.

## App setup

```bash
bun install
bun run dev
```

## Formula data

The formula library lives in `formula-data/` as JSON.

## Tectonic compiler service

The app can compile locally if `tectonic` is installed, but the preferred deployment path is the Dockerized compiler service in `services/latex-compiler/`.

Build and run it directly:

```bash
docker build -f services/latex-compiler/Dockerfile -t cheetah-tectonic .
docker run --rm -p 8080:8080 cheetah-tectonic
```

Or with Compose:

```bash
docker compose up --build latex-compiler
```

Then point the app at it:

```bash
LATEX_COMPILER_URL=http://localhost:8080/compile
```

Health check:

```bash
curl http://localhost:8080/health
```

## Quality checks

```bash
bun run lint
bun run format
bun run check
bun run build
```
