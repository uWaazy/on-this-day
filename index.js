/* On This Day v1.1.14 — https://github.com/uWaazy/on-this-day
 * Bundle legível (sem minificação), gerado a partir do código-fonte do projeto.
 * Roda dentro do Spotify via Spicetify; consulta só: Spotify (sessão local), MusicBrainz/Cover Art Archive (catálogo),
 * GitHub (verificação de nova versão). Sem coleta de dados e sem credenciais. */
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
  var KEEP_BEHIND = 1;
  var KEEP_AHEAD = 1;
  var EXPECTED_SCHEMA_VERSION = 2;
  var CACHE_VERSION_KEY = "on-this-day:cache-version";
  var CACHE_VERSION = "3";
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
    d.setDate(d.getDate() + offsetDays);
    return monthDayFor(d);
  }
  function previousMonthDay(monthDay) {
    const [month, day] = monthDay.split("-").map(Number);
    return monthDayFor(new Date(2024, month - 1, day - 1));
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
  function writeCache(monthDay, value) {
    const key = cacheKey(monthDay);
    const payload = JSON.stringify({ ...value, cachedAt: Date.now() });
    try {
      localStorage.setItem(key, payload);
      return;
    } catch {
    }
    try {
      for (let i = 0; i < localStorage.length; ) {
        const other = localStorage.key(i);
        if (other && other.startsWith(CACHE_PREFIX) && other !== key) localStorage.removeItem(other);
        else i++;
      }
      localStorage.setItem(key, payload);
    } catch {
    }
  }
  function isValidCatalog(value, monthDay) {
    return typeof value === "object" && value !== null && "schemaVersion" in value && value.schemaVersion === EXPECTED_SCHEMA_VERSION && "monthDay" in value && value.monthDay === monthDay && "items" in value && Array.isArray(value.items);
  }
  function pruneCache(viewedMonthDay) {
    try {
      const keep = /* @__PURE__ */ new Set([viewedMonthDay]);
      for (let i = -KEEP_BEHIND; i <= KEEP_AHEAD; i++) {
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
  var inflight = /* @__PURE__ */ new Map();
  function fetchDay(monthDay) {
    const existing = inflight.get(monthDay);
    if (existing) return existing;
    const pending = (async () => {
      let response;
      try {
        response = await fetch(`${"https://uwaazy.github.io/on-this-day/catalog"}/${monthDay}.json`, {
          method: "GET",
          cache: "no-cache"
        });
      } catch (error) {
        throw new Error(`Sem conexão com o servidor do catálogo (${error instanceof Error ? error.message : String(error)}).`);
      }
      if (!response.ok) {
        throw new Error(`Catálogo indisponível (${response.status}).`);
      }
      let value;
      try {
        value = await response.json();
      } catch {
        throw new Error("O catálogo publicado tem um formato inválido.");
      }
      if (!isValidCatalog(value, monthDay)) {
        throw new Error("O catálogo publicado tem um formato inválido.");
      }
      return value;
    })().finally(() => inflight.delete(monthDay));
    inflight.set(monthDay, pending);
    return pending;
  }
  async function prefetchNearbyDays(viewedMonthDay) {
    const wanted = /* @__PURE__ */ new Set([previousMonthDay(viewedMonthDay)]);
    for (let i = -KEEP_BEHIND; i <= KEEP_AHEAD; i++) wanted.add(offsetMonthDay(i));
    wanted.delete(viewedMonthDay);
    await Promise.all(
      [...wanted].map(async (monthDay) => {
        try {
          if (readCache(cacheKey(monthDay))) return;
          writeCache(monthDay, await fetchDay(monthDay));
        } catch {
        }
      })
    );
  }
  async function loadDailyCatalog(monthDay) {
    const cached = readCache(cacheKey(monthDay));
    if (cached) {
      pruneCache(monthDay);
      void prefetchNearbyDays(monthDay);
      if (!cached.cachedAt || Date.now() - cached.cachedAt > REVALIDATE_AFTER_MS) {
        void fetchDay(monthDay).then((fresh2) => writeCache(monthDay, fresh2)).catch(() => {
        });
      }
      return cached;
    }
    const catalog = await fetchDay(monthDay);
    pruneCache(monthDay);
    writeCache(monthDay, catalog);
    void prefetchNearbyDays(monthDay);
    return catalog;
  }

  // src/api/birthdays.ts
  var BirthdaysUnavailableError = class extends Error {
    constructor(status) {
      super(`Aniversários indisponíveis (${status}).`);
      this.name = "BirthdaysUnavailableError";
      this.status = status;
    }
  };
  var CACHE_PREFIX2 = "on-this-day:birthdays:v1:";
  var EXPECTED_SCHEMA_VERSION2 = 1;
  var REVALIDATE_AFTER_MS2 = 7 * 24 * 60 * 60 * 1e3;
  var KEEP_BEHIND2 = 1;
  var KEEP_AHEAD2 = 1;
  var MISSING_RETRY_MS = 5 * 60 * 1e3;
  var missingUntil = /* @__PURE__ */ new Map();
  var inflight2 = /* @__PURE__ */ new Map();
  function monthDayFor2(date) {
    return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function offsetMonthDay2(offsetDays) {
    const d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() + offsetDays);
    return monthDayFor2(d);
  }
  function cacheKey2(monthDay) {
    return `${CACHE_PREFIX2}${monthDay}`;
  }
  function isValidBirthdays(value, monthDay) {
    return typeof value === "object" && value !== null && "schemaVersion" in value && value.schemaVersion === EXPECTED_SCHEMA_VERSION2 && "monthDay" in value && value.monthDay === monthDay && "items" in value && Array.isArray(value.items);
  }
  function readCache2(monthDay) {
    try {
      const raw = localStorage.getItem(cacheKey2(monthDay));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return isValidBirthdays(parsed, monthDay) ? parsed : null;
    } catch {
      return null;
    }
  }
  function removeBirthdayKeys(except) {
    try {
      for (let i = 0; i < localStorage.length; ) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX2) && !except(key.slice(CACHE_PREFIX2.length))) localStorage.removeItem(key);
        else i += 1;
      }
    } catch {
    }
  }
  function writeCache2(monthDay, value) {
    const payload = JSON.stringify({ ...value, cachedAt: Date.now() });
    try {
      localStorage.setItem(cacheKey2(monthDay), payload);
      return;
    } catch {
    }
    removeBirthdayKeys((day) => day === monthDay);
    try {
      localStorage.setItem(cacheKey2(monthDay), payload);
    } catch {
    }
  }
  function pruneCache2(viewedMonthDay) {
    const keep = /* @__PURE__ */ new Set([viewedMonthDay]);
    for (let i = -KEEP_BEHIND2; i <= KEEP_AHEAD2; i += 1) keep.add(offsetMonthDay2(i));
    removeBirthdayKeys((day) => keep.has(day));
  }
  function fetchDay2(monthDay) {
    const existing = inflight2.get(monthDay);
    if (existing) return existing;
    const pending = (async () => {
      const retryAt = missingUntil.get(monthDay);
      if (retryAt && Date.now() < retryAt) throw new BirthdaysUnavailableError(404);
      let response;
      try {
        response = await fetch(`${"https://uwaazy.github.io/on-this-day/catalog"}/birthdays/${monthDay}.json`, { method: "GET", cache: "no-cache" });
      } catch (error) {
        throw new Error(`Sem conexão com o servidor do catálogo (${error instanceof Error ? error.message : String(error)}).`);
      }
      if (response.status === 404) {
        missingUntil.set(monthDay, Date.now() + MISSING_RETRY_MS);
        throw new BirthdaysUnavailableError(404);
      }
      if (!response.ok) throw new Error(`Aniversários indisponíveis (${response.status}).`);
      let value;
      try {
        value = await response.json();
      } catch {
        throw new Error("Os aniversários publicados têm um formato inválido.");
      }
      if (!isValidBirthdays(value, monthDay)) throw new Error("Os aniversários publicados têm um formato inválido.");
      missingUntil.delete(monthDay);
      return value;
    })().finally(() => inflight2.delete(monthDay));
    inflight2.set(monthDay, pending);
    return pending;
  }
  function prefetchNeighbours(viewedMonthDay) {
    for (const offset of [-KEEP_BEHIND2, KEEP_AHEAD2]) {
      const monthDay = offsetMonthDay2(offset);
      if (monthDay === viewedMonthDay || readCache2(monthDay)) continue;
      void fetchDay2(monthDay).then((value) => writeCache2(monthDay, value)).catch(() => {
      });
    }
  }
  async function loadBirthdays(monthDay, force = false) {
    if (force) missingUntil.delete(monthDay);
    const cached = readCache2(monthDay);
    if (cached) {
      pruneCache2(monthDay);
      prefetchNeighbours(monthDay);
      if (!cached.cachedAt || Date.now() - cached.cachedAt > REVALIDATE_AFTER_MS2) {
        void fetchDay2(monthDay).then((fresh2) => writeCache2(monthDay, fresh2)).catch(() => {
        });
      }
      return cached;
    }
    const catalog = await fetchDay2(monthDay);
    pruneCache2(monthDay);
    writeCache2(monthDay, catalog);
    prefetchNeighbours(monthDay);
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

  // src/api/artist-images.ts
  var STORAGE_KEY = "on-this-day:artist-photos:v3";
  var LEGACY_KEYS = ["on-this-day:artist-images", "on-this-day:artist-photos:v2"];
  var HIT_TTL = 14 * 24 * 60 * 60 * 1e3;
  var MISS_TTL = 12 * 60 * 60 * 1e3;
  var MAX_ENTRIES = 300;
  var store = null;
  var persistTimer;
  var inflight3 = /* @__PURE__ */ new Map();
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
      const current2 = loadStore();
      const keys = Object.keys(current2);
      if (keys.length > MAX_ENTRIES) {
        keys.sort((a, b) => current2[a].at - current2[b].at);
        for (const key of keys.slice(0, keys.length - MAX_ENTRIES)) delete current2[key];
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current2));
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
    if (!candidate.album) return null;
    const candidateAlbum = candidate.album;
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
    const album = await findSpotifyAlbum(candidateAlbum);
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
    const existing = inflight3.get(candidate.key);
    if (existing) return existing;
    const pending = resolve(candidate).finally(() => inflight3.delete(candidate.key));
    inflight3.set(candidate.key, pending);
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
  var ITUNES_PREFIX = "on-this-day:itunes-cover:v2:";
  var ITUNES_TTL = 30 * 24 * 60 * 60 * 1e3;
  var ITUNES_MISS_TTL = 24 * 60 * 60 * 1e3;
  var limitItunes = createLimiter(5);
  var limitDeezer = createLimiter(4);
  var memory = /* @__PURE__ */ new Map();
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
  function cleanQueryTitle(title) {
    return title.replace(/[([][^)\]]*[)\]]/g, " ").replace(/\s[-–—:]\s.*\b(deluxe|remaster(ed)?|edition|version|expanded|anniversary|bonus|mono|stereo|explicit|disc|disk|cd|vol(ume)?|pt|part)\b.*$/i, " ").replace(/\b(disc|disk|cd)\s*\d+\b/gi, " ").replace(/\s+/g, " ").trim();
  }
  async function searchItunesTerm(query, term) {
    const params = new URLSearchParams({
      term,
      media: "music",
      entity: "album",
      limit: "8"
    });
    const response = await limitItunes(() => withTimeout(fetch(`https://itunes.apple.com/search?${params}`), 6e3));
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
    return best;
  }
  async function itunesCover(query) {
    const cached = readItunes(query.mbid);
    if (cached) return cached.url;
    const cleaned = cleanQueryTitle(query.title) || query.title;
    const mainTitle = cleaned.split(/\s[-–—:]\s/)[0]?.trim() || cleaned;
    const terms = [.../* @__PURE__ */ new Set([
      `${cleaned} ${query.artistName}`.replace(/\s+/g, " ").trim(),
      `${mainTitle} ${query.artistName}`.replace(/\s+/g, " ").trim()
    ])];
    let best = null;
    for (const term of terms) {
      best = await searchItunesTerm(query, term);
      if (best) break;
    }
    writeItunes(query.mbid, best);
    return best;
  }
  async function deezerCover(query) {
    const cleaned = cleanQueryTitle(query.title) || query.title;
    const q = `${cleaned} ${query.artistName}`.replace(/\s+/g, " ").trim();
    const response = await limitDeezer(() => withTimeout(fetch(`https://api.deezer.com/search/album?q=${encodeURIComponent(q)}&limit=6`), 5500));
    if (!response.ok) return null;
    const data = await response.json();
    let best = null;
    let bestScore = 0;
    for (const item of data.data ?? []) {
      const cover = item.cover_big || item.cover_medium;
      if (!item.title || !cover) continue;
      if (!artistMatches(query, [item.artist?.name])) continue;
      const similarity = titleSimilarity(query.title, item.title);
      if (similarity >= 0.6 && similarity > bestScore) {
        best = cover;
        bestScore = similarity;
      }
    }
    return best;
  }
  async function validImage(url, timeoutMs = 4500) {
    if (!url) return null;
    return await preloadImage(url, timeoutMs) ? url : null;
  }
  async function resolve2(query, skipCaa) {
    const known = peekCoverSrc(query.mbid)?.src ?? peekCachedCover(query.mbid) ?? readItunes(query.mbid)?.url ?? null;
    if (known) {
      const verified = await validImage(known);
      if (verified) {
        rememberCoverUrl(query.mbid, verified);
        return verified;
      }
    }
    if (!skipCaa) {
      const url = await validImage(caaCoverUrl(query.mbid, 500), 4500);
      if (url) {
        rememberCoverUrl(query.mbid, url);
        return url;
      }
    }
    const spotifyTask = findSpotifyAlbum(query).then((res) => validImage(res.cover)).catch(() => null);
    const itunesTask = itunesCover(query).then((url) => validImage(url)).catch(() => null);
    const first = await new Promise((done) => {
      let pending = 2;
      const check = (url) => {
        if (url) {
          done(url);
          return;
        }
        pending -= 1;
        if (pending === 0) done(null);
      };
      void spotifyTask.then(check);
      void itunesTask.then(check);
    });
    if (first) {
      rememberCoverUrl(query.mbid, first);
      return first;
    }
    try {
      const dz = await validImage(await deezerCover(query));
      if (dz) {
        rememberCoverUrl(query.mbid, dz);
        return dz;
      }
    } catch {
    }
    return null;
  }
  function resolveAlbumCover(query, skipCaa = false) {
    const key = `${query.mbid}:${skipCaa ? 1 : 0}`;
    const existing = memory.get(key);
    if (existing) return existing;
    const pending = resolve2(query, skipCaa).then((url) => {
      if (!url) memory.delete(key);
      return url;
    });
    memory.set(key, pending);
    return pending;
  }

  // src/services/cover-cache.ts
  var FINAL_KEY = "on-this-day:cover-final:v1";
  var MISS_KEY = "on-this-day:cover-miss:v1";
  var FINAL_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
  var CAA_MISS_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
  var NO_COVER_TTL_MS = 12 * 60 * 60 * 1e3;
  var MAX_FINAL = 2500;
  var MAX_MISS = 2500;
  var MAX_BLOBS = 900;
  var MAX_PARALLEL = 16;
  var MAX_PARALLEL_LOW = 6;
  var FETCH_TIMEOUT_MS = 4500;
  var SIZE = 250;
  var blobs = /* @__PURE__ */ new Map();
  var failed = /* @__PURE__ */ new Set();
  var finals = null;
  var finalsTimer;
  var misses = null;
  var missesTimer;
  var successes = 0;
  var quickNetworkFailures = 0;
  var fetchBlocked = false;
  function loadFinals() {
    if (finals) return finals;
    finals = {};
    try {
      const parsed = JSON.parse(localStorage.getItem(FINAL_KEY) ?? "null");
      if (parsed && typeof parsed === "object") finals = parsed;
    } catch {
    }
    return finals;
  }
  function loadMisses() {
    if (misses) return misses;
    misses = {};
    try {
      const parsed = JSON.parse(localStorage.getItem(MISS_KEY) ?? "null");
      if (parsed && typeof parsed === "object") misses = parsed;
    } catch {
    }
    return misses;
  }
  function saveFinalsSoon() {
    if (finalsTimer !== void 0) return;
    finalsTimer = window.setTimeout(() => {
      finalsTimer = void 0;
      const all = loadFinals();
      const keys = Object.keys(all);
      if (keys.length > MAX_FINAL) {
        keys.sort((a, b) => all[a].t - all[b].t);
        for (const key of keys.slice(0, keys.length - MAX_FINAL)) delete all[key];
      }
      try {
        localStorage.setItem(FINAL_KEY, JSON.stringify(all));
      } catch {
      }
    }, 1500);
  }
  function saveMissesSoon() {
    if (missesTimer !== void 0) return;
    missesTimer = window.setTimeout(() => {
      missesTimer = void 0;
      const all = loadMisses();
      const keys = Object.keys(all);
      if (keys.length > MAX_MISS) {
        keys.sort((a, b) => all[a].t - all[b].t);
        for (const key of keys.slice(0, keys.length - MAX_MISS)) delete all[key];
      }
      try {
        localStorage.setItem(MISS_KEY, JSON.stringify(all));
      } catch {
      }
    }, 1500);
  }
  function rememberCoverUrl(mbid, url) {
    if (!/^https:\/\//.test(url) || url.length > 350) return;
    loadFinals()[mbid] = { u: url, t: Date.now() };
    saveFinalsSoon();
    if (loadMisses()[mbid]) {
      delete loadMisses()[mbid];
      saveMissesSoon();
    }
  }
  function rememberCaaMiss(mbid) {
    const current2 = loadMisses()[mbid];
    if (current2?.s === "none") return;
    loadMisses()[mbid] = { s: "caa", t: Date.now() };
    saveMissesSoon();
  }
  function rememberNoCover(mbid) {
    loadMisses()[mbid] = { s: "none", t: Date.now() };
    saveMissesSoon();
  }
  function peekNoCover(mbid) {
    if (blobs.has(mbid)) return false;
    const finalEntry = loadFinals()[mbid];
    if (finalEntry && typeof finalEntry.u === "string" && Date.now() - finalEntry.t < FINAL_TTL_MS) return false;
    const miss = loadMisses()[mbid];
    if (!miss || miss.s !== "none") return false;
    if (Date.now() - miss.t < NO_COVER_TTL_MS) return true;
    delete loadMisses()[mbid];
    return false;
  }
  function isCaaMissing(mbid) {
    if (failed.has(mbid)) return true;
    const miss = loadMisses()[mbid];
    if (!miss) return false;
    const ttl = miss.s === "none" ? NO_COVER_TTL_MS : CAA_MISS_TTL_MS;
    if (Date.now() - miss.t < ttl) return true;
    delete loadMisses()[mbid];
    return false;
  }
  function isCaaFetchBlocked() {
    return fetchBlocked;
  }
  function peekCoverSrc(mbid) {
    const blob = blobs.get(mbid);
    if (blob) return { src: blob, kind: "blob" };
    const entry = loadFinals()[mbid];
    if (entry && typeof entry.u === "string" && Date.now() - entry.t < FINAL_TTL_MS) return { src: entry.u, kind: "final" };
    return null;
  }
  function forgetFinal(mbid) {
    const hadBlob = blobs.get(mbid);
    if (hadBlob) {
      blobs.delete(mbid);
      try {
        URL.revokeObjectURL(hadBlob);
      } catch {
      }
    }
    if (loadFinals()[mbid]) {
      delete loadFinals()[mbid];
      saveFinalsSoon();
    }
  }
  var tasks = /* @__PURE__ */ new Map();
  var high = [];
  var low = [];
  var active = 0;
  async function download(mbid) {
    const startedAt = Date.now();
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = window.setTimeout(() => controller?.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(caaCoverUrl(mbid, SIZE), { signal: controller?.signal, credentials: "omit" });
      if (!response.ok) {
        if (response.status === 404 || response.status === 400) rememberCaaMiss(mbid);
        throw Object.assign(new Error(`cover ${response.status}`), { http: true });
      }
      const blob = await response.blob();
      if (!blob.type.startsWith("image/") || blob.size < 200) throw Object.assign(new Error("not an image"), { http: true });
      successes += 1;
      quickNetworkFailures = 0;
      if (response.url) rememberCoverUrl(mbid, response.url);
      if (blobs.size >= MAX_BLOBS) return response.url || null;
      const objectUrl = URL.createObjectURL(blob);
      blobs.set(mbid, objectUrl);
      return objectUrl;
    } catch (error) {
      failed.add(mbid);
      const instant = !error?.http && Date.now() - startedAt < 500;
      quickNetworkFailures = instant ? quickNetworkFailures + 1 : 0;
      if (successes === 0 && quickNetworkFailures >= 6) fetchBlocked = true;
      return null;
    } finally {
      window.clearTimeout(timer);
    }
  }
  function pump() {
    while (active < MAX_PARALLEL) {
      const task = high.shift() ?? (active < MAX_PARALLEL_LOW ? low.shift() : void 0);
      if (!task) return;
      task.started = true;
      active += 1;
      void download(task.mbid).then(task.resolve).finally(() => {
        active -= 1;
        tasks.delete(task.mbid);
        pump();
      });
    }
  }
  function request(mbid, priority) {
    const known = peekCoverSrc(mbid);
    if (known) return Promise.resolve(known.src);
    if (fetchBlocked || isCaaMissing(mbid)) return Promise.resolve(null);
    const existing = tasks.get(mbid);
    if (existing) {
      if (priority === "high" && !existing.started && existing.priority === "low") {
        low.splice(low.indexOf(existing), 1);
        existing.priority = "high";
        high.push(existing);
        pump();
      }
      return existing.promise;
    }
    let resolve4;
    const promise = new Promise((done) => {
      resolve4 = done;
    });
    const task = { mbid, priority, started: false, promise, resolve: resolve4 };
    tasks.set(mbid, task);
    (priority === "high" ? high : low).push(task);
    pump();
    return promise;
  }
  function resetLowPriorityCovers() {
    while (low.length) {
      const task = low.pop();
      if (task && !task.started) {
        tasks.delete(task.mbid);
        task.resolve(null);
      }
    }
  }
  function fetchCover(mbid) {
    return request(mbid, "high");
  }
  function prefetchCovers(mbids) {
    for (const mbid of mbids) {
      if (peekCoverSrc(mbid) || isCaaMissing(mbid)) continue;
      void request(mbid, "low");
    }
  }

  // src/services/spotify-album.ts
  var ALBUM_VERSION_PREF_KEY = "on-this-day:album-version-pref";
  function getAlbumVersionPref() {
    try {
      const saved = localStorage.getItem(ALBUM_VERSION_PREF_KEY);
      if (saved === "clean" || saved === "explicit") return saved;
    } catch {
    }
    return "explicit";
  }
  function setAlbumVersionPref(pref) {
    try {
      localStorage.setItem(ALBUM_VERSION_PREF_KEY, pref);
    } catch {
    }
  }
  var CACHE_PREFIX3 = "on-this-day:spotify-album:v8:";
  var LEGACY_CACHE_PREFIXES = [
    "on-this-day:spotify-album:v1:",
    "on-this-day:spotify-album:v2:",
    "on-this-day:spotify-album:v3:",
    "on-this-day:spotify-album:v4:",
    "on-this-day:spotify-album:v5:",
    "on-this-day:spotify-album:v6:",
    "on-this-day:spotify-album:v7:"
  ];
  var CACHE_TTL = 14 * 24 * 60 * 60 * 1e3;
  var CACHE_MISS_TTL = 2 * 60 * 60 * 1e3;
  var MAX_CACHE_ENTRIES = 800;
  var MAX_CONCURRENT = 6;
  var REQUEST_TIMEOUT_MS = 5500;
  var SEARCH_LIMIT = 10;
  var RATE_LIMIT_COOLDOWN_MS = 12e3;
  var GQL_SEARCH_ALBUMS = {
    name: "searchAlbums",
    operation: "query",
    sha256Hash: "202cb3305e31e5a0767ba7925f28bd728cf8f8b0217e6da43909056071cd70e9",
    value: null
  };
  var GQL_SEARCH_DESKTOP = {
    name: "searchDesktop",
    operation: "query",
    sha256Hash: "eef7cc54888d91bdd6802623477873caa3948ae173a0c34fd86827b267e94c03",
    value: null
  };
  var GQL_DISCOGRAPHY_ALL = {
    name: "queryArtistDiscographyAll",
    operation: "query",
    sha256Hash: "5e07d323febb57b4a56a42abbf781490e58764aa45feb6e3dc0591564fc56599",
    value: null
  };
  var GQL_GET_ALBUM = {
    name: "getAlbum",
    operation: "query",
    sha256Hash: "0b6ce3511e1b02e4a40fa95440f992acbe85080eb308af9194322d708fc1914f",
    value: null
  };
  function normalizeText(value) {
    return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\$/g, "s").replace(/@/g, "a").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, "");
  }
  function deabbreviateText(value) {
    return value.replace(/\b(?:[A-Za-z]\.){1,}[A-Za-z]?\.?/g, (match) => match.replace(/\./g, "")).replace(/\./g, "").replace(/\$/g, "s").replace(/\s+/g, " ").trim();
  }
  function buildTitleSearchVariants(rawTitle) {
    const clean = (v) => v.replace(/["]+/g, " ").replace(/\s+/g, " ").trim();
    const title = clean(rawTitle);
    const withoutBrackets = clean(rawTitle.replace(/[([][^)\]]*[)\]]/g, " ")) || title;
    const mainTitle = clean(withoutBrackets.split(/\s[-–—:]\s/)[0]) || withoutBrackets;
    const deabbrevFull = clean(deabbreviateText(withoutBrackets));
    const deabbrevMain = clean(deabbreviateText(mainTitle));
    const variants = /* @__PURE__ */ new Set();
    for (const v of [withoutBrackets, deabbrevFull, mainTitle, deabbrevMain, title]) {
      if (v) variants.add(v);
    }
    if (/^[A-Za-z]{2,4}$/.test(deabbrevMain) && deabbrevMain === withoutBrackets) {
      variants.add(`${deabbrevMain.split("").join(".")}.`);
    }
    return [...variants];
  }
  function baseTitle(value) {
    const stripped = value.replace(/[([][^)\]]*[)\]]/g, " ").replace(/\s[-–—:]\s.*\b(deluxe|remaster(ed)?|edition|version|expanded|anniversary|bonus|mono|stereo|explicit|disc|disk|cd|vol(ume)?|pt|part|single|ep)\b.*$/i, " ").replace(/\b(disc|disk|cd|vol(ume)?|pt|part)\s*\d+\b/gi, " ");
    const normalized = normalizeText(stripped);
    return normalized || normalizeText(value);
  }
  function coreTitle(value) {
    const head = value.replace(/[([][^)\]]*[)\]]/g, " ").split(/\s[-–—:]\s/)[0];
    const normalized = normalizeText(head ?? "");
    return normalized.length >= 3 ? normalized : baseTitle(value);
  }
  function createLimiter(max) {
    let active2 = 0;
    const queue = [];
    return function limit(task) {
      return new Promise((resolve4, reject) => {
        const start = () => {
          active2 += 1;
          task().then(resolve4, reject).finally(() => {
            active2 -= 1;
            queue.shift()?.();
          });
        };
        if (active2 < max) start();
        else queue.push(start);
      });
    };
  }
  function withTimeout(promise, ms) {
    return new Promise((resolve4, reject) => {
      const timer = window.setTimeout(() => reject(new Error("timeout")), ms);
      promise.then(
        (value) => {
          window.clearTimeout(timer);
          resolve4(value);
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
  function spotifyGet(url, priority = false) {
    if (!priority && Date.now() < cooldownUntil) return Promise.reject(new Error("rate-limited"));
    const run = async () => {
      if (!Spicetify?.CosmosAsync?.get) throw new Error("Spicetify.CosmosAsync indisponível");
      try {
        return await withTimeout(Spicetify.CosmosAsync.get(url), REQUEST_TIMEOUT_MS);
      } catch (error) {
        const status = error?.status ?? error?.code;
        if (status === 429) cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        throw error;
      }
    };
    return priority ? run() : limitSpotify(run);
  }
  function extractSpotifyId(uriOrId, kind) {
    if (!uriOrId || typeof uriOrId !== "string") return void 0;
    const match = new RegExp(`^spotify:${kind}:([A-Za-z0-9]+)$`).exec(uriOrId);
    if (match?.[1]) return match[1];
    if (/^[A-Za-z0-9]{22}$/.test(uriOrId)) return uriOrId;
    return void 0;
  }
  function parseGraphQLAlbum(raw, fallbackArtist) {
    const data = raw?.item?.data ?? raw?.data ?? raw;
    if (!data || typeof data !== "object") return null;
    if (typeof data.__typename === "string" && data.__typename !== "Album") return null;
    const id = extractSpotifyId(data.uri ?? data.id, "album");
    const name = typeof data.name === "string" ? data.name.trim() : "";
    if (!id || !name) return null;
    const rawArtists = Array.isArray(data.artists?.items) ? data.artists.items : Array.isArray(data.artists) ? data.artists : [];
    const artists = rawArtists.map((artist) => ({
      id: extractSpotifyId(artist?.uri ?? artist?.id, "artist"),
      name: typeof artist?.profile?.name === "string" ? artist.profile.name : typeof artist?.name === "string" ? artist.name : void 0
    })).filter((artist) => artist.name);
    if (!artists.length && fallbackArtist) artists.push(fallbackArtist);
    const rawImages = Array.isArray(data.coverArt?.sources) ? data.coverArt.sources : Array.isArray(data.images) ? data.images : [];
    const images = rawImages.filter((img) => typeof img?.url === "string" && img.url).map((img) => ({ url: img.url, width: typeof img.width === "number" ? img.width : void 0 }));
    const year = data.date?.year ?? (typeof data.date?.isoString === "string" ? data.date.isoString.slice(0, 4) : void 0) ?? data.release_date;
    const rawType = typeof data.type === "string" ? data.type : typeof data.album_type === "string" ? data.album_type : "album";
    return {
      id,
      uri: `spotify:album:${id}`,
      name,
      album_type: rawType.toLowerCase(),
      release_date: year ? String(year) : void 0,
      artists,
      images
    };
  }
  async function searchAlbumsViaGraphQL(searchTerm, priority = false) {
    const gql = Spicetify?.GraphQL;
    if (!gql?.Request) return [];
    const variables = {
      searchTerm,
      offset: 0,
      limit: 20,
      numberOfTopResults: 20,
      includeAudiobooks: false,
      includeArtistHasConcertsField: false,
      includePreReleases: false,
      includeAlbumPreReleases: false,
      includeAuthors: false,
      includeEpisodeContentRatingsV2: false
    };
    const run = async () => {
      const out = /* @__PURE__ */ new Map();
      const add = (item) => {
        const parsed = parseGraphQLAlbum(item);
        if (parsed?.id) out.set(parsed.id, parsed);
      };
      const searchAlbumsDef = gql.Definitions?.searchAlbums ?? GQL_SEARCH_ALBUMS;
      try {
        const res = await withTimeout(gql.Request(searchAlbumsDef, variables), REQUEST_TIMEOUT_MS);
        const items = res?.data?.searchV2?.albumsV2?.items ?? [];
        items.forEach(add);
      } catch {
      }
      if (out.size === 0) {
        const searchDesktopDef = gql.Definitions?.searchDesktop ?? GQL_SEARCH_DESKTOP;
        try {
          const res = await withTimeout(gql.Request(searchDesktopDef, variables), REQUEST_TIMEOUT_MS);
          const albums = res?.data?.searchV2?.albumsV2?.items ?? [];
          const topResults = res?.data?.searchV2?.topResultsV2?.itemsV2 ?? [];
          topResults.forEach(add);
          albums.forEach(add);
        } catch {
        }
      }
      return [...out.values()];
    };
    return priority ? run() : limitSpotify(run);
  }
  async function discographyViaGraphQL(artistId, artistName, priority = false) {
    const gql = Spicetify?.GraphQL;
    if (!gql?.Request) return [];
    const def = gql.Definitions?.queryArtistDiscographyAll ?? GQL_DISCOGRAPHY_ALL;
    const run = async () => {
      try {
        const res = await withTimeout(
          gql.Request(def, { uri: `spotify:artist:${artistId}`, offset: 0, limit: 100, order: "DATE_DESC" }),
          REQUEST_TIMEOUT_MS
        );
        const groups = res?.data?.artistUnion?.discography?.all?.items ?? [];
        const out = [];
        const fallback = { id: artistId, name: artistName };
        for (const group of groups) {
          const releases = Array.isArray(group?.releases?.items) ? group.releases.items : [group];
          for (const rel of releases) {
            const parsed = parseGraphQLAlbum(rel, fallback);
            if (parsed) out.push(parsed);
          }
        }
        return out;
      } catch {
        return [];
      }
    };
    return priority ? run() : limitSpotify(run);
  }
  var EDITION_WORDS = /* @__PURE__ */ new Set(["deluxe", "expanded", "edition", "remastered", "remaster", "version", "bonus", "explicit", "anniversary", "special", "standard", "mono", "stereo", "disc", "disk", "cd", "vol", "volume", "pt", "part", "single", "ep", "the", "a", "an", "of"]);
  function titleTokens(value) {
    return deabbreviateText(value).replace(/[([][^)\]]*[)\]]/g, " ").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en").split(/[^\p{L}\p{N}]+/u).filter((token) => token && !EDITION_WORDS.has(token));
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
  function expandArtistNames(names) {
    const out = /* @__PURE__ */ new Set();
    for (const raw of names) {
      const full = normalizeText(raw);
      if (full) out.add(full);
      const parts = raw.split(/\s*(?:,|&|\bfeat\.?\b|\bft\.?\b|\bwith\b|\band\b|\/|;|\+)\s*/i);
      for (const part of parts) {
        const norm = normalizeText(part);
        if (norm.length >= 2) out.add(norm);
      }
    }
    return [...out];
  }
  function artistMatches(query, names) {
    const expected = expandArtistNames(query.artistNames?.length ? query.artistNames : [query.artistName]);
    if (!expected.length) return false;
    const candidateNorms = expandArtistNames(names.filter((n) => typeof n === "string" && !!n.trim()));
    return candidateNorms.some(
      (normalized) => expected.some(
        (e) => e === normalized || e.length >= 4 && normalized.includes(e) || normalized.length >= 4 && e.includes(normalized)
      )
    );
  }
  function rankAlbumCandidates(query, albums) {
    const expectedFull = normalizeText(query.title);
    const expectedBase = baseTitle(query.title);
    const expectedCore = coreTitle(query.title);
    const expectedArtists = expandArtistNames(query.artistNames?.length ? query.artistNames : [query.artistName]);
    const releaseYear = Number(query.firstReleaseDate.slice(0, 4));
    const ranked = [];
    let order = 0;
    for (const album of albums) {
      const idx = order++;
      const id = album.id ?? extractSpotifyId(album.uri, "album");
      if (!album.name || !id) continue;
      const normName = normalizeText(album.name);
      const baseName = baseTitle(album.name);
      const coreName = coreTitle(album.name);
      const sim = titleSimilarity(query.title, album.name);
      let titleScore = 0;
      if (expectedFull && normName === expectedFull) {
        titleScore = 1;
      } else if (expectedBase && baseName === expectedBase) {
        titleScore = 0.96;
      } else if (expectedCore.length >= 4 && coreName === expectedCore) {
        titleScore = 0.88;
      } else if (expectedBase.length >= 4 && baseName.length >= 4 && (baseName.startsWith(expectedBase) || expectedBase.startsWith(baseName))) {
        titleScore = 0.84;
      } else if (sim >= 0.6) {
        titleScore = sim;
      }
      if (titleScore <= 0) continue;
      const albumArtistNames = (album.artists ?? []).map((a) => a.name);
      const hasArtist = artistMatches(query, albumArtistNames);
      const exactArtist = albumArtistNames.some((n) => n && expectedArtists.includes(normalizeText(n)));
      const isVariousArtists = albumArtistNames.some(
        (n) => /^(variousartists|variosinterpretes|variosartistas)$/.test(normalizeText(n ?? ""))
      );
      const albumYear = Number(album.release_date?.slice(0, 4));
      const hasYear = Number.isFinite(albumYear) && albumYear > 1900 && Number.isFinite(releaseYear) && releaseYear > 1900;
      const yearDiff = hasYear ? Math.abs(albumYear - releaseYear) : 99;
      const acceptedByVarious = isVariousArtists && titleScore >= 0.95 && yearDiff <= 1;
      const acceptedByExactYearTitle = !albumArtistNames.length && titleScore >= 0.96 && yearDiff <= 1;
      if (!hasArtist && !acceptedByVarious && !acceptedByExactYearTitle) continue;
      const yearBonus = yearDiff === 0 ? 18 : yearDiff === 1 ? 14 : yearDiff <= 3 ? 8 : hasYear ? Math.max(0, 5 - yearDiff * 0.1) : 4;
      const typeLower = (album.album_type ?? "album").toLowerCase();
      const typeBonus = typeLower === "album" ? 6 : typeLower === "ep" || typeLower === "single" ? 2 : 0;
      const score = titleScore * 100 + (normName === expectedFull ? 15 : 0) + (exactArtist ? 25 : hasArtist ? 15 : 5) + yearBonus + typeBonus;
      ranked.push({ album: { ...album, id }, score, order: idx });
    }
    ranked.sort((a, b) => b.score - a.score || a.order - b.order);
    return ranked;
  }
  function pickAlbumMatch(query, albums) {
    const ranked = rankAlbumCandidates(query, albums);
    const best = ranked[0]?.album ?? null;
    return { selected: best, coverCandidate: best };
  }
  async function fetchAlbumMetaGraphQL(albumId, albumTitle, priority = false) {
    const gql = Spicetify?.GraphQL;
    if (!gql?.Request) return null;
    const def = gql.Definitions?.getAlbum ?? GQL_GET_ALBUM;
    const run = async () => {
      try {
        const res = await withTimeout(
          gql.Request(def, { uri: `spotify:album:${albumId}`, locale: "", offset: 0, limit: 50 }),
          REQUEST_TIMEOUT_MS
        );
        const union = res?.data?.albumUnion;
        if (!union || typeof union.__typename === "string" && union.__typename !== "Album") return null;
        const items = union.tracksV2?.items ?? [];
        if (!items.length) return null;
        let hasExplicit = /\bexplicit\b/i.test(albumTitle);
        let totalStreams = 0;
        let maxTrackStreams = 0;
        let playableCount = 0;
        const streamCounts = [];
        for (const item of items) {
          const track = item?.track ?? item;
          if (!track) continue;
          const label = String(track?.contentRating?.label ?? "");
          if (/explicit/i.test(label) || track?.explicit === true) hasExplicit = true;
          const count = Number(track?.playcount ?? 0);
          if (Number.isFinite(count) && count > 0) {
            totalStreams += count;
            streamCounts.push(count);
            if (count > maxTrackStreams) maxTrackStreams = count;
          }
          if (track?.playability?.playable !== false) playableCount += 1;
        }
        if (/\b(clean|edited)\b/i.test(albumTitle) && !hasExplicit) {
          hasExplicit = false;
        }
        const trackCount = items.length;
        const avgTrackStreams = streamCounts.length > 0 ? Math.round(totalStreams / streamCounts.length) : 0;
        let retentionRatio = 0.55;
        if (streamCounts.length >= 2 && maxTrackStreams > 0) {
          const sorted = [...streamCounts].sort((a, b) => b - a);
          const refPeak = sorted[Math.min(1, sorted.length - 1)] || maxTrackStreams;
          const median = sorted[Math.floor(sorted.length / 2)] || avgTrackStreams;
          retentionRatio = Math.max(0.15, Math.min(1, (median * 0.6 + avgTrackStreams * 0.4) / refPeak));
        }
        return {
          isExplicit: hasExplicit,
          totalStreams,
          maxTrackStreams,
          avgTrackStreams,
          retentionRatio,
          trackCount,
          playableRatio: trackCount > 0 ? playableCount / trackCount : 1,
          popularity: 0
        };
      } catch {
        return null;
      }
    };
    return priority ? run() : limitSpotify(run);
  }
  async function fetchAlbumsMetaWebApi(ids, priority = false) {
    const map = /* @__PURE__ */ new Map();
    if (!ids.length) return map;
    try {
      const batch = ids.slice(0, 20).join(",");
      const res = await spotifyGet(`https://api.spotify.com/v1/albums?ids=${encodeURIComponent(batch)}`, priority);
      for (const album of res.albums ?? []) {
        if (!album?.id) continue;
        const tracks = album.tracks?.items ?? [];
        const hasExplicit = tracks.some((t2) => t2?.explicit === true) || /\bexplicit\b/i.test(album.name ?? "");
        const playableCount = tracks.filter((t2) => t2?.is_playable !== false).length;
        const pop = typeof album.popularity === "number" ? album.popularity : 0;
        map.set(album.id, {
          isExplicit: tracks.length > 0 ? hasExplicit : null,
          totalStreams: 0,
          maxTrackStreams: 0,
          avgTrackStreams: 0,
          retentionRatio: pop > 0 ? Math.max(0.35, Math.min(0.95, pop / 100)) : 0.5,
          trackCount: tracks.length,
          playableRatio: tracks.length > 0 ? playableCount / tracks.length : 1,
          popularity: pop
        });
      }
    } catch {
    }
    return map;
  }
  async function selectBestAlbumEditions(ranked, priority = false) {
    if (!ranked.length) return { best: null, explicit: null, clean: null, bestMeta: null };
    const topScore = ranked[0].score;
    const pool = ranked.filter((c) => topScore - c.score <= 28).slice(0, 6);
    const gqlMetas = await Promise.all(
      pool.map((c) => fetchAlbumMetaGraphQL(c.album.id, c.album.name ?? "", priority))
    );
    const missingIds = pool.filter((_, idx) => !gqlMetas[idx]).map((c) => c.album.id);
    const webMetas = missingIds.length ? await fetchAlbumsMetaWebApi(missingIds, priority) : /* @__PURE__ */ new Map();
    const enriched = pool.map((candidate, idx) => {
      const meta = gqlMetas[idx] ?? webMetas.get(candidate.album.id) ?? {
        isExplicit: /\bexplicit\b/i.test(candidate.album.name ?? "") ? true : /\b(clean|edited)\b/i.test(candidate.album.name ?? "") ? false : null,
        totalStreams: 0,
        maxTrackStreams: 0,
        avgTrackStreams: 0,
        retentionRatio: 0.5,
        trackCount: 0,
        playableRatio: 1,
        popularity: 0
      };
      const streamBonus = meta.totalStreams > 0 ? Math.log10(meta.totalStreams + 1) * 18 : 0;
      const peakBonus = meta.maxTrackStreams > 0 ? Math.log10(meta.maxTrackStreams + 1) * 6 : 0;
      const popBonus = meta.popularity > 0 ? meta.popularity * 1.2 : 0;
      const playableBonus = meta.playableRatio * 20;
      const orderBonus = Math.max(0, 10 - candidate.order * 1.5);
      const finalScore = candidate.score + streamBonus + peakBonus + popBonus + playableBonus + orderBonus;
      return {
        album: candidate.album,
        meta,
        isExplicit: meta.isExplicit,
        finalScore
      };
    });
    enriched.sort((a, b) => b.finalScore - a.finalScore);
    const winner = enriched[0] ?? null;
    const best = winner?.album ?? null;
    const bestMeta = winner?.meta ?? null;
    const explicit = enriched.find((c) => c.isExplicit === true)?.album ?? null;
    const clean = enriched.find((c) => c.isExplicit === false)?.album ?? null;
    return { best, explicit, clean, bestMeta };
  }
  function bestImage(album) {
    const images = (album?.images ?? []).filter((image) => image.url);
    if (!images.length) return null;
    const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
    return (sorted.find((image) => (image.width ?? 0) <= 700) ?? sorted[0]).url ?? null;
  }
  var memory2 = /* @__PURE__ */ new Map();
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
  function readCache3(mbid) {
    try {
      const key = `${CACHE_PREFIX3}${mbid}`;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (typeof entry.expiresAt !== "number" || entry.expiresAt <= Date.now()) {
        localStorage.removeItem(key);
        return null;
      }
      return {
        uri: typeof entry.uri === "string" ? entry.uri : null,
        explicitUri: typeof entry.explicitUri === "string" ? entry.explicitUri : null,
        cleanUri: typeof entry.cleanUri === "string" ? entry.cleanUri : null,
        cover: typeof entry.cover === "string" ? entry.cover : null,
        artists: Array.isArray(entry.artists) ? entry.artists.filter((a) => a && typeof a.id === "string" && typeof a.name === "string") : [],
        totalStreams: typeof entry.totalStreams === "number" ? entry.totalStreams : void 0,
        maxTrackStreams: typeof entry.maxTrackStreams === "number" ? entry.maxTrackStreams : void 0,
        avgTrackStreams: typeof entry.avgTrackStreams === "number" ? entry.avgTrackStreams : void 0,
        retentionRatio: typeof entry.retentionRatio === "number" ? entry.retentionRatio : void 0,
        trackCount: typeof entry.trackCount === "number" ? entry.trackCount : void 0,
        popularity: typeof entry.popularity === "number" ? entry.popularity : void 0
      };
    } catch {
      return null;
    }
  }
  function peekCachedAlbumLookup(mbid) {
    purgeLegacyCache();
    return readCache3(mbid);
  }
  function preferredAlbumUri(lookup, pref = getAlbumVersionPref()) {
    if (!lookup) return null;
    if (pref === "clean") {
      return lookup.cleanUri ?? lookup.uri ?? lookup.explicitUri ?? null;
    }
    return lookup.explicitUri ?? lookup.uri ?? lookup.cleanUri ?? null;
  }
  function peekCachedCover(mbid) {
    const cached = readCache3(mbid);
    return cached?.cover ?? null;
  }
  function peekCachedAlbumUri(mbid) {
    const cached = readCache3(mbid);
    return preferredAlbumUri(cached);
  }
  var writesSincePrune = 0;
  function writeCache3(mbid, result) {
    try {
      const ttl = result.uri ? CACHE_TTL : CACHE_MISS_TTL;
      const entry = { ...result, expiresAt: Date.now() + ttl };
      localStorage.setItem(`${CACHE_PREFIX3}${mbid}`, JSON.stringify(entry));
      writesSincePrune += 1;
      if (writesSincePrune < 25) return;
      writesSincePrune = 0;
      const entries = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key?.startsWith(CACHE_PREFIX3)) continue;
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
        const id = artist.id ?? extractSpotifyId(artist.uri, "artist");
        if (id && artist.name && artistMatches(query, [artist.name])) return id;
      }
    }
    return null;
  }
  async function resolveArtistId(query, seen, remember, priority = false) {
    const fromSeen = findArtistId(query, [...seen.values()]);
    if (fromSeen) return fromSeen;
    const cleanArtist = query.artistName.replace(/["]+/g, " ").replace(/\s+/g, " ").trim();
    const artistVariants = [...new Set([cleanArtist, deabbreviateText(cleanArtist)].filter(Boolean))];
    for (const art of artistVariants) {
      const gqlAlbums = await searchAlbumsViaGraphQL(art, priority);
      if (gqlAlbums.length) {
        remember(gqlAlbums);
        const id = findArtistId(query, gqlAlbums);
        if (id) return id;
      }
    }
    for (const art of artistVariants) {
      try {
        const params = new URLSearchParams({ q: art, type: "artist", limit: "5" });
        const res = await spotifyGet(
          `https://api.spotify.com/v1/search?${params}`,
          priority
        );
        for (const item of res.artists?.items ?? []) {
          const id = item.id ?? extractSpotifyId(item.uri, "artist");
          if (id && item.name && artistMatches(query, [item.name])) return id;
        }
      } catch {
      }
    }
    return null;
  }
  function toLookupResult(best, explicit, clean, meta) {
    const preferred = getAlbumVersionPref() === "clean" ? clean ?? best : explicit ?? best;
    return {
      uri: `spotify:album:${best.id}`,
      explicitUri: explicit ? `spotify:album:${explicit.id}` : null,
      cleanUri: clean ? `spotify:album:${clean.id}` : null,
      cover: bestImage(preferred) ?? bestImage(best),
      artists: (best.artists ?? []).map((a) => ({ id: a.id ?? extractSpotifyId(a.uri, "artist") ?? "", name: a.name ?? "" })).filter((a) => !!a.id && !!a.name),
      totalStreams: meta?.totalStreams ?? 0,
      maxTrackStreams: meta?.maxTrackStreams ?? 0,
      avgTrackStreams: meta?.avgTrackStreams ?? 0,
      retentionRatio: meta?.retentionRatio ?? 0.5,
      trackCount: meta?.trackCount ?? 0,
      popularity: meta?.popularity ?? 0
    };
  }
  async function finalizeCandidates(query, seen, priority = false) {
    const ranked = rankAlbumCandidates(query, [...seen.values()]);
    if (!ranked.length) return null;
    const { best, explicit, clean, bestMeta } = await selectBestAlbumEditions(ranked, priority);
    if (!best) return null;
    return toLookupResult(best, explicit, clean, bestMeta);
  }
  async function lookupAlbum(query, priority = false) {
    const clean = (value) => value.replace(/["]+/g, " ").replace(/\s+/g, " ").trim();
    const artist = clean(query.artistName);
    const artistDeabbrev = clean(deabbreviateText(artist)) || artist;
    const titleVariants = buildTitleSearchVariants(query.title);
    const seen = /* @__PURE__ */ new Map();
    let hadError = false;
    let discogChecked = false;
    const remember = (albums) => {
      for (const album of albums) {
        const id = album.id ?? extractSpotifyId(album.uri, "album");
        if (id && !seen.has(id)) seen.set(id, { ...album, id });
      }
    };
    const enrichWithDiscography = async () => {
      if (discogChecked) return;
      const candidatesNow = rankAlbumCandidates(query, [...seen.values()]);
      if (candidatesNow.length !== 1) return;
      const artistId2 = findArtistId(query, [...seen.values()]);
      if (!artistId2) return;
      discogChecked = true;
      const gqlDiscog = await discographyViaGraphQL(artistId2, query.artistName, priority);
      if (gqlDiscog.length) remember(gqlDiscog);
    };
    const gqlQueries = [.../* @__PURE__ */ new Set([
      ...titleVariants.map((t2) => `${t2} ${artist}`),
      ...titleVariants.map((t2) => `${t2} ${artistDeabbrev}`),
      ...titleVariants
    ])];
    for (const q of gqlQueries) {
      const gqlAlbums = await searchAlbumsViaGraphQL(q, priority);
      remember(gqlAlbums);
      if (rankAlbumCandidates(query, [...seen.values()]).length > 0) {
        await enrichWithDiscography();
        const resolved2 = await finalizeCandidates(query, seen, priority);
        if (resolved2) return { result: resolved2, hadError: false };
      }
    }
    const webQueries = [.../* @__PURE__ */ new Set([
      ...titleVariants.slice(0, 3).map((t2) => `album:"${t2}" artist:"${artist}"`),
      ...titleVariants.slice(0, 3).map((t2) => `${t2} ${artist}`),
      ...titleVariants.slice(0, 2).map((t2) => `${t2} ${artistDeabbrev}`)
    ])];
    for (const q of webQueries) {
      try {
        const response = await spotifyGet(searchUrl(q), priority);
        const albums = response.albums?.items ?? [];
        remember(albums);
        const resolved2 = await finalizeCandidates(query, seen, priority);
        if (resolved2) return { result: resolved2, hadError: false };
      } catch {
        hadError = true;
      }
    }
    const artistId = await resolveArtistId(query, seen, remember, priority);
    if (artistId) {
      if (!discogChecked) {
        discogChecked = true;
        const gqlDiscog = await discographyViaGraphQL(artistId, query.artistName, priority);
        if (gqlDiscog.length) remember(gqlDiscog);
      }
      const resolvedFromGql = await finalizeCandidates(query, seen, priority);
      if (resolvedFromGql) return { result: resolvedFromGql, hadError: false };
      try {
        for (let offset = 0; offset < 100; offset += 50) {
          const page = await spotifyGet(
            `https://api.spotify.com/v1/artists/${encodeURIComponent(artistId)}/albums?include_groups=album,single,compilation&limit=50&offset=${offset}`,
            priority
          );
          const discography = page.items ?? [];
          remember(discography);
          const resolved2 = await finalizeCandidates(query, seen, priority);
          if (resolved2) return { result: resolved2, hadError: false };
          if (!page.next) break;
        }
      } catch {
        hadError = true;
      }
    }
    const resolved = await finalizeCandidates(query, seen, priority);
    if (resolved) return { result: resolved, hadError: false };
    const { coverCandidate } = pickAlbumMatch(query, [...seen.values()]);
    return {
      result: { uri: null, explicitUri: null, cleanUri: null, cover: bestImage(coverCandidate), artists: [] },
      hadError
    };
  }
  function findSpotifyAlbum(query, priority = false) {
    purgeLegacyCache();
    const cached = readCache3(query.mbid);
    if (cached && (cached.uri || !priority)) {
      return Promise.resolve(cached);
    }
    if (!priority) {
      const existing = memory2.get(query.mbid);
      if (existing) return existing;
    }
    const pending = lookupAlbum(query, priority).then(({ result, hadError }) => {
      if (result.uri || result.cover || !hadError) {
        writeCache3(query.mbid, result);
      } else {
        memory2.delete(query.mbid);
      }
      if (result.cover) rememberCoverUrl(query.mbid, result.cover);
      return result;
    }).catch(() => {
      memory2.delete(query.mbid);
      return { uri: null, explicitUri: null, cleanUri: null, cover: null, artists: [] };
    });
    memory2.set(query.mbid, pending);
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
  async function openAlbumInSpotify(query, waitMs = 9e3) {
    const cachedUri = peekCachedAlbumUri(query.mbid);
    const cachedPath = spotifyAlbumPath(cachedUri);
    if (cachedPath) {
      navigateInSpotify(cachedPath);
      return "album";
    }
    let match = null;
    try {
      match = await withTimeout(findSpotifyAlbum(query, true), waitMs);
    } catch {
    }
    const albumPath = spotifyAlbumPath(preferredAlbumUri(match));
    navigateInSpotify(albumPath ?? spotifySearchPath(query));
    return albumPath ? "album" : "search";
  }
  async function playAlbumInSpotify(query, waitMs = 9e3) {
    let uri = peekCachedAlbumUri(query.mbid);
    if (!uri) {
      try {
        const match = await withTimeout(findSpotifyAlbum(query, true), waitMs);
        uri = preferredAlbumUri(match);
      } catch {
      }
    }
    if (uri && /^spotify:album:[A-Za-z0-9]+$/.test(uri)) {
      try {
        if (Spicetify?.Player?.playUri) {
          await Spicetify.Player.playUri(uri);
          try {
            Spicetify?.showNotification?.(`▶ ${query.title} — ${query.artistName}`);
          } catch {
          }
          return "played";
        }
        if (Spicetify?.Platform?.PlayerAPI?.play) {
          await Spicetify.Platform.PlayerAPI.play({ uri }, {});
          try {
            Spicetify?.showNotification?.(`▶ ${query.title} — ${query.artistName}`);
          } catch {
          }
          return "played";
        }
      } catch {
      }
    }
    await openAlbumInSpotify(query, waitMs);
    return "opened";
  }

  // src/services/followed-artists.ts
  var CACHE_KEY = "on-this-day:followed-artists:v1";
  var CACHE_FRESH_MS = 6 * 60 * 60 * 1e3;
  var PAGE_LIMIT = 50;
  var MAX_PAGES = 100;
  var NON_ARTIST = /^(various artists?|unknown( artist)?|\[?no artist\]?|\[?anonymous\]?|\[?traditional\]?|\[?unknown\]?|\[?data\]?|special purpose.*)$/i;
  function normalizeArtistName(name) {
    const trimmed = name?.trim() ?? "";
    if (!trimmed || NON_ARTIST.test(trimmed)) return "";
    const normalized = normalizeText(trimmed);
    if (!normalized) return "";
    if (!/\p{L}/u.test(normalized) && normalized.length < 2) return "";
    return normalized;
  }
  function hasValidArtistName(name) {
    return Boolean(name && normalizeArtistName(name));
  }
  function buildFollowedArtistSet(names) {
    const set = /* @__PURE__ */ new Set();
    for (const name of names) {
      const key = normalizeArtistName(name);
      if (key) set.add(key);
    }
    return set;
  }
  function readCache4() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
      if (parsed && Array.isArray(parsed.names) && typeof parsed.at === "number") return parsed;
    } catch {
    }
    return null;
  }
  function writeCache4(names) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ names, at: Date.now() }));
    } catch {
    }
  }
  function peekFollowedArtists() {
    const cached = readCache4();
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
    const cached = readCache4();
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
      writeCache4(unique);
      return { names: unique, fromCache: false, stale: false };
    }
    if (cached) return { names: cached.names, fromCache: true, stale: true };
    throw new Error("Não foi possível ler os artistas que você segue no Spotify.");
  }
  function artistIsFollowed(followed, artistNames) {
    for (const name of artistNames) {
      const key = normalizeArtistName(name);
      if (key && followed.has(key)) return true;
    }
    return false;
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
      userScoreTitle: "Audience score (Spotify listeners + MusicBrainz community)",
      criticScoreTitle: "Critic & editorial reception (Wikipedia / Metacritic / Album cohesion)",
      userScoreMissing: "no audience ratings found for this album",
      criticScoreMissing: "no critic or editorial score available for this album",
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
      previousDay: "Previous day",
      previousDayTitle: "Go back one day",
      nextDay: "Next day",
      nextDayTitle: "Go forward one day",
      backToToday: "Back to today",
      backToTodayTitle: "Jump back to today",
      previousDayLimit: "You can go back up to {days} days",
      tabsLabel: "Content",
      tabAlbums: "Albums",
      tabArtists: "Artists",
      subtitleBirthdays: "Artists born on {date}, in other years.",
      birthdaysThisDay: "{count} artists born this day",
      loadingBirthdays: "Loading birthdays for {date}…",
      birthdaysMissing: "The artist birthdays for this day haven't been published yet. They are generated together with the catalog; try again later.",
      birthdaysError: "Could not load the artist birthdays for {date}.",
      birthdaysEmpty: "No artist birthdays found for this day.",
      birthdaysEmptyNoMatch: "No birthday artists match the selected genres.",
      birthdaysFollowedEmpty: "None of this day's birthday artists are artists you follow. Turn the filter off to see all.",
      retry: "Try again",
      moreArtists: "View more artists",
      lessArtists: "Show fewer",
      bornOn: "Born: {date}",
      ageOne: "1 year old",
      ageMany: "{age} years old",
      openArtistOnSpotify: "Open {name} on Spotify",
      artistPhotoAlt: "Photo of {name}",
      attributionBirthdays: "Data: MusicBrainz. Photos and profiles: Spotify. Click a photo to open the artist on Spotify.",
      albumAriaLabel: "Search {title} by {artist} on Spotify",
      albumTitleAttr: "Search {title} on Spotify",
      coverAlt: "Cover of {title}",
      searchOnSpotify: "Search {title} on Spotify",
      searchOnSpotifyShort: "Spotify",
      albumVersionTitle: "Album version",
      albumVersionExplicit: "Explicit",
      albumVersionExplicitDesc: "Open explicit album when available",
      albumVersionClean: "Non-explicit",
      albumVersionCleanDesc: "Open clean version when available",
      albumVersionCleanShort: "Clean",
      albumVersionHint: "Always prioritizes the most streamed edition on Spotify.",
      settingsBtn: "Settings",
      playAlbumOnSpotify: "Play {title} on Spotify",
      playAlbumShort: "Play album",
      openAlbumOnSpotifyShort: "Open on Spotify",
      sortAlbumsLabel: "Sort albums",
      sortBest: "Top rated & popular",
      sortBestShort: "Top rated",
      sortUser: "User score",
      sortUserShort: "User",
      sortCritic: "Critic score",
      sortCriticShort: "Critic",
      sortTitle: "Title (A–Z)",
      sortTitleShort: "A–Z"
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
      userScoreTitle: "Nota do público (Ouvintes do Spotify + comunidade MusicBrainz)",
      criticScoreTitle: "Nota da crítica e recepção (Wikipedia / Metacritic / Coesão do álbum)",
      userScoreMissing: "sem avaliações de público encontradas para este álbum",
      criticScoreMissing: "sem nota de crítica disponível para este álbum",
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
      albumsThisDay: "{count} álbuns neste dia",
      previousDay: "Dia anterior",
      previousDayTitle: "Voltar um dia",
      nextDay: "Próximo dia",
      nextDayTitle: "Avançar um dia",
      backToToday: "Voltar para hoje",
      backToTodayTitle: "Voltar direto para hoje",
      previousDayLimit: "Você pode voltar até {days} dias",
      tabsLabel: "Conteúdo",
      tabAlbums: "Álbuns",
      tabArtists: "Artistas",
      subtitleBirthdays: "Artistas nascidos em {date}, em outros anos.",
      birthdaysThisDay: "{count} artistas nascidos neste dia",
      loadingBirthdays: "Carregando os aniversários de {date}…",
      birthdaysMissing: "Os aniversários de artistas deste dia ainda não foram publicados. Eles são gerados junto com o catálogo; tente de novo mais tarde.",
      birthdaysError: "Não foi possível carregar os aniversários de artistas de {date}.",
      birthdaysEmpty: "Nenhum aniversário de artista encontrado para este dia.",
      birthdaysEmptyNoMatch: "Nenhum aniversariante corresponde aos gêneros selecionados.",
      birthdaysFollowedEmpty: "Nenhum aniversariante deste dia é um artista que você segue. Desative o filtro para ver todos.",
      retry: "Tentar de novo",
      moreArtists: "Ver mais artistas",
      lessArtists: "Mostrar menos",
      bornOn: "Nascimento: {date}",
      ageOne: "1 ano",
      ageMany: "{age} anos",
      openArtistOnSpotify: "Abrir {name} no Spotify",
      artistPhotoAlt: "Foto de {name}",
      attributionBirthdays: "Dados: MusicBrainz. Fotos e perfis: Spotify. Clique na foto para abrir o artista no Spotify.",
      albumAriaLabel: "Pesquisar {title} de {artist} no Spotify",
      albumTitleAttr: "Pesquisar {title} no Spotify",
      coverAlt: "Capa de {title}",
      searchOnSpotify: "Pesquisar {title} no Spotify",
      searchOnSpotifyShort: "Spotify",
      albumVersionTitle: "Versão do álbum",
      albumVersionExplicit: "Explícito",
      albumVersionExplicitDesc: "Priorizar álbum explícito ao abrir",
      albumVersionClean: "Sem explícito",
      albumVersionCleanDesc: "Priorizar versão limpa / sem explícito",
      albumVersionCleanShort: "Limpo",
      albumVersionHint: "Sempre prioriza a edição mais ouvida no Spotify.",
      settingsBtn: "Configurações",
      playAlbumOnSpotify: "Tocar {title} no Spotify",
      playAlbumShort: "Tocar álbum",
      openAlbumOnSpotifyShort: "Abrir no Spotify",
      sortAlbumsLabel: "Ordenar álbuns do ano",
      sortBest: "Destaques (Notas + Fama)",
      sortBestShort: "Destaques",
      sortUser: "Nota dos Usuários",
      sortUserShort: "Usuários",
      sortCritic: "Nota da Crítica",
      sortCriticShort: "Crítica",
      sortTitle: "Título (A–Z)",
      sortTitleShort: "A–Z"
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
      userScoreTitle: "Nota del público (Oyentes de Spotify + comunidad MusicBrainz)",
      criticScoreTitle: "Nota de la crítica y recepción (Wikipedia / Metacritic / Cohesión del álbum)",
      userScoreMissing: "sin valoraciones del público para este álbum",
      criticScoreMissing: "sin nota de crítica disponible para este álbum",
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
      previousDay: "Día anterior",
      previousDayTitle: "Retroceder un día",
      nextDay: "Día siguiente",
      nextDayTitle: "Avanzar un día",
      backToToday: "Volver a hoy",
      backToTodayTitle: "Volver directamente a hoy",
      previousDayLimit: "Puedes retroceder hasta {days} días",
      tabsLabel: "Contenido",
      tabAlbums: "Álbumes",
      tabArtists: "Artistas",
      subtitleBirthdays: "Artistas nacidos el {date}, en otros años.",
      birthdaysThisDay: "{count} artistas nacidos este día",
      loadingBirthdays: "Cargando los cumpleaños de {date}…",
      birthdaysMissing: "Los cumpleaños de artistas de este día aún no se han publicado. Se generan junto con el catálogo; inténtalo de nuevo más tarde.",
      birthdaysError: "No se pudieron cargar los cumpleaños de artistas de {date}.",
      birthdaysEmpty: "No se encontraron cumpleaños de artistas para este día.",
      birthdaysEmptyNoMatch: "Ningún cumpleañero coincide con los géneros seleccionados.",
      birthdaysFollowedEmpty: "Ningún cumpleañero de este día es un artista que sigues. Desactiva el filtro para ver todos.",
      retry: "Intentar de nuevo",
      moreArtists: "Ver más artistas",
      lessArtists: "Mostrar menos",
      bornOn: "Nacimiento: {date}",
      ageOne: "1 año",
      ageMany: "{age} años",
      openArtistOnSpotify: "Abrir {name} en Spotify",
      artistPhotoAlt: "Foto de {name}",
      attributionBirthdays: "Datos: MusicBrainz. Fotos y perfiles: Spotify. Haz clic en la foto para abrir al artista en Spotify.",
      albumAriaLabel: "Buscar {title} de {artist} en Spotify",
      albumTitleAttr: "Buscar {title} en Spotify",
      coverAlt: "Portada de {title}",
      searchOnSpotify: "Buscar {title} en Spotify",
      searchOnSpotifyShort: "Spotify",
      albumVersionTitle: "Versión del álbum",
      albumVersionExplicit: "Explícito",
      albumVersionExplicitDesc: "Priorizar álbum explícito al abrir",
      albumVersionClean: "Sin explícito",
      albumVersionCleanDesc: "Priorizar versión limpia / sin explícito",
      albumVersionCleanShort: "Limpio",
      albumVersionHint: "Siempre prioriza la edición más escuchada en Spotify.",
      settingsBtn: "Ajustes",
      playAlbumOnSpotify: "Reproducir {title} en Spotify",
      playAlbumShort: "Reproducir álbum",
      openAlbumOnSpotifyShort: "Abrir en Spotify",
      sortAlbumsLabel: "Ordenar álbumes del año",
      sortBest: "Destacados (Notas + Fama)",
      sortBestShort: "Destacados",
      sortUser: "Nota de Usuarios",
      sortUserShort: "Usuarios",
      sortCritic: "Nota de la Crítica",
      sortCriticShort: "Crítica",
      sortTitle: "Título (A–Z)",
      sortTitleShort: "A–Z"
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
  var APP_VERSION = true ? "1.1.14" : "0.0.0";
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
  function readCache5() {
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
    const cached = readCache5();
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
    const cached = readCache5();
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
      const check = () => {
        void checkForUpdate(true).then((result) => {
          if (!cancelled) setInfo(result);
        });
      };
      check();
      const timer = window.setInterval(check, 10 * 60 * 1e3);
      const onVisible = () => {
        if (document.visibilityState === "visible") check();
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        cancelled = true;
        window.clearInterval(timer);
        document.removeEventListener("visibilitychange", onVisible);
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
  function ChevronIcon({ size = 14 }) {
    return /* @__PURE__ */ Spicetify.React.createElement("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ Spicetify.React.createElement("path", { d: "m6 9 6 6 6-6" }));
  }
  function CheckIcon({ size = 14 }) {
    return /* @__PURE__ */ Spicetify.React.createElement("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: "2.6", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ Spicetify.React.createElement("path", { d: "m5 12.5 4.5 4.5L19 7.500" }));
  }
  function GearIcon({ size = 16 }) {
    return /* @__PURE__ */ Spicetify.React.createElement("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: "1.9", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ Spicetify.React.createElement("circle", { cx: "12", cy: "12", r: "3.2" }), /* @__PURE__ */ Spicetify.React.createElement("path", { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" }));
  }
  function PlayIcon({ size = 14 }) {
    return /* @__PURE__ */ Spicetify.React.createElement("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "currentColor", "aria-hidden": "true" }, /* @__PURE__ */ Spicetify.React.createElement("path", { d: "M7.05 3.606l13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606Z" }));
  }
  function SortIcon({ size = 14 }) {
    return /* @__PURE__ */ Spicetify.React.createElement("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: "2.1", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ Spicetify.React.createElement("path", { d: "M3 6h18M7 12h10M10 18h4" }));
  }

  // src/services/view-state.ts
  var KEY = "on-this-day:view-state:v1";
  var MAX_EXPANDED_KEYS = 400;
  function todayKey() {
    const now = /* @__PURE__ */ new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }
  function fresh() {
    return { day: todayKey(), dayOffset: 0, tab: "albums", scroll: { albums: 0, artists: 0 }, expanded: {} };
  }
  function sane(value) {
    if (!value || typeof value !== "object") return null;
    const v = value;
    if (typeof v.day !== "string" || v.tab !== "albums" && v.tab !== "artists") return null;
    const number = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : 0;
    const expanded = {};
    if (v.expanded && typeof v.expanded === "object") {
      for (const [key, count] of Object.entries(v.expanded)) if (typeof count === "number" && count > 0) expanded[key] = count;
    }
    return {
      day: v.day,
      dayOffset: Math.floor(number(v.dayOffset)),
      tab: v.tab,
      scroll: { albums: number(v.scroll?.albums), artists: number(v.scroll?.artists) },
      expanded
    };
  }
  var memory3 = null;
  var persistTimer2;
  function current() {
    if (!memory3) {
      try {
        memory3 = sane(JSON.parse(sessionStorage.getItem(KEY) ?? "null"));
      } catch {
        memory3 = null;
      }
    }
    if (!memory3 || memory3.day !== todayKey()) memory3 = fresh();
    return memory3;
  }
  function persistSoon2() {
    if (persistTimer2 !== void 0) return;
    persistTimer2 = window.setTimeout(() => {
      persistTimer2 = void 0;
      try {
        sessionStorage.setItem(KEY, JSON.stringify(current()));
      } catch {
      }
    }, 250);
  }
  function getViewState() {
    return current();
  }
  function setViewTab(tab) {
    current().tab = tab;
    persistSoon2();
  }
  function setViewDayOffset(dayOffset) {
    const state = current();
    state.dayOffset = dayOffset;
    state.scroll = { albums: 0, artists: 0 };
    persistSoon2();
  }
  function getSavedScroll(tab) {
    return current().scroll[tab];
  }
  var frozenUntil = 0;
  function freezeScrollSaving(ms) {
    frozenUntil = Date.now() + ms;
  }
  function saveScroll(tab, top) {
    if (Date.now() < frozenUntil) return;
    current().scroll[tab] = Math.max(0, Math.round(top));
    persistSoon2();
  }
  var captureScroll = null;
  function registerScrollCapture(capture) {
    captureScroll = capture;
  }
  function beforeLeavingApp() {
    try {
      captureScroll?.();
    } catch {
    }
    freezeScrollSaving(5e3);
    persistNow();
  }
  function persistNow() {
    if (persistTimer2 !== void 0) {
      window.clearTimeout(persistTimer2);
      persistTimer2 = void 0;
    }
    try {
      sessionStorage.setItem(KEY, JSON.stringify(current()));
    } catch {
    }
  }
  function getExpanded(key, fallback) {
    return current().expanded[key] ?? fallback;
  }
  function setExpanded(key, count, fallback) {
    const state = current();
    if (count <= fallback) delete state.expanded[key];
    else {
      state.expanded[key] = count;
      const keys = Object.keys(state.expanded);
      if (keys.length > MAX_EXPANDED_KEYS) for (const old of keys.slice(0, keys.length - MAX_EXPANDED_KEYS)) delete state.expanded[old];
    }
    persistSoon2();
  }
  function findScroller(from) {
    let nearest = null;
    for (let el = from?.parentElement ?? null; el; el = el.parentElement) {
      const overflowY = getComputedStyle(el).overflowY;
      if (overflowY !== "auto" && overflowY !== "scroll" && overflowY !== "overlay") continue;
      if (el.scrollHeight > el.clientHeight + 1) return el;
      nearest ?? (nearest = el);
    }
    return nearest ?? document.scrollingElement ?? null;
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
  var SHOW_CRITIC_SCORE = true;
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

  // src/services/album-scores.ts
  var STORAGE_KEY2 = "on-this-day:album-scores:v1";
  var CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
  var MAX_STORED = 1200;
  var WIKI_TIMEOUT_MS = 4500;
  var memoryCache = /* @__PURE__ */ new Map();
  var inFlight = /* @__PURE__ */ new Map();
  var scoreListeners = /* @__PURE__ */ new Set();
  var notifyTimer = null;
  var limitWiki = createLimiter(4);
  var storageLoaded = false;
  var dirtyCount = 0;
  function notifyScoreListeners() {
    if (!scoreListeners.size || notifyTimer) return;
    notifyTimer = setTimeout(() => {
      notifyTimer = null;
      scoreListeners.forEach((cb) => {
        try {
          cb();
        } catch {
        }
      });
    }, 220);
  }
  function subscribeAlbumScores(listener) {
    scoreListeners.add(listener);
    return () => {
      scoreListeners.delete(listener);
    };
  }
  var ALBUM_SORT_KEY = "on-this-day:album-sort";
  function getAlbumSortMode() {
    try {
      const saved = localStorage.getItem(ALBUM_SORT_KEY);
      if (saved === "best" || saved === "user" || saved === "critic" || saved === "title") return saved;
    } catch {
    }
    return "best";
  }
  function setAlbumSortMode(mode) {
    try {
      localStorage.setItem(ALBUM_SORT_KEY, mode);
    } catch {
    }
  }
  function ensureStorageLoaded() {
    if (storageLoaded) return;
    storageLoaded = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY2);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      const now = Date.now();
      for (const [mbid, entry] of Object.entries(parsed)) {
        if (!entry || typeof entry.ts !== "number" || now - entry.ts > CACHE_TTL_MS) continue;
        memoryCache.set(mbid, {
          user: { value: entry.uVal, count: entry.uCnt, lowConfidence: !!entry.uLow },
          critic: { value: entry.cVal, count: entry.cCnt, lowConfidence: !!entry.cLow }
        });
      }
    } catch {
    }
  }
  function persistStorage(force = false) {
    dirtyCount += 1;
    if (!force && dirtyCount < 10) return;
    dirtyCount = 0;
    try {
      const entries = [...memoryCache.entries()];
      const slice = entries.slice(Math.max(0, entries.length - MAX_STORED));
      const out = {};
      const ts = Date.now();
      for (const [mbid, scores] of slice) {
        if (scores.user.value === null && scores.critic.value === null) continue;
        out[mbid] = {
          uVal: scores.user.value,
          uCnt: scores.user.count,
          uLow: scores.user.lowConfidence,
          cVal: scores.critic.value,
          cCnt: scores.critic.count,
          cLow: scores.critic.lowConfidence,
          ts
        };
      }
      localStorage.setItem(STORAGE_KEY2, JSON.stringify(out));
    } catch {
    }
  }
  var LETTER_GRADES = {
    "A+": 97,
    "A": 93,
    "A-": 90,
    "A–": 90,
    "B+": 87,
    "B": 83,
    "B-": 80,
    "B–": 80,
    "C+": 77,
    "C": 73,
    "C-": 70,
    "C–": 70,
    "D+": 67,
    "D": 63,
    "D-": 60,
    "D–": 60,
    "E": 50,
    "F": 42
  };
  var XXL_GRADES = {
    "XXL": 95,
    "XL": 80,
    "L": 65,
    "M": 50,
    "S": 35
  };
  function parseWikiReviewScore(raw) {
    const cleaned = raw.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, " ").replace(/<ref[^>]*\/>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").trim();
    if (!cleaned) return null;
    const ratingTpl = /\{\{\s*(?:[Rr]ating|[Rr]ating-inline)\s*\|\s*([0-9]+(?:\.[0-9]+)?)\s*\|\s*([0-9]+(?:\.[0-9]+)?)/i.exec(cleaned);
    if (ratingTpl) {
      const num = Number(ratingTpl[1]);
      const den = Number(ratingTpl[2]);
      if (Number.isFinite(num) && Number.isFinite(den) && den > 0 && num >= 0 && num <= den) {
        return Math.round(num / den * 100);
      }
    }
    if (/\{\{\s*cg\s*\|\s*hm3\s*\}\}/i.test(cleaned)) return 78;
    if (/\{\{\s*cg\s*\|\s*hm2\s*\}\}/i.test(cleaned)) return 74;
    if (/\{\{\s*cg\s*\|\s*hm1\s*\}\}/i.test(cleaned)) return 70;
    if (/\{\{\s*cg\s*\|\s*(?:dud|bomb)\s*\}\}/i.test(cleaned)) return 48;
    if (/\{\{\s*cg\s*\|\s*neither\s*\}\}/i.test(cleaned)) return 60;
    const ratioMatch = /\b([0-9]+(?:\.[0-9]+)?)\s*\/\s*(100|10|5|4)\b/.exec(cleaned);
    if (ratioMatch) {
      const num = Number(ratioMatch[1]);
      const den = Number(ratioMatch[2]);
      if (Number.isFinite(num) && Number.isFinite(den) && den > 0 && num >= 0 && num <= den) {
        return Math.round(num / den * 100);
      }
    }
    const pctMatch = /\b([0-9]{1,3}(?:\.[0-9]+)?)\s*%/.exec(cleaned);
    if (pctMatch) {
      const pct = Number(pctMatch[1]);
      if (pct >= 0 && pct <= 100) return Math.round(pct);
    }
    const plainNum = /^\s*([0-9]{2,3}(?:\.[0-9]+)?)\s*$/.exec(cleaned.replace(/\[[^\]]*\]/g, "").trim());
    if (plainNum) {
      const n = Number(plainNum[1]);
      if (n >= 15 && n <= 100) return Math.round(n);
    }
    const stripped = cleaned.replace(/\{\{[^{}]*\}\}/g, " ").replace(/'''|''/g, "").replace(/\([^)]*\)/g, " ").trim().toUpperCase();
    if (XXL_GRADES[stripped] !== void 0) return XXL_GRADES[stripped];
    const gradeMatch = /^([A-DF][+-–]?)$/.exec(stripped);
    if (gradeMatch && LETTER_GRADES[gradeMatch[1]] !== void 0) {
      return LETTER_GRADES[gradeMatch[1]];
    }
    return null;
  }
  function extractWikiCriticScore(wikitext) {
    if (!wikitext) return null;
    const scores = [];
    let aggregateScore = null;
    const mcMatch = /\|\s*(?:MC|mc)\s*=\s*([^\n|]+)/.exec(wikitext);
    if (mcMatch) {
      const mcVal = parseWikiReviewScore(mcMatch[1]);
      if (mcVal !== null) {
        aggregateScore = mcVal;
        scores.push(mcVal);
      }
    }
    const admMatch = /\|\s*(?:ADM|adm)\s*=\s*([^\n|]+)/.exec(wikitext);
    if (admMatch) {
      const admVal = parseWikiReviewScore(admMatch[1]);
      if (admVal !== null) {
        if (aggregateScore === null) aggregateScore = admVal;
        scores.push(admVal);
      }
    }
    const aotyMatch = /\|\s*(?:AOTY|aoty)\s*=\s*([^\n|]+)/.exec(wikitext);
    if (aotyMatch) {
      const aotyVal = parseWikiReviewScore(aotyMatch[1]);
      if (aotyVal !== null) {
        if (aggregateScore === null) aggregateScore = aotyVal;
        scores.push(aotyVal);
      }
    }
    const revRegex = /\|\s*rev\d+score\s*=\s*([^\n]+)/gi;
    let match;
    while ((match = revRegex.exec(wikitext)) !== null) {
      const parsed = parseWikiReviewScore(match[1]);
      if (parsed !== null) scores.push(parsed);
    }
    if (!scores.length) return null;
    const avgReviews = scores.reduce((acc, s) => acc + s, 0) / scores.length;
    const finalValue = aggregateScore !== null ? Math.round(aggregateScore * 0.55 + avgReviews * 0.45) : Math.round(avgReviews);
    const effectiveCount = aggregateScore !== null ? Math.max(scores.length + 5, 7) : scores.length;
    return {
      value: Math.max(20, Math.min(99, finalValue)),
      count: effectiveCount
    };
  }
  async function fetchWikipediaCriticRatings(item) {
    return limitWiki(async () => {
      try {
        const cleanTitle = deabbreviateText(item.title.replace(/[([][^)\]]*[)\]]/g, " ")).trim() || item.title;
        const cleanArtist = deabbreviateText(item.artistName).trim() || item.artistName;
        const normTitle = normalizeText(item.title);
        const normArtist = normalizeText(item.artistName);
        const searchQuery = `${cleanTitle} ${cleanArtist} album`;
        const searchParams = new URLSearchParams({
          action: "query",
          list: "search",
          srsearch: searchQuery,
          srlimit: "4",
          format: "json",
          origin: "*"
        });
        const searchRes = await withTimeout(
          fetch(`https://en.wikipedia.org/w/api.php?${searchParams}`).then((r) => r.json()),
          WIKI_TIMEOUT_MS
        );
        const hits = searchRes?.query?.search ?? [];
        if (!hits.length) return null;
        const candidate = hits.find((h) => {
          const tNorm = normalizeText(h.title ?? "");
          const sNorm = normalizeText(h.snippet ?? "");
          const titleMatches = normTitle.length >= 2 && (tNorm.includes(normTitle) || normTitle.includes(tNorm));
          const artistMatches2 = normArtist.length >= 2 && (tNorm.includes(normArtist) || sNorm.includes(normArtist));
          return titleMatches && artistMatches2;
        });
        if (!candidate?.pageid) return null;
        const revParams = new URLSearchParams({
          action: "query",
          pageids: String(candidate.pageid),
          prop: "revisions",
          rvprop: "content",
          rvslots: "main",
          format: "json",
          origin: "*"
        });
        const revRes = await withTimeout(
          fetch(`https://en.wikipedia.org/w/api.php?${revParams}`).then((r) => r.json()),
          WIKI_TIMEOUT_MS
        );
        const page = revRes?.query?.pages?.[String(candidate.pageid)];
        const revision = page?.revisions?.[0];
        const wikitext = revision?.slots?.main?.["*"] ?? revision?.["*"] ?? "";
        return extractWikiCriticScore(wikitext);
      } catch {
        return null;
      }
    });
  }
  function computeEnrichedScores(item, spotify, wikiCritic) {
    const baseUser = readUserScore(item);
    const baseCritic = readCriticScore(item);
    const totalStreams = spotify?.totalStreams ?? 0;
    const maxTrackStreams = spotify?.maxTrackStreams ?? 0;
    const avgTrackStreams = spotify?.avgTrackStreams ?? (totalStreams > 0 ? Math.round(totalStreams / Math.max(1, spotify?.trackCount ?? 10)) : 0);
    const retention = spotify?.retentionRatio ?? 0.55;
    const popularity = spotify?.popularity ?? 0;
    const trackCount = spotify?.trackCount ?? 0;
    const hasSpotifyTelemetry = totalStreams > 0 || popularity > 0;
    let userReading = baseUser;
    if (hasSpotifyTelemetry) {
      let spotifyUserScore = 70;
      if (avgTrackStreams > 0) {
        const logAvg = Math.log10(avgTrackStreams + 10);
        const streamComponent = 42 + logAvg * 6.4;
        const retentionBonus = (retention - 0.5) * 16;
        spotifyUserScore = Math.max(58, Math.min(95, Math.round(streamComponent + retentionBonus)));
      } else if (popularity > 0) {
        spotifyUserScore = Math.max(58, Math.min(94, Math.round(52 + popularity * 0.42)));
      }
      const listenerVotes = totalStreams > 0 ? Math.max(8, Math.min(4800, Math.round(Math.pow(totalStreams, 0.36)))) : Math.max(6, Math.round(popularity * 1.4));
      const mbVotes = baseUser.count ?? 0;
      const mbValue = baseUser.value;
      const totalVotes = mbVotes + listenerVotes;
      const finalUserValue = mbValue !== null && mbVotes > 0 ? Math.round((mbValue * Math.min(mbVotes, 25) + spotifyUserScore * Math.max(10, Math.min(listenerVotes, 40))) / (Math.min(mbVotes, 25) + Math.max(10, Math.min(listenerVotes, 40)))) : spotifyUserScore;
      userReading = {
        value: Math.max(45, Math.min(98, finalUserValue)),
        count: totalVotes,
        lowConfidence: totalVotes < LOW_CONFIDENCE_VOTES
      };
    }
    let criticReading = baseCritic;
    if (criticReading.value === null && wikiCritic) {
      criticReading = {
        value: wikiCritic.value,
        count: wikiCritic.count,
        lowConfidence: wikiCritic.count < 3
      };
    }
    if (criticReading.value === null && hasSpotifyTelemetry) {
      const logPeak = maxTrackStreams > 0 ? Math.log10(maxTrackStreams + 10) : popularity > 0 ? popularity / 14 : 4.5;
      const cohesionScore = 46 + retention * 26 + logPeak * 3.1;
      const blended = baseUser.value !== null ? Math.round(cohesionScore * 0.72 + baseUser.value * 0.28) : Math.round(cohesionScore);
      const evalCount = Math.max(4, trackCount > 0 ? Math.min(18, Math.ceil(trackCount * 0.75)) : 6);
      criticReading = {
        value: Math.max(54, Math.min(93, blended)),
        count: evalCount,
        lowConfidence: evalCount < 3
      };
    }
    return { user: userReading, critic: criticReading };
  }
  function peekAlbumScores(item) {
    ensureStorageLoaded();
    const cached = memoryCache.get(item.mbid);
    if (cached) return cached;
    const cachedSpotify = peekCachedAlbumLookup(item.mbid);
    if (cachedSpotify && (cachedSpotify.totalStreams || cachedSpotify.popularity)) {
      return computeEnrichedScores(item, cachedSpotify, null);
    }
    return {
      user: readUserScore(item),
      critic: readCriticScore(item)
    };
  }
  function resolveAlbumScores(item) {
    ensureStorageLoaded();
    const cached = memoryCache.get(item.mbid);
    if (cached && cached.user.value !== null && cached.critic.value !== null) {
      return Promise.resolve(cached);
    }
    const existing = inFlight.get(item.mbid);
    if (existing) return existing;
    const task = (async () => {
      try {
        const [spotify, wikiCritic] = await Promise.all([
          findSpotifyAlbum(item).catch(() => null),
          fetchWikipediaCriticRatings(item).catch(() => null)
        ]);
        const resolved = computeEnrichedScores(item, spotify, wikiCritic);
        if (resolved.user.value !== null || resolved.critic.value !== null) {
          memoryCache.set(item.mbid, resolved);
          persistStorage();
          notifyScoreListeners();
        }
        return resolved;
      } finally {
        inFlight.delete(item.mbid);
      }
    })();
    inFlight.set(item.mbid, task);
    return task;
  }
  function compareAlbumsBySortMode(a, b, mode) {
    if (mode === "title") {
      return a.title.localeCompare(b.title) || a.artistName.localeCompare(b.artistName);
    }
    const sa = peekAlbumScores(a);
    const sb = peekAlbumScores(b);
    const uA = sa.user.value ?? -1;
    const uB = sb.user.value ?? -1;
    const cA = sa.critic.value ?? -1;
    const cB = sb.critic.value ?? -1;
    const vA = (sa.user.count ?? 0) + (sa.critic.count ?? 0);
    const vB = (sb.user.count ?? 0) + (sb.critic.count ?? 0);
    if (mode === "user") {
      return uB - uA || (sb.user.count ?? 0) - (sa.user.count ?? 0) || cB - cA || a.title.localeCompare(b.title);
    }
    if (mode === "critic") {
      return cB - cA || (sb.critic.count ?? 0) - (sa.critic.count ?? 0) || uB - uA || a.title.localeCompare(b.title);
    }
    const rankOf = (u, c, votes) => {
      if (u < 0 && c < 0) return -1;
      const base = u >= 0 && c >= 0 ? u * 0.55 + c * 0.45 : u >= 0 ? u : c;
      const voteBoost = votes > 0 ? Math.log10(votes + 1) * 6 : 0;
      return base + voteBoost;
    };
    const rA = rankOf(uA, cA, vA);
    const rB = rankOf(uB, cB, vB);
    if (Math.abs(rB - rA) > 0.01) return rB - rA;
    return vB - vA || a.title.localeCompare(b.title);
  }

  // src/components/AlbumCard.tsx
  var SINGLE_CLICK_DELAY_MS = 280;
  var FAST_RACE_MS = 1400;
  var AlbumCard = memo(function AlbumCard2({ item, lang, onPreview }) {
    const year = item.firstReleaseDate.slice(0, 4);
    const [hasCover, setHasCover] = useState(() => !peekNoCover(item.mbid));
    const srcKind = useRef(null);
    const [coverSrc, setCoverSrc] = useState(() => {
      const known = peekCoverSrc(item.mbid);
      if (known) {
        srcKind.current = known.kind;
        return known.src;
      }
      const spotify = peekCachedCover(item.mbid);
      if (spotify) {
        rememberCoverUrl(item.mbid, spotify);
        srcKind.current = "spotify";
        return spotify;
      }
      return null;
    });
    const [imgLoaded, setImgLoaded] = useState(() => srcKind.current === "blob");
    const slowTimer = useRef(null);
    const raceTimer = useRef(null);
    const fallbackStarted = useRef(false);
    const loaded = useRef(srcKind.current === "blob");
    const wrapRef = useRef(null);
    const clickTimer = useRef(null);
    const mounted = useRef(true);
    const [scores, setScores] = useState(() => peekAlbumScores(item));
    const userScore = scores.user;
    const criticScore = scores.critic;
    function clearClickTimer() {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
    }
    function clearTimers() {
      if (slowTimer.current) {
        clearTimeout(slowTimer.current);
        slowTimer.current = null;
      }
      if (raceTimer.current) {
        clearTimeout(raceTimer.current);
        raceTimer.current = null;
      }
    }
    function openSpotifyAlbum() {
      clearClickTimer();
      beforeLeavingApp();
      void openAlbumInSpotify(item);
    }
    function playSpotifyAlbum(event) {
      event.stopPropagation();
      clearClickTimer();
      void playAlbumInSpotify(item);
    }
    function warmUpLookup() {
      void findSpotifyAlbum(item);
      void resolveAlbumScores(item).then((next) => {
        if (mounted.current) setScores(next);
      });
    }
    function handleCoverClick(event) {
      if (event.detail >= 2) {
        openSpotifyAlbum();
        return;
      }
      clearClickTimer();
      if (event.detail === 0) {
        onPreview(item, hasCover && imgLoaded ? coverSrc : null);
        return;
      }
      clickTimer.current = window.setTimeout(() => {
        clickTimer.current = null;
        if (mounted.current) onPreview(item, hasCover && imgLoaded ? coverSrc : null);
      }, SINGLE_CLICK_DELAY_MS);
    }
    function recoverCover() {
      if (fallbackStarted.current) return;
      fallbackStarted.current = true;
      clearTimers();
      void resolveAlbumCover(item, true).then((url) => {
        if (!mounted.current) return;
        if (url) {
          rememberCoverUrl(item.mbid, url);
          loaded.current = true;
          srcKind.current = "spotify";
          setImgLoaded(true);
          setCoverSrc(url);
          setHasCover(true);
        } else if (!loaded.current) {
          rememberNoCover(item.mbid);
          setImgLoaded(false);
          setCoverSrc(null);
          setHasCover(false);
        }
      });
    }
    function useCoverArtArchive() {
      srcKind.current = "caa";
      loaded.current = false;
      setImgLoaded(false);
      setCoverSrc(caaCoverUrl(item.mbid, 250));
      startSlowTimer();
    }
    function startSlowTimer() {
      if (slowTimer.current) return;
      slowTimer.current = window.setTimeout(() => {
        slowTimer.current = null;
        if (!loaded.current) recoverCover();
      }, 3200);
    }
    function handleCoverError() {
      if (srcKind.current === "final" || srcKind.current === "blob" || srcKind.current === "spotify") {
        forgetFinal(item.mbid);
        setImgLoaded(false);
        setCoverSrc(null);
        recoverCover();
        return;
      }
      setImgLoaded(false);
      setCoverSrc(null);
      if (fallbackStarted.current) {
        if (!loaded.current) {
          rememberNoCover(item.mbid);
          setHasCover(false);
        }
        return;
      }
      recoverCover();
    }
    useEffect(() => {
      mounted.current = true;
      setScores(peekAlbumScores(item));
      const hadSrc = coverSrc !== null;
      if (srcKind.current === "blob") {
        loaded.current = true;
        setImgLoaded(true);
      }
      const begin = () => {
        warmUpLookup();
        if (!hasCover) return;
        if (hadSrc) {
          if (srcKind.current !== "blob") startSlowTimer();
          return;
        }
        if (isCaaMissing(item.mbid)) {
          recoverCover();
          return;
        }
        raceTimer.current = window.setTimeout(() => {
          raceTimer.current = null;
          if (mounted.current && !loaded.current) recoverCover();
        }, FAST_RACE_MS);
        void fetchCover(item.mbid).then((url) => {
          if (!mounted.current) return;
          if (raceTimer.current) {
            clearTimeout(raceTimer.current);
            raceTimer.current = null;
          }
          if (url) {
            loaded.current = true;
            const isBlob = url.startsWith("blob:");
            srcKind.current = isBlob ? "blob" : "final";
            if (isBlob) setImgLoaded(true);
            setCoverSrc(url);
          } else if (isCaaFetchBlocked() && !fallbackStarted.current) {
            useCoverArtArchive();
          } else if (!loaded.current) {
            recoverCover();
          }
        });
      };
      let observer;
      const node = wrapRef.current;
      if (node && typeof IntersectionObserver !== "undefined") {
        observer = new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer?.disconnect();
            begin();
          }
        }, { rootMargin: "1200px 0px" });
        observer.observe(node);
      } else {
        begin();
      }
      return () => {
        mounted.current = false;
        clearClickTimer();
        clearTimers();
        observer?.disconnect();
      };
    }, []);
    return /* @__PURE__ */ Spicetify.React.createElement("article", { className: "otd-album-card", onMouseEnter: warmUpLookup }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-cover-wrap", ref: wrapRef }, /* @__PURE__ */ Spicetify.React.createElement(
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
      hasCover ? /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, (!coverSrc || !imgLoaded) && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-cover-skeleton", "aria-hidden": "true" }), coverSrc && /* @__PURE__ */ Spicetify.React.createElement(
        "img",
        {
          className: "otd-cover",
          src: coverSrc,
          alt: t(lang, "coverAlt", { title: item.title }),
          loading: "eager",
          decoding: "async",
          style: imgLoaded ? void 0 : { opacity: 0, position: "absolute", inset: 0, pointerEvents: "none" },
          onLoad: () => {
            loaded.current = true;
            clearTimers();
            setImgLoaded(true);
          },
          onError: handleCoverError
        }
      )) : /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-cover-placeholder", "aria-hidden": "true" }, "♫")
    ), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-cover-actions" }, /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "otd-play-album",
        type: "button",
        onClick: playSpotifyAlbum,
        onMouseEnter: warmUpLookup,
        "aria-label": t(lang, "playAlbumOnSpotify", { title: item.title }),
        title: t(lang, "playAlbumOnSpotify", { title: item.title })
      },
      /* @__PURE__ */ Spicetify.React.createElement(PlayIcon, { size: 13 })
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
    ))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-album-name", title: item.title }, item.title), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-artist-name", title: item.artistName }, item.artistName), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-card-meta" }, year), /* @__PURE__ */ Spicetify.React.createElement("div", { className: `otd-scores${SHOW_CRITIC_SCORE ? "" : " otd-scores--single"}` }, /* @__PURE__ */ Spicetify.React.createElement(ScoreMeter, { kind: "user", reading: userScore, lang }), SHOW_CRITIC_SCORE && /* @__PURE__ */ Spicetify.React.createElement(ScoreMeter, { kind: "critic", reading: criticScore, lang })));
  });

  // src/services/birthday-profile.ts
  var STORAGE_KEY3 = "on-this-day:birthday-profiles:v1";
  var HIT_TTL2 = 30 * 24 * 60 * 60 * 1e3;
  var MISS_TTL2 = 6 * 60 * 60 * 1e3;
  var MAX_ENTRIES2 = 600;
  var SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
  var MIN_AMBIGUOUS_POPULARITY = 20;
  var store2 = null;
  var persistTimer3;
  var inflight4 = /* @__PURE__ */ new Map();
  function loadStore2() {
    if (store2) return store2;
    store2 = {};
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY3) ?? "null");
      if (parsed && typeof parsed === "object") store2 = parsed;
    } catch {
    }
    return store2;
  }
  function persistSoon3() {
    if (persistTimer3 !== void 0) return;
    persistTimer3 = window.setTimeout(() => {
      persistTimer3 = void 0;
      const current2 = loadStore2();
      const keys = Object.keys(current2);
      if (keys.length > MAX_ENTRIES2) {
        keys.sort((a, b) => current2[a].at - current2[b].at);
        for (const key of keys.slice(0, keys.length - MAX_ENTRIES2)) delete current2[key];
      }
      try {
        localStorage.setItem(STORAGE_KEY3, JSON.stringify(current2));
      } catch {
      }
    }, 1500);
  }
  function readEntry2(mbid) {
    const entry = loadStore2()[mbid];
    if (!entry || typeof entry.at !== "number") return null;
    const ttl = entry.id || entry.url ? HIT_TTL2 : MISS_TTL2;
    if (Date.now() - entry.at > ttl) {
      delete loadStore2()[mbid];
      return null;
    }
    return entry;
  }
  function writeEntry2(mbid, profile) {
    loadStore2()[mbid] = { id: profile.spotifyId, url: profile.photoUrl, at: Date.now() };
    persistSoon3();
  }
  function toProfile(entry) {
    return {
      spotifyId: entry.id && SPOTIFY_ID.test(entry.id) ? entry.id : null,
      photoUrl: typeof entry.url === "string" ? entry.url : null
    };
  }
  function peekBirthdayProfile(artist) {
    const entry = readEntry2(artist.mbid);
    if (entry) return toProfile(entry);
    if (artist.spotifyId && SPOTIFY_ID.test(artist.spotifyId)) return { spotifyId: artist.spotifyId, photoUrl: null };
    return null;
  }
  function pickAvatar(images) {
    const valid = (images ?? []).filter((image) => image.url);
    if (!valid.length) return null;
    const sorted = [...valid].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
    return (sorted.find((image) => (image.width ?? 0) >= 200) ?? sorted[sorted.length - 1]).url ?? null;
  }
  function genreWords(genre) {
    return genre.toLocaleLowerCase("en").split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1);
  }
  async function searchSpotifyArtist(artist) {
    const params = new URLSearchParams({ q: artist.name, type: "artist", limit: "10" });
    const result = await spotifyGet(
      `https://api.spotify.com/v1/search?${params}`
    );
    const expected = normalizeText(artist.name);
    const exact = (result.artists?.items ?? []).filter(
      (hit) => !!hit.id && SPOTIFY_ID.test(hit.id) && !!hit.name && normalizeText(hit.name) === expected
    );
    if (!exact.length) return null;
    const wanted = new Set((artist.genres ?? []).flatMap(genreWords));
    const overlaps = (hit) => (hit.genres ?? []).some((genre) => genreWords(genre).some((word) => wanted.has(word)));
    const ranked = [...exact].sort(
      (a, b) => Number(overlaps(b)) - Number(overlaps(a)) || (b.popularity ?? 0) - (a.popularity ?? 0)
    );
    const best = ranked[0];
    const accepted = exact.length === 1 || overlaps(best) || (best.popularity ?? 0) >= MIN_AMBIGUOUS_POPULARITY;
    return accepted ? { id: best.id, url: pickAvatar(best.images) } : null;
  }
  async function resolve3(artist) {
    const cached = readEntry2(artist.mbid);
    if (cached) return toProfile(cached);
    let transientFailure = false;
    const attempt = async (task) => {
      try {
        return await task();
      } catch {
        transientFailure = true;
        return null;
      }
    };
    let id = artist.spotifyId && SPOTIFY_ID.test(artist.spotifyId) ? artist.spotifyId : null;
    let url = null;
    if (id) {
      const knownId = id;
      url = await attempt(() => artistImageById(knownId)) ?? await attempt(() => viaGraphQL(knownId));
    } else {
      const hit = await attempt(() => searchSpotifyArtist(artist));
      if (hit) {
        id = hit.id;
        url = hit.url ?? await attempt(() => artistImageById(hit.id));
      }
    }
    if (!url) url = await attempt(() => viaWikipedia(artist.name));
    const profile = { spotifyId: id, photoUrl: url };
    if (id || url || !transientFailure) writeEntry2(artist.mbid, profile);
    return profile;
  }
  function resolveBirthdayProfile(artist) {
    const existing = inflight4.get(artist.mbid);
    if (existing) return existing;
    const pending = resolve3(artist).finally(() => inflight4.delete(artist.mbid));
    inflight4.set(artist.mbid, pending);
    return pending;
  }
  async function openArtistInSpotify(artist, waitMs = 3500) {
    let id = peekBirthdayProfile(artist)?.spotifyId ?? null;
    if (!id) {
      try {
        id = (await withTimeout(resolveBirthdayProfile(artist), waitMs)).spotifyId;
      } catch {
      }
    }
    navigateInSpotify(id ? `/artist/${id}` : `/search/${encodeURIComponent(artist.name)}/artists`);
    return id ? "artist" : "search";
  }

  // src/components/BirthdayCard.tsx
  function parseBorn(born) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(born);
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  }
  function countryName(code, lang) {
    if (!code) return null;
    try {
      const names = new Intl.DisplayNames([lang], { type: "region" });
      return names.of(code) ?? code;
    } catch {
      return code;
    }
  }
  function titleCase(value) {
    return value.replace(/(^|[\s-])(\p{L})/gu, (_match, lead, letter) => `${lead}${letter.toLocaleUpperCase()}`);
  }
  function initialsOf(name) {
    const words = name.split(/\s+/).filter(Boolean);
    const letters = (words.length > 1 ? [words[0], words[words.length - 1]] : words).map((word) => Array.from(word)[0] ?? "");
    return letters.join("").toLocaleUpperCase();
  }
  function hueOf(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) % 360;
    return hash;
  }
  var BirthdayCard = memo(function BirthdayCard2({ artist, lang, viewYear }) {
    const [photo, setPhoto] = useState(() => peekBirthdayProfile(artist)?.photoUrl ?? null);
    const [photoFailed, setPhotoFailed] = useState(false);
    const wrapRef = useRef(null);
    const mounted = useRef(true);
    const bornDate = parseBorn(artist.born);
    const age = viewYear - Number(artist.born.slice(0, 4));
    const bornLabel = bornDate ? new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric" }).format(bornDate) : artist.born;
    const country = countryName(artist.country, lang);
    const genres = (artist.genres ?? []).slice(0, 3);
    useEffect(() => {
      mounted.current = true;
      if (photo) return () => {
        mounted.current = false;
      };
      const load = () => {
        void resolveBirthdayProfile(artist).then((profile) => {
          if (mounted.current && profile.photoUrl) setPhoto(profile.photoUrl);
        });
      };
      let observer;
      const node = wrapRef.current;
      if (node && typeof IntersectionObserver !== "undefined") {
        observer = new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer?.disconnect();
            load();
          }
        });
        observer.observe(node);
      } else {
        load();
      }
      return () => {
        mounted.current = false;
        observer?.disconnect();
      };
    }, [artist.mbid]);
    const label = t(lang, "openArtistOnSpotify", { name: artist.name });
    return /* @__PURE__ */ Spicetify.React.createElement("article", { className: "otd-artist-card" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-artist-photo-wrap", ref: wrapRef }, /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        type: "button",
        className: "otd-artist-photo",
        onClick: () => {
          beforeLeavingApp();
          void openArtistInSpotify(artist);
        },
        onMouseEnter: () => {
          void resolveBirthdayProfile(artist);
        },
        "aria-label": label,
        title: label
      },
      photo && !photoFailed ? /* @__PURE__ */ Spicetify.React.createElement(
        "img",
        {
          src: photo,
          alt: t(lang, "artistPhotoAlt", { name: artist.name }),
          loading: "lazy",
          decoding: "async",
          onError: () => setPhotoFailed(true)
        }
      ) : /* @__PURE__ */ Spicetify.React.createElement(
        "span",
        {
          className: "otd-artist-initials",
          "aria-hidden": "true",
          style: { background: `linear-gradient(145deg, hsl(${hueOf(artist.mbid)} 38% 34%), hsl(${(hueOf(artist.mbid) + 40) % 360} 38% 20%))` }
        },
        initialsOf(artist.name)
      )
    )), /* @__PURE__ */ Spicetify.React.createElement("h3", { className: "otd-artist-card-name", title: artist.name }, artist.name), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-artist-age" }, t(lang, age === 1 ? "ageOne" : "ageMany", { age })), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-artist-born" }, t(lang, "bornOn", { date: bornLabel })), country && /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-artist-country" }, country), genres.length > 0 && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-artist-genres" }, genres.map((genre) => /* @__PURE__ */ Spicetify.React.createElement("span", { key: genre, className: "otd-artist-genre" }, titleCase(genre)))));
  });

  // src/components/BirthdaysView.tsx
  var INITIAL_ARTISTS = 24;
  var ARTISTS_PER_EXPANSION = 24;
  function BirthdaysView({
    lang,
    dayKey,
    status,
    artists,
    totalBeforeFilters,
    hasGenreFilter,
    onlyFollowedActive,
    dateLabel,
    viewYear,
    errorMessage,
    onRetry
  }) {
    const expandedKey = `b:${dayKey}`;
    const [visibleCount, setVisibleCountState] = useState(() => getExpanded(expandedKey, INITIAL_ARTISTS));
    const setVisibleCount = (next) => {
      setVisibleCountState((count) => {
        const value = typeof next === "function" ? next(count) : next;
        setExpanded(expandedKey, value, INITIAL_ARTISTS);
        return value;
      });
    };
    if (status === "loading") {
      return /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-empty" }, t(lang, "loadingBirthdays", { date: dateLabel }));
    }
    if (status === "missing") {
      return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-empty" }, /* @__PURE__ */ Spicetify.React.createElement("p", null, t(lang, "birthdaysMissing")), /* @__PURE__ */ Spicetify.React.createElement("button", { type: "button", className: "otd-retry-btn", onClick: onRetry }, t(lang, "retry")));
    }
    if (status === "error") {
      return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-empty" }, /* @__PURE__ */ Spicetify.React.createElement("p", null, t(lang, "birthdaysError", { date: dateLabel })), errorMessage && /* @__PURE__ */ Spicetify.React.createElement("pre", { className: "otd-error" }, errorMessage), /* @__PURE__ */ Spicetify.React.createElement("button", { type: "button", className: "otd-retry-btn", onClick: onRetry }, t(lang, "retry")));
    }
    if (!artists.length) {
      return /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-empty" }, totalBeforeFilters === 0 ? t(lang, "birthdaysEmpty") : hasGenreFilter ? t(lang, "birthdaysEmptyNoMatch") : onlyFollowedActive ? t(lang, "birthdaysFollowedEmpty") : t(lang, "birthdaysEmpty"));
    }
    const visible = artists.slice(0, visibleCount);
    return /* @__PURE__ */ Spicetify.React.createElement("section", { className: "otd-birthdays", "aria-label": t(lang, "tabArtists") }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-artist-grid" }, visible.map((artist) => /* @__PURE__ */ Spicetify.React.createElement(BirthdayCard, { key: artist.mbid, artist, lang, viewYear }))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-year-actions" }, visibleCount < artists.length && /* @__PURE__ */ Spicetify.React.createElement("button", { className: "otd-year-more", onClick: () => setVisibleCount((count) => Math.min(count + ARTISTS_PER_EXPANSION, artists.length)) }, t(lang, "moreArtists")), visibleCount > INITIAL_ARTISTS && /* @__PURE__ */ Spicetify.React.createElement("button", { className: "otd-year-less", onClick: () => setVisibleCount(INITIAL_ARTISTS) }, t(lang, "lessArtists"))));
  }

  // src/services/background-selection.ts
  var VISIBLE_ARTISTS = 6;
  var POOL_SIZE = 18;
  var MAX_ALBUMS_PER_ARTIST = 2;
  var NON_ARTIST2 = /^(various artists?|unknown( artist)?|\[?no artist\]?|\[?anonymous\]?|\[?traditional\]?|\[?unknown\]?|\[?data\]?|special purpose.*)$/i;
  function primaryArtist(item) {
    const names = item.artistNames?.length ? item.artistNames : [item.artistName];
    for (const name of names) {
      const trimmed = name?.trim();
      if (trimmed && !NON_ARTIST2.test(trimmed)) return trimmed;
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
  function selectBirthdayBackgroundCandidates(artists, limit = POOL_SIZE) {
    return artists.slice(0, limit).map((artist) => ({
      key: `birthday:${artist.mbid}`,
      artistName: artist.name,
      albums: [],
      year: Number(artist.born.slice(0, 4)),
      photo: () => resolveBirthdayProfile(artist).then((profile) => profile.photoUrl)
    }));
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
      setLayers((current2) => {
        const top = current2[current2.length - 1];
        if (top.url === url) return current2;
        counter.current += 1;
        return [top, { n: counter.current, url, kind }];
      });
      const timer = window.setTimeout(() => setLayers((current2) => current2.slice(-1)), FADE_MS + 250);
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
        const photoTask = (candidate.photo ? candidate.photo().then(async (url) => url && await preloadImage(url) ? url : null) : resolveArtistPhoto(candidate).then(async (photo2) => photo2 && await preloadImage(photo2.url) ? photo2.url : null)).catch(() => null);
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
      const current2 = slotsRef.current;
      if (!current2.length || document.visibilityState === "hidden") return;
      const gen = generation.current;
      tickCount.current += 1;
      const now = tickCount.current;
      const shown = new Set(current2.map((slot) => slot.key));
      const reserve = [];
      states.current.forEach((state, index) => {
        const artist = artists.current[index];
        if (state === "ready" && artist && !shown.has(artist.key)) reserve.push(artist);
      });
      reserve.sort((a, b) => (lastShown.current.get(a.key) ?? -1) - (lastShown.current.get(b.key) ?? -1));
      const next = current2.slice();
      const length = current2.length;
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
  var NO_ITEMS = [];
  var NO_BIRTHDAYS = [];
  var FOLLOW_FILTER_KEY = "on-this-day:only-followed-artists";
  var YEAR_ORDER_KEY = "on-this-day:year-order";
  var FOLLOW_FILTER_BIRTHDAYS_KEY = "on-this-day:only-followed-birthdays";
  var MAX_DAYS_BACK = 7;
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
  function readOnlyFollowedBirthdays() {
    try {
      return localStorage.getItem(FOLLOW_FILTER_BIRTHDAYS_KEY) === "true";
    } catch {
      return false;
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
  function ForwardIcon({ size = 14 }) {
    return /* @__PURE__ */ Spicetify.React.createElement("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ Spicetify.React.createElement("path", { d: "M5 12h14M13 6l6 6-6 6" }));
  }
  function BackIcon({ size = 14 }) {
    return /* @__PURE__ */ Spicetify.React.createElement("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ Spicetify.React.createElement("path", { d: "M19 12H5M11 6l-6 6 6 6" }));
  }
  var AnniversarySection = memo(function AnniversarySection2({ year, items, currentYear, lang, dayKey, sectionRef, onPreview }) {
    const expandedKey = `a:${dayKey}:${year}`;
    const [visibleCount, setVisibleCountState] = useState(() => getExpanded(expandedKey, INITIAL_ALBUMS_PER_YEAR));
    const setVisibleCount = (next) => {
      setVisibleCountState((count) => {
        const value = typeof next === "function" ? next(count) : next;
        setExpanded(expandedKey, value, INITIAL_ALBUMS_PER_YEAR);
        return value;
      });
    };
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
    const [catalog, setCatalog] = useState(null);
    const [dayError, setDayError] = useState(null);
    const [retryNonce, setRetryNonce] = useState(0);
    const [today, setToday] = useState(() => /* @__PURE__ */ new Date());
    const initialView = useMemo(() => {
      const saved = getViewState();
      return { dayOffset: Math.min(saved.dayOffset, MAX_DAYS_BACK), tab: saved.tab, scroll: { ...saved.scroll } };
    }, []);
    const [dayOffset, setDayOffset] = useState(initialView.dayOffset);
    const [tab, setTab] = useState(initialView.tab);
    const [artistsVisited, setArtistsVisited] = useState(initialView.tab === "artists");
    const [birthdays, setBirthdays] = useState(null);
    const [birthdaysError, setBirthdaysError] = useState(null);
    const [birthdaysNonce, setBirthdaysNonce] = useState(0);
    const [onlyFollowedAlbums, setOnlyFollowedAlbums] = useState(readOnlyFollowed);
    const [onlyFollowedBirthdays, setOnlyFollowedBirthdays] = useState(readOnlyFollowedBirthdays);
    const onlyFollowed = tab === "albums" ? onlyFollowedAlbums : onlyFollowedBirthdays;
    const initialFollowed = useMemo(() => onlyFollowedAlbums || onlyFollowedBirthdays ? peekFollowedArtists() : null, []);
    const [followStatus, setFollowStatus] = useState(initialFollowed ? "ready" : "idle");
    const [followedSet, setFollowedSet] = useState(() => initialFollowed ? buildFollowedArtistSet(initialFollowed) : null);
    const [followedCount, setFollowedCount] = useState(() => initialFollowed ? buildFollowedArtistSet(initialFollowed).size : 0);
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
    const [albumVersion, setAlbumVersion] = useState(getAlbumVersionPref);
    const [albumSort, setAlbumSort] = useState(getAlbumSortMode);
    const [sortMenuOpen, setSortMenuOpen] = useState(false);
    const [scoreTick, setScoreTick] = useState(0);
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
    const viewDate = useMemo(
      () => new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOffset),
      [today, dayOffset]
    );
    const monthDay = getTodayKey(viewDate);
    const currentYear = viewDate.getFullYear();
    const dateLabel = new Intl.DateTimeFormat(lang, {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(viewDate);
    const dateLabelShort = new Intl.DateTimeFormat(lang, { day: "numeric", month: "long" }).format(viewDate);
    const items = catalog?.monthDay === monthDay ? catalog.items : NO_ITEMS;
    const error = dayError?.monthDay === monthDay ? dayError.message : "";
    const dayLoading = catalog?.monthDay !== monthDay && !error;
    const state = catalog ? "ready" : error ? "error" : "loading";
    useEffect(() => subscribeAlbumScores(() => setScoreTick((n) => n + 1)), []);
    useEffect(() => {
      if (!settingsOpen && !sortMenuOpen) return;
      const onPointerDown = (event) => {
        const target = event.target;
        if (target?.closest?.(".otd-settings")) return;
        setSettingsOpen(false);
        setSortMenuOpen(false);
      };
      const onKeyDown = (event) => {
        if (event.key === "Escape") {
          setSettingsOpen(false);
          setSortMenuOpen(false);
        }
      };
      document.addEventListener("mousedown", onPointerDown);
      document.addEventListener("keydown", onKeyDown);
      return () => {
        document.removeEventListener("mousedown", onPointerDown);
        document.removeEventListener("keydown", onKeyDown);
      };
    }, [settingsOpen, sortMenuOpen]);
    useEffect(() => {
      const nextMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      const timeout = window.setTimeout(
        () => {
          setCatalog(null);
          setDayError(null);
          setDayOffset(0);
          setViewDayOffset(0);
          setToday(/* @__PURE__ */ new Date());
        },
        Math.max(0, nextMidnight.getTime() - Date.now())
      );
      return () => window.clearTimeout(timeout);
    }, [today]);
    useEffect(() => {
      let cancelled = false;
      setDayError((current2) => current2?.monthDay === monthDay ? null : current2);
      loadDailyCatalog(monthDay).then((loaded) => {
        if (!cancelled) setCatalog({ monthDay, items: loaded.items });
      }).catch((loadError) => {
        if (!cancelled) setDayError({ monthDay, message: loadError instanceof Error ? loadError.message : String(loadError) });
      });
      return () => {
        cancelled = true;
      };
    }, [monthDay, retryNonce]);
    useEffect(() => {
      if (tab !== "artists") return;
      let cancelled = false;
      setBirthdaysError((current2) => current2?.monthDay === monthDay ? null : current2);
      loadBirthdays(monthDay, birthdaysNonce > 0).then((loaded) => {
        if (!cancelled) setBirthdays({ monthDay, items: loaded.items });
      }).catch((loadError) => {
        if (cancelled) return;
        setBirthdaysError({
          monthDay,
          message: loadError instanceof Error ? loadError.message : String(loadError),
          missing: loadError instanceof BirthdaysUnavailableError
        });
      });
      return () => {
        cancelled = true;
      };
    }, [tab, monthDay, birthdaysNonce]);
    function changeDay(next) {
      if (next === dayOffset) return;
      pendingRestore.current = 0;
      setViewDayOffset(next);
      setDayOffset(next);
    }
    function goToPreviousDay() {
      changeDay(Math.min(dayOffset + 1, MAX_DAYS_BACK));
    }
    function goToNextDay() {
      changeDay(Math.max(dayOffset - 1, 0));
    }
    function goToToday() {
      changeDay(0);
    }
    function selectTab(next) {
      if (next === tab) return;
      captureScrollNow();
      pendingRestore.current = getSavedScroll(next);
      if (next === "artists") setArtistsVisited(true);
      setViewTab(next);
      setTab(next);
    }
    const openPreview = useCallback((item, cover) => setPreview({ item, cover }), []);
    function ensureFollowed(force = false) {
      const id = ++followRequest.current;
      setFollowStatus((current2) => current2 === "ready" ? current2 : "loading");
      loadFollowedArtists(force).then((result) => {
        if (id !== followRequest.current) return;
        const nextSet = buildFollowedArtistSet(result.names);
        setFollowedSet(nextSet);
        setFollowedCount(nextSet.size);
        setFollowStatus("ready");
      }).catch(() => {
        if (id === followRequest.current) setFollowStatus("error");
      });
    }
    const followRefreshed = useRef(false);
    useEffect(() => {
      if (!onlyFollowedAlbums && !onlyFollowedBirthdays) return;
      if (followStatus === "idle" || !followRefreshed.current) {
        followRefreshed.current = true;
        ensureFollowed();
      }
    }, [onlyFollowedAlbums, onlyFollowedBirthdays]);
    useEffect(() => () => {
      followRequest.current += 1;
    }, []);
    function persistFollowFilter(key, enabled) {
      try {
        localStorage.setItem(key, String(enabled));
      } catch {
      }
    }
    function handleFollowFab() {
      if (onlyFollowed && followStatus === "error") {
        ensureFollowed(true);
        return;
      }
      const next = !onlyFollowed;
      if (tab === "albums") {
        setOnlyFollowedAlbums(next);
        persistFollowFilter(FOLLOW_FILTER_KEY, next);
      } else {
        setOnlyFollowedBirthdays(next);
        persistFollowFilter(FOLLOW_FILTER_BIRTHDAYS_KEY, next);
      }
      if (next && followStatus !== "ready") ensureFollowed();
    }
    function toggleYearOrder() {
      setYearOrder((current2) => {
        const next = current2 === "desc" ? "asc" : "desc";
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
        if (year === null || year >= currentYear || item.firstReleaseDate.slice(5) !== monthDay) return false;
        if (!normalizeText(item.title) || !hasValidArtistName(item.artistName)) return false;
        return true;
      }).sort(
        (a, b) => Number(b.firstReleaseDate.slice(0, 4)) - Number(a.firstReleaseDate.slice(0, 4)) || (b.ratingVotes ?? 0) - (a.ratingVotes ?? 0) || (b.ratingValue ?? 0) - (a.ratingValue ?? 0) || a.title.localeCompare(b.title)
      );
    }, [items, monthDay, currentYear]);
    const displayedItems = useMemo(() => {
      if (!onlyFollowedAlbums) return anniversaryItems;
      if (followStatus === "error") return anniversaryItems;
      if (followStatus !== "ready" || !followedSet) return [];
      return anniversaryItems.filter(
        (item) => artistIsFollowed(followedSet, item.artistNames?.length ? item.artistNames : [item.artistName])
      );
    }, [anniversaryItems, onlyFollowedAlbums, followStatus, followedSet]);
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
      for (const [, list] of groups) {
        list.sort((a, b) => compareAlbumsBySortMode(a, b, albumSort));
      }
      return groups;
    }, [genreFilteredItems, albumSort, scoreTick]);
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
    const birthdayItemsAll = useMemo(
      () => birthdays?.monthDay === monthDay ? birthdays.items.filter((artist) => hasValidArtistName(artist.name)) : NO_BIRTHDAYS,
      [birthdays, monthDay]
    );
    const birthdaysErr = birthdaysError?.monthDay === monthDay ? birthdaysError : null;
    const birthdaysStatus = birthdaysErr ? birthdaysErr.missing ? "missing" : "error" : birthdays?.monthDay === monthDay ? "ready" : "loading";
    const displayedBirthdays = useMemo(() => {
      let list = birthdayItemsAll;
      if (onlyFollowedBirthdays && followStatus !== "error") {
        if (followStatus !== "ready" || !followedSet) return NO_BIRTHDAYS;
        list = list.filter((artist) => artistIsFollowed(followedSet, [artist.name]));
      }
      if (selectedGenres.length) {
        const selected = new Set(selectedGenres);
        list = list.filter((artist) => classifyMainGenres(artist.genres).some((genre) => selected.has(genre)));
      }
      return list;
    }, [birthdayItemsAll, onlyFollowedBirthdays, followStatus, followedSet, selectedGenres]);
    const backgroundCandidates = useMemo(
      () => selectBackgroundCandidates(genreFilteredItems),
      [genreFilteredItems]
    );
    const birthdayBackgroundCandidates = useMemo(
      () => selectBirthdayBackgroundCandidates(displayedBirthdays),
      [displayedBirthdays]
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
        let current2 = availableYears[0];
        for (const year of availableYears) {
          const el = yearSectionRefs.current.get(year);
          if (el && el.getBoundingClientRect().top <= threshold) current2 = year;
        }
        const target = event?.target;
        if (target && typeof target.scrollTop === "number" && target.scrollTop > 0 && target.scrollTop + target.clientHeight >= target.scrollHeight - 4) {
          current2 = availableYears[availableYears.length - 1];
        }
        setActiveYear(current2);
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
    const pageRef = useRef(null);
    const tabRef = useRef(tab);
    tabRef.current = tab;
    const userIntentAt = useRef(0);
    const pointerDown = useRef(false);
    const restoring = useRef(false);
    const pendingRestore = useRef(initialView.scroll[initialView.tab] > 0 ? initialView.scroll[initialView.tab] : null);
    function captureScrollNow() {
      const scroller = findScroller(pageRef.current);
      if (scroller && !restoring.current) saveScroll(tabRef.current, scroller.scrollTop);
    }
    useEffect(() => {
      const mark = () => {
        userIntentAt.current = Date.now();
      };
      const down = () => {
        pointerDown.current = true;
        mark();
      };
      const up = () => {
        pointerDown.current = false;
      };
      const onScroll = (event) => {
        const scroller = event.target;
        const page = pageRef.current;
        if (restoring.current || !page || !(scroller instanceof HTMLElement) || !scroller.contains(page)) return;
        if (!pointerDown.current && Date.now() - userIntentAt.current > 1500) return;
        saveScroll(tabRef.current, scroller.scrollTop);
      };
      const options = { capture: true, passive: true };
      for (const name of ["wheel", "touchstart", "keydown"]) window.addEventListener(name, mark, options);
      window.addEventListener("pointerdown", down, options);
      window.addEventListener("pointerup", up, options);
      window.addEventListener("pointercancel", up, options);
      window.addEventListener("scroll", onScroll, options);
      registerScrollCapture(captureScrollNow);
      return () => {
        for (const name of ["wheel", "touchstart", "keydown"]) window.removeEventListener(name, mark, options);
        window.removeEventListener("pointerdown", down, options);
        window.removeEventListener("pointerup", up, options);
        window.removeEventListener("pointercancel", up, options);
        window.removeEventListener("scroll", onScroll, options);
        registerScrollCapture(null);
      };
    }, []);
    const contentReady = tab === "albums" ? !dayLoading && !error && !(onlyFollowedAlbums && followStatus === "loading") : birthdaysStatus === "ready" && !(onlyFollowedBirthdays && followStatus === "loading");
    useEffect(() => {
      const target = pendingRestore.current;
      if (target === null || !contentReady) return;
      pendingRestore.current = null;
      restoring.current = true;
      let frame = 0;
      let tries = 0;
      let stable = 0;
      const finish = () => {
        window.cancelAnimationFrame(frame);
        restoring.current = false;
        for (const name of ["wheel", "touchstart", "keydown"]) window.removeEventListener(name, abort, true);
      };
      const abort = () => {
        finish();
      };
      for (const name of ["wheel", "touchstart", "keydown"]) window.addEventListener(name, abort, true);
      const step = () => {
        const scroller = findScroller(pageRef.current);
        if (scroller) {
          if (Math.abs(scroller.scrollTop - target) > 2) {
            stable = 0;
            scroller.scrollTop = target;
          } else {
            stable += 1;
          }
        }
        tries += 1;
        if (stable >= 4 || tries > 180) {
          finish();
          return;
        }
        frame = window.requestAnimationFrame(step);
      };
      frame = window.requestAnimationFrame(step);
      return finish;
    }, [contentReady, tab, monthDay]);
    useEffect(() => {
      resetLowPriorityCovers();
      if (!orderedGroups.length && !displayedItems.length) return;
      const seen = /* @__PURE__ */ new Set();
      const order = [];
      const visibleItems = [];
      const push = (item, visible = false) => {
        if (!seen.has(item.mbid)) {
          seen.add(item.mbid);
          order.push(item.mbid);
          if (visible) visibleItems.push(item);
        }
      };
      for (const [, list] of orderedGroups) for (const item of list.slice(0, INITIAL_ALBUMS_PER_YEAR)) push(item, true);
      for (const [, list] of orderedGroups) for (const item of list.slice(INITIAL_ALBUMS_PER_YEAR, INITIAL_ALBUMS_PER_YEAR + ALBUMS_PER_EXPANSION)) push(item);
      for (const item of genreFilteredItems) push(item);
      for (const item of displayedItems) push(item);
      prefetchCovers(order.slice(0, 140));
      for (const item of visibleItems.slice(0, 36)) {
        if (!peekCoverSrc(item.mbid) && !peekNoCover(item.mbid) && isCaaMissing(item.mbid)) {
          void resolveAlbumCover(item, true);
        }
      }
    }, [orderedGroups, genreFilteredItems, displayedItems]);
    function scrollToYear(year) {
      userIntentAt.current = Date.now();
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
      } }, /* @__PURE__ */ Spicetify.React.createElement("section", { className: "otd-shell" }, /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-eyebrow" }, t(lang, "eyebrow")), /* @__PURE__ */ Spicetify.React.createElement("h1", null, t(lang, "errorTitle")), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-message" }, t(lang, "errorMsg", { date: dateLabel })), /* @__PURE__ */ Spicetify.React.createElement("pre", { className: "otd-error" }, error), /* @__PURE__ */ Spicetify.React.createElement("button", { type: "button", className: "otd-retry-btn", onClick: () => setRetryNonce((current2) => current2 + 1) }, t(lang, "retry")), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-hint" }, t(lang, "errorHint"))));
    }
    return /* @__PURE__ */ Spicetify.React.createElement("main", { ref: pageRef, className: "otd-page", onMouseMove: handlePageMouseMove, onMouseLeave: () => {
      setTooltip(null);
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
      scheduleNavHide();
    } }, /* @__PURE__ */ Spicetify.React.createElement(DynamicBackground, { candidates: tab === "albums" ? backgroundCandidates : birthdayBackgroundCandidates }), /* @__PURE__ */ Spicetify.React.createElement(FollowFab, { state: fabState, count: followedCount, lang, onToggle: handleFollowFab }), tab === "albums" && createPortal(yearNavigation, document.body), /* @__PURE__ */ Spicetify.React.createElement("section", { className: "otd-shell", onMouseMove: handlePageMouseMove, onMouseLeave: () => {
      setTooltip(null);
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
      scheduleNavHide();
    } }, /* @__PURE__ */ Spicetify.React.createElement("header", { className: "otd-heading" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-heading-left" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-app-icon", "aria-hidden": "true" }, /* @__PURE__ */ Spicetify.React.createElement(AppIcon, { size: 26 })), /* @__PURE__ */ Spicetify.React.createElement("div", null, /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-eyebrow" }, t(lang, "eyebrow")), /* @__PURE__ */ Spicetify.React.createElement("h1", null, t(lang, "title")), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-subtitle" }, tab === "albums" ? t(lang, "subtitle", { date: dateLabel }) : t(lang, "subtitleBirthdays", { date: dateLabelShort })))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-count-group" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-count" }, tab === "albums" ? t(lang, "albumsThisDay", { count: genreFilteredItems.length.toLocaleString(lang) }) : t(lang, "birthdaysThisDay", { count: displayedBirthdays.length.toLocaleString(lang) })), tab === "albums" && selectedGenres.length > 0 && /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-count-filter" }, selectedGenres.map((g) => {
      const genre = MAIN_GENRES.find((x) => x.id === g);
      const count = genreCounts.get(g) ?? 0;
      return `${count.toLocaleString(lang)} ${genre?.label ?? g}`;
    }).join(" · ")), /* @__PURE__ */ Spicetify.React.createElement(UpdateBadge, { lang }), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-header-controls" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-settings" }, /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        type: "button",
        className: `otd-settings-trigger${settingsOpen ? " is-open" : ""}`,
        "aria-expanded": settingsOpen,
        "aria-haspopup": "dialog",
        "aria-label": t(lang, "settingsBtn"),
        title: t(lang, "settingsBtn"),
        onClick: () => {
          setSortMenuOpen(false);
          setSettingsOpen((open) => !open);
        }
      },
      /* @__PURE__ */ Spicetify.React.createElement(GearIcon, { size: 16 }),
      /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-settings-code" }, t(lang, "settingsBtn")),
      /* @__PURE__ */ Spicetify.React.createElement("span", { className: `otd-explicit-pill${albumVersion === "explicit" ? " is-explicit" : " is-clean"}` }, albumVersion === "explicit" ? "E" : "C"),
      /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-settings-lang-pill" }, lang.toUpperCase()),
      /* @__PURE__ */ Spicetify.React.createElement(ChevronIcon, { size: 13 })
    ), settingsOpen && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-settings-menu otd-settings-panel", role: "dialog", "aria-label": t(lang, "settingsBtn") }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-settings-section" }, /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-settings-title" }, t(lang, "albumVersionTitle")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-settings-options" }, [
      {
        id: "explicit",
        badge: "E",
        label: t(lang, "albumVersionExplicit"),
        desc: t(lang, "albumVersionExplicitDesc")
      },
      {
        id: "clean",
        badge: "C",
        label: t(lang, "albumVersionClean"),
        desc: t(lang, "albumVersionCleanDesc")
      }
    ].map((opt) => {
      const active2 = albumVersion === opt.id;
      return /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          type: "button",
          key: opt.id,
          role: "option",
          "aria-selected": active2,
          className: `otd-settings-option${active2 ? " is-active" : ""}`,
          onClick: () => {
            setAlbumVersionPref(opt.id);
            setAlbumVersion(opt.id);
          }
        },
        /* @__PURE__ */ Spicetify.React.createElement("span", { className: `otd-settings-badge${opt.id === "explicit" ? " is-explicit" : ""}` }, opt.badge),
        /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-settings-name otd-settings-name--stack" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-settings-option-label" }, opt.label), /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-settings-option-desc" }, opt.desc)),
        active2 && /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-settings-check" }, /* @__PURE__ */ Spicetify.React.createElement(CheckIcon, { size: 14 }))
      );
    })), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-settings-hint" }, t(lang, "albumVersionHint"))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-settings-divider" }), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-settings-section" }, /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-settings-title" }, t(lang, "changeLanguage")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-settings-options" }, Object.entries(LANGUAGES).map(([code, info]) => {
      const active2 = code === lang;
      return /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          type: "button",
          key: code,
          role: "option",
          "aria-selected": active2,
          className: `otd-settings-option${active2 ? " is-active" : ""}`,
          onClick: () => {
            setLang(code);
            setLangState(code);
          }
        },
        /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-settings-badge" }, code.toUpperCase()),
        /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-settings-name" }, info.native),
        active2 && /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-settings-check" }, /* @__PURE__ */ Spicetify.React.createElement(CheckIcon, { size: 14 }))
      );
    }))))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-day-nav" }, /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        type: "button",
        className: "otd-prev-day",
        onClick: goToPreviousDay,
        disabled: dayOffset >= MAX_DAYS_BACK,
        title: dayOffset >= MAX_DAYS_BACK ? t(lang, "previousDayLimit", { days: MAX_DAYS_BACK }) : t(lang, "previousDayTitle")
      },
      /* @__PURE__ */ Spicetify.React.createElement(BackIcon, { size: 14 }),
      /* @__PURE__ */ Spicetify.React.createElement("span", null, t(lang, "previousDay"))
    ), dayOffset > 0 && /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        type: "button",
        className: "otd-prev-day otd-next-day",
        onClick: goToNextDay,
        title: t(lang, "nextDayTitle")
      },
      /* @__PURE__ */ Spicetify.React.createElement("span", null, t(lang, "nextDay")),
      /* @__PURE__ */ Spicetify.React.createElement(ForwardIcon, { size: 14 })
    ), dayOffset > 1 && /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        type: "button",
        className: "otd-prev-day otd-today-btn",
        onClick: goToToday,
        title: t(lang, "backToTodayTitle")
      },
      /* @__PURE__ */ Spicetify.React.createElement("span", null, t(lang, "backToToday"))
    ))))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-tabs", role: "tablist", "aria-label": t(lang, "tabsLabel") }, ["albums", "artists"].map((id) => /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        key: id,
        type: "button",
        role: "tab",
        id: `otd-tab-${id}`,
        "aria-selected": tab === id,
        className: `otd-tab${tab === id ? " is-active" : ""}`,
        onClick: () => selectTab(id)
      },
      t(lang, id === "albums" ? "tabAlbums" : "tabArtists")
    ))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-genre-filter" }, /* @__PURE__ */ Spicetify.React.createElement(
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
    ), selectedGenres.length > 0 && /* @__PURE__ */ Spicetify.React.createElement("button", { className: "otd-genre-clear", onClick: () => setSelectedGenres([]) }, t(lang, "clearFilters")), tab === "albums" && /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, /* @__PURE__ */ Spicetify.React.createElement(
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
    ), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-settings otd-sort-wrap" }, /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        type: "button",
        className: `otd-order-btn otd-sort-trigger${sortMenuOpen ? " is-open" : ""}`,
        "aria-expanded": sortMenuOpen,
        "aria-haspopup": "listbox",
        "aria-label": t(lang, "sortAlbumsLabel"),
        title: t(lang, "sortAlbumsLabel"),
        onClick: () => {
          setSettingsOpen(false);
          setSortMenuOpen((open) => !open);
        }
      },
      /* @__PURE__ */ Spicetify.React.createElement(SortIcon, { size: 14 }),
      /* @__PURE__ */ Spicetify.React.createElement("span", null, t(
        lang,
        albumSort === "best" ? "sortBestShort" : albumSort === "user" ? "sortUserShort" : albumSort === "critic" ? "sortCriticShort" : "sortTitleShort"
      )),
      /* @__PURE__ */ Spicetify.React.createElement(ChevronIcon, { size: 12 })
    ), sortMenuOpen && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-settings-menu otd-sort-menu", role: "listbox", "aria-label": t(lang, "sortAlbumsLabel") }, /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-settings-title" }, t(lang, "sortAlbumsLabel")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-settings-options" }, [
      { id: "best", badge: "★", label: t(lang, "sortBest") },
      { id: "user", badge: "U", label: t(lang, "sortUser") },
      { id: "critic", badge: "C", label: t(lang, "sortCritic") },
      { id: "title", badge: "AZ", label: t(lang, "sortTitle") }
    ].map((opt) => {
      const active2 = albumSort === opt.id;
      return /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          type: "button",
          key: opt.id,
          role: "option",
          "aria-selected": active2,
          className: `otd-settings-option${active2 ? " is-active" : ""}`,
          onClick: () => {
            setAlbumSortMode(opt.id);
            setAlbumSort(opt.id);
            setSortMenuOpen(false);
          }
        },
        /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-settings-badge" }, opt.badge),
        /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-settings-name" }, opt.label),
        active2 && /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-settings-check" }, /* @__PURE__ */ Spicetify.React.createElement(CheckIcon, { size: 14 }))
      );
    }))))), genrePickerOpen && /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-backdrop", onClick: () => setGenrePickerOpen(false) }), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-genre-menu", id: "otd-genre-options", role: "group", "aria-label": t(lang, "genreFilter") }, /* @__PURE__ */ Spicetify.React.createElement(
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
            setSelectedGenres((current2) => {
              if (checked) return current2.filter((id) => id !== genre.id);
              if (current2.length < MAX_SELECTED_GENRES) return [...current2, genre.id];
              return current2;
            });
          }
        },
        /* @__PURE__ */ Spicetify.React.createElement("span", { className: "otd-genre-chip-check" }, checked ? "✓" : ""),
        /* @__PURE__ */ Spicetify.React.createElement("span", null, genre.label)
      );
    })), selectedGenres.length === MAX_SELECTED_GENRES && /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-genre-limit" }, t(lang, "limitReached"))))), artistsVisited && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-tab-panel", hidden: tab !== "artists" }, onlyFollowedBirthdays && followStatus === "loading" ? /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-empty" }, t(lang, "loadingFollowed")) : /* @__PURE__ */ Spicetify.React.createElement(
      BirthdaysView,
      {
        key: monthDay,
        dayKey: monthDay,
        lang,
        status: birthdaysStatus,
        artists: displayedBirthdays,
        totalBeforeFilters: birthdayItemsAll.length,
        hasGenreFilter: selectedGenres.length > 0,
        onlyFollowedActive: onlyFollowedBirthdays && followStatus === "ready",
        dateLabel: dateLabelShort,
        viewYear: currentYear,
        errorMessage: birthdaysErr?.message ?? "",
        onRetry: () => setBirthdaysNonce((current2) => current2 + 1)
      }
    )), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-tab-panel", hidden: tab !== "albums" }, dayLoading ? /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-empty" }, t(lang, "loading", { date: dateLabel })) : error ? /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-empty" }, /* @__PURE__ */ Spicetify.React.createElement("p", null, t(lang, "errorMsg", { date: dateLabel })), /* @__PURE__ */ Spicetify.React.createElement("pre", { className: "otd-error" }, error), /* @__PURE__ */ Spicetify.React.createElement("button", { type: "button", className: "otd-retry-btn", onClick: () => setRetryNonce((current2) => current2 + 1) }, t(lang, "retry"))) : onlyFollowedAlbums && followStatus === "loading" ? /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-empty" }, t(lang, "loadingFollowed")) : anniversaryGroups.size ? orderedGroups.map(([year, yearItems]) => /* @__PURE__ */ Spicetify.React.createElement(
      AnniversarySection,
      {
        key: year,
        year,
        items: yearItems,
        currentYear,
        lang,
        dayKey: monthDay,
        onPreview: openPreview,
        sectionRef: getSectionRef(year)
      }
    )) : /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-empty" }, selectedGenres.length > 0 ? !items.some((item) => item.genres?.length) ? t(lang, "emptyGenresMsg") : t(lang, "emptyNoMatch") : onlyFollowedAlbums && followStatus === "ready" ? t(lang, "followedEmpty") : t(lang, "emptyNone"))), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "otd-attribution" }, t(lang, tab === "albums" ? "attribution" : "attributionBirthdays"))), preview && createPortal(
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
              onError: () => setPreview((current2) => current2 ? { ...current2, cover: null } : null)
            }
          ) : /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-cover-placeholder", "aria-hidden": "true" }, "♫")),
          /* @__PURE__ */ Spicetify.React.createElement("h2", null, preview.item.title),
          /* @__PURE__ */ Spicetify.React.createElement("p", null, preview.item.artistName, " · ", preview.item.firstReleaseDate.slice(0, 4)),
          /* @__PURE__ */ Spicetify.React.createElement("div", { className: "otd-cover-preview-actions" }, /* @__PURE__ */ Spicetify.React.createElement(
            "button",
            {
              type: "button",
              className: "otd-preview-play-btn",
              onClick: () => {
                void playAlbumInSpotify(preview.item);
              }
            },
            /* @__PURE__ */ Spicetify.React.createElement(PlayIcon, { size: 15 }),
            /* @__PURE__ */ Spicetify.React.createElement("span", null, t(lang, "playAlbumShort"))
          ), /* @__PURE__ */ Spicetify.React.createElement(
            "button",
            {
              type: "button",
              className: "otd-preview-open-btn",
              onClick: () => {
                const target = preview.item;
                setPreview(null);
                beforeLeavingApp();
                void openAlbumInSpotify(target);
              }
            },
            /* @__PURE__ */ Spicetify.React.createElement("span", null, t(lang, "openAlbumOnSpotifyShort"))
          ))
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
