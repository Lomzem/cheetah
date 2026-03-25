# Tectonic Compiler Service

This service exposes a tiny HTTP API around `tectonic`.

## Endpoints

- `GET /health`
- `POST /compile` with JSON `{ "tex": "..." }`

Successful compile responses return:

```json
{
  "ok": true,
  "pdfBase64": "...",
  "logs": "...",
  "pageCount": 1
}
```

## Build and run

```bash
docker build -f services/latex-compiler/Dockerfile -t cheetah-tectonic .
docker run --rm -p 8080:8080 cheetah-tectonic
```

Then point the app at it with:

```bash
LATEX_COMPILER_URL=http://localhost:8080/compile
```
