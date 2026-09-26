# Research Capture Recovery Export

Research Capture provides a complete, read-only export of the `CURATOR_RESEARCH_CAPTURES` namespace at:

`GET /api/recovery-export`

Unlike `/api/recent`, the recovery export paginates the full KV keyspace and is not limited to the most recent 100 captures.

## Security

The export contains the complete research intake archive and therefore requires the existing `CAPTURE_TOKEN`.

Send it in:

`X-Curator-Capture-Key: <CAPTURE_TOKEN>`

If `CAPTURE_TOKEN` is not configured, recovery export is disabled rather than becoming public.

The endpoint performs no KV writes.

## Export contents

The backup includes:

- every `capture:*` key and its complete JSON value
- the `latest` pointer, if present
- export timestamp
- capture count
- oldest/newest capture keys
- SHA-256 digest covering the exported data
- source binding and namespace identity

The response downloads as:

`research-capture-recovery-<timestamp>.json`

## iPad / iPhone

Because Safari cannot add the required custom request header by itself, use an authenticated Shortcut or another client that can send the `X-Curator-Capture-Key` header and save the response body as a file.

A suitable Shortcut flow is:

1. Get Contents of URL
2. URL: `https://<research-capture-host>/api/recovery-export`
3. Method: GET
4. Header: `X-Curator-Capture-Key` = the same token used by the Research Capture shortcut
5. Save File

Keep the backup outside GitHub and outside Cloudflare.

## Validation

From a checkout of this repository:

```bash
npm run recovery:validate -- /path/to/research-capture-recovery-....json
```

Validation checks:

- format and schema version
- capture-key structure
- duplicate keys
- summary count
- SHA-256 integrity

A failed validation means the file must not be used as a recovery source.

## Restore policy

There is intentionally no production restore endpoint.

As with CuratorOS institutional data, restoration should first be proven against a disposable KV namespace with an explicitly targeted remote write and post-write readback verification.
