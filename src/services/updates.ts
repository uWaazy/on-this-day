import { withTimeout } from "./spotify-album";

declare const __OTD_VERSION__: string;
declare const __OTD_REPO__: string;

/** Versão compilada dentro do app (o build copia de package.json). */
export const APP_VERSION = typeof __OTD_VERSION__ !== "undefined" ? __OTD_VERSION__ : "0.0.0";
export const REPO = typeof __OTD_REPO__ !== "undefined" ? __OTD_REPO__ : "uWaazy/on-this-day";
export const REPO_URL = `https://github.com/${REPO}`;
export const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/main`;
export const RAW_MANIFEST_URL = `${RAW_BASE}/manifest.json`;
/** Comando de instalação/atualização via RAW (PowerShell). */
export const INSTALL_COMMAND = `irm ${RAW_BASE}/install.ps1 | iex`;

const CACHE_KEY = "on-this-day:update-check:v1";
const CHECK_INTERVAL_MS = 3 * 60 * 60 * 1000;

export type UpdateInfo = { latest: string | null; hasUpdate: boolean; checkedAt: number };

/** Compara "1.10.0" > "1.9.3" numericamente. Retorna >0 se a > b. */
export function compareVersions(a: string, b: string): number {
  const parse = (value: string) => (/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(value.trim()) ?? []).slice(1).map((part) => Number(part ?? 0));
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < 3; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function readCache(): { latest: string; at: number } | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
    if (parsed && typeof parsed.latest === "string" && typeof parsed.at === "number") return parsed;
  } catch { /* sem cache */ }
  return null;
}

function toInfo(latest: string | null, checkedAt: number): UpdateInfo {
  return { latest, hasUpdate: !!latest && compareVersions(latest, APP_VERSION) > 0, checkedAt };
}

/** Consulta o manifest.json do GitHub (RAW). No máximo 1 consulta a cada 3 h, salvo `force`. Falhas são silenciosas. */
export async function checkForUpdate(force = false): Promise<UpdateInfo> {
  const cached = readCache();
  if (!force && cached && Date.now() - cached.at < CHECK_INTERVAL_MS) return toInfo(cached.latest, cached.at);
  try {
    const response = await withTimeout(fetch(`${RAW_MANIFEST_URL}?t=${Math.floor(Date.now() / 60000)}`, { cache: "no-store" }), 8000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest = await response.json() as { version?: unknown };
    const latest = typeof manifest.version === "string" && /^\d+\.\d+\.\d+/.test(manifest.version) ? manifest.version : null;
    if (!latest) throw new Error("manifest sem versão");
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ latest, at: Date.now() })); } catch { /* ignore */ }
    return toInfo(latest, Date.now());
  } catch {
    return toInfo(cached?.latest ?? null, cached?.at ?? 0);
  }
}

/** Resultado em cache, sem rede (para pintar o selo logo de cara). */
export function peekUpdate(): UpdateInfo {
  const cached = readCache();
  return toInfo(cached?.latest ?? null, cached?.at ?? 0);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    const clipboard = (globalThis as any).Spicetify?.Platform?.ClipboardAPI;
    if (clipboard?.copy) { await clipboard.copy(text); return true; }
  } catch { /* tenta o próximo */ }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* fallback antigo */ }
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
