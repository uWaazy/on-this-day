import type { MusicBrainzCatalogItem } from "../api/catalog";
import { normalizeText } from "./spotify-album";

/**
 * Seleção dos artistas do fundo dinâmico.
 *
 * Consome exatamente os mesmos itens que os cards exibem (já filtrados por
 * gênero / "só quem eu sigo"), então não existe um segundo sistema de filtragem.
 * Não há lista fixa nem sorteio: o ranking usa só dados reais do catálogo
 * (votos e nota da comunidade MusicBrainz) com desempate determinístico.
 */

export const VISIBLE_ARTISTS = 6;
export const POOL_SIZE = 18;
const MAX_ALBUMS_PER_ARTIST = 2;

export type BackgroundCandidate = {
  /** Chave estável (artista normalizado) – usada para cache e comparação entre filtros. */
  key: string;
  artistName: string;
  /** Álbum mais destacado do artista na tela atual. */
  album: BackgroundAlbum;
  /** Até 2 álbuns do artista (mais relevantes primeiro): suas capas alternam com a foto do artista. */
  albums: BackgroundAlbum[];
  year: number;
};

export type BackgroundAlbum = {
  mbid: string;
  title: string;
  artistName: string;
  artistNames?: string[];
  firstReleaseDate: string;
};

const NON_ARTIST = /^(various artists?|unknown( artist)?|\[?no artist\]?|\[?anonymous\]?|\[?traditional\]?|\[?unknown\]?|\[?data\]?|special purpose.*)$/i;

function primaryArtist(item: MusicBrainzCatalogItem): string | null {
  const names = item.artistNames?.length ? item.artistNames : [item.artistName];
  for (const name of names) {
    const trimmed = name?.trim();
    if (trimmed && !NON_ARTIST.test(trimmed)) return trimmed;
  }
  return null;
}

function compareRelevance(a: MusicBrainzCatalogItem, b: MusicBrainzCatalogItem): number {
  return (
    (b.ratingVotes ?? 0) - (a.ratingVotes ?? 0) ||
    (b.ratingValue ?? 0) - (a.ratingValue ?? 0) ||
    Number(!!b.genres?.length) - Number(!!a.genres?.length) ||
    Number(b.firstReleaseDate.slice(0, 4)) - Number(a.firstReleaseDate.slice(0, 4)) ||
    a.title.localeCompare(b.title) ||
    a.mbid.localeCompare(b.mbid)
  );
}

/**
 * Retorna até `limit` artistas distintos, na ordem de relevância dos álbuns.
 * Os `VISIBLE_ARTISTS` primeiros correspondem aos álbuns mais destacados; o
 * restante forma a reserva usada pela rotação.
 */
export function selectBackgroundCandidates(
  items: readonly MusicBrainzCatalogItem[],
  limit = POOL_SIZE,
): BackgroundCandidate[] {
  if (!items.length) return [];
  const ranked = [...items].sort(compareRelevance);
  const result: BackgroundCandidate[] = [];

  const byKey = new Map<string, BackgroundCandidate>();
  for (const item of ranked) {
    const artist = primaryArtist(item);
    if (!artist || !item.mbid || !item.title) continue;
    const key = normalizeText(artist);
    if (!key) continue;
    const album: BackgroundAlbum = {
      mbid: item.mbid,
      title: item.title,
      artistName: item.artistName,
      artistNames: item.artistNames,
      firstReleaseDate: item.firstReleaseDate,
    };
    const existing = byKey.get(key);
    if (existing) {
      if (existing.albums.length < MAX_ALBUMS_PER_ARTIST) existing.albums.push(album);
      continue;
    }
    if (byKey.size >= limit) continue; // já temos artistas suficientes; só completa os álbuns dos que já entraram
    const candidate: BackgroundCandidate = { key, artistName: artist, album, albums: [album], year: Number(item.firstReleaseDate.slice(0, 4)) };
    byKey.set(key, candidate);
    result.push(candidate);
  }
  return result;
}
