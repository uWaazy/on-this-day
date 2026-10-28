import { React } from "../react";
import type { MusicBrainzCatalogItem } from "../api/catalog";
import type { Lang } from "../i18n";
import { t } from "../i18n";
import { ScoreInfo } from "./ScoreInfo";

/**
 * Nota de críticos desativada temporariamente: o catálogo não tem fonte confiável para ela.
 * Quando houver dados (`criticScore` nos itens), basta trocar para `true`.
 */
export const SHOW_CRITIC_SCORE = false;

/** Abaixo disso a nota é exibida, porém marcada como "poucas avaliações". */
export const LOW_CONFIDENCE_VOTES = 5;

export type ScoreReading = {
  /** 0–100 inteiro, ou null quando não há dado real. */
  value: number | null;
  count: number | null;
  lowConfidence: boolean;
};

/** Nota de usuários = média MusicBrainz (0–5) convertida para 0–100. Sem votos = indisponível (nunca "0"). */
export function readUserScore(item: Pick<MusicBrainzCatalogItem, "ratingValue" | "ratingVotes">): ScoreReading {
  const votes = Number(item.ratingVotes ?? 0);
  const rating = Number(item.ratingValue ?? 0);
  if (!Number.isFinite(votes) || !Number.isFinite(rating) || votes <= 0 || rating <= 0 || rating > 5) {
    return { value: null, count: null, lowConfidence: false };
  }
  return { value: Math.round((rating / 5) * 100), count: votes, lowConfidence: votes < LOW_CONFIDENCE_VOTES };
}

/** Nota de críticos: só existe se o catálogo trouxer `criticScore` (0–100); nunca é estimada. */
export function readCriticScore(item: Pick<MusicBrainzCatalogItem, "criticScore" | "criticVotes">): ScoreReading {
  const score = Number(item.criticScore);
  if (item.criticScore === undefined || !Number.isFinite(score) || score < 0 || score > 100) {
    return { value: null, count: null, lowConfidence: false };
  }
  const count = item.criticVotes !== undefined && Number(item.criticVotes) > 0 ? Number(item.criticVotes) : null;
  return { value: Math.round(score), count, lowConfidence: count !== null && count < 3 };
}

type Props = {
  kind: "user" | "critic";
  reading: ScoreReading;
  lang: Lang;
};

export function ScoreMeter({ kind, reading, lang }: Props) {
  const available = reading.value !== null;
  const label = t(lang, kind === "user" ? "communityScore" : "criticScore");
  const sourceTitle = t(lang, kind === "user" ? "userScoreTitle" : "criticScoreTitle");
  const tooltip = !available
    ? `${label}: ${t(lang, kind === "user" ? "userScoreMissing" : "criticScoreMissing")}`
    : [
        sourceTitle,
        reading.count !== null ? t(lang, "scoreVotes", { count: reading.count.toLocaleString(lang) }) : "",
        reading.lowConfidence ? t(lang, "scoreFew") : "",
      ].filter(Boolean).join(" · ");
  const countText = !available
    ? t(lang, "scoreUnavailable")
    : reading.count !== null
      ? t(lang, "scoreVotes", { count: reading.count.toLocaleString(lang) })
      : "";

  return (
    <ScoreInfo
      text={tooltip}
      className={`otd-score otd-score--${kind}${available ? "" : " is-unavailable"}${reading.lowConfidence ? " is-low" : ""}`}
    >
      <div className="otd-score-top">
        <span className="otd-score-label">{label}</span>
        <span className="otd-score-value">{available ? reading.value : "—"}</span>
      </div>
      <div
        className="otd-score-track"
        role={available ? "meter" : undefined}
        aria-valuemin={available ? 0 : undefined}
        aria-valuemax={available ? 100 : undefined}
        aria-valuenow={available ? reading.value ?? undefined : undefined}
        aria-label={`${label}: ${available ? reading.value : t(lang, "scoreUnavailable")}`}
      >
        {available && <span className="otd-score-fill" style={{ width: `${reading.value}%` }} />}
      </div>
      <div className="otd-score-count">{countText}</div>
    </ScoreInfo>
  );
}
