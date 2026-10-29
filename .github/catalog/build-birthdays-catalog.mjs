#!/usr/bin/env node

/**
 * Gera os aniversários de artistas (um arquivo por dia: birthdays/MM-DD.json) a partir do dump
 * JSON de artistas do MusicBrainz. Não usa a API (que limita a ~1 requisição/segundo): o dump
 * inteiro é lido uma única vez, em streaming, e filtrado localmente.
 *
 *   node .github/catalog/build-birthdays-catalog.mjs <artist.tar.xz> [pasta-de-saida]
 *
 * Opções (flag ou variável de ambiente):
 *   --max-per-day   MB_BIRTHDAYS_MAX_PER_DAY   máximo de artistas por dia, os mais relevantes primeiro (200)
 *   --min-year      MB_BIRTHDAYS_MIN_YEAR      ano de nascimento mínimo (1900)
 *   --max-age       MB_BIRTHDAYS_MAX_AGE       idade máxima de quem não tem morte registrada (100)
 *   --min-total     MB_BIRTHDAYS_MIN_TOTAL     mínimo de artistas no total; abaixo disso o build falha,
 *                                              para nunca publicar um dump truncado (1000)
 *
 * Regras: só pessoas (type = Person) com data de nascimento completa (AAAA-MM-DD) e sem data de morte.
 * Para valer a pena mostrar, o artista precisa ter um link do Spotify ou ao menos um gênero no MusicBrainz.
 */

import fsp from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";

function parseArgs(argv) {
  const positional = [];
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) values[arg.slice(2)] = argv[++i];
    else positional.push(arg);
  }
  return { positional, values };
}

const { positional, values } = parseArgs(process.argv.slice(2));
const input = positional[0];
const outputDir = path.resolve(positional[1] ?? "data/site/catalog/birthdays");

const numberOption = (flag, env, fallback) => {
  const raw = values[flag] ?? process.env[env];
  const value = raw === undefined || raw === "" ? fallback : Number(raw);
  if (!Number.isFinite(value)) throw new Error(`Valor inválido para --${flag}: "${raw}"`);
  return value;
};

const maxPerDay = numberOption("max-per-day", "MB_BIRTHDAYS_MAX_PER_DAY", 200);
const minYear = numberOption("min-year", "MB_BIRTHDAYS_MIN_YEAR", 1900);
const maxAge = numberOption("max-age", "MB_BIRTHDAYS_MAX_AGE", 100);
const minTotal = numberOption("min-total", "MB_BIRTHDAYS_MIN_TOTAL", 1000);
const currentYear = new Date().getUTCFullYear();

if (!input) {
  console.error("Uso: node .github/catalog/build-birthdays-catalog.mjs <artist.tar.xz> [pasta-de-saida]");
  process.exit(1);
}

try {
  await fsp.access(input);
} catch {
  console.error(`Arquivo não encontrado: ${input}`);
  console.error("Baixe com: npm run catalog:birthdays");
  process.exit(1);
}

const SPOTIFY_ARTIST = /open\.spotify\.com\/(?:intl-[a-z-]+\/)?artist\/([A-Za-z0-9]{22})/;

function isRealDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function spotifyIdOf(row) {
  if (!Array.isArray(row.relations)) return undefined;
  for (const relation of row.relations) {
    const resource = relation?.url?.resource;
    if (typeof resource !== "string") continue;
    const match = SPOTIFY_ARTIST.exec(resource);
    if (match) return match[1];
  }
  return undefined;
}

/** Converte uma linha do dump em um aniversariante, ou null quando não serve. */
function toBirthday(row) {
  if (!row || row.type !== "Person" || typeof row.id !== "string" || typeof row.name !== "string") return null;

  const span = row["life-span"];
  const born = span?.begin;
  if (typeof born !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(born);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (!isRealDate(year, month, day)) return null;
  if (year < minYear || year > currentYear - 3) return null;

  // Só quem está vivo: sem data de morte e sem a marca "ended".
  const died = span.ended === true || (typeof span.end === "string" && span.end !== "");
  if (died) return null;
  if (currentYear - year > maxAge) return null;

  const genres = (Array.isArray(row.genres) ? row.genres : [])
    .filter((genre) => typeof genre?.name === "string" && genre.name)
    .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0));
  const spotifyId = spotifyIdOf(row);
  if (!spotifyId && !genres.length) return null;

  const hasWiki = Array.isArray(row.relations) && row.relations.some((relation) =>
    typeof relation?.url?.resource === "string" && /(wikidata|wikipedia)\.org\//.test(relation.url.resource));
  const genreVotes = genres.reduce((total, genre) => total + (Number(genre.count) || 0), 0);
  const ratingVotes = Number(row.rating?.["votes-count"]) || 0;
  const score =
    (spotifyId ? 40 : 0) +
    (hasWiki ? 15 : 0) +
    Math.min(genreVotes * 2, 30) +
    Math.min(ratingVotes * 2, 15) +
    Math.min(genres.length * 2, 6);

  const country = typeof row.country === "string" && /^[A-Z]{2}$/.test(row.country)
    ? row.country
    : row.area?.["iso-3166-1-codes"]?.find?.((code) => /^[A-Z]{2}$/.test(code));

  return {
    monthDay: `${match[2]}-${match[3]}`,
    score,
    item: {
      mbid: row.id,
      name: row.name,
      born,
      ...(country ? { country } : {}),
      ...(genres.length ? { genres: [...new Set(genres.map((genre) => genre.name))].slice(0, 4) } : {}),
      ...(spotifyId ? { spotifyId } : {}),
    },
  };
}

const byDay = new Map();
const stats = { lines: 0, malformed: 0, kept: 0 };

function readArchive() {
  return new Promise((resolve, reject) => {
    const child = spawn("tar", ["-xJOf", input], { stdio: ["ignore", "pipe", "inherit"], windowsHide: true });
    const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });

    lines.on("line", (line) => {
      const text = line.trim();
      if (!text) return;
      stats.lines += 1;
      if (stats.lines % 200000 === 0) {
        process.stderr.write(`Processados: ${stats.lines.toLocaleString()} | aniversariantes: ${stats.kept.toLocaleString()}\n`);
      }
      let row;
      try {
        row = JSON.parse(text);
      } catch {
        stats.malformed += 1;
        return;
      }
      const birthday = toBirthday(row);
      if (!birthday) return;
      const list = byDay.get(birthday.monthDay) ?? [];
      list.push(birthday);
      byDay.set(birthday.monthDay, list);
      stats.kept += 1;
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`tar terminou com código ${code}`));
      else resolve();
    });
  });
}

console.log("========================================");
console.log(" MusicBrainz Artist Birthdays Builder");
console.log("========================================");
console.log(`Entrada: ${path.resolve(input)}`);
console.log(`Saída:   ${outputDir}`);
console.log(`Regras:  nascidos desde ${minYear}, até ${maxAge} anos, no máximo ${maxPerDay} por dia`);
console.log("");

await readArchive();

if (stats.kept < minTotal) {
  throw new Error(
    `Só ${stats.kept} aniversariantes encontrados (mínimo ${minTotal}). O dump pode estar incompleto ou ter mudado de formato; nada foi publicado.`,
  );
}

await fsp.mkdir(outputDir, { recursive: true });

const generatedAt = new Date().toISOString();
let written = 0;
let totalItems = 0;
for (let month = 1; month <= 12; month += 1) {
  const daysInMonth = new Date(Date.UTC(2024, month, 0)).getUTCDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const monthDay = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const items = (byDay.get(monthDay) ?? [])
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name) || a.item.mbid.localeCompare(b.item.mbid))
      .slice(0, maxPerDay)
      .map((entry) => entry.item);
    const file = path.join(outputDir, `${monthDay}.json`);
    const tmp = `${file}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify({
      schemaVersion: 1,
      monthDay,
      source: "MusicBrainz artist database",
      generatedAt,
      items,
    }), "utf8");
    await fsp.rename(tmp, file);
    written += 1;
    totalItems += items.length;
  }
}

console.log("");
console.log("Aniversários criados!");
console.log(`Linhas lidas:            ${stats.lines.toLocaleString()}`);
console.log(`Linhas inválidas:        ${stats.malformed.toLocaleString()}`);
console.log(`Elegíveis (antes do corte): ${stats.kept.toLocaleString()}`);
console.log(`Arquivos de dia:         ${written}`);
console.log(`Artistas publicados:     ${totalItems.toLocaleString()}`);
console.log(`Diretório:               ${outputDir}`);
