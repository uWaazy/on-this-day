import { preloadImage } from "../api/artist-images";
import {
  artistMatches,
  createLimiter,
  findSpotifyAlbum,
  titleSimilarity,
  withTimeout,
  type AlbumQuery,
} from "./spotify-album";

/**
 * Capa de um álbum, sempre validada (a imagem precisa carregar de verdade).
 * Cadeia: Cover Art Archive → Spotify (correspondência exata e depois flexível) → iTunes Search.
 * Cada etapa só roda se a anterior falhar; resultados ficam em cache.
 */

const ITUNES_PREFIX = "on-this-day:itunes-cover:v1:";
const ITUNES_TTL = 30 * 24 * 60 * 60 * 1000;
const ITUNES_MISS_TTL = 24 * 60 * 60 * 1000;
const limitItunes = createLimiter(2);
const memory = new Map<string, Promise<string | null>>();

export function caaCoverUrl(mbid: string, size: 250 | 500 = 500): string {
  return `https://coverartarchive.org/release-group/${mbid}/front-${size}`;
}

type CachedItunes = { url: string | null; expiresAt: number };

function readItunes(mbid: string): CachedItunes | null {
  try {
    const entry = JSON.parse(localStorage.getItem(ITUNES_PREFIX + mbid) ?? "null") as CachedItunes | null;
    if (entry && typeof entry.expiresAt === "number" && entry.expiresAt > Date.now()) return entry;
  } catch { /* sem cache */ }
  return null;
}

function writeItunes(mbid: string, url: string | null) {
  try {
    localStorage.setItem(ITUNES_PREFIX + mbid, JSON.stringify({ url, expiresAt: Date.now() + (url ? ITUNES_TTL : ITUNES_MISS_TTL) } satisfies CachedItunes));
  } catch { /* ignore */ }
}

async function itunesCover(query: AlbumQuery): Promise<string | null> {
  const cached = readItunes(query.mbid);
  if (cached) return cached.url;
  const params = new URLSearchParams({
    term: `${query.title.replace(/[([][^)\]]*[)\]]/g, " ")} ${query.artistName}`.replace(/\s+/g, " ").trim(),
    media: "music",
    entity: "album",
    limit: "8",
  });
  const response = await limitItunes(() => withTimeout(fetch(`https://itunes.apple.com/search?${params}`), 8000));
  if (!response.ok) throw new Error(`itunes ${response.status}`);
  const data = await response.json() as { results?: Array<{ collectionName?: string; artistName?: string; artworkUrl100?: string }> };
  let best: string | null = null;
  let bestScore = 0;
  for (const result of data.results ?? []) {
    if (!result.collectionName || !result.artworkUrl100) continue;
    if (!artistMatches(query, [result.artistName])) continue;
    const similarity = titleSimilarity(query.title, result.collectionName);
    if (similarity >= 0.6 && similarity > bestScore) {
      best = result.artworkUrl100.replace(/\/\d+x\d+(bb)?\./, "/600x600bb.");
      bestScore = similarity;
    }
  }
  writeItunes(query.mbid, best);
  return best;
}

async function resolve(query: AlbumQuery, skipCaa: boolean): Promise<string | null> {
  if (!skipCaa) {
    const url = caaCoverUrl(query.mbid, 500);
    if (await preloadImage(url, 6000)) return url;
  }
  const spotify = await findSpotifyAlbum(query);
  if (spotify.cover && await preloadImage(spotify.cover, 6000)) return spotify.cover;
  try {
    const url = await itunesCover(query);
    if (url && await preloadImage(url, 6000)) return url;
  } catch { /* fonte indisponível */ }
  return null;
}

/** `skipCaa`: use quando o card já tentou o Cover Art Archive e ele falhou. */
export function resolveAlbumCover(query: AlbumQuery, skipCaa = false): Promise<string | null> {
  const key = `${query.mbid}:${skipCaa ? 1 : 0}`;
  const existing = memory.get(key);
  if (existing) return existing;
  const pending = resolve(query, skipCaa).then((url) => {
    if (!url) memory.delete(key); // falhas podem ser temporárias: permite nova tentativa
    return url;
  });
  memory.set(key, pending);
  return pending;
}
