declare const Spicetify: any;

import { normalizeText, spotifyGet } from "./spotify-album";

/**
 * Artistas que o usuário segue no Spotify – sem login extra.
 *
 * O app roda dentro do cliente do Spotify (Spicetify), que já está autenticado:
 *  1. Web API `GET /v1/me/following?type=artist` pela sessão do próprio cliente
 *     (paginada, 50 por vez);
 *  2. se o token do cliente não tiver esse escopo, tenta a biblioteca local
 *     (`Spicetify.Platform.LibraryAPI`), que também lista artistas seguidos.
 * A lista fica em cache (atualizada em segundo plano) para ativar o filtro na hora.
 */

const CACHE_KEY = "on-this-day:followed-artists:v1";
const CACHE_FRESH_MS = 6 * 60 * 60 * 1000;
const PAGE_LIMIT = 50;
const MAX_PAGES = 100; // até 5.000 artistas

type Cached = { names: string[]; at: number };

export function normalizeArtistName(name: string): string {
  return normalizeText(name);
}

function readCache(): Cached | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
    if (parsed && Array.isArray(parsed.names) && typeof parsed.at === "number") return parsed as Cached;
  } catch { /* sem cache */ }
  return null;
}

function writeCache(names: string[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ names, at: Date.now() } satisfies Cached)); } catch { /* ignore */ }
}

/** Lista em cache (qualquer idade), sem rede: permite abrir já filtrado enquanto atualiza em segundo plano. */
export function peekFollowedArtists(): string[] | null {
  const cached = readCache();
  return cached?.names.length ? cached.names : null;
}

async function fromWebApi(): Promise<string[]> {
  const names: string[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ type: "artist", limit: String(PAGE_LIMIT) });
    if (after) params.set("after", after);
    const result: { artists?: { items?: Array<{ name?: string }>; cursors?: { after?: string | null } } } =
      await spotifyGet(`https://api.spotify.com/v1/me/following?${params}`);
    for (const artist of result.artists?.items ?? []) if (artist.name) names.push(artist.name);
    after = result.artists?.cursors?.after ?? null;
    if (!after || !(result.artists?.items?.length)) break;
  }
  return names;
}

async function fromLibrary(): Promise<string[]> {
  const api = Spicetify?.Platform?.LibraryAPI;
  if (!api?.getContents) throw new Error("Biblioteca do Spotify indisponível");
  const names: string[] = [];
  const limit = 500;
  for (let offset = 0; offset < 10000; offset += limit) {
    const response = await api.getContents({ limit, offset });
    const items: Array<{ type?: string; name?: string }> = response?.items ?? [];
    for (const item of items) if (item.type === "artist" && item.name) names.push(item.name);
    if (items.length < limit) break;
  }
  return names;
}

export type FollowedLoad = { names: string[]; fromCache: boolean; stale: boolean };

/** Retorna a lista; usa cache recente, senão busca. Se a busca falhar, usa cache antigo antes de dar erro. */
export async function loadFollowedArtists(force = false): Promise<FollowedLoad> {
  const cached = readCache();
  if (!force && cached && Date.now() - cached.at < CACHE_FRESH_MS) {
    return { names: cached.names, fromCache: true, stale: false };
  }
  let names: string[] | null = null;
  try {
    names = await fromWebApi();
  } catch { /* tenta a biblioteca */ }
  if (!names?.length) {
    try { names = await fromLibrary(); } catch { /* sem alternativa */ }
  }
  if (names?.length) {
    const unique = [...new Set(names)];
    writeCache(unique);
    return { names: unique, fromCache: false, stale: false };
  }
  if (cached) return { names: cached.names, fromCache: true, stale: true };
  throw new Error("Não foi possível ler os artistas que você segue no Spotify.");
}

export function artistIsFollowed(followed: ReadonlySet<string>, artistNames: readonly string[]): boolean {
  return artistNames.some((name) => followed.has(normalizeArtistName(name)));
}
