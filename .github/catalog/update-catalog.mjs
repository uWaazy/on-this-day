#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function parseArgs(argv) {
  const out = { flags: new Set(), values: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    if (["no-lookup", "dry-run", "help"].includes(key)) out.flags.add(key);
    else out.values[key] = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.flags.has("help")) {
  console.log(fsHelp());
  process.exit(0);
}

function fsHelp() {
  return "Uso: node .github/catalog/update-catalog.mjs [--dir pasta] [--since AAAA-MM-DD] [--until AAAA-MM-DD] [--no-lookup] [--dry-run] [--max n] [--api url] [--delay ms] [--contact info]";
}

const catalogDir = args.values.dir ? path.resolve(process.cwd(), args.values.dir) : path.join(projectRoot, "data/site/catalog");
const statePath = path.join(path.dirname(catalogDir), "catalog-state.json");
const apiBase = (args.values.api ?? "https://musicbrainz.org/ws/2").replace(/\/+$/, "");
const delayMs = Number(args.values.delay ?? 1100);
const dryRun = args.flags.has("dry-run");
const lookup = !args.flags.has("no-lookup");
const maxNew = args.values.max ? Number(args.values.max) : Infinity;
const contact = args.values.contact ?? process.env.MB_CONTACT ?? "https://github.com/on-this-day-spicetify";
const userAgent = `OnThisDayCatalogUpdater/1.0 ( ${contact} )`;
const PAGE = 100;

const isoDate = (date) => date.toISOString().slice(0, 10);
const addDays = (iso, days) => isoDate(new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


let lastRequest = 0;
async function mbGet(pathAndQuery) {
  const url = `${apiBase}${pathAndQuery}`;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const wait = lastRequest + delayMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    try {
      const response = await fetch(url, { headers: { "User-Agent": userAgent, Accept: "application/json" } });
      if (response.ok) return await response.json();
      if (response.status === 404) return null;
      if (response.status === 503 || response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const backoff = (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 4000 * 2 ** attempt);
        console.warn(`  ⚠ HTTP ${response.status}; nova tentativa em ${Math.round(backoff / 1000)}s`);
        await sleep(backoff);
        continue;
      }
      throw new Error(`HTTP ${response.status} em ${url}`);
    } catch (error) {
      if (attempt === 5) throw error;
      const backoff = 3000 * 2 ** attempt;
      console.warn(`  ⚠ ${error.message}; nova tentativa em ${Math.round(backoff / 1000)}s`);
      await sleep(backoff);
    }
  }
  throw new Error(`Falha após várias tentativas: ${url}`);
}

const dayFiles = new Map();

async function loadDay(monthDay) {
  let entry = dayFiles.get(monthDay);
  if (entry) return entry;
  const file = path.join(catalogDir, `${monthDay}.json`);
  let data;
  try {
    data = JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    data = { schemaVersion: 2, monthDay, source: "MusicBrainz release-group database", generatedAt: new Date().toISOString(), items: [] };
  }
  if (!Array.isArray(data.items)) data.items = [];
  entry = { data, dirty: false, ids: new Set(data.items.map((item) => item.mbid)) };
  dayFiles.set(monthDay, entry);
  return entry;
}

async function atomicWrite(file, content) {
  const tmp = `${file}.tmp-${process.pid}`;
  await fs.writeFile(tmp, content);
  await fs.rename(tmp, file);
}

async function flushDays() {
  for (const [monthDay, entry] of dayFiles) {
    if (!entry.dirty || dryRun) continue;
    entry.data.updatedAt = new Date().toISOString();
    await atomicWrite(path.join(catalogDir, `${monthDay}.json`), JSON.stringify(entry.data));
    entry.dirty = false;
  }
}

async function readState() {
  try { return JSON.parse(await fs.readFile(statePath, "utf8")); } catch { return null; }
}

async function writeState(syncedUntil) {
  if (dryRun) return;
  await atomicWrite(statePath, JSON.stringify({ schemaVersion: 1, syncedUntil, updatedAt: new Date().toISOString() }, null, 2));
}

async function inferSince() {
  let newest = null;
  for (const monthDay of ["01-01", "06-15", "12-31"]) {
    try {
      const data = JSON.parse(await fs.readFile(path.join(catalogDir, `${monthDay}.json`), "utf8"));
      const generated = typeof data.generatedAt === "string" ? data.generatedAt.slice(0, 10) : null;
      if (generated && (!newest || generated > newest)) newest = generated;
    } catch { }
  }
  return newest;
}


const NON_ARTIST = /^(various artists?|unknown( artist)?|\[?no artist\]?|\[?anonymous\]?|\[?traditional\]?|\[?unknown\]?|\[?data\]?|special purpose.*)$/i;

function hasValidText(value, checkNonArtist = false) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || (checkNonArtist && NON_ARTIST.test(trimmed))) return false;
  const norm = trimmed.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, "");
  return Boolean(norm && (/\p{L}/u.test(norm) || norm.length >= 2));
}

function artistNamesOf(row) {
  const credits = Array.isArray(row["artist-credit"]) ? row["artist-credit"] : [];
  return [...new Set(credits.map((credit) => (typeof credit?.artist?.name === "string" ? credit.artist.name : credit?.name)).filter((n) => hasValidText(n, true)))];
}

function genresOf(row, fallbackTags) {
  const genres = Array.isArray(row?.genres) ? row.genres.map((g) => g?.name).filter((n) => typeof n === "string") : [];
  if (genres.length) return [...new Set(genres)].slice(0, 8);
  const tags = (fallbackTags ?? []).slice().sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).map((t) => t?.name).filter((n) => typeof n === "string");
  return [...new Set(tags)].slice(0, 8);
}

function toCatalogItem(searchRow, detail, critic) {
  const source = detail ?? searchRow;
  const artistNames = artistNamesOf(source).length ? artistNamesOf(source) : artistNamesOf(searchRow);
  const item = {
    mbid: searchRow.id,
    title: searchRow.title,
    artistName: artistNames[0] ?? "Unknown Artist",
    artistNames,
    firstReleaseDate: searchRow["first-release-date"],
    genres: genresOf(detail, searchRow.tags),
    ratingVotes: Number(detail?.rating?.["votes-count"] ?? 0),
    ratingValue: Number(detail?.rating?.value ?? 0),
  };
  if (critic && typeof critic.value === "number" && critic.value > 0) {
    item.criticScore = critic.value;
    item.criticVotes = critic.count;
  }
  return item;
}

const LETTER_GRADES = { "A+": 97, A: 93, "A-": 90, "B+": 87, B: 83, "B-": 80, "C+": 77, C: 73, "C-": 70, "D+": 67, D: 63, "D-": 60, F: 42 };
const XXL_GRADES = { XXL: 95, XL: 80, L: 65, M: 50, S: 35 };

function parseWikiScoreToken(raw) {
  const cleaned = String(raw ?? "").replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, " ").replace(/<ref[^>]*\/>/gi, " ").trim();
  if (!cleaned) return null;
  const tpl = /\{\{\s*(?:[Rr]ating|[Rr]ating-inline)\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)/.exec(cleaned);
  if (tpl && Number(tpl[2]) > 0) return Math.round((Number(tpl[1]) / Number(tpl[2])) * 100);
  const ratio = /\b([0-9.]+)\s*\/\s*(100|10|5|4)\b/.exec(cleaned);
  if (ratio && Number(ratio[2]) > 0) return Math.round((Number(ratio[1]) / Number(ratio[2])) * 100);
  const plain = /^\s*([0-9]{2,3})\s*$/.exec(cleaned);
  if (plain && Number(plain[1]) >= 15 && Number(plain[1]) <= 100) return Number(plain[1]);
  const grade = cleaned.replace(/\{\{[^{}]*\}\}/g, "").replace(/'''|''/g, "").trim().toUpperCase();
  return XXL_GRADES[grade] ?? LETTER_GRADES[grade] ?? null;
}

async function fetchWikiCriticScore(title, artistName) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const q = `${title} ${artistName} album`.replace(/["]+/g, " ").trim();
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=2&format=json`;
    const sRes = await fetch(searchUrl, { headers: { "User-Agent": userAgent }, signal: controller.signal }).then((r) => r.json());
    const pageId = sRes?.query?.search?.[0]?.pageid;
    if (!pageId) return null;
    const revUrl = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=revisions&rvprop=content&rvslots=main&format=json`;
    const rRes = await fetch(revUrl, { headers: { "User-Agent": userAgent }, signal: controller.signal }).then((r) => r.json());
    const page = rRes?.query?.pages?.[String(pageId)];
    const rev = page?.revisions?.[0];
    const text = rev?.slots?.main?.["*"] ?? rev?.["*"] ?? "";
    if (!text) return null;
    const scores = [];
    let mcVal = null;
    const mc = /\|\s*(?:MC|mc)\s*=\s*([^\n|]+)/.exec(text);
    if (mc) { mcVal = parseWikiScoreToken(mc[1]); if (mcVal) scores.push(mcVal); }
    const revRe = /\|\s*rev\d+score\s*=\s*([^\n]+)/gi;
    let m;
    while ((m = revRe.exec(text)) !== null) {
      const s = parseWikiScoreToken(m[1]);
      if (s !== null) scores.push(s);
    }
    if (!scores.length) return null;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const value = mcVal ? Math.round(mcVal * 0.55 + avg * 0.45) : Math.round(avg);
    return { value: Math.max(20, Math.min(99, value)), count: mcVal ? Math.max(scores.length + 5, 7) : scores.length };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const minYear = Number(process.env.MB_MIN_YEAR ?? 1900);
const today = isoDate(new Date());
const maxYear = Number(process.env.MB_MAX_YEAR ?? new Date().getUTCFullYear());

const state = await readState();
const explicitSince = args.values.since;
let since = explicitSince ?? (state?.syncedUntil ? addDays(state.syncedUntil, -7) : null);
if (!since) {
  const inferred = await inferSince();
  since = inferred ? addDays(inferred, -14) : `${maxYear - 1}-01-01`;
}
const until = args.values.until ?? `${maxYear}-12-31`;
for (const [name, value] of [["since", since], ["until", until]]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) { console.error(`--${name} inválido: ${value} (use AAAA-MM-DD)`); process.exit(1); }
}

await fs.mkdir(catalogDir, { recursive: true });
console.log("========================================");
console.log(" On This Day — atualização do catálogo");
console.log("========================================");
console.log(`Pasta:   ${catalogDir}`);
console.log(`Período: ${since} → ${until}${dryRun ? "  (simulação, nada será gravo)" : ""}`);
console.log(`Detalhes por álbum (gêneros/notas): ${lookup ? "sim (≈1 álbum/s)" : "não (só tags da busca)"}`);
console.log("");

let found = 0;
let added = 0;
let skippedExisting = 0;
let skippedInvalid = 0;
const touched = new Set();
let reachedMax = false;

for (let start = since; start <= until && !reachedMax; start = addDays(start, 8)) {
  const end = addDays(start, 7) < until ? addDays(start, 7) : until;
  const query = encodeURIComponent(`primarytype:album AND firstreleasedate:[${start} TO ${end}]`);
  let offset = 0;
  let total = Infinity;
  let windowAdded = 0;

  while (offset < total && !reachedMax) {
    const page = await mbGet(`/release-group/?query=${query}&fmt=json&limit=${PAGE}&offset=${offset}`);
    const rows = page?.["release-groups"] ?? [];
    total = Number(page?.count ?? rows.length);
    if (!rows.length) break;
    offset += rows.length;

    for (const row of rows) {
      found += 1;
      const date = row["first-release-date"];
      const year = Number(String(date).slice(0, 4));
      if (row["primary-type"] !== "Album" || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || year < minYear || year > maxYear || !row.id || !hasValidText(row.title) || !artistNamesOf(row).length) {
        skippedInvalid += 1;
        continue;
      }
      const day = await loadDay(date.slice(5));
      if (day.ids.has(row.id)) { skippedExisting += 1; continue; }

      let detail = null;
      let critic = null;
      if (lookup && !dryRun) {
        const primaryArtist = artistNamesOf(row)[0] ?? "";
        const [mbDetail, wikiCritic] = await Promise.all([
          mbGet(`/release-group/${row.id}?inc=genres+ratings+artist-credits&fmt=json`).catch((error) => {
            console.warn(`  ⚠ sem detalhes de "${row.title}": ${error.message}`);
            return null;
          }),
          fetchWikiCriticScore(row.title, primaryArtist),
        ]);
        detail = mbDetail;
        critic = wikiCritic;
      }
      const item = toCatalogItem(row, detail, critic);
      day.ids.add(item.mbid);
      if (!dryRun) {
        day.data.items.push(item);
        day.dirty = true;
      }
      touched.add(date.slice(5));
      windowAdded += 1;
      added += 1;
      if (added >= maxNew) { reachedMax = true; break; }
    }
  }

  await flushDays();
  if (!reachedMax) await writeState(end > today ? today : end);
  console.log(`${start} → ${end}: ${windowAdded} novo(s)`);
}

await flushDays();
console.log("");
console.log(`Encontrados no período: ${found.toLocaleString()}`);
console.log(`Já existiam no catálogo: ${skippedExisting.toLocaleString()}`);
console.log(`Ignorados (data incompleta/tipo): ${skippedInvalid.toLocaleString()}`);
console.log(`${dryRun ? "Seriam adicionados" : "Adicionados"}: ${added.toLocaleString()} em ${touched.size} dia(s) do ano`);
if (!dryRun && added) console.log("Pronto. Reabra o On This Day (ou recarregue o catálogo) para ver os novos álbuns.");
