import { React, createPortal, useEffect, useRef, useState } from "../react";

type Props = {
  /** Conteúdo da explicação mostrada ao passar o mouse, focar ou clicar. */
  text: string;
  children?: any;
  className?: string;
};

/**
 * Tooltip próprio. O atributo `title` nativo não aparece de forma confiável no
 * cliente do Spotify, por isso as informações das notas usam este popover.
 */
export function ScoreInfo({ text, children, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function show(delay: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 230;
      const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
      const above = rect.top > 110;
      setPos({ left, top: above ? rect.top - 8 : rect.bottom + 8 });
      (ref.current as any).dataset.placement = above ? "above" : "below";
    }, delay);
  }
  function hide() {
    if (timer.current) clearTimeout(timer.current);
    setPos(null);
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const placement = ref.current?.dataset.placement ?? "above";
  return (
    <div
      ref={ref}
      className={className}
      tabIndex={0}
      onMouseEnter={() => show(250)}
      onMouseLeave={hide}
      onFocus={() => show(0)}
      onBlur={hide}
      onClick={() => (pos ? hide() : show(0))}
    >
      {children}
      {pos && createPortal(
        <div className={`otd-info-pop otd-info-pop--${placement}`} role="tooltip" style={{ top: pos.top, left: pos.left }}>
          {text}
        </div>,
        document.body,
      )}
    </div>
  );
}
