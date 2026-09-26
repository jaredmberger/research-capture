import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/validate-recovery-backup.mjs <backup.json>");
  process.exit(2);
}

let backup;
try {
  backup = JSON.parse(await readFile(file, "utf8"));
} catch (error) {
  fail(`Could not read valid JSON: ${error.message}`);
}

if (backup.format !== "research-capture-kv-recovery") fail("Unexpected backup format.");
if (backup.schemaVersion !== 1) fail(`Unsupported schemaVersion: ${backup.schemaVersion}`);
if (!backup.data || !Array.isArray(backup.data.captures)) fail("captures array is missing.");
if (!backup.integrity || backup.integrity.algorithm !== "SHA-256" || !backup.integrity.dataSha256) {
  fail("SHA-256 integrity metadata is missing.");
}

const seen = new Set();
for (const entry of backup.data.captures) {
  if (!entry || typeof entry.key !== "string" || !entry.key.startsWith("capture:")) {
    fail("Backup contains an invalid capture key.");
  }
  if (seen.has(entry.key)) fail(`Duplicate capture key: ${entry.key}`);
  seen.add(entry.key);
  if (!entry.value || typeof entry.value !== "object" || Array.isArray(entry.value)) {
    fail(`Capture value is invalid for ${entry.key}`);
  }
}

const actual = createHash("sha256").update(JSON.stringify(backup.data)).digest("hex");
if (actual !== backup.integrity.dataSha256) fail("SHA-256 integrity check failed.");
if (Number(backup.summary?.captureCount) !== backup.data.captures.length) {
  fail("Summary captureCount does not match the exported capture array.");
}

console.log("Research Capture recovery backup is valid.");
console.log(`Exported: ${backup.exportedAt || "unknown"}`);
console.log(`Captures: ${backup.data.captures.length}`);
console.log(`Latest pointer included: ${backup.data.latest !== null}`);
console.log(`SHA-256: ${actual}`);

function fail(message) {
  console.error(`Invalid Research Capture recovery backup: ${message}`);
  process.exit(1);
}
