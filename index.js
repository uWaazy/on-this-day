"use strict";
(() => {
  // src/react.ts
  var React = Spicetify.React;
  function createPortal(children, container) {
    const reactDom = Spicetify.ReactDOM;
    return typeof reactDom?.createPortal === "function" ? reactDom.createPortal(children, container) : children;
  }
  var useState = Spicetify.React.useState;
  var useEffect = Spicetify.React.useEffect;
  var useMemo = Spicetify.React.useMemo;
  var useRef = Spicetify.React.useRef;
  var useCallback = Spicetify.React.useCallback;
  function memo(component) {
    return Spicetify.React.memo ? Spicetify.React.memo(component) : component;
  }

  // src/api/catalog.ts
  var CACHE_PREFIX = "on-this-day:catalog:";
  var WINDOW_DAYS = 2;
  var EXPECTED_SCHEMA_VERSION = 2;
  var CACHE_VERSION_KEY = "on-this-day:cache-version";
  var CACHE_VERSION = "2";
  var REVALIDATE_AFTER_MS = 24 * 60 * 60 * 1e3;
  function bustOldCache() {
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
    }
  }
  bustOldCache();
  function monthDayFor(date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${month}-${day}`;
  }
  function offsetMonthDay(offsetDays) {
    const d = /* @__PURE__ */ new Date();
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return monthDayFor(d);
  }
  function cacheKey(monthDay) {
    return `${CACHE_PREFIX}${monthDay}`;
  }
  function readCache(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.schemaVersion !== EXPECTED_SCHEMA_VERSION) return null;
      return parsed;
    } catch {
      return null;
    }
  }
  function writeCache(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify({ ...value, cachedAt: Date.now() }));
    } catch {
    }
  }
  function isValidCatalog(value, monthDay) {
    return typeof value === "object" && value !== null && "schemaVersion" in value && value.schemaVersion === EXPECTED_SCHEMA_VERSION && "monthDay" in value && value.monthDay === monthDay && "items" in value && Array.isArray(value.items);
  }
  function pruneCache(todayKey) {
    try {
      const keep = /* @__PURE__ */ new Set();
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
    }
  }
  async function prefetchNearbyDays() {
    const today = /* @__PURE__ */ new Date();
    const offsets = [-2, -1, 1, 2];
    await Promise.all(
      offsets.map((o) => {
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() + o);
        const md = monthDayFor(d);
        return (async () => {
          try {
            if (readCache(cacheKey(md))) return;
            const response = await fetch(`${"https://uwaazy.github.io/on-this-day/catalog"}/${md}.json`, {
              cache: "no-cache"
            });
            if (!response.ok) return;
            const value = await response.json();
            if (isValidCatalog(value, md)) {
              writeCache(cacheKey(md), value);
            }
          } catch {
          }
        })();
      })
    );
  }
  async function loadDailyCatalog(monthDay) {
    const cached = readCache(cacheKey(monthDay));
    if (cached) {
      pruneCache(monthDay);
      void prefetchNearbyDays();
      if (!cached.cachedAt || Date.now() - cached.cachedAt > REVALIDATE_AFTER_MS) {
        void fetch(`${"https://uwaazy.github.io/on-this-day/catalog"}/${monthDay}.json`, { cache: "no-cache" }).then((response2) => response2.ok ? response2.json() : null).then((fresh) => {
          if (fresh && isValidCatalog(fresh, monthDay)) writeCache(cacheKey(monthDay), fresh);
        }).catch(() => {
        });
      }
      return cached;
    }
    const response = await fetch(`${"https://uwaazy.github.io/on-this-day/catalog"}/${monthDay}.json`, {
      method: "GET",
      cache: "no-cache"
    });
    if (!response.ok) {
      throw new Error(`Catálogo indisponível (${response.status}).`);
    }
    const value = await response.json();
    if (!isValidCatalog(value, monthDay)) {
      throw new Error("O catálogo publicado tem um formato inválido.");
    }
    const catalog = value;
    writeCache(cacheKey(monthDay), catalog);
    pruneCache(monthDay);
    void prefetchNearbyDays();
    return catalog;
  }

  // src/api/genres.ts
  var MAIN_GENRES = [
    { id: "african", label: "African", patterns: [/\bafrican?\b/, /\bafro[- ]/, /\bafrobeats?\b/, /\bafropop\b/, /\bamapiano\b/, /\bgqom\b/, /\bhighlife\b/, /\bjuju\b/, /\bkwaito\b/, /\bmakossa\b/, /\bmbalax\b/, /\bmbaqanga\b/, /\bsoukous\b/] },
    { id: "arabic", label: "Arabic & Middle Eastern", patterns: [/\barab(ic|ian)\b/, /\bkhaleeji\b/, /\blevantine\b/, /\bmiddle eastern\b/, /\bnorth african\b/, /\bpersian\b/, /\bturkish\b/, /\boud\b/, /\bshaabi\b/] },
    { id: "asian", label: "East & Southeast Asian", patterns: [/\basian\b/, /\bc-?pop\b/, /\bcantopop\b/, /\bchinese\b/, /\bgamelan\b/, /\bj-?pop\b/, /\bj-rock\b/, /\bk-?pop\b/, /\bkorean\b/, /\bmandopop\b/, /\bthai\b/, /\bvietnamese\b/] },
    { id: "south-asian", label: "South Asian", patterns: [/\bbhangra\b/, /\bbollywood\b/, /\bcarnatic\b/, /\bhindustani\b/, /\bindian classical\b/, /\bindian pop\b/, /\bqawwali\b/, /\braga\b/, /\braga rock\b/] },
    { id: "blues", label: "Blues", patterns: [/\bblues?\b/] },
    { id: "caribbean", label: "Caribbean", patterns: [/\bcalypso\b/, /\bcaribbean\b/, /\bmento\b/, /\bsoca\b/, /\bzouk\b/] },
    { id: "classical", label: "Classical", patterns: [/\bbaroque\b/, /\bchamber music\b/, /\bclassical\b/, /\bopera\b/, /\boratorio\b/, /\borchestral\b/, /\bsymphon(y|ic)\b/] },
    { id: "country", label: "Country", patterns: [/\bbluegrass\b/, /\bcountry\b/, /\bamericana\b/, /\bwestern swing\b/] },
    { id: "disco", label: "Disco", patterns: [/\bdisco\b/, /\bitalo disco\b/] },
    { id: "electronic", label: "Electronic & Dance", patterns: [/\bambient techno\b/, /\bbass music\b/, /\bbreakbeat\b/, /\bdrum and bass\b/, /\bdubstep\b/, /\bedm\b/, /\belectro(nic)?\b/, /\bhouse\b/, /\btechno\b/, /\btrance\b/, /\btrip hop\b/, /\bgarage\b/] },
    { id: "experimental", label: "Experimental", patterns: [/\bavant[- ]garde\b/, /\bexperimental\b/, /\bnoise music\b/, /\bmusique concr[eè]te\b/] },
    { id: "folk", label: "Folk", patterns: [/\bfolk\b/, /\bsinger[- ]songwriter\b/, /\btraditional folk\b/] },
    { id: "funk", label: "Funk", patterns: [/\bfunk\b/] },
    { id: "gospel", label: "Gospel & Religious", patterns: [/\bchristian\b/, /\bgospel\b/, /\bhymn(s)?\b/, /\bqawwali\b/, /\breligious\b/, /\bworship\b/] },
    { id: "hip-hop", label: "Hip-hop", patterns: [/\bhip[- ]hop\b/, /\btrip hop\b/] },
    { id: "rap", label: "Rap", patterns: [/\brap\b/] },
    { id: "trap", label: "Trap", patterns: [/\btrap\b/] },
    { id: "drill", label: "Drill", patterns: [/\bdrill\b/] },
    { id: "jazz", label: "Jazz", patterns: [/\bjazz\b/, /\bbebop\b/, /\bbig band\b/, /\bragtime\b/, /\bswing\b/] },
    { id: "latin", label: "Latin", patterns: [/\bbachata\b/, /\bbolero\b/, /\bbossa nova\b/, /\bcumbia\b/, /\bflamenco\b/, /\blatin\b/, /\bmerengue\b/, /\breggaeton\b/, /\bsalsa\b/, /\bsamba\b/, /\btango\b/] },
    { id: "metal", label: "Metal", patterns: [/\bmetal\b/, /\bdeathcore\b/, /\bmetalcore\b/] },
    { id: "new-age", label: "New Age & Ambient", patterns: [/\bambient\b/, /\bdrone\b/, /\bmeditation\b/, /\bnew age\b/, /\brelaxation\b/] },
    { id: "pop", label: "Pop", patterns: [/\bpop\b/, /\beuropop\b/, /\bsynth[- ]?pop\b/] },
    { id: "punk", label: "Punk", patterns: [/\bhardcore punk\b/, /\bpunk\b/] },
    { id: "rnb-soul", label: "R&B & Soul", patterns: [/\bneo[- ]soul\b/, /\br&b\b/, /\brhythm and blues\b/, /\bsoul\b/, /\bmotown\b/, /\bdoo[- ]wop\b/] },
    { id: "reggae", label: "Reggae & Dub", patterns: [/\bdancehall\b/, /\bdub\b/, /\breggae\b/, /\brocksteady\b/] },
    { id: "rock", label: "Rock", patterns: [/\bgrunge\b/, /\bindie rock\b/, /\bpost[- ]rock\b/, /\bpsychedelic rock\b/, /\brock\b/] },
    { id: "ska", label: "Ska", patterns: [/\b2 tone\b/, /\bska\b/] },
    { id: "soundtrack", label: "Soundtrack & Musical", patterns: [/\bfilm score\b/, /\bmusical theatre\b/, /\bsoundtrack\b/, /\bvideo game music\b/] },
    { id: "spoken-word", label: "Spoken Word", patterns: [/\baudiobook\b/, /\bpoetry\b/, /\bspoken word\b/] },
    { id: "world", label: "Traditional & World", patterns: [/\btraditional\b/, /\bworld music\b/, /\bindigenous\b/, /\bethnic\b/] },
    { id: "funk-br", label: "Funk Brasileiro", patterns: [/\bfunk carioca\b/, /\bfunk brasileiro\b/, /\bfunk melody\b/, /\bproibid[aã]o\b/, /\bbatid[aã]o\b/, /\bbrazilian funk\b/] },
    { id: "sertanejo", label: "Sertanejo", patterns: [/\bsertanejo\b/] },
    { id: "pagode", label: "Pagode", patterns: [/\bpagode\b/] },
    { id: "samba", label: "Samba", patterns: [/\bsamba\b/, /\bsamba de roda\b/, /\bsamba-enredo\b/] },
    { id: "mpb", label: "MPB", patterns: [/\bmpb\b/, /\bmúsica popular brasileira\b/, /\bmusica popular brasileira\b/] },
    { id: "forro", label: "Forró", patterns: [/\bforr[oó]\b/, /\bforro\b/, /\bxote\b/, /\bbaião\b/, /\bbai[aã]o\b/] },
    { id: "bossa-nova", label: "Bossa Nova", patterns: [/\bbossa nova\b/, /\bbossa\b/] },
    { id: "axe", label: "Axé", patterns: [/\baxé\b/, /\baxe\b/, /\baxé music\b/] },
    { id: "piseiro", label: "Piseiro", patterns: [/\bpiseiro\b/] }
  ];
  function normalizeGenre(value) {
    return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en").replace(/[’']/g, "").replace(/[^\p{L}\p{N}&]+/gu, " ").trim();
  }
  function classifyMainGenres(genres) {
    if (!genres?.length) return [];
    const names = genres.map(normalizeGenre);
    return MAIN_GENRES.filter((genre) => names.some((name) => genre.patterns.some((pattern) => pattern.test(name)))).map((genre) => genre.id);
  }

  // src/services/spotify-album.ts
  var CACHE_PREFIX2 = "on-this-day:spotify-album:v3:";
  var LEGACY_CACHE_PREFIXES = ["on-this-day:spotify-album:v1:", "on-this-day:spotify-album:v2:"];
  var CACHE_TTL = 14 * 24 * 60 * 60 * 1e3;
  var CACHE_MISS_TTL = 24 * 60 * 60 * 1e3;
  var MAX_CACHE_ENTRIES = 400;
  var MAX_CONCURRENT = 3;
  var REQUEST_TIMEOUT_MS = 8e3;
  var SEARCH_LIMIT = 10;
  var RATE_LIMIT_COOLDOWN_MS = 2e4;
  function normalizeText(value) {
    return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, "");
  }
  function baseTitle(value) {
    const stripped = value.replace(/[([][^)\]]*[)\]]/g, " ").replace(/\s[-–—:]\s.*\b(deluxe|remaster(ed)?|edition|version|expanded|anniversary|bonus|mono|stereo|explicit)\b.*$/i, " ");
    const normalized = normalizeText(stripped);
    return normalized || normalizeText(value);
  }
  function createLimiter(max) {
    let active = 0;
    const queue = [];
    return function limit(task) {
      return new Promise((resolve3, reject) => {
        const start = () => {
          active += 1;
          task().then(resolve3, reject).finally(() => {
            active -= 1;
            queue.shift()?.();
          });
        };
        if (active < max) start();
        else queue.push(start);
      });
    };
  }
  function withTimeout(promise, ms) {
    return new Promise((resolve3, reject) => {
      const timer = window.setTimeout(() => reject(new Error("timeout")), ms);
      promise.then(
        (value) => {
          window.clearTimeout(timer);
          resolve3(value);
        },
        (error) => {
          window.clearTimeout(timer);
          reject(error);
        }
      );
    });
  }
  var limitSpotify = createLimiter(MAX_CONCURRENT);
  var cooldownUntil = 0;
  function spotifyGet(url) {
    if (Date.now() < cooldownUntil) return Promise.reject(new Error("rate-limited"));
    return limitSpotify(async () => {
      if (!Spicetify?.CosmosAsync?.get) throw new Error("Spicetify.CosmosAsync indisponível");
      try {
        return await withTimeout(Spicetify.CosmosAsync.get(url), REQUEST_TIMEOUT_MS);
      } catch (error) {
        const status = error?.status ?? error?.code;
        if (status === 429) cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        throw error;
      }
    });
  }
  function pickAlbumMatch(query, albums) {
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
    const yearOf = (album) => Number(album.release_date?.slice(0, 4));
    const sameYear = pool.filter((album) => yearOf(album) === releaseYear);
    let selected = null;
    if (sameYear.length) {
      selected = sameYear.find((album) => album.album_type === "album") ?? sameYear[0];
    } else if (pool.length === 1) {
      const year = yearOf(pool[0]);
      if (!Number.isFinite(year) || year >= releaseYear) selected = pool[0];
    }
    return { selected, coverCandidate: selected ?? pool[0] };
  }
  function bestImage(album) {
    const images = (album?.images ?? []).filter((image) => image.url);
    if (!images.length) return null;
    const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
    return (sorted.find((image) => (image.width ?? 0) <= 700) ?? sorted[0]).url ?? null;
  }
  var EDITION_WORDS = /* @__PURE__ */ new Set(["deluxe", "expanded", "edition", "remastered", "remaster", "version", "bonus", "explicit", "anniversary", "special", "standard", "mono", "stereo", "the", "a", "an", "of"]);
  function titleTokens(value) {
    return value.replace(/[([][^)\]]*[)\]]/g, " ").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en").split(/[^\p{L}\p{N}]+/u).filter((token) => token && !EDITION_WORDS.has(token));
  }
  function titleSimilarity(a, b) {
    const first = new Set(titleTokens(a));
    const second = new Set(titleTokens(b));
    if (!first.size || !second.size) return 0;
    let shared = 0;
    first.forEach((token) => {
      if (second.has(token)) shared += 1;
    });
    return shared / (first.size + second.size - shared);
  }
  function artistMatches(query, names) {
    const expected = (query.artistNames?.length ? query.artistNames : [query.artistName]).map(normalizeText).filter(Boolean);
    return names.some((name) => {
      const normalized = name ? normalizeText(name) : "";
      return !!normalized && expected.some((e) => e === normalized || e.length > 4 && normalized.includes(e) || normalized.length > 4 && e.includes(normalized));
    });
  }
  function pickCoverCandidate(query, albums) {
    let best = null;
    let bestScore = 0;
    for (const album of albums) {
      if (!album.name || !bestImage(album)) continue;
      if (!artistMatches(query, (album.artists ?? []).map((artist) => artist.name))) continue;
      const similarity = titleSimilarity(query.title, album.name);
      if (similarity < 0.6) continue;
      const sameYear = Number(album.release_date?.slice(0, 4)) === Number(query.firstReleaseDate.slice(0, 4)) ? 0.05 : 0;
      const score = similarity + sameYear + (album.album_type === "album" ? 0.02 : 0);
      if (score > bestScore) {
        best = album;
        bestScore = score;
      }
    }
    return best;
  }
  var memory = /* @__PURE__ */ new Map();
  var legacyPurged = false;
  function purgeLegacyCache() {
    if (legacyPurged) return;
    legacyPurged = true;
    try {
      for (let i = 0; i < localStorage.length; ) {
        const key = localStorage.key(i);
        if (key && LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) localStorage.removeItem(key);
        else i += 1;
      }
    } catch {
    }
  }
  function readCache2(mbid) {
    try {
      const key = `${CACHE_PREFIX2}${mbid}`;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (typeof entry.expiresAt !== "number" || entry.expiresAt <= Date.now()) {
        localStorage.removeItem(key);
        return null;
      }
      return {
        uri: typeof entry.uri === "string" ? entry.uri : null,
        cover: typeof entry.cover === "string" ? entry.cover : null,
        artists: Array.isArray(entry.artists) ? entry.artists.filter((a) => a && typeof a.id === "string" && typeof a.name === "string") : []
      };
    } catch {
      return null;
    }
  }
  function peekCachedCover(mbid) {
    const cached = readCache2(mbid);
    return cached?.cover ?? null;
  }
  var writesSincePrune = 0;
  function writeCache2(mbid, result) {
    try {
      const ttl = result.uri || result.cover ? CACHE_TTL : CACHE_MISS_TTL;
      const entry = { ...result, expiresAt: Date.now() + ttl };
      localStorage.setItem(`${CACHE_PREFIX2}${mbid}`, JSON.stringify(entry));
      writesSincePrune += 1;
      if (writesSincePrune < 25) return;
      writesSincePrune = 0;
      const entries = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key?.startsWith(CACHE_PREFIX2)) continue;
        try {
          const value = JSON.parse(localStorage.getItem(key) ?? "");
          entries.push({ key, expiresAt: typeof value.expiresAt === "number" ? value.expiresAt : 0 });
        } catch {
          localStorage.removeItem(key);
        }
      }
      if (entries.length > MAX_CACHE_ENTRIES) {
        entries.sort((a, b) => a.expiresAt - b.expiresAt);
        for (const stale of entries.slice(0, entries.length - MAX_CACHE_ENTRIES)) localStorage.removeItem(stale.key);
      }
    } catch {
    }
  }
  function searchUrl(q) {
    const params = new URLSearchParams({ q, type: "album", limit: String(SEARCH_LIMIT) });
    return `https://api.spotify.com/v1/search?${params}`;
  }
  function findArtistId(query, albums) {
    for (const album of albums) {
      for (const artist of album.artists ?? []) {
        if (artist.id && artist.name && artistMatches(query, [artist.name])) return artist.id;
      }
    }
    return null;
  }
  async function lookupAlbum(query) {
    const clean = (value) => value.replace(/["]+/g, " ").replace(/\s+/g, " ").trim();
    const title = clean(query.title);
    const artist = clean(query.artistName);
    const titleWithoutBrackets = clean(query.title.replace(/[([][^)\]]*[)\]]/g, " ")) || title;
    const mainTitle = clean(titleWithoutBrackets.split(/\s[-–—:]\s/)[0]) || titleWithoutBrackets;
    const queries = [.../* @__PURE__ */ new Set([
      `album:"${title}" artist:"${artist}"`,
      `${titleWithoutBrackets} ${artist}`,
      `${mainTitle} ${artist}`
    ])];
    const seen = /* @__PURE__ */ new Map();
    for (const q of queries) {
      const response = await spotifyGet(searchUrl(q));
      const albums = response.albums?.items ?? [];
      albums.forEach((album) => {
        if (album.id) seen.set(album.id, album);
      });
      const { selected } = pickAlbumMatch(query, albums);
      if (selected) {
        return {
          uri: selected.id ? `spotify:album:${selected.id}` : null,
          cover: bestImage(selected),
          artists: (selected.artists ?? []).filter((a) => !!a.id && !!a.name).map((a) => ({ id: a.id, name: a.name }))
        };
      }
    }
    const artistId = findArtistId(query, [...seen.values()]);
    if (artistId) {
      try {
        for (let offset = 0; offset < 100; offset += 50) {
          const page = await spotifyGet(
            `https://api.spotify.com/v1/artists/${encodeURIComponent(artistId)}/albums?include_groups=album,single&limit=50&offset=${offset}`
          );
          const discography = page.items ?? [];
          discography.forEach((album) => {
            if (album.id) seen.set(album.id, album);
          });
          const { selected } = pickAlbumMatch(query, discography);
          if (selected) {
            return {
              uri: selected.id ? `spotify:album:${selected.id}` : null,
              cover: bestImage(selected),
              artists: (selected.artists ?? []).filter((a) => !!a.id && !!a.name).map((a) => ({ id: a.id, name: a.name }))
            };
          }
          if (!page.next) break;
        }
      } catch {
      }
    }
    const coverAlbum = pickCoverCandidate(query, [...seen.values()]);
    return { uri: null, cover: bestImage(coverAlbum), artists: [] };
  }
  function findSpotifyAlbum(query) {
    purgeLegacyCache();
    const existing = memory.get(query.mbid);
    if (existing) return existing;
    const cached = readCache2(query.mbid);
    if (cached) {
      const resolved = Promise.resolve(cached);
      memory.set(query.mbid, resolved);
      return resolved;
    }
    const pending = lookupAlbum(query).then((found) => {
      writeCache2(query.mbid, found);
      return found;
    }).catch(() => {
      memory.delete(query.mbid);
      return { uri: null, cover: null, artists: [] };
    });
    memory.set(query.mbid, pending);
    return pending;
  }
  function spotifyAlbumPath(uri) {
    const id = uri?.match(/^spotify:album:([A-Za-z0-9]+)$/)?.[1];
    return id ? `/album/${id}` : null;
  }
  function spotifySearchPath(query) {
    const text = `${query.title} ${query.artistName}`.replace(/\s+/g, " ").trim();
    return `/search/${encodeURIComponent(text)}/albums`;
  }
  function navigateInSpotify(path) {
    try {
      const history = Spicetify?.Platform?.History;
      if (history?.push) {
        history.push(path);
        return true;
      }
    } catch {
    }
    try {
      Spicetify?.showNotification?.("Não foi possível abrir o Spotify automaticamente.", true);
    } catch {
    }
    return false;
  }
  async function openAlbumInSpotify(query, waitMs = 3500) {
    let match = null;
    try {
      match = await withTimeout(findSpotifyAlbum(query), waitMs);
    } catch {
    }
    const albumPath = spotifyAlbumPath(match?.uri ?? null);
    navigateInSpotify(albumPath ?? spotifySearchPath(query));
    return albumPath ? "album" : "search";
  }

  // src/services/followed-artists.ts
  var CACHE_KEY = "on-this-day:followed-artists:v1";
  var CACHE_FRESH_MS = 6 * 60 * 60 * 1e3;
  var PAGE_LIMIT = 50;
  var MAX_PAGES = 100;
  function normalizeArtistName(name) {
    return normalizeText(name);
  }
  function readCache3() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
      if (parsed && Array.isArray(parsed.names) && typeof parsed.at === "number") return parsed;
    } catch {
    }
    return null;
  }
  function writeCache3(names) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ names, at: Date.now() }));
    } catch {
    }
  }
  function peekFollowedArtists() {
    const cached = readCache3();
    return cached?.names.length ? cached.names : null;
  }
  async function fromWebApi() {
    const names = [];
    let after = null;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const params = new URLSearchParams({ type: "artist", limit: String(PAGE_LIMIT) });
      if (after) params.set("after", after);
      const result = await spotifyGet(`https://api.spotify.com/v1/me/following?${params}`);
      for (const artist of result.artists?.items ?? []) if (artist.name) names.push(artist.name);
      after = result.artists?.cursors?.after ?? null;
      if (!after || !result.artists?.items?.length) break;
    }
    return names;
  }
  async function fromLibrary() {
    const api = Spicetify?.Platform?.LibraryAPI;
    if (!api?.getContents) throw new Error("Biblioteca do Spotify indisponível");
    const names = [];
    const limit = 500;
    for (let offset = 0; offset < 1e4; offset += limit) {
      const response = await api.getContents({ limit, offset });
      const items = response?.items ?? [];
      for (const item of items) if (item.type === "artist" && item.name) names.push(item.name);
      if (items.length < limit) break;
    }
    return names;
  }
  async function loadFollowedArtists(force = false) {
    const cached = readCache3();
    if (!force && cached && Date.now() - cached.at < CACHE_FRESH_MS) {
      return { names: cached.names, fromCache: true, stale: false };
    }
    let names = null;
    try {
      names = await fromWebApi();
    } catch {
    }
    if (!names?.length) {
      try {
        names = await fromLibrary();
      } catch {
      }
    }
    if (names?.length) {
      const unique = [...new Set(names)];
      writeCache3(unique);
      return { names: unique, fromCache: false, stale: false };
    }
    if (cached) return { names: cached.names, fromCache: true, stale: true };
    throw new Error("Não foi possível ler os artistas que você segue no Spotify.");
  }
  function artistIsFollowed(followed, artistNames) {
    return artistNames.some((name) => followed.has(normalizeArtistName(name)));
  }

  // src/i18n.ts
  var LANGUAGES = {
    en: { code: "en", label: "English", native: "English" },
    pt: { code: "pt", label: "Português", native: "Português" },
    es: { code: "es", label: "Español", native: "Español" }
  };
  var LANG_KEY = "on-this-day:lang";
  var TEXTS = {
    en: {
      eyebrow: "MUSIC HISTORY",
      title: "On This Day",
      subtitle: "Albums released on {date}, in other years.",
      count: "{count} albums this day",
      loading: "Loading releases for {date}…",
      errorTitle: "On This Day",
      errorMsg: "Could not load the catalog for {date}.",
      errorHint: "Check that the catalog was generated and the data server is reachable.",
      genreFilter: "Filter by genre",
      genreLimit: "{selected}/{max} genres",
      clearFilters: "Clear filters",
      chooseGenres: "Choose up to five genres. Albums from any selected genre will be shown.",
      limitReached: "Five-genre limit reached.",
      followTitle: "Albums from artists you follow",
      followDesc: "The app only asks permission to read your followed artists list; it does not modify your account or access playlists and listening history.",
      followReq: "In development mode, Premium is required from the app owner, not from you. The owner must also authorize each test account (up to 5). For public distribution, Spotify must approve broader access.",
      followToggle: "Show only artists I follow",
      followConnected: " ( {count} )",
      disconnect: "Disconnect",
      activateFollow: "Connect Spotify and activate filter",
      activateFollowNow: "Activate filter now",
      connectAgain: "Connect again",
      close: "Close",
      manualLabel: "If Spotify opened outside the app, paste the address that appeared after you accepted:",
      manualSubmit: "Complete connection",
      emptyGenresMsg: "The published catalog does not include genres yet. Update the catalog publication to enable this filter.",
      emptyNoMatch: "No albums from this date match the selected genres.",
      emptyFollowed: "No albums from the artists you follow were found on this date. Disable the filter to see all.",
      emptyNone: "No albums found for this date and anniversary.",
      attribution: "Data: MusicBrainz. Order prioritizes community ratings when available. Click a cover to preview; double-click to open the album or search Spotify.",
      moreAlbums: "View more albums",
      lessAlbums: "Show fewer",
      yearAgo: "1 year ago",
      yearsAgo: "{age} years ago",
      yearTooltip: "{age} year ago",
      yearsTooltip: "{age} years ago",
      yearShort: "1 year",
      yearsShort: "{age} years",
      albumsCount: "{count} albums",
      communityScore: "USER",
      criticScore: "CRITIC",
      scoreUnavailable: "N/A",
      scoreVotes: "{count} votes",
      userScoreTitle: "Average rating from MusicBrainz community users",
      criticScoreTitle: "Aggregated critic score",
      userScoreMissing: "no community ratings for this album",
      criticScoreMissing: "no critic score: no critics data source is connected to the catalog yet, so this album has no value",
      scoreFew: "few ratings, interpret with care",
      navYears: "YEARS",
      updBadge: "Version {version} — click for update info",
      updBadgeNew: "Update available: v{latest} — click for instructions",
      updTitleNew: "New version available",
      updTitleCurrent: "You are on the latest version",
      updInstalled: "Installed",
      updLatest: "Latest",
      updCheckFailed: "Could not check GitHub right now. You can still reinstall with the steps below.",
      updRecommended: "Recommended",
      updRawTitle: "Update via RAW (PowerShell)",
      updRawHint: "Open PowerShell, paste this command and press Enter. It downloads the new files, enables the app and runs spicetify apply. Restart Spotify if it does not refresh by itself.",
      updCopy: "Copy",
      updCopied: "Copied!",
      updManualTitle: "Manual method",
      updManual1: "Download manifest.json, index.js and style.css from the repository (button below).",
      updManual2: "Replace the files in",
      updManual3: "Then run",
      updOpenGithub: "Open repository on GitHub",
      updClose: "Close",
      fabOff: "Show only artists I follow",
      fabOn: "Only artists you follow ({count}) — click to turn off",
      fabLoading: "Reading the artists you follow…",
      fabError: "Could not read followed artists — click to retry",
      followedEmpty: "None of this day's albums are by artists you follow. Turn the filter off to see all.",
      orderNewest: "Newest first",
      orderOldest: "Oldest first",
      orderTitle: "Reverse the order of the years",
      previewCover: "Preview {title} cover; double-click to open album in Spotify",
      coverPreviewTitle: "{title} cover preview",
      loadingFollowed: "Loading your followed artists list…",
      changeLanguage: "Change language",
      albumsThisDay: "{count} albums this day",
      albumAriaLabel: "Search {title} by {artist} on Spotify",
      albumTitleAttr: "Search {title} on Spotify",
      coverAlt: "Cover of {title}",
      searchOnSpotify: "Search {title} on Spotify",
      searchOnSpotifyShort: "Spotify"
    },
    pt: {
      eyebrow: "HISTÓRIA DA MÚSICA",
      title: "On This Day",
      subtitle: "Álbuns lançados em {date}, em outros anos.",
      count: "{count} álbuns neste dia",
      loading: "Carregando os lançamentos de {date}…",
      errorTitle: "On This Day",
      errorMsg: "Não foi possível carregar o catálogo de {date}.",
      errorHint: "Confira se o catálogo foi gerado e se o servidor de dados está acessível.",
      genreFilter: "Filtrar por gênero",
      genreLimit: "{selected}/{max} gêneros",
      clearFilters: "Limpar filtros",
      chooseGenres: "Escolha até cinco gêneros. Álbuns de qualquer gênero selecionado serão mostrados.",
      limitReached: "Limite de cinco gêneros atingido.",
      followTitle: "Álbuns de artistas que você segue",
      followDesc: "O app pede somente permissão para ler a lista de artistas que você segue; não altera sua conta nem acessa playlists ou histórico.",
      followReq: "No modo de desenvolvimento, Premium é exigido do responsável pelo app, não de quem usa. O responsável também precisa liberar cada conta de teste (até 5). Para distribuir ao público geral, o Spotify precisa aprovar acesso ampliado.",
      followToggle: "Mostrar somente artistas que sigo",
      followConnected: " ( {count} )",
      disconnect: "Desconectar",
      activateFollow: "Conectar Spotify e ativar filtro",
      activateFollowNow: "Ativar filtro agora",
      connectAgain: "Conectar novamente",
      close: "Fechar",
      manualLabel: "Se o Spotify abriu no navegador fora do app, cole aqui o endereço que apareceu depois de aceitar:",
      manualSubmit: "Concluir conexão",
      emptyGenresMsg: "O catálogo publicado ainda não inclui gêneros. Atualize a publicação do catálogo para ativar este filtro.",
      emptyNoMatch: "Nenhum álbum desta data corresponde aos gêneros selecionados.",
      emptyFollowed: "Nenhum álbum dos artistas que você segue foi encontrado nesta data. Desative o filtro para ver todos.",
      emptyNone: "Nenhum álbum encontrado para este dia e aniversário.",
      attribution: "Dados: MusicBrainz. A ordem prioriza avaliações da comunidade quando disponíveis. Clique na capa para ampliar; clique duas vezes para abrir o álbum ou pesquisar no Spotify.",
      moreAlbums: "Ver mais álbuns",
      lessAlbums: "Mostrar menos",
      yearAgo: "1 ano atrás",
      yearsAgo: "{age} anos atrás",
      yearTooltip: "{age} ano atrás",
      yearsTooltip: "{age} anos atrás",
      yearShort: "1 ano",
      yearsShort: "{age} anos",
      albumsCount: "{count} álbuns",
      communityScore: "USUÁRIOS",
      criticScore: "CRÍTICA",
      scoreUnavailable: "N/D",
      scoreVotes: "{count} avaliações",
      userScoreTitle: "Média das avaliações da comunidade MusicBrainz",
      criticScoreTitle: "Média agregada de críticos",
      userScoreMissing: "este álbum ainda não tem avaliações da comunidade",
      criticScoreMissing: "sem nota de críticos: nenhuma fonte de críticos está conectada ao catálogo, então este dado ainda não existe para este álbum",
      scoreFew: "poucas avaliações, interprete com cautela",
      navYears: "ANOS",
      updBadge: "Versão {version} — clique para ver informações de atualização",
      updBadgeNew: "Atualização disponível: v{latest} — clique para ver as instruções",
      updTitleNew: "Nova versão disponível",
      updTitleCurrent: "Você está na versão mais recente",
      updInstalled: "Instalada",
      updLatest: "Mais recente",
      updCheckFailed: "Não foi possível consultar o GitHub agora. Você ainda pode reinstalar pelos passos abaixo.",
      updRecommended: "Recomendado",
      updRawTitle: "Atualizar via RAW (PowerShell)",
      updRawHint: "Abra o PowerShell, cole este comando e pressione Enter. Ele baixa os arquivos novos, ativa o app e roda o spicetify apply. Reinicie o Spotify se ele não atualizar sozinho.",
      updCopy: "Copiar",
      updCopied: "Copiado!",
      updManualTitle: "Método manual",
      updManual1: "Baixe manifest.json, index.js e style.css do repositório (botão abaixo).",
      updManual2: "Substitua os arquivos em",
      updManual3: "Depois execute",
      updOpenGithub: "Abrir repositório no GitHub",
      updClose: "Fechar",
      fabOff: "Mostrar só artistas que eu sigo",
      fabOn: "Só artistas que você segue ({count}) — clique para desativar",
      fabLoading: "Lendo os artistas que você segue…",
      fabError: "Não foi possível ler os artistas seguidos — clique para tentar de novo",
      followedEmpty: "Nenhum álbum deste dia é de artistas que você segue. Desative o filtro para ver todos.",
      orderNewest: "Mais recentes primeiro",
      orderOldest: "Mais antigos primeiro",
      orderTitle: "Inverter a ordem dos anos",
      previewCover: "Ampliar a capa de {title}; clique duas vezes para abrir o álbum no Spotify",
      coverPreviewTitle: "Visualização da capa de {title}",
      loadingFollowed: "Carregando a lista de artistas que você segue…",
      changeLanguage: "Mudar idioma",
      albumsThisDay: "{count} álbuns neste dia"
    },
    es: {
      eyebrow: "HISTORIA DE LA MÚSICA",
      title: "On This Day",
      subtitle: "Álbumes lanzados el {date}, en otros años.",
      count: "{count} álbumes este día",
      loading: "Cargando lanzamientos de {date}…",
      errorTitle: "On This Day",
      errorMsg: "No se pudo cargar el catálogo de {date}.",
      errorHint: "Comprueba que el catálogo se generó y que el servidor de datos es accesible.",
      genreFilter: "Filtrar por género",
      genreLimit: "{selected}/{max} géneros",
      clearFilters: "Limpiar filtros",
      chooseGenres: "Elige hasta cinco géneros. Se mostrarán álbumes de cualquier género seleccionado.",
      limitReached: "Límite de cinco géneros alcanzado.",
      followTitle: "Álbumes de artistas que sigues",
      followDesc: "La app solo pide permiso para leer tu lista de artistas seguidos; no modifica tu cuenta ni accede a listas de reproducción ni historial de escucha.",
      followReq: "En modo de desarrollo, se requiere Premium del propietario de la app, no de ti. El propietario también debe autorizar cada cuenta de prueba (hasta 5). Para distribución pública, Spotify debe aprobar acceso ampliado.",
      followToggle: "Mostrar solo artistas que sigo",
      followConnected: " ( {count} )",
      disconnect: "Desconectar",
      activateFollow: "Conectar Spotify y activar filtro",
      activateFollowNow: "Activar filtro ahora",
      connectAgain: "Conectar de nuevo",
      close: "Cerrar",
      manualLabel: "Si Spotify se abrió fuera de la app, pega la dirección que apareció después de aceptar:",
      manualSubmit: "Completar conexión",
      emptyGenresMsg: "El catálogo publicado aún no incluye géneros. Actualiza la publicación del catálogo para activar este filtro.",
      emptyNoMatch: "Ningún álbum de esta fecha coincide con los géneros seleccionados.",
      emptyFollowed: "No se encontraron álbumes de los artistas que sigues en esta fecha. Desactiva el filtro para ver todos.",
      emptyNone: "No se encontraron álbumes para esta fecha y aniversario.",
      attribution: "Datos: MusicBrainz. El orden prioriza las calificaciones de la comunidad cuando están disponibles. Haz clic en la portada para ampliarla; doble clic para abrir el álbum o buscar en Spotify.",
      moreAlbums: "Ver más álbumes",
      lessAlbums: "Mostrar menos",
      yearAgo: "1 año atrás",
      yearsAgo: "{age} años atrás",
      yearTooltip: "{age} año atrás",
      yearsTooltip: "{age} años atrás",
      yearShort: "1 año",
      yearsShort: "{age} años",
      albumsCount: "{count} álbumes",
      communityScore: "USUARIOS",
      criticScore: "CRÍTICA",
      scoreUnavailable: "N/D",
      scoreVotes: "{count} valoraciones",
      userScoreTitle: "Promedio de valoraciones de la comunidad MusicBrainz",
      criticScoreTitle: "Promedio agregado de críticos",
      userScoreMissing: "este álbum aún no tiene valoraciones de la comunidad",
      criticScoreMissing: "sin nota de críticos: ninguna fuente de críticos está conectada al catálogo, por lo que este álbum aún no tiene el dato",
      scoreFew: "pocas valoraciones, interpreta con cautela",
      navYears: "AÑOS",
      updBadge: "Versión {version} — haz clic para ver información de actualización",
      updBadgeNew: "Actualización disponible: v{latest} — haz clic para ver las instrucciones",
      updTitleNew: "Nueva versión disponible",
      updTitleCurrent: "Estás en la última versión",
      updInstalled: "Instalada",
      updLatest: "Más reciente",
      updCheckFailed: "No se pudo consultar GitHub ahora. Aún puedes reinstalar con los pasos de abajo.",
      updRecommended: "Recomendado",
      updRawTitle: "Actualizar vía RAW (PowerShell)",
      updRawHint: "Abre PowerShell, pega este comando y pulsa Enter. Descarga los archivos nuevos, activa la app y ejecuta spicetify apply. Reinicia Spotify si no se actualiza solo.",
      updCopy: "Copiar",
      updCopied: "¡Copiado!",
      updManualTitle: "Método manual",
      updManual1: "Descarga manifest.json, index.js y style.css del repositorio (botón de abajo).",
      updManual2: "Reemplaza los archivos en",
      updManual3: "Luego ejecuta",
      updOpenGithub: "Abrir repositorio en GitHub",
      updClose: "Cerrar",
      fabOff: "Mostrar solo artistas que sigo",
      fabOn: "Solo artistas que sigues ({count}) — clic para desactivar",
      fabLoading: "Leyendo los artistas que sigues…",
      fabError: "No se pudo leer los artistas seguidos — clic para reintentar",
      followedEmpty: "Ningún álbum de este día es de artistas que sigues. Desactiva el filtro para ver todos.",
      orderNewest: "Más recientes primero",
      orderOldest: "Más antiguos primero",
      orderTitle: "Invertir el orden de los años",
      previewCover: "Ampliar la portada de {title}; haz doble clic para abrir el álbum en Spotify",
      coverPreviewTitle: "Vista previa de la portada de {title}",
      loadingFollowed: "Cargando tu lista de artistas seguidos…",
      changeLanguage: "Cambiar idioma",
      albumsThisDay: "{count} álbumes este día",
      albumAriaLabel: "Buscar {title} de {artist} en Spotify",
      albumTitleAttr: "Buscar {title} en Spotify",
      coverAlt: "Portada de {title}",
      searchOnSpotify: "Buscar {title} en Spotify",
      searchOnSpotifyShort: "Spotify"
    }
  };
  function detectLang() {
    try {
      const stored = localStorage.getItem(LANG_KEY);
      if (stored && stored in TEXTS) return stored;
    } catch {
    }
    const nav = typeof navigator !== "undefined" ? navigator.language : "en";
    const code = nav.split("-")[0].toLowerCase();
    return code in TEXTS ? code : "en";
  }
  function getLang() {
    try {
      const stored = localStorage.getItem(LANG_KEY);
      if (stored && stored in TEXTS) return stored;
    } catch {
    }
    return detectLang();
  }
  function setLang(lang) {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
    }
  }
  function t(lang, key, params) {
    let text = TEXTS[lang][key] ?? TEXTS.en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return text;
  }

  // src/components/FollowFab.tsx
  function FollowFab({ state, count, lang, onToggle }) {
    const [hover, setHover] = useState(false);
    const hideTimer = useRef(null);
    const [offset, setOffset] = useState(null);
    useEffect(() => {
      const main = document.querySelector(".Root__main-view") ?? document.querySelector("main");
      if (!main) return;
      const update = () => {
        const rect = main.getBoundingClientRect();
        const bar = document.querySelector(".Root__now-playing-bar");
        const barTop = bar ? bar.getBoundingClientRect().top : window.innerHeight - 90;
        setOffset({
          right: Math.max(12, Math.round(window.innerWidth - rect.right + 20)),
          bottom: Math.max(12, Math.round(window.innerHeight - Math.min(barTop, rect.bottom) + 18))
        });
      };
      update();
      const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
      observer?.observe(main);
      window.addEventListener("resize", update);
      const poll = window.setInterval(update, 1500);
      return () => {
        observer?.disconnect();
        window.removeEventListener("resize", update);
        window.clearInterval(poll);
      };
    }, []);
    const label = state === "on" ? t(lang, "fabOn", { count: count.toLocaleString(lang) }) : state === "loading" ? t(lang, "fabLoading") : state === "error" ? t(lang, "fabError") : t(lang, "fabOff");
    return createPortal(
      /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-fab-wrap", style: offset ? { right: `${offset.right}px`, bottom: `${offset.bottom}px` } : void 0 }, /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          type: "button",
          className: `otd-fab otd-fab--${state}`,
          "aria-pressed": state === "on",
          "aria-label": label,
          onClick: onToggle,
          onMouseEnter: () => {
            if (hideTimer.current) clearTimeout(hideTimer.current);
            setHover(true);
          },
          onMouseLeave: () => {
            hideTimer.current = window.setTimeout(() => setHover(false), 120);
          },
          onFocus: () => setHover(true),
          onBlur: () => setHover(false)
        },
        state === "loading" ? /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-fab-spinner", "aria-hidden": "true" }) : /* @__PURE__ */ Spicetify.React.createElement("svg", { viewBox: "0 0 24 24", width: "22", height: "22", "aria-hidden": "true" }, /* @__PURE__ */ Spicetify.React.createElement("path", { fill: "currentColor", d: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.3 0-8 1.7-8 5v1h9.1A6 6 0 0 1 12 14Zm7 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-.7 6.2-1.7-1.7 1-1 .7.7 2-2 1 1-3 3Z" })),
        state === "on" && /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-fab-dot", "aria-hidden": "true" })
      ), hover && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-fab-tip", role: "status" }, label)),
      document.body
    );
  }

  // src/services/updates.ts
  var APP_VERSION = true ? "1.1.1" : "0.0.0";
  var REPO = true ? "uWaazy/on-this-day" : "uWaazy/on-this-day";
  var REPO_URL = `https://github.com/${REPO}`;
  var RAW_BASE = `https://raw.githubusercontent.com/${REPO}/main`;
  var RAW_MANIFEST_URL = `${RAW_BASE}/manifest.json`;
  var INSTALL_COMMAND = `irm ${RAW_BASE}/install.ps1 | iex`;
  var CACHE_KEY2 = "on-this-day:update-check:v1";
  var CHECK_INTERVAL_MS = 3 * 60 * 60 * 1e3;
  function compareVersions(a, b) {
    const parse = (value) => (/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(value.trim()) ?? []).slice(1).map((part) => Number(part ?? 0));
    const left = parse(a);
    const right = parse(b);
    for (let i = 0; i < 3; i += 1) {
      const diff = (left[i] || 0) - (right[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }
  function readCache4() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CACHE_KEY2) ?? "null");
      if (parsed && typeof parsed.latest === "string" && typeof parsed.at === "number") return parsed;
    } catch {
    }
    return null;
  }
  function toInfo(latest, checkedAt) {
    return { latest, hasUpdate: !!latest && compareVersions(latest, APP_VERSION) > 0, checkedAt };
  }
  async function checkForUpdate(force = false) {
    const cached = readCache4();
    if (!force && cached && Date.now() - cached.at < CHECK_INTERVAL_MS) return toInfo(cached.latest, cached.at);
    try {
      const response = await withTimeout(fetch(`${RAW_MANIFEST_URL}?t=${Math.floor(Date.now() / 6e4)}`, { cache: "no-store" }), 8e3);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const manifest = await response.json();
      const latest = typeof manifest.version === "string" && /^\d+\.\d+\.\d+/.test(manifest.version) ? manifest.version : null;
      if (!latest) throw new Error("manifest sem versão");
      try {
        localStorage.setItem(CACHE_KEY2, JSON.stringify({ latest, at: Date.now() }));
      } catch {
      }
      return toInfo(latest, Date.now());
    } catch {
      return toInfo(cached?.latest ?? null, cached?.at ?? 0);
    }
  }
  function peekUpdate() {
    const cached = readCache4();
    return toInfo(cached?.latest ?? null, cached?.at ?? 0);
  }
  async function copyText(text) {
    try {
      const clipboard = globalThis.Spicetify?.Platform?.ClipboardAPI;
      if (clipboard?.copy) {
        await clipboard.copy(text);
        return true;
      }
    } catch {
    }
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
    }
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }

  // src/components/UpdateBadge.tsx
  function UpdateBadge({ lang }) {
    const [info, setInfo] = useState(peekUpdate);
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const closeRef = useRef(null);
    const copyTimer = useRef(null);
    useEffect(() => {
      let cancelled = false;
      void checkForUpdate().then((result) => {
        if (!cancelled) setInfo(result);
      });
      return () => {
        cancelled = true;
      };
    }, []);
    useEffect(() => {
      if (!open) return;
      closeRef.current?.focus({ preventScroll: true });
      const onKey = (event) => {
        if (event.key === "Escape") setOpen(false);
      };
      document.addEventListener("keydown", onKey);
      void checkForUpdate(true).then(setInfo);
      return () => document.removeEventListener("keydown", onKey);
    }, [open]);
    useEffect(() => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    }, []);
    async function copyCommand() {
      const ok = await copyText(INSTALL_COMMAND);
      setCopied(ok);
      if (ok) {
        try {
          globalThis.Spicetify?.showNotification?.(t(lang, "updCopied"));
        } catch {
        }
        if (copyTimer.current) clearTimeout(copyTimer.current);
        copyTimer.current = window.setTimeout(() => setCopied(false), 2200);
      }
    }
    const label = info.hasUpdate ? t(lang, "updBadgeNew", { latest: info.latest ?? "" }) : t(lang, "updBadge", { version: APP_VERSION });
    return /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        type: "button",
        className: `otd-version-badge${info.hasUpdate ? " has-update" : ""}`,
        onClick: () => setOpen(true),
        title: label,
        "aria-label": label,
        "aria-haspopup": "dialog"
      },
      info.hasUpdate && /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-version-dot", "aria-hidden": "true" }),
      /* @__PURE__ */ Spicetify.React.createElement("span", null, "v", APP_VERSION),
      info.hasUpdate && /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-version-new" }, "↑ v", info.latest)
    ), open && createPortal(
      /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-update-backdrop", role: "presentation", onClick: () => setOpen(false) }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-update-dialog", role: "dialog", "aria-modal": "true", "aria-label": t(lang, "updTitleNew"), onClick: (event) => event.stopPropagation() }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-update-head" }, /* @__PURE__ */ Spicetify.React.createElement("div", null, /* @__PURE__ */ Spicetify.React.createElement("h2", null, info.hasUpdate ? t(lang, "updTitleNew") : t(lang, "updTitleCurrent")), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-update-versions" }, t(lang, "updInstalled"), ": ", /* @__PURE__ */ Spicetify.React.createElement("strong", null, "v", APP_VERSION), info.latest && /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, " · ", t(lang, "updLatest"), ": ", /* @__PURE__ */ Spicetify.React.createElement("strong", { className: info.hasUpdate ? "is-new" : "" }, "v", info.latest))), !info.latest && /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-update-warn" }, t(lang, "updCheckFailed"))), /* @__PURE__ */ Spicetify.React.createElement("button", { ref: closeRef, type: "button", className: "otd-update-close", onClick: () => setOpen(false), "aria-label": t(lang, "updClose") }, "✕")), /* @__PURE__ */ Spicetify.React.createElement("section", { className: "otd-update-block" }, /* @__PURE__ */ Spicetify.React.createElement("h3", null, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-update-tag" }, t(lang, "updRecommended")), " ", t(lang, "updRawTitle")), /* @__PURE__ */ Spicetify.React.createElement("p", null, t(lang, "updRawHint")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-update-command" }, /* @__PURE__ */ Spicetify.React.createElement("code", null, INSTALL_COMMAND), /* @__PURE__ */ Spicetify.React.createElement("button", { type: "button", className: copied ? "is-copied" : "", onClick: copyCommand }, copied ? t(lang, "updCopied") : t(lang, "updCopy")))), /* @__PURE__ */ Spicetify.React.createElement("section", { className: "otd-update-block" }, /* @__PURE__ */ Spicetify.React.createElement("h3", null, t(lang, "updManualTitle")), /* @__PURE__ */ Spicetify.React.createElement("ol", null, /* @__PURE__ */ Spicetify.React.createElement("li", null, t(lang, "updManual1")), /* @__PURE__ */ Spicetify.React.createElement("li", null, t(lang, "updManual2"), " ", /* @__PURE__ */ Spicetify.React.createElement("code", null, "%appdata%\\spicetify\\CustomApps\\on-this-day")), /* @__PURE__ */ Spicetify.React.createElement("li", null, t(lang, "updManual3"), " ", /* @__PURE__ */ Spicetify.React.createElement("code", null, "spicetify config custom_apps on-this-day"), " → ", /* @__PURE__ */ Spicetify.React.createElement("code", null, "spicetify apply")))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-update-actions" }, /* @__PURE__ */ Spicetify.React.createElement("a", { className: "otd-update-link", href: REPO_URL, target: "_blank", rel: "noopener noreferrer" }, t(lang, "updOpenGithub")), /* @__PURE__ */ Spicetify.React.createElement("button", { type: "button", className: "otd-update-done", onClick: () => setOpen(false) }, t(lang, "updClose"))))),
      document.body
    ));
  }

  // src/components/AppIcon.tsx
  function AppIcon({ size = 26 }) {
    return /* @__PURE__ */ Spicetify.React.createElement("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: "1.9", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ Spicetify.React.createElement("rect", { x: "3.2", y: "4.8", width: "17.6", height: "16", rx: "4.2" }), /* @__PURE__ */ Spicetify.React.createElement("path", { d: "M8 2.6v3.6M16 2.6v3.6M3.4 9.8h17.2" }), /* @__PURE__ */ Spicetify.React.createElement("circle", { cx: "10.4", cy: "16.6", r: "1.75", fill: "currentColor", stroke: "none" }), /* @__PURE__ */ Spicetify.React.createElement("path", { d: "M12.15 16.6v-4.7l3.4 1.3" }));
  }
  function GlobeIcon({ size = 16 }) {
    return /* @__PURE__ */ Spicetify.React.createElement("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ Spicetify.React.createElement("circle", { cx: "12", cy: "12", r: "9" }), /* @__PURE__ */ Spicetify.React.createElement("path", { d: "M3 12h18M12 3c2.6 2.5 3.9 5.5 3.9 9S14.600 18.500 12 21c-2.600-2.500-3.900-5.500-3.900-9S9.400 5.500 12 3Z" }));
  }
  function ChevronIcon({ size = 14 }) {
    return /* @__PURE__ */ Spicetify.React.createElement("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ Spicetify.React.createElement("path", { d: "m6 9 6 6 6-6" }));
  }
  function CheckIcon({ size = 14 }) {
    return /* @__PURE__ */ Spicetify.React.createElement("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: "2.6", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ Spicetify.React.createElement("path", { d: "m5 12.5 4.5 4.5L19 7.500" }));
  }

  // src/api/artist-images.ts
  var STORAGE_KEY = "on-this-day:artist-photos:v3";
  var LEGACY_KEYS = ["on-this-day:artist-images", "on-this-day:artist-photos:v2"];
  var HIT_TTL = 14 * 24 * 60 * 60 * 1e3;
  var MISS_TTL = 12 * 60 * 60 * 1e3;
  var MAX_ENTRIES = 300;
  var store = null;
  var persistTimer;
  var inflight = /* @__PURE__ */ new Map();
  function loadStore() {
    if (store) return store;
    store = {};
    try {
      LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object") store = parsed;
    } catch {
    }
    return store;
  }
  function persistSoon() {
    if (persistTimer !== void 0) return;
    persistTimer = window.setTimeout(() => {
      persistTimer = void 0;
      const current = loadStore();
      const keys = Object.keys(current);
      if (keys.length > MAX_ENTRIES) {
        keys.sort((a, b) => current[a].at - current[b].at);
        for (const key of keys.slice(0, keys.length - MAX_ENTRIES)) delete current[key];
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      } catch {
      }
    }, 1500);
  }
  function readEntry(key) {
    const entry = loadStore()[key];
    if (!entry || typeof entry.at !== "number") return null;
    const ttl = entry.url ? HIT_TTL : MISS_TTL;
    if (Date.now() - entry.at > ttl) {
      delete loadStore()[key];
      return null;
    }
    return entry;
  }
  function writeEntry(key, entry) {
    loadStore()[key] = { ...entry, at: Date.now() };
    persistSoon();
  }
  function pickImage(images) {
    const valid = (images ?? []).filter((image) => image.url);
    if (!valid.length) return null;
    const sorted = [...valid].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
    return (sorted.find((image) => (image.width ?? 0) >= 500 && (image.width ?? 0) <= 1e3) ?? sorted[0]).url ?? null;
  }
  async function artistImageById(id) {
    const cached = readEntry(`id:${id}`);
    if (cached) return cached.url;
    const artist = await spotifyGet(`https://api.spotify.com/v1/artists/${encodeURIComponent(id)}`);
    const url = pickImage(artist.images);
    writeEntry(`id:${id}`, { url, kind: "artist", id });
    return url;
  }
  async function artistBySearch(name) {
    const params = new URLSearchParams({ q: name, type: "artist", limit: "10" });
    const result = await spotifyGet(
      `https://api.spotify.com/v1/search?${params}`
    );
    const expected = normalizeText(name);
    const exact = (result.artists?.items ?? []).filter((artist) => artist.id && artist.name && normalizeText(artist.name) === expected && pickImage(artist.images)).sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    const best = exact[0];
    if (!best?.id) return null;
    const url = pickImage(best.images);
    return url ? { id: best.id, url } : null;
  }
  async function viaGraphQL(id) {
    const gql = Spicetify?.GraphQL;
    const definition = gql?.Definitions?.queryArtistOverview;
    if (!gql?.Request || !definition) return null;
    const response = await withTimeout(
      gql.Request(definition, { uri: `spotify:artist:${id}`, locale: "", includePrerelease: false }),
      8e3
    );
    const visuals = response?.data?.artistUnion?.visuals;
    const sources = [
      ...visuals?.headerImage?.sources ?? [],
      ...visuals?.avatarImage?.sources ?? []
    ].filter((source) => source?.url);
    if (!sources.length) return null;
    const sorted = [...sources].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
    return (sorted.find((source) => (source.width ?? 0) <= 1400) ?? sorted[sorted.length - 1]).url ?? null;
  }
  var MUSICIAN = /\b(singer|rapper|musician|band|duo|group|songwriter|record producer|dj|composer|vocalist|guitarist|pianist|drummer|bassist|trio|quartet|ensemble|hip hop|rock|pop|jazz|metal|punk)\b/i;
  async function viaWikipedia(name) {
    const response = await withTimeout(
      fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/\s+/g, "_"))}`, {
        headers: { Accept: "application/json" }
      }),
      8e3
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`wikipedia ${response.status}`);
    const page = await response.json();
    if (page.type !== "standard" || !page.thumbnail?.source) return null;
    if (normalizeText(page.title ?? "").replace(/\(.*$/, "") !== normalizeText(name) && !normalizeText(page.title ?? "").startsWith(normalizeText(name))) return null;
    if (!MUSICIAN.test(`${page.description ?? ""} ${(page.extract ?? "").slice(0, 200)}`)) return null;
    return page.thumbnail.source.replace(/\/\d+px-/, "/800px-");
  }
  async function resolve(candidate) {
    const key = `artist:${candidate.key}`;
    const cached = readEntry(key);
    if (cached) return cached.url ? { url: cached.url, kind: "artist", source: cached.source ?? "spotify", spotifyArtistId: cached.id } : null;
    let failures = 0;
    const found = (url, source, id) => {
      writeEntry(key, { url, kind: "artist", id, source });
      return { url, kind: "artist", source, spotifyArtistId: id };
    };
    const attempt = async (task) => {
      try {
        return await task();
      } catch {
        failures += 1;
        return null;
      }
    };
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
    if (failures === 0) writeEntry(key, { url: null, kind: "artist" });
    return null;
  }
  function resolveArtistPhoto(candidate) {
    const existing = inflight.get(candidate.key);
    if (existing) return existing;
    const pending = resolve(candidate).finally(() => inflight.delete(candidate.key));
    inflight.set(candidate.key, pending);
    return pending;
  }
  var loadedImages = /* @__PURE__ */ new Set();
  function preloadImage(url, timeoutMs = 7e3) {
    if (loadedImages.has(url)) return Promise.resolve(true);
    return new Promise((resolvePreload) => {
      const image = new Image();
      let done = false;
      const finish = (ok) => {
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

  // src/services/album-cover.ts
  var ITUNES_PREFIX = "on-this-day:itunes-cover:v1:";
  var ITUNES_TTL = 30 * 24 * 60 * 60 * 1e3;
  var ITUNES_MISS_TTL = 24 * 60 * 60 * 1e3;
  var limitItunes = createLimiter(2);
  var memory2 = /* @__PURE__ */ new Map();
  function caaCoverUrl(mbid, size = 500) {
    return `https://coverartarchive.org/release-group/${mbid}/front-${size}`;
  }
  function readItunes(mbid) {
    try {
      const entry = JSON.parse(localStorage.getItem(ITUNES_PREFIX + mbid) ?? "null");
      if (entry && typeof entry.expiresAt === "number" && entry.expiresAt > Date.now()) return entry;
    } catch {
    }
    return null;
  }
  function writeItunes(mbid, url) {
    try {
      localStorage.setItem(ITUNES_PREFIX + mbid, JSON.stringify({ url, expiresAt: Date.now() + (url ? ITUNES_TTL : ITUNES_MISS_TTL) }));
    } catch {
    }
  }
  async function itunesCover(query) {
    const cached = readItunes(query.mbid);
    if (cached) return cached.url;
    const params = new URLSearchParams({
      term: `${query.title.replace(/[([][^)\]]*[)\]]/g, " ")} ${query.artistName}`.replace(/\s+/g, " ").trim(),
      media: "music",
      entity: "album",
      limit: "8"
    });
    const response = await limitItunes(() => withTimeout(fetch(`https://itunes.apple.com/search?${params}`), 8e3));
    if (!response.ok) throw new Error(`itunes ${response.status}`);
    const data = await response.json();
    let best = null;
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
  async function resolve2(query, skipCaa) {
    if (!skipCaa) {
      const url = caaCoverUrl(query.mbid, 500);
      if (await preloadImage(url, 6e3)) return url;
    }
    const spotify = await findSpotifyAlbum(query);
    if (spotify.cover && await preloadImage(spotify.cover, 6e3)) return spotify.cover;
    try {
      const url = await itunesCover(query);
      if (url && await preloadImage(url, 6e3)) return url;
    } catch {
    }
    return null;
  }
  function resolveAlbumCover(query, skipCaa = false) {
    const key = `${query.mbid}:${skipCaa ? 1 : 0}`;
    const existing = memory2.get(key);
    if (existing) return existing;
    const pending = resolve2(query, skipCaa).then((url) => {
      if (!url) memory2.delete(key);
      return url;
    });
    memory2.set(key, pending);
    return pending;
  }

  // src/components/ScoreInfo.tsx
  function ScoreInfo({ text, children, className }) {
    const ref = useRef(null);
    const timer = useRef(null);
    const [pos, setPos] = useState(null);
    function show(delay) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        const width = 230;
        const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
        const above = rect.top > 110;
        setPos({ left, top: above ? rect.top - 8 : rect.bottom + 8 });
        ref.current.dataset.placement = above ? "above" : "below";
      }, delay);
    }
    function hide() {
      if (timer.current) clearTimeout(timer.current);
      setPos(null);
    }
    useEffect(() => () => {
      if (timer.current) clearTimeout(timer.current);
    }, []);
    const placement = ref.current?.dataset.placement ?? "above";
    return /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        ref,
        className,
        tabIndex: 0,
        onMouseEnter: () => show(250),
        onMouseLeave: hide,
        onFocus: () => show(0),
        onBlur: hide,
        onClick: () => pos ? hide() : show(0)
      },
      children,
      pos && createPortal(
        /* @__PURE__ */ Spicetify.React.createElement("div", { className: `otd-info-pop otd-info-pop--${placement}`, role: "tooltip", style: { top: pos.top, left: pos.left } }, text),
        document.body
      )
    );
  }

  // src/components/ScoreMeter.tsx
  var SHOW_CRITIC_SCORE = false;
  var LOW_CONFIDENCE_VOTES = 5;
  function readUserScore(item) {
    const votes = Number(item.ratingVotes ?? 0);
    const rating = Number(item.ratingValue ?? 0);
    if (!Number.isFinite(votes) || !Number.isFinite(rating) || votes <= 0 || rating <= 0 || rating > 5) {
      return { value: null, count: null, lowConfidence: false };
    }
    return { value: Math.round(rating / 5 * 100), count: votes, lowConfidence: votes < LOW_CONFIDENCE_VOTES };
  }
  function readCriticScore(item) {
    const score = Number(item.criticScore);
    if (item.criticScore === void 0 || !Number.isFinite(score) || score < 0 || score > 100) {
      return { value: null, count: null, lowConfidence: false };
    }
    const count = item.criticVotes !== void 0 && Number(item.criticVotes) > 0 ? Number(item.criticVotes) : null;
    return { value: Math.round(score), count, lowConfidence: count !== null && count < 3 };
  }
  function ScoreMeter({ kind, reading, lang }) {
    const available = reading.value !== null;
    const label = t(lang, kind === "user" ? "communityScore" : "criticScore");
    const sourceTitle = t(lang, kind === "user" ? "userScoreTitle" : "criticScoreTitle");
    const tooltip = !available ? `${label}: ${t(lang, kind === "user" ? "userScoreMissing" : "criticScoreMissing")}` : [
      sourceTitle,
      reading.count !== null ? t(lang, "scoreVotes", { count: reading.count.toLocaleString(lang) }) : "",
      reading.lowConfidence ? t(lang, "scoreFew") : ""
    ].filter(Boolean).join(" · ");
    const countText = !available ? t(lang, "scoreUnavailable") : reading.count !== null ? t(lang, "scoreVotes", { count: reading.count.toLocaleString(lang) }) : "";
    return /* @__PURE__ */ Spicetify.React.createElement(
      ScoreInfo,
      {
        text: tooltip,
        className: `otd-score otd-score--${kind}${available ? "" : " is-unavailable"}${reading.lowConfidence ? " is-low" : ""}`
      },
      /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-score-top" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-score-label" }, label), /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-score-value" }, available ? reading.value : "—")),
      /* @__PURE__ */ Spicetify.React.createElement(
        "div",
        {
          className: "otd-score-track",
          role: available ? "meter" : void 0,
          "aria-valuemin": available ? 0 : void 0,
          "aria-valuemax": available ? 100 : void 0,
          "aria-valuenow": available ? reading.value ?? void 0 : void 0,
          "aria-label": `${label}: ${available ? reading.value : t(lang, "scoreUnavailable")}`
        },
        available && /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-score-fill", style: { width: `${reading.value}%` } })
      ),
      /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-score-count" }, countText)
    );
  }

  // src/components/AlbumCard.tsx
  var SINGLE_CLICK_DELAY_MS = 280;
  var AlbumCard = memo(function AlbumCard2({ item, lang, onPreview }) {
    const year = item.firstReleaseDate.slice(0, 4);
    const [hasCover, setHasCover] = useState(true);
    const [coverSrc, setCoverSrc] = useState(() => peekCachedCover(item.mbid) ?? `https://coverartarchive.org/release-group/${item.mbid}/front-250`);
    const fallbackStarted = useRef(false);
    const loaded = useRef(false);
    const wrapRef = useRef(null);
    const retryTimer = useRef(null);
    const clickTimer = useRef(null);
    const mounted = useRef(true);
    const userScore = readUserScore(item);
    const criticScore = readCriticScore(item);
    function clearClickTimer() {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
    }
    function openSpotifyAlbum() {
      clearClickTimer();
      void openAlbumInSpotify(item);
    }
    function warmUpLookup() {
      void findSpotifyAlbum(item);
    }
    function handleCoverClick(event) {
      if (event.detail >= 2) {
        openSpotifyAlbum();
        return;
      }
      clearClickTimer();
      if (event.detail === 0) {
        onPreview(item, hasCover ? coverSrc : null);
        return;
      }
      clickTimer.current = window.setTimeout(() => {
        clickTimer.current = null;
        if (mounted.current) onPreview(item, hasCover ? coverSrc : null);
      }, SINGLE_CLICK_DELAY_MS);
    }
    function recoverCover(attempt = 0) {
      void resolveAlbumCover(item, true).then((url) => {
        if (!mounted.current) return;
        if (url) {
          loaded.current = false;
          setCoverSrc(url);
          setHasCover(true);
        } else if (attempt === 0) {
          retryTimer.current = window.setTimeout(() => recoverCover(1), 12e3);
        } else {
          setHasCover(false);
        }
      });
    }
    function handleCoverError() {
      if (fallbackStarted.current) {
        if (!loaded.current) setHasCover(false);
        return;
      }
      fallbackStarted.current = true;
      recoverCover();
    }
    useEffect(() => {
      mounted.current = true;
      let slowTimer;
      const startSlowTimer = () => {
        if (slowTimer) return;
        slowTimer = window.setTimeout(() => {
          if (!loaded.current && !fallbackStarted.current) {
            fallbackStarted.current = true;
            recoverCover();
          }
        }, 7e3);
      };
      let observer;
      const node = wrapRef.current;
      if (node && typeof IntersectionObserver !== "undefined") {
        observer = new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            startSlowTimer();
            observer?.disconnect();
          }
        });
        observer.observe(node);
      } else {
        startSlowTimer();
      }
      return () => {
        mounted.current = false;
        clearClickTimer();
        observer?.disconnect();
        if (slowTimer) window.clearTimeout(slowTimer);
        if (retryTimer.current) clearTimeout(retryTimer.current);
      };
    }, []);
    return /* @__PURE__ */ Spicetify.React.createElement("article", { className: "otd-album-card" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-cover-wrap", ref: wrapRef }, /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "otd-cover-trigger",
        type: "button",
        onClick: handleCoverClick,
        onMouseEnter: warmUpLookup,
        onFocus: warmUpLookup,
        "aria-label": t(lang, "previewCover", { title: item.title }),
        title: t(lang, "previewCover", { title: item.title })
      },
      hasCover ? /* @__PURE__ */ Spicetify.React.createElement(
        "img",
        {
          className: "otd-cover",
          src: coverSrc,
          alt: t(lang, "coverAlt", { title: item.title }),
          loading: "lazy",
          decoding: "async",
          onLoad: () => {
            loaded.current = true;
          },
          onError: handleCoverError
        }
      ) : /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-cover-placeholder", "aria-hidden": "true" }, "♫")
    ), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "otd-open-spotify",
        type: "button",
        onClick: openSpotifyAlbum,
        onMouseEnter: warmUpLookup,
        "aria-label": t(lang, "searchOnSpotify", { title: item.title })
      },
      t(lang, "searchOnSpotifyShort")
    )), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-album-name", title: item.title }, item.title), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-artist-name", title: item.artistName }, item.artistName), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-card-meta" }, year), /* @__PURE__ */ Spicetify.React.createElement("div", { className: `otd-scores${SHOW_CRITIC_SCORE ? "" : " otd-scores--single"}` }, /* @__PURE__ */ Spicetify.React.createElement(ScoreMeter, { kind: "user", reading: userScore, lang }), SHOW_CRITIC_SCORE && /* @__PURE__ */ Spicetify.React.createElement(ScoreMeter, { kind: "critic", reading: criticScore, lang })));
  });

  // src/services/background-selection.ts
  var VISIBLE_ARTISTS = 6;
  var POOL_SIZE = 18;
  var MAX_ALBUMS_PER_ARTIST = 2;
  var NON_ARTIST = /^(various artists?|unknown( artist)?|\[?no artist\]?|\[?anonymous\]?|\[?traditional\]?|\[?unknown\]?|\[?data\]?|special purpose.*)$/i;
  function primaryArtist(item) {
    const names = item.artistNames?.length ? item.artistNames : [item.artistName];
    for (const name of names) {
      const trimmed = name?.trim();
      if (trimmed && !NON_ARTIST.test(trimmed)) return trimmed;
    }
    return null;
  }
  function compareRelevance(a, b) {
    return (b.ratingVotes ?? 0) - (a.ratingVotes ?? 0) || (b.ratingValue ?? 0) - (a.ratingValue ?? 0) || Number(!!b.genres?.length) - Number(!!a.genres?.length) || Number(b.firstReleaseDate.slice(0, 4)) - Number(a.firstReleaseDate.slice(0, 4)) || a.title.localeCompare(b.title) || a.mbid.localeCompare(b.mbid);
  }
  function selectBackgroundCandidates(items, limit = POOL_SIZE) {
    if (!items.length) return [];
    const ranked = [...items].sort(compareRelevance);
    const result = [];
    const byKey = /* @__PURE__ */ new Map();
    for (const item of ranked) {
      const artist = primaryArtist(item);
      if (!artist || !item.mbid || !item.title) continue;
      const key = normalizeText(artist);
      if (!key) continue;
      const album = {
        mbid: item.mbid,
        title: item.title,
        artistName: item.artistName,
        artistNames: item.artistNames,
        firstReleaseDate: item.firstReleaseDate
      };
      const existing = byKey.get(key);
      if (existing) {
        if (existing.albums.length < MAX_ALBUMS_PER_ARTIST) existing.albums.push(album);
        continue;
      }
      if (byKey.size >= limit) continue;
      const candidate = { key, artistName: artist, album, albums: [album], year: Number(item.firstReleaseDate.slice(0, 4)) };
      byKey.set(key, candidate);
      result.push(candidate);
    }
    return result;
  }

  // src/components/DynamicBackground.tsx
  var FADE_MS = 1800;
  var SETTLE_TIMEOUT_FIRST_MS = 4500;
  var SETTLE_TIMEOUT_REPLACE_MS = 8e3;
  var PARALLEL_RESOLVERS = 3;
  var FIRST_START_DELAY_MS = 900;
  function getRect(index, count) {
    const cell = (columns, rows, col, row) => ({
      left: `${col * 100 / columns}%`,
      top: `${row * 100 / rows}%`,
      width: `${100 / columns}%`,
      height: `${100 / rows}%`
    });
    switch (count) {
      case 1:
        return cell(1, 1, 0, 0);
      case 2:
        return cell(2, 1, index, 0);
      case 3:
        return cell(3, 1, index, 0);
      case 4:
        return cell(2, 2, index % 2, Math.floor(index / 2));
      case 5:
        return index < 3 ? cell(3, 2, index, 0) : { left: `${(index - 3) * 50}%`, top: "50%", width: "50%", height: "50%" };
      default:
        return cell(3, 2, index % 3, Math.floor(index / 3));
    }
  }
  function SlotImage({ url, kind }) {
    const counter = useRef(0);
    const [layers, setLayers] = useState(() => [{ n: 0, url, kind }]);
    useEffect(() => {
      setLayers((current) => {
        const top = current[current.length - 1];
        if (top.url === url) return current;
        counter.current += 1;
        return [top, { n: counter.current, url, kind }];
      });
      const timer = window.setTimeout(() => setLayers((current) => current.slice(-1)), FADE_MS + 250);
      return () => window.clearTimeout(timer);
    }, [url]);
    return /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, layers.map((layer, index) => /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        key: layer.n,
        className: `otd-bg-photo otd-bg-photo--${layer.kind}${index === layers.length - 1 ? " is-entering" : ""}`,
        style: { backgroundImage: `url("${layer.url}")` }
      }
    )));
  }
  function toSlot(artist, index) {
    const i = (index % artist.visuals.length + artist.visuals.length) % artist.visuals.length;
    return { key: artist.key, url: artist.visuals[i].url, kind: artist.visuals[i].kind, visuals: artist.visuals, index: i };
  }
  function DynamicBackground({ candidates, rotationInterval = 8e3 }) {
    const [slots, setSlots] = useState([]);
    const slotsRef = useRef([]);
    const generation = useRef(0);
    const states = useRef([]);
    const artists = useRef([]);
    const lastShown = useRef(/* @__PURE__ */ new Map());
    const entries = useRef(/* @__PURE__ */ new Map());
    const tickCount = useRef(0);
    const cursor = useRef(0);
    const extraBusy = useRef(false);
    const tickRef = useRef(() => {
    });
    const candidatesKey = candidates.map((candidate) => `${candidate.key}@${candidate.albums.map((album) => album.mbid).join("+")}`).join("|");
    function publish(next) {
      const previous = slotsRef.current;
      const same = previous.length === next.length && previous.every((slot, i) => slot.url === next[i].url && slot.key === next[i].key);
      if (same) return;
      slotsRef.current = next;
      setSlots(next);
    }
    async function loadIndex(gen, list, index) {
      states.current[index] = "loading";
      const candidate = list[index];
      const visuals = [];
      try {
        const photoTask = resolveArtistPhoto(candidate).then(async (photo2) => photo2 && await preloadImage(photo2.url) ? photo2.url : null).catch(() => null);
        const coverTasks = candidate.albums.map((album) => resolveAlbumCover(album).catch(() => null));
        const [photo, ...covers] = await Promise.all([photoTask, ...coverTasks]);
        if (photo) visuals.push({ url: photo, kind: "artist" });
        covers.forEach((cover) => {
          if (cover && !visuals.some((v) => v.url === cover)) visuals.push({ url: cover, kind: "cover" });
        });
      } catch {
      }
      if (gen !== generation.current) return false;
      if (visuals.length) artists.current[index] = { key: candidate.key, visuals };
      states.current[index] = visuals.length ? "ready" : "failed";
      return visuals.length > 0;
    }
    function prefetchExtra(gen, list) {
      if (extraBusy.current || gen !== generation.current) return;
      const index = states.current.findIndex((state) => state === "idle");
      if (index === -1) return;
      extraBusy.current = true;
      void loadIndex(gen, list, index).finally(() => {
        extraBusy.current = false;
      });
    }
    function enter(artist) {
      const times = entries.current.get(artist.key) ?? 0;
      entries.current.set(artist.key, times + 1);
      return toSlot(artist, times);
    }
    function compose() {
      const ready = [];
      states.current.forEach((state, index) => {
        const artist = artists.current[index];
        if (state === "ready" && artist && ready.length < VISIBLE_ARTISTS) ready.push(enter(artist));
      });
      return ready;
    }
    useEffect(() => {
      const gen = ++generation.current;
      const list = candidates;
      states.current = list.map(() => "idle");
      artists.current = list.map(() => null);
      lastShown.current = /* @__PURE__ */ new Map();
      entries.current = /* @__PURE__ */ new Map();
      tickCount.current = 0;
      cursor.current = 0;
      extraBusy.current = false;
      if (!list.length) {
        publish([]);
        return () => {
          generation.current += 1;
        };
      }
      const hadDisplay = slotsRef.current.length > 0;
      let next = 0;
      let readyCount = 0;
      let committed = false;
      const commit = () => {
        if (gen !== generation.current || committed) return;
        committed = true;
        const composition = compose();
        publish(composition);
        composition.forEach((slot) => lastShown.current.set(slot.key, 0));
        prefetchExtra(gen, list);
      };
      const worker = async () => {
        while (gen === generation.current && readyCount < VISIBLE_ARTISTS) {
          const index = next++;
          if (index >= list.length) return;
          if (await loadIndex(gen, list, index)) readyCount += 1;
        }
      };
      const forceTimer = window.setTimeout(() => {
        if (readyCount > 0) commit();
      }, hadDisplay ? SETTLE_TIMEOUT_REPLACE_MS : SETTLE_TIMEOUT_FIRST_MS + FIRST_START_DELAY_MS);
      const startTimer = window.setTimeout(() => {
        if (gen !== generation.current) return;
        void Promise.all(Array.from({ length: Math.min(PARALLEL_RESOLVERS, list.length) }, worker)).then(commit);
      }, hadDisplay ? 0 : FIRST_START_DELAY_MS);
      return () => {
        generation.current += 1;
        window.clearTimeout(forceTimer);
        window.clearTimeout(startTimer);
      };
    }, [candidatesKey]);
    tickRef.current = () => {
      const current = slotsRef.current;
      if (!current.length || document.visibilityState === "hidden") return;
      const gen = generation.current;
      tickCount.current += 1;
      const now = tickCount.current;
      const shown = new Set(current.map((slot) => slot.key));
      const reserve = [];
      states.current.forEach((state, index) => {
        const artist = artists.current[index];
        if (state === "ready" && artist && !shown.has(artist.key)) reserve.push(artist);
      });
      reserve.sort((a, b) => (lastShown.current.get(a.key) ?? -1) - (lastShown.current.get(b.key) ?? -1));
      const next = current.slice();
      const length = current.length;
      const start = cursor.current % length;
      const updates = Math.min(2, length);
      const used = /* @__PURE__ */ new Set();
      let reserveIndex = 0;
      for (let k = 0; k < updates; k += 1) {
        const position = (start + k * Math.ceil(length / 2)) % length;
        if (used.has(position)) continue;
        used.add(position);
        const slot = next[position];
        if (reserveIndex < reserve.length) {
          const incoming = reserve[reserveIndex++];
          lastShown.current.set(slot.key, now);
          lastShown.current.set(incoming.key, now);
          next[position] = enter(incoming);
        } else if (slot.visuals.length > 1) {
          next[position] = toSlot({ key: slot.key, visuals: slot.visuals }, slot.index + 1);
        } else if (length > 1) {
          const other = (position + 1) % length;
          [next[position], next[other]] = [next[other], next[position]];
        }
      }
      cursor.current = (start + 1) % length;
      publish(next);
      prefetchExtra(gen, candidates);
    };
    useEffect(() => {
      let timer;
      const stop = () => {
        if (timer !== void 0) window.clearInterval(timer);
        timer = void 0;
      };
      const start = () => {
        stop();
        if (document.visibilityState === "visible") timer = window.setInterval(() => tickRef.current(), rotationInterval);
      };
      start();
      document.addEventListener("visibilitychange", start);
      return () => {
        stop();
        document.removeEventListener("visibilitychange", start);
      };
    }, [rotationInterval]);
    if (!slots.length) return null;
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-dynamic-bg", "aria-hidden": "true", "data-count": slots.length }, slots.map((slot, index) => /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        key: index,
        className: "otd-bg-slot",
        "data-artist": slot.key,
        "data-kind": slot.kind,
        style: getRect(index, slots.length)
      },
      /* @__PURE__ */ Spicetify.React.createElement(SlotImage, { url: slot.url, kind: slot.kind })
    )), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-bg-overlay" }));
  }

  // src/app/OnThisDay.tsx
  var INITIAL_ALBUMS_PER_YEAR = 5;
  var ALBUMS_PER_EXPANSION = 5;
  var MAX_SELECTED_GENRES = 5;
  var FOLLOW_FILTER_KEY = "on-this-day:only-followed-artists";
  var YEAR_ORDER_KEY = "on-this-day:year-order";
  function readOnlyFollowed() {
    try {
      const saved = localStorage.getItem(FOLLOW_FILTER_KEY);
      if (saved === null) {
        localStorage.setItem(FOLLOW_FILTER_KEY, "true");
        return true;
      }
      return saved === "true";
    } catch {
      return true;
    }
  }
  function readYearOrder() {
    try {
      return localStorage.getItem(YEAR_ORDER_KEY) === "asc" ? "asc" : "desc";
    } catch {
      return "desc";
    }
  }
  function getTodayKey(date = /* @__PURE__ */ new Date()) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${month}-${day}`;
  }
  function getAnniversaryYear(date) {
    const match = /^(\d{4})-\d{2}-\d{2}$/.exec(date);
    return match ? Number(match[1]) : null;
  }
  var AnniversarySection = memo(function AnniversarySection2({ year, items, currentYear, lang, sectionRef, onPreview }) {
    const [visibleCount, setVisibleCount] = useState(INITIAL_ALBUMS_PER_YEAR);
    const visibleItems = items.slice(0, visibleCount);
    const anniversaryAge = currentYear - year;
    const isOne = anniversaryAge === 1;
    return /* @__PURE__ */ Spicetify.React.createElement("section", { className: "otd-year-section", ref: sectionRef, "aria-label": t(lang, isOne ? "yearAgo" : "yearsAgo", { age: anniversaryAge, year }) }, /* @__PURE__ */ Spicetify.React.createElement("header", { className: "otd-year-heading" }, /* @__PURE__ */ Spicetify.React.createElement("div", null, /* @__PURE__ */ Spicetify.React.createElement("h2", null, t(lang, isOne ? "yearAgo" : "yearsAgo", { age: anniversaryAge, year }), " ", /* @__PURE__ */ Spicetify.React.createElement("span", null, "· ", year)), /* @__PURE__ */ Spicetify.React.createElement("p", null, t(lang, "albumsCount", { count: items.length.toLocaleString(lang) })))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-album-grid" }, visibleItems.map((item) => /* @__PURE__ */ Spicetify.React.createElement(AlbumCard, { key: item.mbid, item, lang, onPreview }))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-year-actions" }, visibleCount < items.length && /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "otd-year-more",
        onClick: () => setVisibleCount((count) => Math.min(count + ALBUMS_PER_EXPANSION, items.length))
      },
      t(lang, "moreAlbums")
    ), visibleCount > INITIAL_ALBUMS_PER_YEAR && /* @__PURE__ */ Spicetify.React.createElement("button", { className: "otd-year-less", onClick: () => setVisibleCount(INITIAL_ALBUMS_PER_YEAR) }, t(lang, "lessAlbums"))));
  });
  function OnThisDay() {
    const [lang, setLangState] = useState(getLang);
    const [items, setItems] = useState([]);
    const [state, setState] = useState("loading");
    const [error, setError] = useState("");
    const [today, setToday] = useState(() => /* @__PURE__ */ new Date());
    const [onlyFollowed, setOnlyFollowed] = useState(readOnlyFollowed);
    const initialFollowed = useMemo(() => readOnlyFollowed() ? peekFollowedArtists() : null, []);
    const [followStatus, setFollowStatus] = useState(initialFollowed ? "ready" : "idle");
    const [followedSet, setFollowedSet] = useState(() => initialFollowed ? new Set(initialFollowed.map(normalizeArtistName)) : null);
    const [followedCount, setFollowedCount] = useState(initialFollowed?.length ?? 0);
    const [yearOrder, setYearOrder] = useState(readYearOrder);
    const [activeYear, setActiveYear] = useState(null);
    const followRequest = useRef(0);
    const previewCloseRef = useRef(null);
    const [selectedGenres, setSelectedGenres] = useState(() => {
      try {
        const raw = localStorage.getItem("on-this-day:selected-genres");
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((g) => typeof g === "string").slice(0, MAX_SELECTED_GENRES);
      } catch {
        return [];
      }
    });
    const [genrePickerOpen, setGenrePickerOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [preview, setPreview] = useState(null);
    const [navHover, setNavHover] = useState(false);
    const [tooltip, setTooltip] = useState(null);
    const tooltipTimer = useRef(null);
    const navHideTimer = useRef(null);
    const navRef = useRef(null);
    const yearSectionRefs = useRef(/* @__PURE__ */ new Map());
    const sectionRefCallbacks = useRef(/* @__PURE__ */ new Map());
    const getSectionRef = (year) => {
      let callback = sectionRefCallbacks.current.get(year);
      if (!callback) {
        callback = (el) => {
          if (el) yearSectionRefs.current.set(year, el);
          else yearSectionRefs.current.delete(year);
        };
        sectionRefCallbacks.current.set(year, callback);
      }
      return callback;
    };
    const monthDay = getTodayKey(today);
    const currentYear = today.getFullYear();
    const dateLabel = new Intl.DateTimeFormat(lang, {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(today);
    useEffect(() => {
      const nextMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      const timeout = window.setTimeout(
        () => {
          setItems([]);
          setError("");
          setState("loading");
          setToday(/* @__PURE__ */ new Date());
        },
        Math.max(0, nextMidnight.getTime() - Date.now())
      );
      return () => window.clearTimeout(timeout);
    }, [today]);
    useEffect(() => {
      let cancelled = false;
      loadDailyCatalog(monthDay).then((catalog) => {
        if (!cancelled) {
          setItems(catalog.items);
          setState("ready");
        }
      }).catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
          setState("error");
        }
      });
      return () => {
        cancelled = true;
      };
    }, [monthDay]);
    const openPreview = useCallback((item, cover) => setPreview({ item, cover }), []);
    function ensureFollowed(force = false) {
      const id = ++followRequest.current;
      setFollowStatus((current) => current === "ready" ? current : "loading");
      loadFollowedArtists(force).then((result) => {
        if (id !== followRequest.current) return;
        setFollowedSet(new Set(result.names.map(normalizeArtistName)));
        setFollowedCount(result.names.length);
        setFollowStatus("ready");
      }).catch(() => {
        if (id === followRequest.current) setFollowStatus("error");
      });
    }
    useEffect(() => {
      if (onlyFollowed) ensureFollowed();
      return () => {
        followRequest.current += 1;
      };
    }, []);
    function persistFollowFilter(enabled) {
      try {
        localStorage.setItem(FOLLOW_FILTER_KEY, String(enabled));
      } catch {
      }
    }
    function handleFollowFab() {
      if (onlyFollowed && followStatus === "error") {
        ensureFollowed(true);
        return;
      }
      const next = !onlyFollowed;
      setOnlyFollowed(next);
      persistFollowFilter(next);
      if (next && followStatus !== "ready") ensureFollowed();
    }
    function toggleYearOrder() {
      setYearOrder((current) => {
        const next = current === "desc" ? "asc" : "desc";
        try {
          localStorage.setItem(YEAR_ORDER_KEY, next);
        } catch {
        }
        return next;
      });
    }
    const fabState = !onlyFollowed ? "off" : followStatus === "error" ? "error" : followStatus === "ready" ? "on" : "loading";
    const anniversaryItems = useMemo(() => {
      return items.filter((item) => {
        const year = getAnniversaryYear(item.firstReleaseDate);
        return year !== null && year < currentYear && item.firstReleaseDate.slice(5) === monthDay;
      }).sort(
        (a, b) => Number(b.firstReleaseDate.slice(0, 4)) - Number(a.firstReleaseDate.slice(0, 4)) || (b.ratingVotes ?? 0) - (a.ratingVotes ?? 0) || (b.ratingValue ?? 0) - (a.ratingValue ?? 0) || a.title.localeCompare(b.title)
      );
    }, [items, monthDay, currentYear]);
    const displayedItems = useMemo(() => {
      if (!onlyFollowed) return anniversaryItems;
      if (followStatus === "error") return anniversaryItems;
      if (followStatus !== "ready" || !followedSet) return [];
      return anniversaryItems.filter(
        (item) => artistIsFollowed(followedSet, item.artistNames?.length ? item.artistNames : [item.artistName])
      );
    }, [anniversaryItems, onlyFollowed, followStatus, followedSet]);
    const genreFilteredItems = useMemo(() => {
      if (!selectedGenres.length) return displayedItems;
      const selected = new Set(selectedGenres);
      return displayedItems.filter(
        (item) => classifyMainGenres(item.genres).some((genre) => selected.has(genre))
      );
    }, [displayedItems, selectedGenres]);
    const anniversaryGroups = useMemo(() => {
      const groups = /* @__PURE__ */ new Map();
      for (const item of genreFilteredItems) {
        const year = getAnniversaryYear(item.firstReleaseDate);
        if (year === null) continue;
        const group = groups.get(year) ?? [];
        group.push(item);
        groups.set(year, group);
      }
      return groups;
    }, [genreFilteredItems]);
    const genreCounts = useMemo(() => {
      const counts = /* @__PURE__ */ new Map();
      for (const genreId of selectedGenres) {
        const count = displayedItems.filter(
          (item) => classifyMainGenres(item.genres).includes(genreId)
        ).length;
        counts.set(genreId, count);
      }
      return counts;
    }, [displayedItems, selectedGenres]);
    const selectedGenreLabels = useMemo(() => {
      return selectedGenres.map((id) => {
        const g = MAIN_GENRES.find((x) => x.id === id);
        return g ? g.label : id;
      });
    }, [selectedGenres]);
    const backgroundCandidates = useMemo(
      () => selectBackgroundCandidates(genreFilteredItems),
      [genreFilteredItems]
    );
    useEffect(() => {
      try {
        localStorage.setItem("on-this-day:selected-genres", JSON.stringify(selectedGenres));
      } catch {
      }
    }, [selectedGenres]);
    useEffect(() => {
      return () => {
        if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
        if (navHideTimer.current) clearTimeout(navHideTimer.current);
      };
    }, []);
    useEffect(() => {
      if (!preview) return;
      previewCloseRef.current?.focus({ preventScroll: true });
      const closeOnEscape = (event) => {
        if (event.key === "Escape") setPreview(null);
      };
      document.addEventListener("keydown", closeOnEscape);
      return () => document.removeEventListener("keydown", closeOnEscape);
    }, [preview]);
    const orderedGroups = useMemo(() => {
      const entries = [...anniversaryGroups.entries()];
      entries.sort((a, b) => yearOrder === "desc" ? b[0] - a[0] : a[0] - b[0]);
      return entries;
    }, [anniversaryGroups, yearOrder]);
    const availableYears = useMemo(() => orderedGroups.map(([year]) => year), [orderedGroups]);
    useEffect(() => {
      if (!availableYears.length) return;
      let frame = 0;
      const update = (event) => {
        frame = 0;
        const threshold = window.innerHeight * 0.3;
        let current = availableYears[0];
        for (const year of availableYears) {
          const el = yearSectionRefs.current.get(year);
          if (el && el.getBoundingClientRect().top <= threshold) current = year;
        }
        const target = event?.target;
        if (target && typeof target.scrollTop === "number" && target.scrollTop > 0 && target.scrollTop + target.clientHeight >= target.scrollHeight - 4) {
          current = availableYears[availableYears.length - 1];
        }
        setActiveYear(current);
      };
      const onScroll = (event) => {
        if (!frame) frame = window.requestAnimationFrame(() => update(event));
      };
      update();
      window.addEventListener("scroll", onScroll, { capture: true, passive: true });
      return () => {
        window.removeEventListener("scroll", onScroll, { capture: true });
        if (frame) window.cancelAnimationFrame(frame);
      };
    }, [availableYears.join(",")]);
    function scrollToYear(year) {
      const el = yearSectionRefs.current.get(year);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    function clearNavHideTimer() {
      if (navHideTimer.current) {
        clearTimeout(navHideTimer.current);
        navHideTimer.current = null;
      }
    }
    function scheduleNavHide() {
      clearNavHideTimer();
      navHideTimer.current = window.setTimeout(() => {
        setNavHover(false);
      }, 180);
    }
    function handlePageMouseMove(event) {
      const nearActivationZone = event.clientX <= 34;
      const navRect = navRef.current?.getBoundingClientRect();
      const insideNav = !!navRect && event.clientX >= navRect.left && event.clientX <= navRect.right && event.clientY >= navRect.top && event.clientY <= navRect.bottom;
      if (nearActivationZone || insideNav) {
        clearNavHideTimer();
        setNavHover(true);
        return;
      }
      if (navHover) {
        scheduleNavHide();
      }
    }
    function showYearTooltip(event, age) {
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
      const target = event.currentTarget;
      tooltipTimer.current = window.setTimeout(() => {
        const rect = target.getBoundingClientRect();
        const tooltipWidth = 150;
        const tooltipPadding = 12;
        const preferredLeft = rect.right + 12;
        const shouldPlaceLeft = preferredLeft + tooltipWidth > window.innerWidth - tooltipPadding;
        const left = shouldPlaceLeft ? Math.max(tooltipPadding, rect.left - tooltipWidth - 12) : preferredLeft;
        const top = Math.min(Math.max(rect.top + rect.height / 2, tooltipPadding), window.innerHeight - tooltipPadding);
        setTooltip({
          text: t(lang, age === 1 ? "yearTooltip" : "yearsTooltip", { age }),
          top,
          left
        });
      }, 800);
    }
    const yearNavigation = /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        ref: navRef,
        className: `otd-year-nav${navHover ? " is-visible" : ""}`,
        onMouseEnter: () => {
          clearNavHideTimer();
          setNavHover(true);
        },
        onMouseLeave: () => {
          setTooltip(null);
          if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
          scheduleNavHide();
        }
      },
      /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-year-nav-inner" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-year-nav-head" }, t(lang, "navYears")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-year-nav-list" }, availableYears.map((year) => {
        const age = currentYear - year;
        return /* @__PURE__ */ Spicetify.React.createElement(
          "button",
          {
            key: year,
            className: `otd-year-nav-item${activeYear === year ? " is-active" : ""}`,
            "aria-current": activeYear === year ? "true" : void 0,
            onClick: () => {
              setActiveYear(year);
              scrollToYear(year);
            },
            onMouseEnter: (event) => {
              showYearTooltip(event, age);
            },
            onMouseLeave: () => {
              if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
              setTooltip(null);
            }
          },
          /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-year-nav-year" }, year),
          /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-year-nav-age" }, t(lang, age === 1 ? "yearShort" : "yearsShort", { age }))
        );
      })))
    ), tooltip && /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        className: "otd-year-nav-tooltip-fixed",
        style: { top: tooltip.top, left: tooltip.left }
      },
      tooltip.text
    ));
    if (state === "loading") {
      return /* @__PURE__ */ Spicetify.React.createElement("main", { className: "otd-page", onMouseMove: handlePageMouseMove, onMouseLeave: () => {
        setTooltip(null);
        if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
        scheduleNavHide();
      } }, /* @__PURE__ */ Spicetify.React.createElement("section", { className: "otd-shell" }, /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-eyebrow" }, t(lang, "eyebrow")), /* @__PURE__ */ Spicetify.React.createElement("h1", null, t(lang, "title")), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-message" }, t(lang, "loading", { date: dateLabel }))));
    }
    if (state === "error") {
      return /* @__PURE__ */ Spicetify.React.createElement("main", { className: "otd-page", onMouseMove: handlePageMouseMove, onMouseLeave: () => {
        setTooltip(null);
        if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
        scheduleNavHide();
      } }, /* @__PURE__ */ Spicetify.React.createElement("section", { className: "otd-shell" }, /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-eyebrow" }, t(lang, "eyebrow")), /* @__PURE__ */ Spicetify.React.createElement("h1", null, t(lang, "errorTitle")), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-message" }, t(lang, "errorMsg", { date: dateLabel })), /* @__PURE__ */ Spicetify.React.createElement("pre", { className: "otd-error" }, error), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-hint" }, t(lang, "errorHint"))));
    }
    return /* @__PURE__ */ Spicetify.React.createElement("main", { className: "otd-page", onMouseMove: handlePageMouseMove, onMouseLeave: () => {
      setTooltip(null);
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
      scheduleNavHide();
    } }, /* @__PURE__ */ Spicetify.React.createElement(DynamicBackground, { candidates: backgroundCandidates }), /* @__PURE__ */ Spicetify.React.createElement(FollowFab, { state: fabState, count: followedCount, lang, onToggle: handleFollowFab }), createPortal(yearNavigation, document.body), /* @__PURE__ */ Spicetify.React.createElement("section", { className: "otd-shell", onMouseMove: handlePageMouseMove, onMouseLeave: () => {
      setTooltip(null);
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
      scheduleNavHide();
    } }, /* @__PURE__ */ Spicetify.React.createElement("header", { className: "otd-heading" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-heading-left" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-app-icon", "aria-hidden": "true" }, /* @__PURE__ */ Spicetify.React.createElement(AppIcon, { size: 26 })), /* @__PURE__ */ Spicetify.React.createElement("div", null, /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-eyebrow" }, t(lang, "eyebrow")), /* @__PURE__ */ Spicetify.React.createElement("h1", null, t(lang, "title")), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-subtitle" }, t(lang, "subtitle", { date: dateLabel })))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-count-group" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-count" }, t(lang, "albumsThisDay", { count: genreFilteredItems.length.toLocaleString(lang) })), selectedGenres.length > 0 && /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-count-filter" }, selectedGenres.map((g) => {
      const genre = MAIN_GENRES.find((x) => x.id === g);
      const count = genreCounts.get(g) ?? 0;
      return `${count.toLocaleString(lang)} ${genre?.label ?? g}`;
    }).join(" · ")), /* @__PURE__ */ Spicetify.React.createElement(UpdateBadge, { lang }), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-settings" }, /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: `otd-settings-trigger${settingsOpen ? " is-open" : ""}`,
        "aria-expanded": settingsOpen,
        "aria-haspopup": "listbox",
        "aria-label": t(lang, "changeLanguage"),
        title: t(lang, "changeLanguage"),
        onClick: () => setSettingsOpen((open) => !open)
      },
      /* @__PURE__ */ Spicetify.React.createElement(GlobeIcon, { size: 16 }),
      /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-settings-code" }, lang.toUpperCase()),
      /* @__PURE__ */ Spicetify.React.createElement(ChevronIcon, { size: 13 })
    ), settingsOpen && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-settings-menu", role: "listbox" }, /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-settings-title" }, t(lang, "changeLanguage")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-settings-options" }, Object.entries(LANGUAGES).map(([code, info]) => {
      const active = code === lang;
      return /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          key: code,
          role: "option",
          "aria-selected": active,
          className: `otd-settings-option${active ? " is-active" : ""}`,
          onClick: () => {
            setLang(code);
            setLangState(code);
            setSettingsOpen(false);
          }
        },
        /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-settings-badge" }, code.toUpperCase()),
        /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-settings-name" }, info.native),
        active && /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-settings-check" }, /* @__PURE__ */ Spicetify.React.createElement(CheckIcon, { size: 14 }))
      );
    })))))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-genre-filter" }, /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        type: "button",
        className: "otd-genre-trigger",
        "aria-expanded": genrePickerOpen,
        "aria-controls": "otd-genre-options",
        onClick: () => setGenrePickerOpen((open) => !open)
      },
      t(lang, "genreFilter"),
      " ",
      /* @__PURE__ */ Spicetify.React.createElement("span", null, selectedGenres.length, "/", MAX_SELECTED_GENRES)
    ), selectedGenres.length > 0 && /* @__PURE__ */ Spicetify.React.createElement("button", { className: "otd-genre-clear", onClick: () => setSelectedGenres([]) }, t(lang, "clearFilters")), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        type: "button",
        className: "otd-order-btn",
        onClick: toggleYearOrder,
        title: t(lang, "orderTitle"),
        "aria-label": t(lang, "orderTitle")
      },
      /* @__PURE__ */ Spicetify.React.createElement("span", { "aria-hidden": "true" }, yearOrder === "desc" ? "↓" : "↑"),
      " ",
      t(lang, yearOrder === "desc" ? "orderNewest" : "orderOldest")
    ), genrePickerOpen && /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-backdrop", onClick: () => setGenrePickerOpen(false) }), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-genre-menu", id: "otd-genre-options", role: "group", "aria-label": t(lang, "genreFilter") }, /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "otd-genre-close",
        "aria-label": t(lang, "close"),
        onClick: () => setGenrePickerOpen(false)
      },
      "×"
    ), /* @__PURE__ */ Spicetify.React.createElement("p", null, t(lang, "chooseGenres")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-genre-grid" }, MAIN_GENRES.map((genre) => {
      const checked = selectedGenres.includes(genre.id);
      const disabled = !checked && selectedGenres.length >= MAX_SELECTED_GENRES;
      return /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          type: "button",
          key: genre.id,
          className: `otd-genre-chip${checked ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`,
          disabled,
          onClick: () => {
            setSelectedGenres((current) => {
              if (checked) return current.filter((id) => id !== genre.id);
              if (current.length < MAX_SELECTED_GENRES) return [...current, genre.id];
              return current;
            });
          }
        },
        /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-genre-chip-check" }, checked ? "✓" : ""),
        /* @__PURE__ */ Spicetify.React.createElement("span", null, genre.label)
      );
    })), selectedGenres.length === MAX_SELECTED_GENRES && /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-genre-limit" }, t(lang, "limitReached"))))), onlyFollowed && followStatus === "loading" ? /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-empty" }, t(lang, "loadingFollowed")) : anniversaryGroups.size ? orderedGroups.map(([year, yearItems]) => /* @__PURE__ */ Spicetify.React.createElement(
      AnniversarySection,
      {
        key: year,
        year,
        items: yearItems,
        currentYear,
        lang,
        onPreview: openPreview,
        sectionRef: getSectionRef(year)
      }
    )) : /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-empty" }, selectedGenres.length > 0 ? !items.some((item) => item.genres?.length) ? t(lang, "emptyGenresMsg") : t(lang, "emptyNoMatch") : onlyFollowed && followStatus === "ready" ? t(lang, "followedEmpty") : t(lang, "emptyNone")), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-attribution" }, t(lang, "attribution"))), preview && createPortal(
      /* @__PURE__ */ Spicetify.React.createElement(
        "div",
        {
          className: "otd-cover-preview-backdrop",
          role: "presentation",
          onClick: () => setPreview(null)
        },
        /* @__PURE__ */ Spicetify.React.createElement(
          "section",
          {
            className: "otd-cover-preview",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": t(lang, "coverPreviewTitle", { title: preview.item.title }),
            onClick: (event) => event.stopPropagation()
          },
          /* @__PURE__ */ Spicetify.React.createElement(
            "button",
            {
              className: "otd-cover-preview-close",
              type: "button",
              onClick: () => setPreview(null),
              "aria-label": t(lang, "close"),
              ref: previewCloseRef
            },
            "×"
          ),
          /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-cover-preview-image" }, preview.cover ? /* @__PURE__ */ Spicetify.React.createElement(
            "img",
            {
              src: preview.cover.replace("/front-250", "/front-500"),
              alt: t(lang, "coverAlt", { title: preview.item.title }),
              onError: () => setPreview((current) => current ? { ...current, cover: null } : null)
            }
          ) : /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-cover-placeholder", "aria-hidden": "true" }, "♫")),
          /* @__PURE__ */ Spicetify.React.createElement("h2", null, preview.item.title),
          /* @__PURE__ */ Spicetify.React.createElement("p", null, preview.item.artistName, " · ", preview.item.firstReleaseDate.slice(0, 4))
        )
      ),
      document.body
    ));
  }

  // src/app/App.tsx
  function App() {
    return React.createElement(OnThisDay);
  }

  // src/index.tsx
  var react = Spicetify.React;
  function render() {
    return react.createElement(App);
  }
  globalThis.render = render;
})();
