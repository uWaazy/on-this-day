import { React, createPortal, useEffect, useRef, useState } from "../react";
import type { Lang } from "../i18n";
import { t } from "../i18n";
import { APP_VERSION, INSTALL_COMMAND, REPO_URL, checkForUpdate, copyText, peekUpdate, type UpdateInfo } from "../services/updates";

/**
 * Selo de versão no canto superior direito do app.
 * Fica verde (com um ponto pulsante) quando existe uma versão mais nova no GitHub; ao clicar mostra
 * o comando RAW para o PowerShell e o passo a passo manual.
 */
export function UpdateBadge({ lang }: { lang: Lang }) {
  const [info, setInfo] = useState<UpdateInfo>(peekUpdate);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void checkForUpdate().then((result) => { if (!cancelled) setInfo(result); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    // Ao abrir, confirma de novo (ignora o intervalo de 3 h) para a mensagem estar atualizada.
    void checkForUpdate(true).then(setInfo);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  async function copyCommand() {
    const ok = await copyText(INSTALL_COMMAND);
    setCopied(ok);
    if (ok) {
      try { (globalThis as any).Spicetify?.showNotification?.(t(lang, "updCopied")); } catch { /* ignore */ }
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2200);
    }
  }

  const label = info.hasUpdate
    ? t(lang, "updBadgeNew", { latest: info.latest ?? "" })
    : t(lang, "updBadge", { version: APP_VERSION });

  return (
    <>
      <button
        type="button"
        className={`otd-version-badge${info.hasUpdate ? " has-update" : ""}`}
        onClick={() => setOpen(true)}
        title={label}
        aria-label={label}
        aria-haspopup="dialog"
      >
        {info.hasUpdate && <span className="otd-version-dot" aria-hidden="true" />}
        <span>v{APP_VERSION}</span>
        {info.hasUpdate && <span className="otd-version-new">↑ v{info.latest}</span>}
      </button>
      {open && createPortal(
        <div className="otd-update-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div className="otd-update-dialog" role="dialog" aria-modal="true" aria-label={t(lang, "updTitleNew")} onClick={(event: { stopPropagation: () => void }) => event.stopPropagation()}>
            <div className="otd-update-head">
              <div>
                <h2>{info.hasUpdate ? t(lang, "updTitleNew") : t(lang, "updTitleCurrent")}</h2>
                <p className="otd-update-versions">
                  {t(lang, "updInstalled")}: <strong>v{APP_VERSION}</strong>
                  {info.latest && <> · {t(lang, "updLatest")}: <strong className={info.hasUpdate ? "is-new" : ""}>v{info.latest}</strong></>}
                </p>
                {!info.latest && <p className="otd-update-warn">{t(lang, "updCheckFailed")}</p>}
              </div>
              <button ref={closeRef} type="button" className="otd-update-close" onClick={() => setOpen(false)} aria-label={t(lang, "updClose")}>✕</button>
            </div>

            <section className="otd-update-block">
              <h3><span className="otd-update-tag">{t(lang, "updRecommended")}</span> {t(lang, "updRawTitle")}</h3>
              <p>{t(lang, "updRawHint")}</p>
              <div className="otd-update-command">
                <code>{INSTALL_COMMAND}</code>
                <button type="button" className={copied ? "is-copied" : ""} onClick={copyCommand}>{copied ? t(lang, "updCopied") : t(lang, "updCopy")}</button>
              </div>
            </section>

            <section className="otd-update-block">
              <h3>{t(lang, "updManualTitle")}</h3>
              <ol>
                <li>{t(lang, "updManual1")}</li>
                <li>{t(lang, "updManual2")} <code>%appdata%\spicetify\CustomApps\on-this-day</code></li>
                <li>{t(lang, "updManual3")} <code>spicetify config custom_apps on-this-day</code> → <code>spicetify apply</code></li>
              </ol>
            </section>

            <div className="otd-update-actions">
              <a className="otd-update-link" href={REPO_URL} target="_blank" rel="noopener noreferrer">{t(lang, "updOpenGithub")}</a>
              <button type="button" className="otd-update-done" onClick={() => setOpen(false)}>{t(lang, "updClose")}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
