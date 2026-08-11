const VERSION = "1.0.0";

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function nowISO() {
  return new Date().toISOString();
}

function makeId() {
  return crypto.randomUUID();
}

function safeString(value, max = 10000) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return value || "";
  }
}

function normalizeCapture(input) {
  const page = input?.page || {};
  const selection = input?.selection || {};
  const context = input?.context || {};

  return {
    schemaVersion: 1,
    source: "curator-research-capture-shortcut",
    status: "new",
    capturedAt: safeString(input?.capturedAt, 100) || nowISO(),

    page: {
      url: safeString(page.url, 4000),
      canonical: safeString(page.canonical, 4000),
      title: safeString(page.title, 1500),
      site: safeString(page.site, 1000),
      hostname: safeString(page.hostname, 500),
      description: safeString(page.description, 6000)
    },

    selection: {
      text: safeString(selection.text, 30000)
    },

    context: {
      text: safeString(context.text, 50000)
    },

    research: {
      notes: null,
      entity: null,
      disposition: "unreviewed"
    }
  };
}

async function requireCaptureToken(request, env) {
  if (!env.CAPTURE_TOKEN) return null;

  const supplied = request.headers.get("x-curator-capture-key");

  if (supplied === env.CAPTURE_TOKEN) return null;

  return json(
    {
      ok: false,
      error: "Unauthorized capture request."
    },
    401
  );
}

async function saveCapture(env, capture) {
  if (!env.CURATOR_RESEARCH_CAPTURES) {
    return {
      stored: false,
      reason: "CURATOR_RESEARCH_CAPTURES binding is not configured."
    };
  }

  const id = makeId();
  const timestamp = Date.now();
  const key = `capture:${String(timestamp).padStart(13, "0")}:${id}`;

  const stored = {
    id,
    ...capture,
    storedAt: nowISO()
  };

  await env.CURATOR_RESEARCH_CAPTURES.put(
    key,
    JSON.stringify(stored)
  );

  await env.CURATOR_RESEARCH_CAPTURES.put(
    "latest",
    JSON.stringify(stored)
  );

  return {
    stored: true,
    id,
    key,
    record: stored
  };
}

async function readRecent(env, limit = 30) {
  if (!env.CURATOR_RESEARCH_CAPTURES) {
    return {
      ok: false,
      error: "CURATOR_RESEARCH_CAPTURES binding is not configured.",
      records: []
    };
  }

  const listing = await env.CURATOR_RESEARCH_CAPTURES.list({
    prefix: "capture:",
    limit: Math.min(Math.max(limit, 1), 100)
  });

  const keys = listing.keys
    .map(item => item.name)
    .sort()
    .reverse()
    .slice(0, limit);

  const records = [];

  for (const key of keys) {
    const record = await env.CURATOR_RESEARCH_CAPTURES.get(key, "json");
    if (record) records.push(record);
  }

  return {
    ok: true,
    count: records.length,
    records
  };
}

async function recentPage(env) {
  const recent = await readRecent(env, 50);

  if (!recent.ok) {
    return html(
      `<!doctype html><meta charset="utf-8"><title>Research Capture</title><p>${escapeHTML(recent.error)}</p>`,
      503
    );
  }

  const cards = recent.records.length
    ? recent.records.map(record => {
        const quote = record.selection?.text || "No selected text stored.";
        const context = record.context?.text || "";
        const site = record.page?.site || record.page?.hostname || "Unknown source";
        const title = record.page?.title || "Untitled source";
        const url = record.page?.canonical || record.page?.url || "";

        return `
          <article class="capture" data-search="${escapeHTML(`${title} ${site} ${quote} ${context}`.toLowerCase())}">
            <div class="capture-top">
              <span class="status">NEW</span>
              <time>${escapeHTML(formatDate(record.capturedAt))}</time>
            </div>

            <div class="source">${escapeHTML(site)}</div>
            <h2>${escapeHTML(title)}</h2>

            <blockquote>${escapeHTML(quote)}</blockquote>

            ${context && context !== quote ? `
              <details>
                <summary>Surrounding context</summary>
                <p>${escapeHTML(context)}</p>
              </details>
            ` : ""}

            <div class="meta">
              <span>Disposition: ${escapeHTML(record.research?.disposition || "unreviewed")}</span>
              <span>ID: ${escapeHTML(record.id || "")}</span>
            </div>

            ${url ? `<a class="open" href="${escapeHTML(url)}" target="_blank" rel="noopener">Open source →</a>` : ""}
          </article>
        `;
      }).join("")
    : `<div class="empty">No research captures yet.</div>`;

  return html(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Research Capture — CuratorOS</title>
  <style>
    :root {
      color-scheme: dark;
      --bg:#07100e;
      --panel:rgba(14,24,21,.94);
      --text:#f3eee4;
      --muted:#aaa69c;
      --brass:#bfa46a;
      --line:rgba(191,164,106,.28);
      --soft:rgba(255,255,255,.035);
    }
    *{box-sizing:border-box}
    body{margin:0;background:radial-gradient(circle at top,rgba(191,164,106,.09),transparent 34rem),var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .shell{width:min(980px,calc(100% - 28px));margin:0 auto;padding:38px 0 70px}
    header{margin-bottom:24px}
    .eyebrow{color:var(--brass);font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px}
    h1{font:500 clamp(32px,6vw,54px)/1.05 Georgia,"Times New Roman",serif;margin:0 0 10px}
    .intro{color:var(--muted);max-width:720px;line-height:1.6;margin:0}
    .toolbar{display:flex;gap:10px;align-items:center;margin:22px 0}
    .search{width:100%;border:1px solid var(--line);background:rgba(255,255,255,.035);color:var(--text);padding:12px 14px;border-radius:12px;font:inherit;outline:none}
    .search:focus{border-color:var(--brass);box-shadow:0 0 0 3px rgba(191,164,106,.08)}
    .count{white-space:nowrap;color:var(--brass);font-size:12px;border:1px solid var(--line);padding:8px 10px;border-radius:999px}
    .captures{display:grid;gap:14px}
    .capture{padding:20px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.04),transparent),var(--panel);box-shadow:0 16px 40px rgba(0,0,0,.18)}
    .capture-top{display:flex;justify-content:space-between;gap:14px;align-items:center;margin-bottom:13px}
    .status{color:var(--brass);background:rgba(191,164,106,.1);border:1px solid rgba(191,164,106,.25);font-size:10px;font-weight:800;letter-spacing:.08em;padding:5px 8px;border-radius:999px}
    time{color:var(--muted);font-size:12px}
    .source{color:var(--brass);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px}
    h2{font:500 21px/1.25 Georgia,"Times New Roman",serif;margin:0 0 14px}
    blockquote{margin:0;padding:14px 16px;border-left:3px solid var(--brass);background:var(--soft);border-radius:0 10px 10px 0;font:400 16px/1.55 Georgia,"Times New Roman",serif;white-space:pre-wrap}
    details{margin-top:14px;border-top:1px solid rgba(255,255,255,.06);padding-top:12px}
    summary{cursor:pointer;color:var(--brass);font-size:12px;font-weight:700}
    details p{color:var(--muted);line-height:1.6;white-space:pre-wrap;margin:10px 0 0}
    .meta{display:flex;flex-wrap:wrap;gap:8px 16px;color:var(--muted);font-size:11px;margin-top:14px}
    .open{display:inline-block;margin-top:14px;color:var(--brass);font-size:13px;font-weight:700;text-decoration:none}
    .empty{padding:42px 20px;border:1px dashed var(--line);border-radius:16px;text-align:center;color:var(--muted)}
    footer{margin-top:28px;text-align:center;color:var(--muted);font-size:11px}
    @media(max-width:620px){.shell{padding-top:28px}.capture{padding:17px}.toolbar{align-items:stretch;flex-direction:column}.count{align-self:flex-start}}
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <div class="eyebrow">⚓ CuratorOS · Research Intake</div>
      <h1>Research Capture</h1>
      <p class="intro">Selected passages and source context captured from Safari. Captures are discovery material awaiting review; they do not become canonical historical facts automatically.</p>
    </header>

    <div class="toolbar">
      <input id="search" class="search" type="search" placeholder="Search captures…" autocomplete="off">
      <div class="count"><span id="visibleCount">${recent.records.length}</span> capture${recent.records.length === 1 ? "" : "s"}</div>
    </div>

    <section id="captures" class="captures">${cards}</section>

    <footer>Ocean Liner Curator · CuratorOS</footer>
  </main>

  <script>
    const input = document.getElementById('search');
    const cards = [...document.querySelectorAll('.capture')];
    const count = document.getElementById('visibleCount');

    input?.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      let visible = 0;

      for (const card of cards) {
        const show = !q || card.dataset.search.includes(q);
        card.hidden = !show;
        if (show) visible++;
      }

      count.textContent = visible;
    });
  </script>
</body>
</html>`);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "Research Capture",
        version: VERSION,
        storage: Boolean(env.CURATOR_RESEARCH_CAPTURES),
        tokenProtection: Boolean(env.CAPTURE_TOKEN),
        time: nowISO()
      });
    }

    if (request.method === "GET" && url.pathname === "/api/recent") {
      const requested = Number(url.searchParams.get("limit") || 30);
      const limit = Number.isFinite(requested)
        ? Math.min(Math.max(Math.trunc(requested), 1), 100)
        : 30;

      const recent = await readRecent(env, limit);
      return json(recent, recent.ok ? 200 : 503);
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/recent")) {
      return recentPage(env);
    }

    if (request.method === "POST" && url.pathname === "/api/capture") {
      const authError = await requireCaptureToken(request, env);
      if (authError) return authError;

      let input;

      try {
        input = await request.json();
      } catch {
        return json(
          {
            ok: false,
            error: "Request body must be valid JSON."
          },
          400
        );
      }

      if (!input?.selection?.text || !String(input.selection.text).trim()) {
        return json(
          {
            ok: false,
            error: "Capture must include selection.text."
          },
          400
        );
      }

      if (!input?.page?.url) {
        return json(
          {
            ok: false,
            error: "Capture must include page.url."
          },
          400
        );
      }

      try {
        const pageUrl = new URL(input.page.url);
        if (!/^https?:$/.test(pageUrl.protocol)) {
          throw new Error("unsupported protocol");
        }
      } catch {
        return json(
          {
            ok: false,
            error: "Capture page URL must be a valid http(s) URL."
          },
          400
        );
      }

      const capture = normalizeCapture(input);
      const storage = await saveCapture(env, capture);

      const confirmation = [
        "⚓ RESEARCH CAPTURE SAVED",
        "",
        capture.page.title || "Untitled source",
        capture.page.site || capture.page.hostname || "Unknown source",
        "",
        storage.stored
          ? "✓ Added to the CuratorOS research inbox"
          : "⚠ Capture accepted but could not be stored",
        "",
        storage.id ? `Capture: ${storage.id}` : ""
      ].filter(Boolean).join("\n");

      return json({
        ok: true,
        accepted: true,
        stored: storage.stored,
        service: "Research Capture",
        version: VERSION,
        id: storage.id || null,
        confirmation,
        capture: {
          title: capture.page.title,
          site: capture.page.site || capture.page.hostname,
          disposition: capture.research.disposition,
          status: capture.status
        },
        capturedAt: capture.capturedAt
      });
    }

    return json(
      {
        ok: false,
        error: "Not found"
      },
      404
    );
  }
};
