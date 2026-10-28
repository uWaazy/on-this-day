export type MusicBrainzCatalogItem = {
  mbid: string;
  title: string;
  artistName: string;
  artistNames?: string[];
  firstReleaseDate: string;
  genres?: string[];
  /** Nota mÃ©dia da comunidade MusicBrainz (escala 0â€“5) e nÃºmero de votos. */
  ratingVotes?: number;
  ratingValue?: number;
  /**
   * Opcional: mÃ©dia de crÃ­ticos (0â€“100) e quantidade de resenhas. O catÃ¡logo
   * gerado a partir do MusicBrainz NÃƒO traz esses campos; sÃ³ aparecem se uma
   * fonte licenciada for importada para o catÃ¡logo.
   */
  criticScore?: number;
  criticVotes?: number;
};

export type MusicBrainzDailyCatalog = {
  schemaVersion: number;
  monthDay: string;
  source: string;
  generatedAt: string;
  items: MusicBrainzCatalogItem[];
};

declare const __OTD_CATALOG_BASE_URL__: string;

const CACHE_PREFIX = "on-this-day:catalog:";
const WINDOW_DAYS = 2;
const EXPECTED_SCHEMA_VERSION = 2;
const CACHE_VERSION_KEY = "on-this-day:cache-version";
const CACHE_VERSION = "3";
/** Depois disso o catÃ¡logo em cache ainda Ã© usado na hora, mas Ã© rebaixado em segundo plano. */
const REVALIDATE_AFTER_MS = 24 * 60 * 60 * 1000;

function bustOldCache(): void {
  try {
    const stored = localStorage.getItem(CACHE_VERSION_KEY);
    if (stored !== CACHE_VERSION) {
      for (let i = 0; i < localStorage.length; ) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(key);
        } else {
          i++;
        }
      }
      localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
    }
  } catch {
    /* Best-effort. */
  }
}

bustOldCache();

function monthDayFor(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

function offsetMonthDay(offsetDays: number): string {
  // Use o calendÃ¡rio local de forma consistente com monthDayFor(). Misturar
  // setUTCDate() com getMonth()/getDate() pode deslocar o dia perto da meia-noite.
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return monthDayFor(d);
}

function cacheKey(monthDay: string): string {
  return `${CACHE_PREFIX}${monthDay}`;
}

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.schemaVersion !== EXPECTED_SCHEMA_VERSION) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify({ ...(value as object), cachedAt: Date.now() }));
  } catch {
    /* Sem espaÃ§o no armazenamento local: segue direto da rede. */
  }
}

function isValidCatalog(value: unknown, monthDay: string): value is MusicBrainzDailyCatalog {
  return (
    typeof value === "object" &&
    value !== null &&
    ("schemaVersion" in value) && value.schemaVersion === EXPECTED_SCHEMA_VERSION &&
    ("monthDay" in value) && value.monthDay === monthDay &&
    ("items" in value) && Array.isArray(value.items)
  );
}

function pruneCache(todayKey: string): void {
  try {
    const keep = new Set<string>();
    for (let i = -WINDOW_DAYS; i <= WINDOW_DAYS; i++) {
      keep.add(offsetMonthDay(i));
    }
    for (let i = 0; i < localStorage.length; ) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        const monthDay = key.slice(CACHE_PREFIX.length);
        if (!keep.has(monthDay)) {
          localStorage.removeItem(key);
        } else {
          i++;
        }
      } else {
        i++;
      }
    }
  } catch {
    /* Poda Ã© best-effort. */
  }
}

async function prefetchNearbyDays(): Promise<void> {
  const today = new Date();
  const offsets = [-2, -1, 1, 2];
  await Promise.all(
    offsets.map((o) => {
      const d = new Date(today);
      d.setDate(d.getDate() + o);
      const md = monthDayFor(d);
      return (async () => {
        try {
          if (readCache<MusicBrainzDailyCatalog>(cacheKey(md))) return;
          const response = await fetch(`${__OTD_CATALOG_BASE_URL__}/${md}.json`, {
            cache: "no-cache",
          });
          if (!response.ok) return;
          const value = await response.json();
          if (isValidCatalog(value, md)) {
            writeCache(cacheKey(md), value);
          }
        } catch {
          /* PrÃ©-busca falhou: nÃ£o bloqueia o dia atual. */
        }
      })();
    }),
  );
}

export async function loadDailyCatalog(monthDay: string): Promise<MusicBrainzDailyCatalog> {
  // 1. Sirve do cache local quando disponÃ­vel (mesmo dia).
  const cached = readCache<MusicBrainzDailyCatalog & { cachedAt?: number }>(cacheKey(monthDay));
  if (cached) {
    pruneCache(monthDay);
    void prefetchNearbyDays();
    // CatÃ¡logo atualizado no GitHub (novos Ã¡lbuns)? Troca o cache em segundo plano; vale na prÃ³xima abertura.
    if (!cached.cachedAt || Date.now() - cached.cachedAt > REVALIDATE_AFTER_MS) {
      void fetch(`${__OTD_CATALOG_BASE_URL__}/${monthDay}.json`, { cache: "no-cache" })
        .then((response) => (response.ok ? response.json() : null))
        .then((fresh: unknown) => { if (fresh && isValidCatalog(fresh, monthDay)) writeCache(cacheKey(monthDay), fresh); })
        .catch(() => { /* mantÃ©m o cache atual */ });
    }
    return cached;
  }

  // 2. Busca na rede.
  const response = await fetch(`${__OTD_CATALOG_BASE_URL__}/${monthDay}.json`, {
    method: "GET",
    cache: "no-cache",
  });

  if (!response.ok) {
    throw new Error(`CatÃ¡logo indisponÃ­vel (${response.status}).`);
  }

  const value: unknown = await response.json();
  if (!isValidCatalog(value, monthDay)) {
    throw new Error("O catÃ¡logo publicado tem um formato invÃ¡lido.");
  }

  const catalog = value as MusicBrainzDailyCatalog;

  // 3. Guarda no cache e mantÃ©m a janela deslizante (Â±2 dias), podando o resto.
  writeCache(cacheKey(monthDay), catalog);
  pruneCache(monthDay);
  void prefetchNearbyDays();

  return catalog;
}

