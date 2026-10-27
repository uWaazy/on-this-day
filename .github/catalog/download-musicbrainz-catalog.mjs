#!/usr/bin/env node

import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const output = path.resolve(process.argv[2] ?? "release-group.tar.xz");
const indexUrl = "https://ftp.musicbrainz.org/pub/musicbrainz/data/json-dumps/";

const indexResponse = await fetch(indexUrl);
if (!indexResponse.ok) {
  throw new Error(`MusicBrainz index request failed: HTTP ${indexResponse.status}`);
}

const indexHtml = await indexResponse.text();
const snapshots = [...indexHtml.matchAll(/href="(\d{8}-\d{6})\//g)]
  .map((match) => match[1])
  .sort();
const latest = snapshots.at(-1);
if (!latest) throw new Error("Could not find a MusicBrainz JSON dump snapshot.");

const archiveUrl = `${indexUrl}${latest}/release-group.tar.xz`;
const checksumsResponse = await fetch(`${indexUrl}${latest}/SHA256SUMS`);
if (!checksumsResponse.ok) {
  throw new Error(`MusicBrainz checksum request failed: HTTP ${checksumsResponse.status}`);
}
const checksums = await checksumsResponse.text();
const expectedHash = checksums
  .split(/\r?\n/)
  .map((line) => {
    const match = /^([a-f\d]{64})\s+\*?(.+?)\s*$/i.exec(line);
    return match && path.posix.basename(match[2]) === "release-group.tar.xz"
      ? match[1]
      : null;
  })
  .find(Boolean);
if (!expectedHash) throw new Error("MusicBrainz checksum file did not list release-group.tar.xz.");

const response = await fetch(archiveUrl, { redirect: "follow" });
if (!response.ok || !response.body) {
  throw new Error(`MusicBrainz dump request failed: HTTP ${response.status}`);
}

await mkdir(path.dirname(output), { recursive: true });
await pipeline(Readable.fromWeb(response.body), createWriteStream(output));
const hash = createHash("sha256");
for await (const chunk of createReadStream(output)) hash.update(chunk);
const actualHash = hash.digest("hex");
if (actualHash !== expectedHash) {
  throw new Error(`MusicBrainz dump checksum mismatch: expected ${expectedHash}, got ${actualHash}`);
}
console.log(`Downloaded MusicBrainz snapshot ${latest} to ${output}`);
