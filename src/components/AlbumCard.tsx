import { React, memo, useEffect, useRef, useState } from "../react";
import type { MusicBrainzCatalogItem } from "../api/catalog";
import type { Lang } from "../i18n";
import { t } from "../i18n";
import { resolveAlbumCover } from "../services/album-cover";
import { findSpotifyAlbum, openAlbumInSpotify, peekCachedCover } from "../services/spotify-album";
import { SHOW_CRITIC_SCORE, ScoreMeter, readCriticScore, readUserScore } from "./ScoreMeter";

type Props = {
  item: MusicBrainzCatalogItem;
  lang: Lang;
  onPreview: (item: MusicBrainzCatalogItem, cover: string | null) => void;
};

/** Tempo para distinguir clique simples (ampliar) de duplo clique (abrir no Spotify). */
const SINGLE_CLICK_DELAY_MS = 280;

export const AlbumCard = memo(function AlbumCard({ item, lang, onPreview }: Props) {
  const year = item.firstReleaseDate.slice(0, 4);
  const [hasCover, setHasCover] = useState(true);
  // Se o Spotify já resolveu esta capa antes, usa o CDN dele (rápido); senão o Cover Art Archive, que redireciona e é mais lento.
  const [coverSrc, setCoverSrc] = useState(() => peekCachedCover(item.mbid) ?? `https://coverartarchive.org/release-group/${item.mbid}/front-250`);
  const fallbackStarted = useRef(false);
  const loaded = useRef(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  /** Começa a consulta ao passar o mouse: no duplo clique o resultado normalmente já está em cache. */
  function warmUpLookup() {
    void findSpotifyAlbum(item);
  }

  function handleCoverClick(event: { detail: number; preventDefault: () => void }) {
    // `detail` conta cliques consecutivos: 1 = simples, >=2 = duplo (ou mais). 0 = teclado.
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

  /**
   * A capa do Cover Art Archive falhou (404, lenta ou fora do ar): tenta Spotify (exato e flexível) e iTunes.
   * Se nada servir, tenta de novo uma vez mais tarde (a falha pode ter sido temporária).
   */
  function recoverCover(attempt = 0) {
    void resolveAlbumCover(item, true).then((url) => {
      if (!mounted.current) return;
      if (url) {
        loaded.current = false;
        setCoverSrc(url);
        setHasCover(true);
      } else if (attempt === 0) {
        retryTimer.current = window.setTimeout(() => recoverCover(1), 12000);
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
    // Cover Art Archive às vezes não responde nem dá erro: depois de 7 s procura outra fonte.
    // O relógio só começa quando o card aparece na tela (imagens fora dela nem começaram a carregar).
    let slowTimer: ReturnType<typeof setTimeout> | undefined;
    const startSlowTimer = () => {
      if (slowTimer) return;
      slowTimer = window.setTimeout(() => {
        if (!loaded.current && !fallbackStarted.current) {
          fallbackStarted.current = true;
          recoverCover();
        }
      }, 7000);
    };
    let observer: IntersectionObserver | undefined;
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

  return (
    <article className="otd-album-card">
      <div className="otd-cover-wrap" ref={wrapRef}>
        <button
          className="otd-cover-trigger"
          type="button"
          onClick={handleCoverClick}
          onMouseEnter={warmUpLookup}
          onFocus={warmUpLookup}
          aria-label={t(lang, "previewCover", { title: item.title })}
          title={t(lang, "previewCover", { title: item.title })}
        >
          {hasCover ? (
            <img
              className="otd-cover"
              src={coverSrc}
              alt={t(lang, "coverAlt", { title: item.title })}
              loading="lazy"
              decoding="async"
              onLoad={() => { loaded.current = true; }}
              onError={handleCoverError}
            />
          ) : (
            <div className="otd-cover-placeholder" aria-hidden="true">♫</div>
          )}
        </button>
        <button
          className="otd-open-spotify"
          type="button"
          onClick={openSpotifyAlbum}
          onMouseEnter={warmUpLookup}
          aria-label={t(lang, "searchOnSpotify", { title: item.title })}
        >
          {t(lang, "searchOnSpotifyShort")}
        </button>
      </div>
      <div className="otd-album-name" title={item.title}>{item.title}</div>
      <div className="otd-artist-name" title={item.artistName}>{item.artistName}</div>
      <div className="otd-card-meta">{year}</div>
      <div className={`otd-scores${SHOW_CRITIC_SCORE ? "" : " otd-scores--single"}`}>
        <ScoreMeter kind="user" reading={userScore} lang={lang} />
        {SHOW_CRITIC_SCORE && <ScoreMeter kind="critic" reading={criticScore} lang={lang} />}
      </div>
    </article>
  );
});
