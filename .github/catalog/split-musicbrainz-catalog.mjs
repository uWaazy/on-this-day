#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const input =
  process.argv[2] ??
  "data/musicbrainz-albums-by-day.json";

const outputDir =
  process.argv[3] ??
  "data/musicbrainz/catalog";

const inputPath = path.resolve(input);
const outputPath = path.resolve(outputDir);

console.log("========================================");
console.log(" MusicBrainz Daily Catalog Splitter");
console.log("========================================");
console.log(`Entrada: ${inputPath}`);
console.log(`Saída:   ${outputPath}`);
console.log("");

const raw = await fs.readFile(inputPath, "utf8");
const source = JSON.parse(raw);

if (
  !source ||
  typeof source !== "object" ||
  !source.days ||
  typeof source.days !== "object"
) {
  throw new Error(
    "O catálogo não possui a estrutura esperada: days."
  );
}

await fs.mkdir(outputPath, {
  recursive: true,
});

const allDays = new Set();
for (let month = 1; month <= 12; month++) {
  const monthKey = String(month).padStart(2, "0");
  const daysInMonth = new Date(2024, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    allDays.add(`${monthKey}-${String(day).padStart(2, "0")}`);
  }
}

const entries = [...allDays]
  .sort()
  .map((monthDay) => [monthDay, source.days[monthDay] ?? []]);

let totalItems = 0;

for (const [monthDay, items] of entries) {
  if (!Array.isArray(items)) {
    console.warn(
      `Ignorando ${monthDay}: não é uma lista.`
    );
    continue;
  }

  const result = {
    schemaVersion: 2,
    monthDay,
    source: "MusicBrainz release-group database",
    generatedAt: source.generatedAt,
    yearRange: source.yearRange,
    items,
  };

  const outputFile = path.join(
    outputPath,
    `${monthDay}.json`
  );

  await fs.writeFile(
    outputFile,
    JSON.stringify(result),
    "utf8"
  );

  totalItems += items.length;

  console.log(
    `${monthDay}: ${items.length.toLocaleString()} álbuns`
  );
}

console.log("");
console.log("Catálogo diário criado.");
console.log(
  `Dias: ${entries.length}`
);
console.log(
  `Álbuns: ${totalItems.toLocaleString()}`
);
console.log(
  `Diretório: ${outputPath}`
);
