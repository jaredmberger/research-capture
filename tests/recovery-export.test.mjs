import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker.js";

function makeStore(values) {
  return {
    async list({ prefix, cursor }) {
      assert.equal(prefix, "capture:");
      if (!cursor) {
        return {
          keys: Object.keys(values).filter(k => k.startsWith("capture:")).slice(0, 2).map(name => ({ name })),
          list_complete: Object.keys(values).filter(k => k.startsWith("capture:")).length <= 2,
          cursor: "page-2"
        };
      }
      return {
        keys: Object.keys(values).filter(k => k.startsWith("capture:")).slice(2).map(name => ({ name })),
        list_complete: true,
        cursor: ""
      };
    },
    async get(key, type) {
      const value = Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
      if (value === null) return null;
      if (type === "text") return JSON.stringify(value);
      if (type === "json") return value;
      return JSON.stringify(value);
    },
    async put() {}
  };
}

test("recovery export requires CAPTURE_TOKEN configuration", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/api/recovery-export"),
    { CURATOR_RESEARCH_CAPTURES: makeStore({}) }
  );
  assert.equal(response.status, 503);
});

test("recovery export rejects wrong token", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/api/recovery-export", {
      headers: { "x-curator-capture-key": "wrong" }
    }),
    { CAPTURE_TOKEN: "right", CURATOR_RESEARCH_CAPTURES: makeStore({}) }
  );
  assert.equal(response.status, 401);
});

test("recovery export paginates all captures and includes integrity metadata", async () => {
  const values = {
    "capture:001:a": { id: "a", selection: { text: "A" } },
    "capture:002:b": { id: "b", selection: { text: "B" } },
    "capture:003:c": { id: "c", selection: { text: "C" } },
    latest: { id: "c", selection: { text: "C" } }
  };

  const response = await worker.fetch(
    new Request("https://example.test/api/recovery-export", {
      headers: { "x-curator-capture-key": "secret" }
    }),
    { CAPTURE_TOKEN: "secret", CURATOR_RESEARCH_CAPTURES: makeStore(values) }
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.format, "research-capture-kv-recovery");
  assert.equal(body.summary.captureCount, 3);
  assert.deepEqual(body.data.captures.map(x => x.key), [
    "capture:001:a",
    "capture:002:b",
    "capture:003:c"
  ]);
  assert.equal(body.data.latest.id, "c");
  assert.match(body.integrity.dataSha256, /^[a-f0-9]{64}$/);
});
