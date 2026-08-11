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

Optional Worker secret:

```text
CAPTURE_TOKEN
```

If `CAPTURE_TOKEN` is configured, POST requests to `/api/capture` must include the same value in the `X-Curator-Capture-Key` header. If the secret is absent, capture posting remains open.

## Routes

- `GET /api/health` — service/storage status
- `POST /api/capture` — receive and store a research capture
- `GET /api/recent` — recent captures as JSON
- `GET /recent` — searchable research inbox
- `GET /` — same research inbox

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
