declare const Spicetify: any;

import type { BackgroundCandidate } from "../services/background-selection";
import { findSpotifyAlbum, normalizeText, spotifyGet, withTimeout } from "../services/spotify-album";

/**
 * Resolve a fotografia da PESSOA (ou banda) dona do álbum em destaque. Nunca usa capa de álbum.
 *
 * Fontes, em ordem:
 *  1. Perfil do artista no Spotify, pelo ID do artista do álbum correspondente
 *     (evita confundir homônimos);
 *  2. imagens do perfil via GraphQL interno do Spicetify (cabeçalho/avatar);
 *  3. busca de artista no Spotify com nome idêntico (maior popularidade);
 *  4. Wikipedia (resumo do artigo), só se o artigo for de músico/banda.
 * Sem foto confiável, o artista é pulado e o próximo da fila assume o lugar.
 *
 * Limitação: nenhuma dessas fontes informa a data da foto, então não há como
 * garantir que ela seja da época do lançamento.
 */

export type ArtistPhoto = {
  url: string;
  kind: "artist";
  source: "spotify" | "spotify-graphql" | "wikipedia";
  spotifyArtistId?: string;
};

type SpotifyImage = { url?: string; width?: number };
type SpotifyArtist = { id?: string; name?: string; popularity?: number; images?: SpotifyImage[] };
type CachedPhoto = { url: string | null; kind: "artist"; id?: string; source?: ArtistPhoto["source"]; at: number };

const STORAGE_KEY = "on-this-day:artist-photos:v3";
const LEGACY_KEYS = ["on-this-day:artist-images", "on-this-day:artist-photos:v2"];
const HIT_TTL = 14 * 24 * 60 * 60 * 1000;
const MISS_TTL = 12 * 60 * 60 * 1000;
const MAX_ENTRIES = 300;

let store: Record<string, CachedPhoto> | null = null;
let persistTimer: number | undefined;
const inflight = new Map<string, Promise<ArtistPhoto | null>>();

function loadStore(): Record<string, CachedPhoto> {
  if (store) return store;
  store = {};
  try {
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") store = parsed as Record<string, CachedPhoto>;
  } catch { /* começa vazio */ }
  return store;
}

function persistSoon() {
  if (persistTimer !== undefined) return;
  persistTimer = window.setTimeout(() => {
    persistTimer = undefined;
    const current = loadStore();
    const keys = Object.keys(current);
    if (keys.length > MAX_ENTRIES) {
      keys.sort((a, b) => current[a].at - current[b].at);
      for (const key of keys.slice(0, keys.length - MAX_ENTRIES)) delete current[key];
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch { /* sem espaço: segue em memória */ }
  }, 1500);
}

function readEntry(key: string): CachedPhoto | null {
  const entry = loadStore()[key];
  if (!entry || typeof entry.at !== "number") return null;
  const ttl = entry.url ? HIT_TTL : MISS_TTL;
  if (Date.now() - entry.at > ttl) {
    delete loadStore()[key];
    return null;
  }
  return entry;
}

function writeEntry(key: string, entry: Omit<CachedPhoto, "at">) {
  loadStore()[key] = { ...entry, at: Date.now() };
  persistSoon();
}

function pickImage(images: SpotifyImage[] | undefined): string | null {
  const valid = (images ?? []).filter((image) => image.url);
  if (!valid.length) return null;
  const sorted = [...valid].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  // Fundo em tela cheia: prefere ~640px (o maior que o Spotify publica de forma estável).
  return (sorted.find((image) => (image.width ?? 0) >= 500 && (image.width ?? 0) <= 1000) ?? sorted[0]).url ?? null;
}

async function artistImageById(id: string): Promise<string | null> {
  const cached = readEntry(`id:${id}`);
  if (cached) return cached.url;
  const artist = await spotifyGet<SpotifyArtist>(`https://api.spotify.com/v1/artists/${encodeURIComponent(id)}`);
  const url = pickImage(artist.images);
  writeEntry(`id:${id}`, { url, kind: "artist", id });
  return url;
}

async function artistBySearch(name: string): Promise<{ id: string; url: string } | null> {
  const params = new URLSearchParams({ q: name, type: "artist", limit: "10" });
  const result = await spotifyGet<{ artists?: { items?: SpotifyArtist[] } }>(
    `https://api.spotify.com/v1/search?${params}`,
  );
  const expected = normalizeText(name);
  const exact = (result.artists?.items ?? [])
    .filter((artist) => artist.id && artist.name && normalizeText(artist.name) === expected && pickImage(artist.images))
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  const best = exact[0];
  if (!best?.id) return null;
  const url = pickImage(best.images);
  return url ? { id: best.id, url } : null;
}

async function viaGraphQL(id: string): Promise<string | null> {
  const gql = Spicetify?.GraphQL;
  const definition = gql?.Definitions?.queryArtistOverview;
  if (!gql?.Request || !definition) return null;
  const response = await withTimeout(
    gql.Request(definition, { uri: `spotify:artist:${id}`, locale: "", includePrerelease: false }) as Promise<any>,
    8000,
  );
  const visuals = response?.data?.artistUnion?.visuals;
  const sources: SpotifyImage[] = [
    ...(visuals?.headerImage?.sources ?? []),
    ...(visuals?.avatarImage?.sources ?? []),
  ].filter((source: SpotifyImage) => source?.url);
  if (!sources.length) return null;
  const sorted = [...sources].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return (sorted.find((source) => (source.width ?? 0) <= 1400) ?? sorted[sorted.length - 1]).url ?? null;
}

const MUSICIAN = /\b(singer|rapper|musician|band|duo|group|songwriter|record producer|dj|composer|vocalist|guitarist|pianist|drummer|bassist|trio|quartet|ensemble|hip hop|rock|pop|jazz|metal|punk)\b/i;

async function viaWikipedia(name: string): Promise<string | null> {
  const response = await withTimeout(
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/\s+/g, "_"))}`, {
      headers: { Accept: "application/json" },
    }),
    8000,
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`wikipedia ${response.status}`);
  const page = await response.json() as { type?: string; title?: string; description?: string; extract?: string; thumbnail?: { source?: string } };
  if (page.type !== "standard" || !page.thumbnail?.source) return null;
  if (normalizeText(page.title ?? "").replace(/\(.*$/, "") !== normalizeText(name) && !normalizeText(page.title ?? "").startsWith(normalizeText(name))) return null;
  if (!MUSICIAN.test(`${page.description ?? ""} ${(page.extract ?? "").slice(0, 200)}`)) return null;
  return page.thumbnail.source.replace(/\/\d+px-/, "/800px-");
}

async function resolve(candidate: BackgroundCandidate): Promise<ArtistPhoto | null> {
  const key = `artist:${candidate.key}`;
  const cached = readEntry(key);
  if (cached) return cached.url ? { url: cached.url, kind: "artist", source: cached.source ?? "spotify", spotifyArtistId: cached.id } : null;

  let failures = 0;
  const found = (url: string, source: ArtistPhoto["source"], id?: string): ArtistPhoto => {
    writeEntry(key, { url, kind: "artist", id, source });
    return { url, kind: "artist", source, spotifyArtistId: id };
  };
  const attempt = async <T,>(task: () => Promise<T | null>): Promise<T | null> => {
    try { return await task(); } catch { failures += 1; return null; }
  };

  // ID do artista do álbum correspondente.
  const album = await findSpotifyAlbum(candidate.album);
  const owner = album.artists.find((artist) => normalizeText(artist.name) === candidate.key);

  if (owner) {
    const url = await attempt(() => artistImageById(owner.id));
    if (url) return found(url, "spotify", owner.id);
    const gqlUrl = await attempt(() => viaGraphQL(owner.id));
    if (gqlUrl) return found(gqlUrl, "spotify-graphql", owner.id);
  }

  const bySearch = await attempt(() => artistBySearch(candidate.artistName));
  if (bySearch) return found(bySearch.url, "spotify", bySearch.id);

  const wiki = await attempt(() => viaWikipedia(candidate.artistName));
  if (wiki) return found(wiki, "wikipedia");

  // Só grava "sem foto" quando nenhuma fonte falhou por erro (evita cachear indisponibilidade).
  if (failures === 0) writeEntry(key, { url: null, kind: "artist" });
  return null;
}

/** Deduplica requisições em andamento para o mesmo artista. */
export function resolveArtistPhoto(candidate: BackgroundCandidate): Promise<ArtistPhoto | null> {
  const existing = inflight.get(candidate.key);
  if (existing) return existing;
  const pending = resolve(candidate).finally(() => inflight.delete(candidate.key));
  inflight.set(candidate.key, pending);
  return pending;
}

const loadedImages = new Set<string>();

/** Pré-carrega uma imagem (com timeout) e lembra das que já carregaram. */
export function preloadImage(url: string, timeoutMs = 7000): Promise<boolean> {
  if (loadedImages.has(url)) return Promise.resolve(true);
  return new Promise<boolean>((resolvePreload) => {
    const image = new Image();
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (ok) loadedImages.add(url);
      resolvePreload(ok);
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    image.decoding = "async";
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.src = url;
  });
}
