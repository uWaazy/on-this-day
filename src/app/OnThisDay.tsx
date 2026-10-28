import { React, createPortal, useEffect, useMemo, useRef, useState, memo, useCallback } from "../react";
import { loadDailyCatalog, type MusicBrainzCatalogItem } from "../api/catalog";
import { classifyMainGenres, MAIN_GENRES } from "../api/genres";
import { artistIsFollowed, loadFollowedArtists, normalizeArtistName, peekFollowedArtists } from "../services/followed-artists";
import { FollowFab, type FollowFabState } from "../components/FollowFab";
import { UpdateBadge } from "../components/UpdateBadge";
import { AppIcon, CheckIcon, ChevronIcon, GlobeIcon } from "../components/AppIcon";
import { AlbumCard } from "../components/AlbumCard";
import DynamicBackground from "../components/DynamicBackground";
import { selectBackgroundCandidates } from "../services/background-selection";
import { Lang, LANGUAGES, getLang, setLang, t } from "../i18n";

const INITIAL_ALBUMS_PER_YEAR = 5;
const ALBUMS_PER_EXPANSION = 5;
const MAX_SELECTED_GENRES = 5;

type LoadState = "loading" | "ready" | "error";
type FollowStatus = "idle" | "loading" | "ready" | "error";
type YearOrder = "desc" | "asc";
const FOLLOW_FILTER_KEY = "on-this-day:only-followed-artists";
const YEAR_ORDER_KEY = "on-this-day:year-order";

/** Primeira abertura (nada salvo): começa só com os artistas que o usuário segue. Depois, respeita a última escolha. */
function readOnlyFollowed(): boolean {
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

function readYearOrder(): YearOrder {
  try { return localStorage.getItem(YEAR_ORDER_KEY) === "asc" ? "asc" : "desc"; } catch { return "desc"; }
}

function getTodayKey(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

function getAnniversaryYear(date: string): number | null {
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(date);
  return match ? Number(match[1]) : null;
}

type AnniversarySectionProps = {
  year: number;
  items: MusicBrainzCatalogItem[];
  currentYear: number;
  lang: Lang;
  sectionRef: (el: HTMLElement | null) => void;
  onPreview: (item: MusicBrainzCatalogItem, cover: string | null) => void;
};

const AnniversarySection = memo(function AnniversarySection({ year, items, currentYear, lang, sectionRef, onPreview }: AnniversarySectionProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_ALBUMS_PER_YEAR);
  const visibleItems = items.slice(0, visibleCount);
  const anniversaryAge = currentYear - year;
  const isOne = anniversaryAge === 1;

  return (
    <section className="otd-year-section" ref={sectionRef} aria-label={t(lang, isOne ? "yearAgo" : "yearsAgo", { age: anniversaryAge, year })}>
      <header className="otd-year-heading">
        <div>
          <h2>{t(lang, isOne ? "yearAgo" : "yearsAgo", { age: anniversaryAge, year })} <span>· {year}</span></h2>
          <p>{t(lang, "albumsCount", { count: items.length.toLocaleString(lang) })}</p>
        </div>
      </header>
      <div className="otd-album-grid">
        {visibleItems.map((item) => (
          <AlbumCard key={item.mbid} item={item} lang={lang} onPreview={onPreview} />
        ))}
      </div>
      <div className="otd-year-actions">
        {visibleCount < items.length && (
          <button
            className="otd-year-more"
            onClick={() => setVisibleCount((count) => Math.min(count + ALBUMS_PER_EXPANSION, items.length))}
          >
            {t(lang, "moreAlbums")}
          </button>
        )}
        {visibleCount > INITIAL_ALBUMS_PER_YEAR && (
          <button className="otd-year-less" onClick={() => setVisibleCount(INITIAL_ALBUMS_PER_YEAR)}>
            {t(lang, "lessAlbums")}
          </button>
        )}
      </div>
    </section>
  );
});

export function OnThisDay() {
  const [lang, setLangState] = useState<Lang>(getLang);
  const [items, setItems] = useState<MusicBrainzCatalogItem[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [today, setToday] = useState(() => new Date());
  const [onlyFollowed, setOnlyFollowed] = useState(readOnlyFollowed);
  // Se já existe uma lista salva, o filtro de seguidos aparece pronto na hora (atualiza em segundo plano).
  const initialFollowed = useMemo(() => (readOnlyFollowed() ? peekFollowedArtists() : null), []);
  const [followStatus, setFollowStatus] = useState<FollowStatus>(initialFollowed ? "ready" : "idle");
  const [followedSet, setFollowedSet] = useState<Set<string> | null>(() => (initialFollowed ? new Set(initialFollowed.map(normalizeArtistName)) : null));
  const [followedCount, setFollowedCount] = useState(initialFollowed?.length ?? 0);
  const [yearOrder, setYearOrder] = useState<YearOrder>(readYearOrder);
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const followRequest = useRef(0);
  const previewCloseRef = useRef<HTMLButtonElement | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("on-this-day:selected-genres");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((g) => typeof g === "string").slice(0, MAX_SELECTED_GENRES);
    } catch { return []; }
  });
  const [genrePickerOpen, setGenrePickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preview, setPreview] = useState<{ item: MusicBrainzCatalogItem; cover: string | null } | null>(null);
  const [navHover, setNavHover] = useState(false);
  const [tooltip, setTooltip] = useState<{ text: string; top: number; left: number } | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);
  const yearSectionRefs = useRef<Map<number, HTMLElement>>(new Map());
  // Callbacks de ref estáveis por ano (um callback novo a cada render desfaz o memo e refaz o ref).
  const sectionRefCallbacks = useRef(new Map<number, (el: HTMLElement | null) => void>());
  const getSectionRef = (year: number) => {
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
    year: "numeric",
  }).format(today);

  useEffect(() => {
    const nextMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const timeout = window.setTimeout(
      () => {
        setItems([]);
        setError("");
        setState("loading");
        setToday(new Date());
      },
      Math.max(0, nextMidnight.getTime() - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [today]);

  useEffect(() => {
    let cancelled = false;

    loadDailyCatalog(monthDay)
      .then((catalog) => {
        if (!cancelled) {
          setItems(catalog.items);
          setState("ready");
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
          setState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [monthDay]);

  const openPreview = useCallback((item: MusicBrainzCatalogItem, cover: string | null) => setPreview({ item, cover }), []);

  function ensureFollowed(force = false) {
    const id = ++followRequest.current;
    setFollowStatus((current) => (current === "ready" ? current : "loading"));
    loadFollowedArtists(force)
      .then((result) => {
        if (id !== followRequest.current) return;
        setFollowedSet(new Set(result.names.map(normalizeArtistName)));
        setFollowedCount(result.names.length);
        setFollowStatus("ready");
      })
      .catch(() => {
        if (id === followRequest.current) setFollowStatus("error");
      });
  }

  // Filtro "só artistas que eu sigo": restaura a escolha anterior e carrega a lista sem login extra.
  useEffect(() => {
    if (onlyFollowed) ensureFollowed();
    return () => { followRequest.current += 1; };
  }, []);

  function persistFollowFilter(enabled: boolean) {
    try { localStorage.setItem(FOLLOW_FILTER_KEY, String(enabled)); } catch { /* vale só para esta sessão */ }
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
      const next: YearOrder = current === "desc" ? "asc" : "desc";
      try { localStorage.setItem(YEAR_ORDER_KEY, next); } catch { /* best effort */ }
      return next;
    });
  }

  const fabState: FollowFabState = !onlyFollowed ? "off" : followStatus === "error" ? "error" : followStatus === "ready" ? "on" : "loading";

  const anniversaryItems = useMemo(() => {
    return items.filter((item) => {
      const year = getAnniversaryYear(item.firstReleaseDate);
      return year !== null && year < currentYear && item.firstReleaseDate.slice(5) === monthDay;
    }).sort((a, b) =>
      Number(b.firstReleaseDate.slice(0, 4)) - Number(a.firstReleaseDate.slice(0, 4)) ||
      (b.ratingVotes ?? 0) - (a.ratingVotes ?? 0) ||
      (b.ratingValue ?? 0) - (a.ratingValue ?? 0) ||
      a.title.localeCompare(b.title),
    );
  }, [items, monthDay, currentYear]);

  const displayedItems = useMemo(() => {
    if (!onlyFollowed) return anniversaryItems;
    if (followStatus === "error") return anniversaryItems; // sem a lista, não esconde tudo
    if (followStatus !== "ready" || !followedSet) return [];
    return anniversaryItems.filter((item) =>
      artistIsFollowed(followedSet, item.artistNames?.length ? item.artistNames : [item.artistName]),
    );
  }, [anniversaryItems, onlyFollowed, followStatus, followedSet]);

  const genreFilteredItems = useMemo(() => {
    if (!selectedGenres.length) return displayedItems;
    const selected = new Set(selectedGenres);
    return displayedItems.filter((item) =>
      classifyMainGenres(item.genres).some((genre) => selected.has(genre)),
    );
  }, [displayedItems, selectedGenres]);

  const anniversaryGroups = useMemo(() => {
    const groups = new Map<number, MusicBrainzCatalogItem[]>();
    for (const item of genreFilteredItems) {
      const year = getAnniversaryYear(item.firstReleaseDate);
      if (year === null) continue;
      const group = groups.get(year) ?? [];
      group.push(item);
      groups.set(year, group);
    }
    return groups;
  }, [genreFilteredItems]);

  // Per-genre counts
  const genreCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const genreId of selectedGenres) {
      const count = displayedItems.filter((item) =>
        classifyMainGenres(item.genres).includes(genreId),
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

  // Artistas do fundo: derivados dos MESMOS álbuns exibidos (após filtros de gênero / seguidos).
  const backgroundCandidates = useMemo(
    () => selectBackgroundCandidates(genreFilteredItems),
    [genreFilteredItems],
  );

  useEffect(() => {
    try {
      localStorage.setItem("on-this-day:selected-genres", JSON.stringify(selectedGenres));
    } catch { /* best effort */ }
  }, [selectedGenres]);

  useEffect(() => {
    return () => {
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
      if (navHideTimer.current) clearTimeout(navHideTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!preview) return;
    // preventScroll: focar o botão não pode rolar a página de volta ao topo.
    previewCloseRef.current?.focus({ preventScroll: true });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [preview]);

  const orderedGroups = useMemo(() => {
    const entries = [...anniversaryGroups.entries()];
    entries.sort((a, b) => (yearOrder === "desc" ? b[0] - a[0] : a[0] - b[0]));
    return entries;
  }, [anniversaryGroups, yearOrder]);

  const availableYears = useMemo(() => orderedGroups.map(([year]) => year), [orderedGroups]);

  // Destaca na barra lateral o ano da seção que está no topo da área visível (e o último ao chegar no fim).
  useEffect(() => {
    if (!availableYears.length) return;
    let frame = 0;
    const update = (event?: Event) => {
      frame = 0;
      const threshold = window.innerHeight * 0.3;
      let current = availableYears[0];
      for (const year of availableYears) {
        const el = yearSectionRefs.current.get(year);
        if (el && el.getBoundingClientRect().top <= threshold) current = year;
      }
      const target = event?.target as HTMLElement | undefined;
      if (target && typeof target.scrollTop === "number" && target.scrollTop > 0 && target.scrollTop + target.clientHeight >= target.scrollHeight - 4) {
        current = availableYears[availableYears.length - 1];
      }
      setActiveYear(current);
    };
    const onScroll = (event: Event) => {
      if (!frame) frame = window.requestAnimationFrame(() => update(event));
    };
    update();
    // `capture` pega a rolagem de qualquer contêiner (o Spotify rola dentro de um elemento próprio).
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [availableYears.join(",")]);

  function scrollToYear(year: number) {
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

  function handlePageMouseMove(event: { clientX: number; clientY: number }) {
    const nearActivationZone = event.clientX <= 34;
    const navRect = navRef.current?.getBoundingClientRect();
    const insideNav = !!navRect && event.clientX >= navRect.left && event.clientX <= navRect.right &&
      event.clientY >= navRect.top && event.clientY <= navRect.bottom;

    if (nearActivationZone || insideNav) {
      clearNavHideTimer();
      setNavHover(true);
      return;
    }

    if (navHover) {
      scheduleNavHide();
    }
  }

  function showYearTooltip(event: { currentTarget: HTMLButtonElement }, age: number) {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    const target = event.currentTarget;

    tooltipTimer.current = window.setTimeout(() => {
      const rect = target.getBoundingClientRect();
      const tooltipWidth = 150;
      const tooltipPadding = 12;
      const preferredLeft = rect.right + 12;
      const shouldPlaceLeft = preferredLeft + tooltipWidth > window.innerWidth - tooltipPadding;
      const left = shouldPlaceLeft ? Math.max(tooltipPadding, rect.left - tooltipWidth - 12) : preferredLeft;
      const top = Math.min(Math.max(rect.top + (rect.height / 2), tooltipPadding), window.innerHeight - tooltipPadding);

      setTooltip({
        text: t(lang, age === 1 ? "yearTooltip" : "yearsTooltip", { age }),
        top,
        left,
      });
    }, 800);
  }

  const yearNavigation = (
    <>
      <div
        ref={navRef}
        className={`otd-year-nav${navHover ? " is-visible" : ""}`}
        onMouseEnter={() => {
          clearNavHideTimer();
          setNavHover(true);
        }}
        onMouseLeave={() => {
          setTooltip(null);
          if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
          scheduleNavHide();
        }}
      >
        <div className="otd-year-nav-inner">
          <div className="otd-year-nav-head">{t(lang, "navYears")}</div>
          <div className="otd-year-nav-list">
            {availableYears.map((year) => {
              const age = currentYear - year;
              return (
                <button
                  key={year}
                  className={`otd-year-nav-item${activeYear === year ? " is-active" : ""}`}
                  aria-current={activeYear === year ? "true" : undefined}
                  onClick={() => { setActiveYear(year); scrollToYear(year); }}
                  onMouseEnter={(event: { currentTarget: HTMLButtonElement }) => {
                    showYearTooltip(event, age);
                  }}
                  onMouseLeave={() => {
                    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
                    setTooltip(null);
                  }}
                >
                  <span className="otd-year-nav-year">{year}</span>
                  <span className="otd-year-nav-age">{t(lang, age === 1 ? "yearShort" : "yearsShort", { age })}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {tooltip && (
        <div
          className="otd-year-nav-tooltip-fixed"
          style={{ top: tooltip.top, left: tooltip.left }}
        >
          {tooltip.text}
        </div>
      )}
    </>
  );

  if (state === "loading") {
    return (
      <main className="otd-page" onMouseMove={handlePageMouseMove} onMouseLeave={() => {
        setTooltip(null);
        if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
        scheduleNavHide();
      }}>
        <section className="otd-shell">
          <p className="otd-eyebrow">{t(lang, "eyebrow")}</p>
          <h1>{t(lang, "title")}</h1>
          <p className="otd-message">{t(lang, "loading", { date: dateLabel })}</p>
        </section>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="otd-page" onMouseMove={handlePageMouseMove} onMouseLeave={() => {
        setTooltip(null);
        if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
        scheduleNavHide();
      }}>
        <section className="otd-shell">
          <p className="otd-eyebrow">{t(lang, "eyebrow")}</p>
          <h1>{t(lang, "errorTitle")}</h1>
          <p className="otd-message">{t(lang, "errorMsg", { date: dateLabel })}</p>
          <pre className="otd-error">{error}</pre>
          <p className="otd-hint">{t(lang, "errorHint")}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="otd-page" onMouseMove={handlePageMouseMove} onMouseLeave={() => {
      setTooltip(null);
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
      scheduleNavHide();
    }}>
      <DynamicBackground candidates={backgroundCandidates} />
      <FollowFab state={fabState} count={followedCount} lang={lang} onToggle={handleFollowFab} />
      {createPortal(yearNavigation, document.body)}

      <section className="otd-shell" onMouseMove={handlePageMouseMove} onMouseLeave={() => {
        setTooltip(null);
        if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
        scheduleNavHide();
      }}>
        <header className="otd-heading">
          <div className="otd-heading-left">
            <div className="otd-app-icon" aria-hidden="true">
              <AppIcon size={26} />
            </div>
            <div>
              <p className="otd-eyebrow">{t(lang, "eyebrow")}</p>
              <h1>{t(lang, "title")}</h1>
              <p className="otd-subtitle">{t(lang, "subtitle", { date: dateLabel })}</p>
            </div>
          </div>
          <div className="otd-count-group">
            <span className="otd-count">{t(lang, "albumsThisDay", { count: genreFilteredItems.length.toLocaleString(lang) })}</span>
            {selectedGenres.length > 0 && (
              <span className="otd-count-filter">
                {selectedGenres.map((g) => {
                  const genre = MAIN_GENRES.find((x) => x.id === g);
                  const count = genreCounts.get(g) ?? 0;
                  return `${count.toLocaleString(lang)} ${genre?.label ?? g}`;
                }).join(" · ")}
              </span>
            )}
            <UpdateBadge lang={lang} />
            <div className="otd-settings">
              <button
                className={`otd-settings-trigger${settingsOpen ? " is-open" : ""}`}
                aria-expanded={settingsOpen}
                aria-haspopup="listbox"
                aria-label={t(lang, "changeLanguage")}
                title={t(lang, "changeLanguage")}
                onClick={() => setSettingsOpen((open) => !open)}
              >
                <GlobeIcon size={16} />
                <span className="otd-settings-code">{lang.toUpperCase()}</span>
                <ChevronIcon size={13} />
              </button>
              {settingsOpen && (
                <div className="otd-settings-menu" role="listbox">
                  <p className="otd-settings-title">{t(lang, "changeLanguage")}</p>
                  <div className="otd-settings-options">
                    {Object.entries(LANGUAGES).map(([code, info]) => {
                      const active = code === lang;
                      return (
                        <button
                          key={code}
                          role="option"
                          aria-selected={active}
                          className={`otd-settings-option${active ? " is-active" : ""}`}
                          onClick={() => {
                            setLang(code as Lang);
                            setLangState(code as Lang);
                            setSettingsOpen(false);
                          }}
                        >
                          <span className="otd-settings-badge">{code.toUpperCase()}</span>
                          <span className="otd-settings-name">{info.native}</span>
                          {active && <span className="otd-settings-check"><CheckIcon size={14} /></span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="otd-genre-filter">
          <button
            type="button"
            className="otd-genre-trigger"
            aria-expanded={genrePickerOpen}
            aria-controls="otd-genre-options"
            onClick={() => setGenrePickerOpen((open) => !open)}
          >
            {t(lang, "genreFilter")} <span>{selectedGenres.length}/{MAX_SELECTED_GENRES}</span>
          </button>
          {selectedGenres.length > 0 && (
            <button className="otd-genre-clear" onClick={() => setSelectedGenres([])}>
              {t(lang, "clearFilters")}
            </button>
          )}
          <button
            type="button"
            className="otd-order-btn"
            onClick={toggleYearOrder}
            title={t(lang, "orderTitle")}
            aria-label={t(lang, "orderTitle")}
          >
            <span aria-hidden="true">{yearOrder === "desc" ? "↓" : "↑"}</span>{" "}
            {t(lang, yearOrder === "desc" ? "orderNewest" : "orderOldest")}
          </button>
          {genrePickerOpen && (
          <>
            <div className="otd-backdrop" onClick={() => setGenrePickerOpen(false)} />
            <div className="otd-genre-menu" id="otd-genre-options" role="group" aria-label={t(lang, "genreFilter")}>
              <button
                className="otd-genre-close"
                aria-label={t(lang, "close")}
                onClick={() => setGenrePickerOpen(false)}
              >
                ×
              </button>
              <p>{t(lang, "chooseGenres")}</p>
              <div className="otd-genre-grid">
                {MAIN_GENRES.map((genre) => {
                  const checked = selectedGenres.includes(genre.id);
                  const disabled = !checked && selectedGenres.length >= MAX_SELECTED_GENRES;
                  return (
                    <button
                      type="button"
                      key={genre.id}
                      className={`otd-genre-chip${checked ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}
                      disabled={disabled}
                      onClick={() => {
                        setSelectedGenres((current) => {
                          if (checked) return current.filter((id) => id !== genre.id);
                          if (current.length < MAX_SELECTED_GENRES) return [...current, genre.id];
                          return current;
                        });
                      }}
                    >
                      <span className="otd-genre-chip-check">{checked ? "✓" : ""}</span>
                      <span>{genre.label}</span>
                    </button>
                  );
                })}
              </div>
              {selectedGenres.length === MAX_SELECTED_GENRES && <p className="otd-genre-limit">{t(lang, "limitReached")}</p>}
            </div>
          </>
        )}
        </div>

        {onlyFollowed && followStatus === "loading" ? (
          <p className="otd-empty">{t(lang, "loadingFollowed")}</p>
        ) : anniversaryGroups.size ? (
          orderedGroups.map(([year, yearItems]) => (
            <AnniversarySection
              key={year}
              year={year}
              items={yearItems}
              currentYear={currentYear}
              lang={lang}
              onPreview={openPreview}
              sectionRef={getSectionRef(year)}
            />
          ))
        ) : (
          <p className="otd-empty">
            {selectedGenres.length > 0
              ? !items.some((item) => item.genres?.length)
                ? t(lang, "emptyGenresMsg")
                : t(lang, "emptyNoMatch")
              : onlyFollowed && followStatus === "ready"
                ? t(lang, "followedEmpty")
                : t(lang, "emptyNone")}
          </p>
        )}

        <p className="otd-attribution">{t(lang, "attribution")}</p>
      </section>
      {preview && createPortal(
        <div
          className="otd-cover-preview-backdrop"
          role="presentation"
          onClick={() => setPreview(null)}
        >
          <section
            className="otd-cover-preview"
            role="dialog"
            aria-modal="true"
            aria-label={t(lang, "coverPreviewTitle", { title: preview.item.title })}
            onClick={(event: { stopPropagation: () => void }) => event.stopPropagation()}
          >
            <button
              className="otd-cover-preview-close"
              type="button"
              onClick={() => setPreview(null)}
              aria-label={t(lang, "close")}
              ref={previewCloseRef}
            >
              ×
            </button>
            <div className="otd-cover-preview-image">
              {preview.cover ? (
                <img
                  src={preview.cover.replace("/front-250", "/front-500")}
                  alt={t(lang, "coverAlt", { title: preview.item.title })}
                  onError={() => setPreview((current) => current ? { ...current, cover: null } : null)}
                />
              ) : (
                <div className="otd-cover-placeholder" aria-hidden="true">♫</div>
              )}
            </div>
            <h2>{preview.item.title}</h2>
            <p>{preview.item.artistName} · {preview.item.firstReleaseDate.slice(0, 4)}</p>
          </section>
        </div>,
        document.body,
      )}
    </main>
  );
}
