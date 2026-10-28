declare const __OTD_SPOTIFY_CLIENT_ID__: string;
declare const __OTD_SPOTIFY_REDIRECT_URI__: string;

const FOLLOW_SCOPE = "user-follow-read";
const REFRESH_TOKEN_KEY = "on-this-day:spotify-refresh-token";
const PENDING_AUTH_KEY = "on-this-day:spotify-oauth-pending";
const AUTH_MESSAGE_KIND = "on-this-day:spotify-oauth";

type SpotifyTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type SpotifyOAuthMessage = {
  kind: string;
  state?: string;
  code?: string;
  error?: string;
};

type StoredAccess = {
  token: string;
  expiresAt: number;
};

type PendingAuthorization = { state: string; verifier: string };

let access: StoredAccess | null = null;

export function isSpotifyFollowConfigured(): boolean {
  return Boolean(__OTD_SPOTIFY_CLIENT_ID__ && __OTD_SPOTIFY_REDIRECT_URI__);
}

export function hasSpotifyRefreshToken(): boolean {
  try {
    return Boolean(localStorage.getItem(REFRESH_TOKEN_KEY));
  } catch {
    return false;
  }
}

export function normalizeArtistName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function randomBase64Url(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function saveRefreshToken(token: string): void {
  try {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } catch {
    throw new Error("O Spotify autorizou, mas não foi possível salvar a conexão neste dispositivo.");
  }
}

function readRefreshToken(): string {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function readPendingAuthorization(): PendingAuthorization | null {
  try {
    const value = sessionStorage.getItem(PENDING_AUTH_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<PendingAuthorization>;
    return typeof parsed.state === "string" && typeof parsed.verifier === "string"
      ? { state: parsed.state, verifier: parsed.verifier }
      : null;
  } catch {
    return null;
  }
}

function clearPendingAuthorization(): void {
  try { sessionStorage.removeItem(PENDING_AUTH_KEY); } catch { /* Nothing to clear. */ }
}

export function hasPendingSpotifyAuthorization(): boolean {
  return readPendingAuthorization() !== null;
}

async function exchangeCode(code: string, verifier: string): Promise<SpotifyTokenResponse> {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: __OTD_SPOTIFY_CLIENT_ID__,
      grant_type: "authorization_code",
      code,
      redirect_uri: __OTD_SPOTIFY_REDIRECT_URI__,
      code_verifier: verifier,
    }),
  });
  const result = await response.json() as SpotifyTokenResponse;
  if (!response.ok || !result.access_token) {
    throw new Error(result.error_description ?? "O Spotify não concluiu a autorização.");
  }
  return result;
}

async function finishAuthorization(code: string, state: string, pending: PendingAuthorization): Promise<string[]> {
  if (state !== pending.state) throw new Error("A confirmação do Spotify não corresponde a esta tentativa. Feche a janela e tente novamente.");
  const tokens = await exchangeCode(code, pending.verifier);
  if (!tokens.refresh_token) throw new Error("O Spotify não retornou uma autorização renovável. Tente conectar novamente.");
  saveRefreshToken(tokens.refresh_token);
  access = { token: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 };
  clearPendingAuthorization();
  return loadFollowedArtistNames();
}

export async function completeSpotifyAuthorizationFromUrl(callbackUrl: string): Promise<string[]> {
  const pending = readPendingAuthorization();
  if (!pending) throw new Error("Não há uma autorização Spotify pendente neste app.");

  let callback: URL;
  try { callback = new URL(callbackUrl); } catch { throw new Error("Cole o endereço completo que o Spotify abriu após a autorização."); }
  if (callback.origin !== new URL(__OTD_SPOTIFY_REDIRECT_URI__).origin) {
    throw new Error("Esse endereço não é o retorno autorizado do Spotify para este app.");
  }

  const state = callback.searchParams.get("state") ?? "";
  const error = callback.searchParams.get("error");
  if (error) {
    if (state === pending.state) clearPendingAuthorization();
    throw new Error(error === "access_denied"
      ? "Você recusou a permissão. Nada foi alterado na sua conta."
      : `O Spotify encerrou a autorização (${error}).`);
  }
  const code = callback.searchParams.get("code");
  if (!code) throw new Error("O endereço não contém o código de autorização do Spotify.");
  return finishAuthorization(code, state, pending);
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = readRefreshToken();
  if (!refreshToken) throw new Error("Conecte sua conta Spotify para usar este filtro.");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: __OTD_SPOTIFY_CLIENT_ID__,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const result = await response.json() as SpotifyTokenResponse;
  if (!response.ok || !result.access_token) {
    if (result.error === "invalid_grant") disconnectSpotify();
    throw new Error(result.error_description ?? "A conexão com o Spotify expirou. Conecte novamente.");
  }

  if (result.refresh_token) saveRefreshToken(result.refresh_token);
  access = { token: result.access_token, expiresAt: Date.now() + result.expires_in * 1000 };
  return access.token;
}

async function getAccessToken(): Promise<string> {
  if (access && access.expiresAt > Date.now() + 60_000) return access.token;
  return refreshAccessToken();
}

async function requestFollowedArtists(token: string): Promise<{ status: number; names?: string[] }> {
  let nextUrl: string | null = "https://api.spotify.com/v1/me/following?type=artist&limit=50";
  const names = new Set<string>();

  while (nextUrl) {
    let response = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 429) {
      const retryAfter = Math.min(Number(response.headers.get("Retry-After") ?? 2), 15);
      await new Promise((resolve) => window.setTimeout(resolve, Math.max(1, retryAfter) * 1000));
      response = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
    }
    if (!response.ok) return { status: response.status };

    const page = await response.json() as {
      artists?: { items?: Array<{ name?: string }>; next?: string | null };
    };
    for (const artist of page.artists?.items ?? []) {
      if (artist.name) names.add(artist.name);
    }
    nextUrl = page.artists?.next ?? null;
  }

  return { status: 200, names: [...names] };
}

export async function loadFollowedArtistNames(): Promise<string[]> {
  let token = await getAccessToken();
  let result = await requestFollowedArtists(token);
  if (result.status === 401) {
    access = null;
    token = await refreshAccessToken();
    result = await requestFollowedArtists(token);
  }
  if (result.status !== 200) {
    if (result.status === 403) {
      throw new Error("O Spotify não liberou essa permissão para esta conta. Se o app estiver em modo de desenvolvimento, a conta precisa estar autorizada pelo responsável.");
    }
    if (result.status === 429) {
      throw new Error("O Spotify pediu uma pausa. Tente atualizar a lista daqui a pouco.");
    }
    if (result.status === 401) {
      disconnectSpotify();
      throw new Error("A autorização expirou. Conecte sua conta Spotify novamente.");
    }
    throw new Error(`Não foi possível ler os artistas seguidos (${result.status}).`);
  }

  return result.names ?? [];
}

export function connectSpotifyForFollowedArtists(): Promise<string[]> {
  if (!isSpotifyFollowConfigured()) {
    return Promise.reject(new Error("A conexão com o Spotify ainda não foi configurada pelo responsável pelo app."));
  }

  // Open synchronously in the click handler so the Spotify consent window is not blocked.
  const popup = window.open("about:blank", "on-this-day-spotify-consent", "popup,width=520,height=760");
  if (!popup) {
    return Promise.reject(new Error("O Spotify bloqueou a janela de autorização. Permita pop-ups e tente novamente."));
  }

  const verifier = randomBase64Url(64);
  const state = randomBase64Url(24);
  const redirectOrigin = new URL(__OTD_SPOTIFY_REDIRECT_URI__).origin;
  try { sessionStorage.setItem(PENDING_AUTH_KEY, JSON.stringify({ state, verifier })); } catch {
    popup.close();
    return Promise.reject(new Error("O Spotify não conseguiu guardar o estado temporário da autorização neste dispositivo."));
  }

  return new Promise((resolve, reject) => {
    let completed = false;
    let closePoll = 0;
    let timeout = 0;

    const cleanup = (closePopup = true) => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(closePoll);
      window.clearTimeout(timeout);
      if (closePopup) {
        try { popup.close(); } catch { /* The auth window may already be gone. */ }
      }
    };

    const fail = (error: Error, closePopup = true) => {
      if (completed) return;
      completed = true;
      cleanup(closePopup);
      reject(error);
    };

    const onMessage = (event: MessageEvent<SpotifyOAuthMessage>) => {
      if (event.origin !== redirectOrigin || event.source !== popup) return;
      const message = event.data;
      if (!message || message.kind !== AUTH_MESSAGE_KIND) return;
      if (message.state !== state) {
        fail(new Error("A confirmação do Spotify não corresponde a esta tentativa. Feche a janela e tente novamente."), false);
        return;
      }
      if (message.error) {
        if (message.state === state) clearPendingAuthorization();
        popup.postMessage({ kind: `${AUTH_MESSAGE_KIND}:ack`, state }, redirectOrigin);
        fail(new Error(message.error === "access_denied"
          ? "Você recusou a permissão. Nada foi alterado na sua conta." 
          : `O Spotify encerrou a autorização (${message.error}).`), false);
        return;
      }
      if (!message.code) {
        fail(new Error("O Spotify não retornou o código de autorização."));
        return;
      }

      completed = true;
      popup.postMessage({ kind: `${AUTH_MESSAGE_KIND}:ack`, state }, redirectOrigin);
      cleanup(false);
      void finishAuthorization(message.code, state, { state, verifier })
        .then(resolve)
        .catch((error: unknown) => reject(error instanceof Error ? error : new Error(String(error))));
    };

    window.addEventListener("message", onMessage);
    closePoll = window.setInterval(() => {
      if (popup.closed) fail(new Error("A janela do Spotify foi fechada antes da autorização terminar."));
    }, 500);
    timeout = window.setTimeout(() => fail(new Error("A autorização expirou. Tente conectar novamente.")), 5 * 60 * 1000);

    void createCodeChallenge(verifier).then((challenge) => {
      const authorization = new URL("https://accounts.spotify.com/authorize");
      authorization.search = new URLSearchParams({
        client_id: __OTD_SPOTIFY_CLIENT_ID__,
        response_type: "code",
        redirect_uri: __OTD_SPOTIFY_REDIRECT_URI__,
        scope: FOLLOW_SCOPE,
        state,
        code_challenge_method: "S256",
        code_challenge: challenge,
      }).toString();
      popup.location.replace(authorization.toString());
    }).catch((error: unknown) => fail(error instanceof Error ? error : new Error(String(error))));
  });
}

export function disconnectSpotify(): void {
  access = null;
  try { localStorage.removeItem(REFRESH_TOKEN_KEY); } catch { /* Nothing to remove. */ }
}
