#!/usr/bin/env node

/**
 * Baixa um dump JSON do MusicBrainz (o snapshot mais recente) e confere o SHA-256.
 *
 *   node .github/catalog/download-musicbrainz-catalog.mjs [saida] [entidade]
 *
 *   entidade: release-group (padrão, álbuns) ou artist (aniversários de artistas).
 *
 * Se o arquivo de saída já existir e o hash for igual ao do snapshot mais recente, o download é
 * pulado (não baixa de novo a cada execução).
 */

import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const entity = process.argv[3] ?? "release-group";
if (!/^[a-z][a-z-]*$/.test(entity)) {
  throw new Error(`Entidade inválida: "${entity}". Use "release-group" ou "artist".`);
}

const fileName = `${entity}.tar.xz`;
const output = path.resolve(process.argv[2] ?? fileName);
const indexUrl = "https://ftp.musicbrainz.org/pub/musicbrainz/data/json-dumps/";

async function sha256Of(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

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

const archiveUrl = `${indexUrl}${latest}/${fileName}`;
const checksumsResponse = await fetch(`${indexUrl}${latest}/SHA256SUMS`);
if (!checksumsResponse.ok) {
  throw new Error(`MusicBrainz checksum request failed: HTTP ${checksumsResponse.status}`);
}
const checksums = await checksumsResponse.text();
const expectedHash = checksums
  .split(/\r?\n/)
  .map((line) => {
    const match = /^([a-f\d]{64})\s+\*?(.+?)\s*$/i.exec(line);
    return match && path.posix.basename(match[2]) === fileName
      ? match[1]
      : null;
  })
  .find(Boolean);
if (!expectedHash) throw new Error(`MusicBrainz checksum file did not list ${fileName}.`);

if (existsSync(output) && (await sha256Of(output)) === expectedHash) {
  console.log(`${fileName} já está na versão mais recente (snapshot ${latest}); download pulado.`);
  process.exit(0);
}

const response = await fetch(archiveUrl, { redirect: "follow" });
if (!response.ok || !response.body) {
  throw new Error(`MusicBrainz dump request failed: HTTP ${response.status}`);
}

const total = Number(response.headers.get("content-length")) || 0;
const toMb = (bytes) => (bytes / 1048576).toFixed(0);
let received = 0;
let lastLog = 0;
const progress = new Transform({
  transform(chunk, _encoding, callback) {
    received += chunk.length;
    const now = Date.now();
    if (now - lastLog > 5000) {
      lastLog = now;
      const percent = total ? ` (${Math.floor((received / total) * 100)}%)` : "";
      process.stderr.write(`Baixando ${fileName}: ${toMb(received)} MB${total ? ` / ${toMb(total)} MB` : ""}${percent}\n`);
    }
    callback(null, chunk);
  },
});

await mkdir(path.dirname(output), { recursive: true });
await pipeline(Readable.fromWeb(response.body), progress, createWriteStream(output));

const actualHash = await sha256Of(output);
if (actualHash !== expectedHash) {
  throw new Error(`MusicBrainz dump checksum mismatch: expected ${expectedHash}, got ${actualHash}`);
}
console.log(`Downloaded MusicBrainz snapshot ${latest} (${fileName}, ${toMb(received)} MB) to ${output}`);
