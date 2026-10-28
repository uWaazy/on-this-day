import { React, createPortal, useEffect, useRef, useState } from "../react";
import type { Lang } from "../i18n";
import { t } from "../i18n";

export type FollowFabState = "off" | "loading" | "on" | "error";

type Props = {
  state: FollowFabState;
  count: number;
  lang: Lang;
  onToggle: () => void;
};

/** Botão flutuante (canto direito) que liga/desliga "só artistas que eu sigo". Fica no body: o fixed funciona mesmo em contêineres com transform. */
export function FollowFab({ state, count, lang, onToggle }: Props) {
  const [hover, setHover] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [offset, setOffset] = useState<{ right: number; bottom: number } | null>(null);

  // O botão acompanha a borda direita da ÁREA PRINCIPAL do Spotify. Quando o painel "Tocando agora" (ou
  // Fila/Amigos) abre, a área principal encolhe e o botão recua junto, ficando sempre por trás/ao lado do painel.
  useEffect(() => {
    const main = document.querySelector<HTMLElement>(".Root__main-view") ?? document.querySelector<HTMLElement>("main");
    if (!main) return;
    const update = () => {
      const rect = main.getBoundingClientRect();
      const bar = document.querySelector<HTMLElement>(".Root__now-playing-bar");
      const barTop = bar ? bar.getBoundingClientRect().top : window.innerHeight - 90;
      setOffset({
        right: Math.max(12, Math.round(window.innerWidth - rect.right + 20)),
        bottom: Math.max(12, Math.round(window.innerHeight - Math.min(barTop, rect.bottom) + 18)),
      });
    };
    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(main);
    window.addEventListener("resize", update);
    const poll = window.setInterval(update, 1500); // pega aberturas de painel que não redimensionam a área principal
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      window.clearInterval(poll);
    };
  }, []);
  const label =
    state === "on" ? t(lang, "fabOn", { count: count.toLocaleString(lang) })
    : state === "loading" ? t(lang, "fabLoading")
    : state === "error" ? t(lang, "fabError")
    : t(lang, "fabOff");

  return createPortal(
    <div className="otd-fab-wrap" style={offset ? { right: `${offset.right}px`, bottom: `${offset.bottom}px` } : undefined}>
      <button
        type="button"
        className={`otd-fab otd-fab--${state}`}
        aria-pressed={state === "on"}
        aria-label={label}
        onClick={onToggle}
        onMouseEnter={() => { if (hideTimer.current) clearTimeout(hideTimer.current); setHover(true); }}
        onMouseLeave={() => { hideTimer.current = window.setTimeout(() => setHover(false), 120); }}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        {state === "loading" ? (
          <span className="otd-fab-spinner" aria-hidden="true" />
        ) : (
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path fill="currentColor" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.3 0-8 1.7-8 5v1h9.1A6 6 0 0 1 12 14Zm7 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-.7 6.2-1.7-1.7 1-1 .7.7 2-2 1 1-3 3Z" />
          </svg>
        )}
        {state === "on" && <span className="otd-fab-dot" aria-hidden="true" />}
      </button>
      {/* depois do botão: com row-reverse ele aparece à esquerda sem deslocar o botão */}
      {hover && <div className="otd-fab-tip" role="status">{label}</div>}
    </div>,
    document.body,
  );
}
