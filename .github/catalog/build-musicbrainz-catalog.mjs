#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const input = process.argv[2];
const output = process.argv[3] ?? path.resolve("data/musicbrainz-albums-by-day.json");

if (!input) {
  console.error("Uso:");
  console.error('node .github/catalog/build-musicbrainz-catalog.mjs "CAMINHO\\release-group.tar.xz"');
  process.exit(1);
}

if (!fs.existsSync(input)) {
  console.error(`Arquivo não encontrado: ${input}`);
  process.exit(1);
}

const minYear = Number(process.env.MB_MIN_YEAR ?? 1900);
const maxYear = Number(process.env.MB_MAX_YEAR ?? new Date().getUTCFullYear());

await fsp.mkdir(path.dirname(path.resolve(output)), { recursive: true });

const catalog = Object.create(null);

function getGenres(row) {
  const releaseGenres = Array.isArray(row.genres)
    ? row.genres.map((genre) => genre?.name).filter((name) => typeof name === "string")
    : [];
  if (releaseGenres.length) return [...new Set(releaseGenres)].slice(0, 8);

  const artistGenres = Array.isArray(row["artist-credit"])
    ? row["artist-credit"].flatMap((credit) => Array.isArray(credit?.artist?.genres)
        ? credit.artist.genres.map((genre) => genre?.name).filter((name) => typeof name === "string")
        : [])
    : [];
  return [...new Set(artistGenres)].slice(0, 8);
}

function processArchive() {
  return new Promise((resolve, reject) => {
    const child = spawn("tar", ["-xJOf", input], {
      stdio: ["ignore", "pipe", "inherit"],
      windowsHide: true
    });

    let carry = "";
    let processed = 0;
    let kept = 0;
    let skipped = 0;
    let malformed = 0;

    child.stdout.setEncoding("utf8");

    child.stdout.on("data", chunk => {
      carry += chunk;

      let newline;

      while ((newline = carry.indexOf("\n")) !== -1) {
        const line = carry.slice(0, newline).trim();
        carry = carry.slice(newline + 1);

        if (!line) continue;

        processed++;

        try {
          const row = JSON.parse(line);

          const date = row["first-release-date"];

          if (
            row["primary-type"] !== "Album" ||
            typeof date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date)
          ) {
            skipped++;
            continue;
          }

          const year = Number(date.slice(0, 4));

          if (year < minYear || year > maxYear) {
            skipped++;
            continue;
          }

          const artistNames = Array.isArray(row["artist-credit"])
            ? [...new Set(row["artist-credit"]
                .map(credit => typeof credit?.artist?.name === "string"
                  ? credit.artist.name
                  : typeof credit?.name === "string" ? credit.name : "")
                .filter(Boolean))]
            : [];
          const artistName = artistNames[0] ?? "Unknown Artist";

          const monthDay = date.slice(5);

          if (!catalog[monthDay]) {
            catalog[monthDay] = [];
          }

          catalog[monthDay].push({
            mbid: row.id,
            title: row.title,
            artistName,
            artistNames,
            firstReleaseDate: date,
            genres: getGenres(row),
            ratingVotes: Number(row.rating?.["votes-count"] ?? 0),
            ratingValue: Number(row.rating?.value ?? 0)
          });

          kept++;
        } catch {
          malformed++;
        }

        if (processed % 100000 === 0) {
          process.stderr.write(
            `\rProcessados: ${processed.toLocaleString()} | álbuns: ${kept.toLocaleString()}`
          );
        }
      }
    });

    child.stdout.on("end", () => {
      if (carry.trim()) {
        try {
          const row = JSON.parse(carry.trim());

          const date = row["first-release-date"];

          if (
            row["primary-type"] === "Album" &&
            typeof date === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(date)
          ) {
            const year = Number(date.slice(0, 4));

            if (year >= minYear && year <= maxYear) {
              const artistNames = Array.isArray(row["artist-credit"])
                ? [...new Set(row["artist-credit"]
                    .map(credit => typeof credit?.artist?.name === "string"
                      ? credit.artist.name
                      : typeof credit?.name === "string" ? credit.name : "")
                    .filter(Boolean))]
                : [];
              const artistName = artistNames[0] ?? "Unknown Artist";

              const monthDay = date.slice(5);

              if (!catalog[monthDay]) catalog[monthDay] = [];

              catalog[monthDay].push({
                mbid: row.id,
                title: row.title,
                artistName,
                artistNames,
                firstReleaseDate: date,
                genres: getGenres(row),
                ratingVotes: Number(row.rating?.["votes-count"] ?? 0),
                ratingValue: Number(row.rating?.value ?? 0)
              });

              kept++;
            }
          }
        } catch {
          malformed++;
        }
      }
    });

    child.on("error", reject);

    child.on("close", code => {
      process.stderr.write("\n");

      if (code !== 0) {
        reject(new Error(`tar terminou com código ${code}`));
        return;
      }

      resolve({ processed, kept, skipped, malformed });
    });
  });
}

console.log("========================================");
console.log(" MusicBrainz Catalog Builder");
console.log("========================================");
console.log(`Entrada: ${input}`);
console.log(`Anos: ${minYear} até ${maxYear}`);
console.log("");

const stats = await processArchive();

for (const day of Object.keys(catalog)) {
  catalog[day].sort((a, b) =>
    a.firstReleaseDate.localeCompare(b.firstReleaseDate) ||
    a.artistName.localeCompare(b.artistName) ||
    a.title.localeCompare(b.title)
  );
}

const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: "MusicBrainz release-group JSON dump",
  yearRange: {
    min: minYear,
    max: maxYear
  },
  days: catalog,
  stats
};

await fsp.writeFile(
  path.resolve(output),
  JSON.stringify(result),
  "utf8"
);

console.log("");
console.log("Catálogo criado!");
console.log(`Saída: ${path.resolve(output)}`);
console.log(`Release groups processados: ${stats.processed.toLocaleString()}`);
console.log(`Álbuns mantidos: ${stats.kept.toLocaleString()}`);
console.log(`Dias encontrados: ${Object.keys(catalog).length}`);
console.log(`Linhas inválidas: ${stats.malformed.toLocaleString()}`);

