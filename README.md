# Research Capture

Research Capture is the lightweight Safari-to-CuratorOS intake service for Ocean Liner Curator.

It receives selected text and surrounding page context from the iOS/iPadOS Shortcuts app, stores captures in Cloudflare KV, and presents a searchable research inbox for later review.

## Intended flow

`Safari selection → Share Sheet → Research Capture shortcut → POST /api/capture → Cloudflare KV → /recent`

Captures are discovery material only. They do **not** become canonical historical facts automatically.

## Cloudflare Worker

Worker source: `worker.js`

Expected KV binding:

```text
CURATOR_RESEARCH_CAPTURES
```

Required Worker secret:

```text
CAPTURE_TOKEN
```

`POST /api/capture`, `GET /api/recent`, and `GET /api/recovery-export` fail closed when `CAPTURE_TOKEN` is absent. Machine clients must send the same value in the `X-Curator-Capture-Key` header.

The human `/` and `/recent` inbox pages should be protected at the hostname/application layer with Cloudflare Access. Do not put `CAPTURE_TOKEN` in a query string or client-side JavaScript.

## Routes

- `GET /api/health` — service/storage status
- `GET /api/recovery-export` — authenticated full-KV recovery export; requires `CAPTURE_TOKEN`
- `POST /api/capture` — receive and store a research capture
- `GET /api/recent` — authenticated recent captures as JSON; requires `X-Curator-Capture-Key`
- `GET /recent` — searchable research inbox; protect with Cloudflare Access
- `GET /` — same research inbox; protect with Cloudflare Access

## Capture contract

```json
{
  "schemaVersion": 1,
  "source": "curator-research-capture-shortcut",
  "capturedAt": "2026-08-11T18:00:00.000Z",
  "page": {
    "url": "https://example.org/page",
    "canonical": "https://example.org/page",
    "title": "Source title",
    "site": "Archive or museum",
    "hostname": "example.org",
    "description": "Optional page description"
  },
  "selection": {
    "text": "Selected passage"
  },
  "context": {
    "text": "Surrounding paragraph or section"
  }
}
```

Stored records add a UUID, storage timestamp, `status: "new"`, and a research state initialized to `disposition: "unreviewed"`.

## Shortcut JavaScript

The Safari shortcut should gather the current selection and return an already-serialized `captureJSON` string so Shortcuts can POST the exact JSON bytes to `/api/capture` with `Content-Type: application/json`.

## Disaster recovery

A complete authenticated backup of the Research Capture KV archive is available through `/api/recovery-export`. It paginates the entire `capture:*` keyspace, includes the `latest` pointer, and embeds SHA-256 integrity metadata. See [`RECOVERY_EXPORT.md`](RECOVERY_EXPORT.md) for the iPad/Shortcut workflow and validation procedure.
