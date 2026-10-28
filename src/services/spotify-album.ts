declare const Spicetify: any;

/**
 * Resolução de álbuns do MusicBrainz para o catálogo do Spotify.
 *
 * Compartilhada pelo card (duplo clique / capa) e pelo fundo dinâmico
 * (que usa os artistas do álbum encontrado para buscar fotos).
 * Só devolve `uri` quando a correspondência é confiável; caso contrário a
 * interface cai na pesquisa nativa do Spotify.
 */

export type AlbumQuery = {
  mbid: string;
  title: string;
  artistName: string;
  artistNames?: string[];
  firstReleaseDate: string;
};

export type SpotifyArtistRef = { id: string; name: string };

export type SpotifyAlbumLookup = {
  /** `spotify:album:<id>` somente quando a correspondência é única e validada. */
  uri: string | null;
  cover: string | null;
  /** Artistas do álbum encontrado (vazio quando não houve correspondência confiável). */
  artists: SpotifyArtistRef[];
};

type SpotifySearchAlbum = {
  id?: string;
  uri?: string;
  name?: string;
  album_type?: string;
  release_date?: string;
  artists?: Array<{ id?: string; name?: string }>;
  images?: Array<{ url?: string; width?: number }>;
};

type SpotifyAlbumSearchResponse = { albums?: { items?: SpotifySearchAlbum[] } };

type CachedLookup = SpotifyAlbumLookup & { expiresAt: number };

const CACHE_PREFIX = "on-this-day:spotify-album:v3:";
const LEGACY_CACHE_PREFIXES = ["on-this-day:spotify-album:v1:", "on-this-day:spotify-album:v2:"];
const CACHE_TTL = 14 * 24 * 60 * 60 * 1000;
const CACHE_MISS_TTL = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 400;
const MAX_CONCURRENT = 3;
const REQUEST_TIMEOUT_MS = 8000;
/** O Spotify limita `limit` a 10 na busca; valores maiores retornam 400. */
const SEARCH_LIMIT = 10;
const RATE_LIMIT_COOLDOWN_MS = 20_000;

/* ----------------------------- utilitários ----------------------------- */

export function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Remove sufixos de edição ("Deluxe", "Remastered", "(Expanded)") para comparar títulos. */
export function baseTitle(value: string): string {
  const stripped = value
    .replace(/[([][^)\]]*[)\]]/g, " ")
    .replace(/\s[-–—:]\s.*\b(deluxe|remaster(ed)?|edition|version|expanded|anniversary|bonus|mono|stereo|explicit)\b.*$/i, " ");
  const normalized = normalizeText(stripped);
  return normalized || normalizeText(value);
}

export function createLimiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return function limit<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        active += 1;
        task().then(resolve, reject).finally(() => {
          active -= 1;
          queue.shift()?.();
        });
      };
      if (active < max) start();
      else queue.push(start);
    });
  };
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

const limitSpotify = createLimiter(MAX_CONCURRENT);
let cooldownUntil = 0;

/** GET na Web API do Spotify usando a sessão do próprio cliente (Spicetify). */
export function spotifyGet<T>(url: string): Promise<T> {
  if (Date.now() < cooldownUntil) return Promise.reject(new Error("rate-limited"));
  return limitSpotify(async () => {
    if (!Spicetify?.CosmosAsync?.get) throw new Error("Spicetify.CosmosAsync indisponível");
    try {
      return await withTimeout(Spicetify.CosmosAsync.get(url) as Promise<T>, REQUEST_TIMEOUT_MS);
    } catch (error) {
      const status = (error as { status?: number })?.status ?? (error as { code?: number })?.code;
      if (status === 429) cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      throw error;
    }
  });
}

/* ------------------------------ correspondência ------------------------------ */

export type AlbumMatch = {
  selected: SpotifySearchAlbum | null;
  /** Álbum com título/artista compatíveis, usado apenas para capa de reserva. */
  coverCandidate: SpotifySearchAlbum | null;
};

export function pickAlbumMatch(query: AlbumQuery, albums: SpotifySearchAlbum[]): AlbumMatch {
  const expectedFull = normalizeText(query.title);
  const expectedBase = baseTitle(query.title);
  const expectedArtists = (query.artistNames?.length ? query.artistNames : [query.artistName]).map(normalizeText);
  const releaseYear = Number(query.firstReleaseDate.slice(0, 4));

  const candidates = albums.filter((album) => {
    if (!album.name || !album.id) return false;
    const titleOk = normalizeText(album.name) === expectedFull || baseTitle(album.name) === expectedBase;
    if (!titleOk) return false;
    return (album.artists ?? []).some((artist) => artist.name && expectedArtists.includes(normalizeText(artist.name)));
  });
  if (!candidates.length) return { selected: null, coverCandidate: null };

  const exact = candidates.filter((album) => normalizeText(album.name ?? "") === expectedFull);
  const pool = exact.length ? exact : candidates;
  const yearOf = (album: SpotifySearchAlbum) => Number(album.release_date?.slice(0, 4));

  const sameYear = pool.filter((album) => yearOf(album) === releaseYear);
  let selected: SpotifySearchAlbum | null = null;
  if (sameYear.length) {
    // Edições com o mesmo título/artista/ano são o mesmo álbum; prefere o tipo "album".
    selected = sameYear.find((album) => album.album_type === "album") ?? sameYear[0];
  } else if (pool.length === 1) {
    // Único candidato: aceita relançamento (data do Spotify igual ou posterior à original).
    const year = yearOf(pool[0]);
    if (!Number.isFinite(year) || year >= releaseYear) selected = pool[0];
  }
  return { selected, coverCandidate: selected ?? pool[0] };
}

function bestImage(album: SpotifySearchAlbum | null): string | null {
  const images = (album?.images ?? []).filter((image) => image.url);
  if (!images.length) return null;
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return (sorted.find((image) => (image.width ?? 0) <= 700) ?? sorted[0]).url ?? null;
}


/* ------------------------- correspondência flexível (só capa) ------------------------- */

const EDITION_WORDS = new Set(["deluxe", "expanded", "edition", "remastered", "remaster", "version", "bonus", "explicit", "anniversary", "special", "standard", "mono", "stereo", "the", "a", "an", "of"]);

export function titleTokens(value: string): string[] {
  return value
    .replace(/[([][^)\]]*[)\]]/g, " ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token && !EDITION_WORDS.has(token));
}

/** Similaridade 0–1 entre dois títulos (Jaccard dos termos, ignorando edições e parênteses). */
export function titleSimilarity(a: string, b: string): number {
  const first = new Set(titleTokens(a));
  const second = new Set(titleTokens(b));
  if (!first.size || !second.size) return 0;
  let shared = 0;
  first.forEach((token) => { if (second.has(token)) shared += 1; });
  return shared / (first.size + second.size - shared);
}

export function artistMatches(query: AlbumQuery, names: Array<string | undefined>): boolean {
  const expected = (query.artistNames?.length ? query.artistNames : [query.artistName]).map(normalizeText).filter(Boolean);
  return names.some((name) => {
    const normalized = name ? normalizeText(name) : "";
    return !!normalized && expected.some((e) => e === normalized || (e.length > 4 && normalized.includes(e)) || (normalized.length > 4 && e.includes(normalized)));
  });
}

/** Melhor álbum parecido o bastante para servir de capa (não é usado para abrir o álbum). */
export function pickCoverCandidate(query: AlbumQuery, albums: SpotifySearchAlbum[]): SpotifySearchAlbum | null {
  let best: SpotifySearchAlbum | null = null;
  let bestScore = 0;
  for (const album of albums) {
    if (!album.name || !bestImage(album)) continue;
    if (!artistMatches(query, (album.artists ?? []).map((artist) => artist.name))) continue;
    const similarity = titleSimilarity(query.title, album.name);
    if (similarity < 0.6) continue;
    const sameYear = Number(album.release_date?.slice(0, 4)) === Number(query.firstReleaseDate.slice(0, 4)) ? 0.05 : 0;
    const score = similarity + sameYear + (album.album_type === "album" ? 0.02 : 0);
    if (score > bestScore) { best = album; bestScore = score; }
  }
  return best;
}

/* ---------------------------------- cache ---------------------------------- */

const memory = new Map<string, Promise<SpotifyAlbumLookup>>();
let legacyPurged = false;

function purgeLegacyCache() {
  if (legacyPurged) return;
  legacyPurged = true;
  try {
    for (let i = 0; i < localStorage.length; ) {
      const key = localStorage.key(i);
      if (key && LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) localStorage.removeItem(key);
      else i += 1;
    }
  } catch { /* melhor esforço */ }
}

function readCache(mbid: string): SpotifyAlbumLookup | null {
  try {
    const key = `${CACHE_PREFIX}${mbid}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CachedLookup;
    if (typeof entry.expiresAt !== "number" || entry.expiresAt <= Date.now()) {
      localStorage.removeItem(key);
      return null;
    }
    return {
      uri: typeof entry.uri === "string" ? entry.uri : null,
      cover: typeof entry.cover === "string" ? entry.cover : null,
      artists: Array.isArray(entry.artists)
        ? entry.artists.filter((a) => a && typeof a.id === "string" && typeof a.name === "string")
        : [],
    };
  } catch {
    return null;
  }
}

/** Capa já resolvida (memória/localStorage), sem rede. */
export function peekCachedCover(mbid: string): string | null {
  const cached = readCache(mbid);
  return cached?.cover ?? null;
}

let writesSincePrune = 0;

function writeCache(mbid: string, result: SpotifyAlbumLookup): void {
  try {
    const ttl = result.uri || result.cover ? CACHE_TTL : CACHE_MISS_TTL;
    const entry: CachedLookup = { ...result, expiresAt: Date.now() + ttl };
    localStorage.setItem(`${CACHE_PREFIX}${mbid}`, JSON.stringify(entry));

    writesSincePrune += 1;
    if (writesSincePrune < 25) return;
    writesSincePrune = 0;
    const entries: Array<{ key: string; expiresAt: number }> = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(CACHE_PREFIX)) continue;
      try {
        const value = JSON.parse(localStorage.getItem(key) ?? "") as CachedLookup;
        entries.push({ key, expiresAt: typeof value.expiresAt === "number" ? value.expiresAt : 0 });
      } catch {
        localStorage.removeItem(key);
      }
    }
    if (entries.length > MAX_CACHE_ENTRIES) {
      entries.sort((a, b) => a.expiresAt - b.expiresAt);
      for (const stale of entries.slice(0, entries.length - MAX_CACHE_ENTRIES)) localStorage.removeItem(stale.key);
    }
  } catch { /* o cache em memória continua valendo */ }
}

/* --------------------------------- consulta --------------------------------- */

function searchUrl(q: string): string {
  const params = new URLSearchParams({ q, type: "album", limit: String(SEARCH_LIMIT) });
  return `https://api.spotify.com/v1/search?${params}`;
}

/** ID do artista (do próprio resultado da busca) cujo nome bate com o do álbum. */
function findArtistId(query: AlbumQuery, albums: SpotifySearchAlbum[]): string | null {
  for (const album of albums) {
    for (const artist of album.artists ?? []) {
      if (artist.id && artist.name && artistMatches(query, [artist.name])) return artist.id;
    }
  }
  return null;
}

async function lookupAlbum(query: AlbumQuery): Promise<SpotifyAlbumLookup> {
  const clean = (value: string) => value.replace(/["]+/g, " ").replace(/\s+/g, " ").trim();
  const title = clean(query.title);
  const artist = clean(query.artistName);
  const titleWithoutBrackets = clean(query.title.replace(/[([][^)\]]*[)\]]/g, " ")) || title;
  const mainTitle = clean(titleWithoutBrackets.split(/\s[-–—:]\s/)[0]) || titleWithoutBrackets;

  // Variações de consulta: filtros de campo → texto livre → título principal (sem subtítulo/edição).
  const queries = [...new Set([
    `album:"${title}" artist:"${artist}"`,
    `${titleWithoutBrackets} ${artist}`,
    `${mainTitle} ${artist}`,
  ])];
  const seen = new Map<string, SpotifySearchAlbum>();

  for (const q of queries) {
    const response = await spotifyGet<SpotifyAlbumSearchResponse>(searchUrl(q));
    const albums = response.albums?.items ?? [];
    albums.forEach((album) => { if (album.id) seen.set(album.id, album); });
    const { selected } = pickAlbumMatch(query, albums);
    if (selected) {
      return {
        uri: selected.id ? `spotify:album:${selected.id}` : null,
        cover: bestImage(selected),
        artists: (selected.artists ?? [])
          .filter((a): a is { id: string; name: string } => !!a.id && !!a.name)
          .map((a) => ({ id: a.id, name: a.name })),
      };
    }
  }
  // A busca do Spotify às vezes não traz o álbum certo nas primeiras posições (nome comum, muitos relançamentos).
  // Tenta de novo pela discografia do próprio artista, que é uma lista exata em vez de uma busca por relevância.
  const artistId = findArtistId(query, [...seen.values()]);
  if (artistId) {
    try {
      for (let offset = 0; offset < 100; offset += 50) {
        const page = await spotifyGet<{ items?: SpotifySearchAlbum[]; next?: string | null }>(
          `https://api.spotify.com/v1/artists/${encodeURIComponent(artistId)}/albums?include_groups=album,single&limit=50&offset=${offset}`,
        );
        const discography = page.items ?? [];
        discography.forEach((album) => { if (album.id) seen.set(album.id, album); });
        const { selected } = pickAlbumMatch(query, discography);
        if (selected) {
          return {
            uri: selected.id ? `spotify:album:${selected.id}` : null,
            cover: bestImage(selected),
            artists: (selected.artists ?? [])
              .filter((a): a is { id: string; name: string } => !!a.id && !!a.name)
              .map((a) => ({ id: a.id, name: a.name })),
          };
        }
        if (!page.next) break;
      }
    } catch { /* sem discografia: segue para a capa/pesquisa */ }
  }
  // Sem correspondência exata para abrir o álbum: ainda tenta uma capa compatível entre tudo que foi encontrado.
  const coverAlbum = pickCoverCandidate(query, [...seen.values()]);
  return { uri: null, cover: bestImage(coverAlbum), artists: [] };
}

/**
 * Busca (com deduplicação, cache persistente e limite de concorrência).
 * Erros de rede NÃO são gravados em cache: a próxima chamada tenta de novo.
 */
export function findSpotifyAlbum(query: AlbumQuery): Promise<SpotifyAlbumLookup> {
  purgeLegacyCache();
  const existing = memory.get(query.mbid);
  if (existing) return existing;

  const cached = readCache(query.mbid);
  if (cached) {
    const resolved = Promise.resolve(cached);
    memory.set(query.mbid, resolved);
    return resolved;
  }

  const pending = lookupAlbum(query)
    .then((found) => {
      writeCache(query.mbid, found);
      return found;
    })
    .catch(() => {
      memory.delete(query.mbid);
      return { uri: null, cover: null, artists: [] } as SpotifyAlbumLookup;
    });
  memory.set(query.mbid, pending);
  return pending;
}

/* -------------------------------- navegação -------------------------------- */

export function spotifyAlbumPath(uri: string | null): string | null {
  const id = uri?.match(/^spotify:album:([A-Za-z0-9]+)$/)?.[1];
  return id ? `/album/${id}` : null;
}

/** Pesquisa nativa do Spotify já na aba "Álbuns", com texto livre (os filtros de campo não funcionam na UI). */
export function spotifySearchPath(query: AlbumQuery): string {
  const text = `${query.title} ${query.artistName}`.replace(/\s+/g, " ").trim();
  return `/search/${encodeURIComponent(text)}/albums`;
}

export function navigateInSpotify(path: string): boolean {
  try {
    const history = Spicetify?.Platform?.History;
    if (history?.push) {
      history.push(path);
      return true;
    }
  } catch { /* cai para a notificação */ }
  try { Spicetify?.showNotification?.("Não foi possível abrir o Spotify automaticamente.", true); } catch { /* ignore */ }
  return false;
}

/**
 * Abre o álbum exato quando há correspondência confiável; caso contrário (ou se a
 * consulta demorar mais de `waitMs`) abre a pesquisa de álbuns do Spotify.
 */
export async function openAlbumInSpotify(query: AlbumQuery, waitMs = 3500): Promise<"album" | "search"> {
  let match: SpotifyAlbumLookup | null = null;
  try {
    match = await withTimeout(findSpotifyAlbum(query), waitMs);
  } catch { /* usa a pesquisa */ }
  const albumPath = spotifyAlbumPath(match?.uri ?? null);
  navigateInSpotify(albumPath ?? spotifySearchPath(query));
  return albumPath ? "album" : "search";
}
