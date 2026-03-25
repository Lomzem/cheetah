# Cheetah Cheat Sheets

Static Vite + React app for building math cheat sheets from a curated JSON formula library. The app compiles Typst directly in the browser, previews the generated PDF client-side, and downloads both `.pdf` and `.typ` files without any backend.

## Stack

- Vite
- React
- Tailwind CSS
- shadcn/ui primitives already present in the codebase
- bun
- Typst via `@myriaddreamin/typst.ts`

## Local development

```bash
bun install
bun run dev
```

## Formula data

The formula library lives in `formula-data/` as static JSON. Each formula now stores a `typst` expression.

## Quality checks

```bash
bun run verify:typst
bun run lint
bun run build
```

## GitHub Pages

This app is built for static hosting.

If you are deploying to a repository subpath on GitHub Pages, set `VITE_BASE_PATH` when building:

```bash
VITE_BASE_PATH=/your-repo-name/ bun run build
```
