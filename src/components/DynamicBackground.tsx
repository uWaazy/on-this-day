import { useEffect, useRef, useState } from "../react";
import { preloadImage, resolveArtistPhoto } from "../api/artist-images";
import { resolveAlbumCover } from "../services/album-cover";
import { VISIBLE_ARTISTS, type BackgroundCandidate } from "../services/background-selection";

type DynamicBackgroundProps = {
  /** Artistas já selecionados (os 6 primeiros = álbuns mais destacados; o resto é reserva para a rotação). */
  candidates: BackgroundCandidate[];
  rotationInterval?: number;
};

type Visual = { url: string; kind: "artist" | "cover" };
/** Um artista pronto: foto dele + capas dos álbuns em destaque (alternam entre si). */
type Artist = { key: string; visuals: Visual[] };
/** Uma posição da composição: mostra uma das imagens do artista. */
type Slot = { key: string; url: string; kind: Visual["kind"]; visuals: Visual[]; index: number };
type Rect = { left: string; top: string; width: string; height: string };

const FADE_MS = 1800;
const SETTLE_TIMEOUT_FIRST_MS = 4500;
const SETTLE_TIMEOUT_REPLACE_MS = 8000;
const PARALLEL_RESOLVERS = 3;
/** O primeiro carregamento espera a lista de álbuns aparecer antes de buscar fotos (a interface vem primeiro). */
const FIRST_START_DELAY_MS = 900;

/** Distribuição equilibrada para 1–6 fotos (percentual da área do fundo). */
function getRect(index: number, count: number): Rect {
  const cell = (columns: number, rows: number, col: number, row: number): Rect => ({
    left: `${(col * 100) / columns}%`,
    top: `${(row * 100) / rows}%`,
    width: `${100 / columns}%`,
    height: `${100 / rows}%`,
  });
  switch (count) {
    case 1: return cell(1, 1, 0, 0);
    case 2: return cell(2, 1, index, 0);
    case 3: return cell(3, 1, index, 0);
    case 4: return cell(2, 2, index % 2, Math.floor(index / 2));
    case 5:
      return index < 3
        ? cell(3, 2, index, 0)
        : { left: `${(index - 3) * 50}%`, top: "50%", width: "50%", height: "50%" };
    default: return cell(3, 2, index % 3, Math.floor(index / 3));
  }
}

type Layer = { n: number; url: string; kind: Visual["kind"] };

/** Uma posição da composição: troca de foto com sobreposição gradual (sem piscar nem tela vazia). */
function SlotImage({ url, kind }: { url: string; kind: Visual["kind"] }) {
  const counter = useRef(0);
  const [layers, setLayers] = useState<Layer[]>(() => [{ n: 0, url, kind }]);

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

  return (
    <>
      {layers.map((layer, index) => (
        <div
          key={layer.n}
          className={`otd-bg-photo otd-bg-photo--${layer.kind}${index === layers.length - 1 ? " is-entering" : ""}`}
          style={{ backgroundImage: `url("${layer.url}")` }}
        />
      ))}
    </>
  );
}

type ItemState = "idle" | "loading" | "ready" | "failed";

function toSlot(artist: Artist, index: number): Slot {
  const i = ((index % artist.visuals.length) + artist.visuals.length) % artist.visuals.length;
  return { key: artist.key, url: artist.visuals[i].url, kind: artist.visuals[i].kind, visuals: artist.visuals, index: i };
}

export default function DynamicBackground({ candidates, rotationInterval = 8000 }: DynamicBackgroundProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const slotsRef = useRef<Slot[]>([]);
  const generation = useRef(0);
  const states = useRef<ItemState[]>([]);
  const artists = useRef<Array<Artist | null>>([]);
  const lastShown = useRef<Map<string, number>>(new Map());
  const entries = useRef<Map<string, number>>(new Map());
  const tickCount = useRef(0);
  const cursor = useRef(0);
  const extraBusy = useRef(false);
  const tickRef = useRef<() => void>(() => {});

  const candidatesKey = candidates.map((candidate) => `${candidate.key}@${candidate.albums.map((album) => album.mbid).join("+")}`).join("|");

  function publish(next: Slot[]) {
    const previous = slotsRef.current;
    const same = previous.length === next.length && previous.every((slot, i) => slot.url === next[i].url && slot.key === next[i].key);
    if (same) return;
    slotsRef.current = next;
    setSlots(next);
  }

  /** Foto do artista + capas dos álbuns em destaque; vale se ao menos uma imagem carregar. */
  async function loadIndex(gen: number, list: BackgroundCandidate[], index: number): Promise<boolean> {
    states.current[index] = "loading";
    const candidate = list[index];
    const visuals: Visual[] = [];
    try {
      const photoTask = resolveArtistPhoto(candidate).then(async (photo) => (photo && await preloadImage(photo.url) ? photo.url : null)).catch(() => null);
      const coverTasks = candidate.albums.map((album) => resolveAlbumCover(album).catch(() => null));
      const [photo, ...covers] = await Promise.all([photoTask, ...coverTasks]);
      // Foto primeiro (é o que representa o artista); capas depois, sem repetir.
      if (photo) visuals.push({ url: photo, kind: "artist" });
      covers.forEach((cover) => { if (cover && !visuals.some((v) => v.url === cover)) visuals.push({ url: cover, kind: "cover" }); });
    } catch { /* trata como falha */ }
    if (gen !== generation.current) return false;
    if (visuals.length) artists.current[index] = { key: candidate.key, visuals };
    states.current[index] = visuals.length ? "ready" : "failed";
    return visuals.length > 0;
  }

  /** Resolve um artista de reserva por vez, sem competir com a rolagem dos álbuns. */
  function prefetchExtra(gen: number, list: BackgroundCandidate[]) {
    if (extraBusy.current || gen !== generation.current) return;
    const index = states.current.findIndex((state) => state === "idle");
    if (index === -1) return;
    extraBusy.current = true;
    void loadIndex(gen, list, index).finally(() => { extraBusy.current = false; });
  }

  function enter(artist: Artist): Slot {
    const times = entries.current.get(artist.key) ?? 0;
    entries.current.set(artist.key, times + 1);
    return toSlot(artist, times); // a cada volta ao palco mostra a próxima imagem (foto → capa → capa…)
  }

  function compose(): Slot[] {
    const ready: Slot[] = [];
    states.current.forEach((state, index) => {
      const artist = artists.current[index];
      if (state === "ready" && artist && ready.length < VISIBLE_ARTISTS) ready.push(enter(artist));
    });
    return ready;
  }

  useEffect(() => {
    const gen = ++generation.current;
    const list = candidates;
    states.current = list.map(() => "idle" as ItemState);
    artists.current = list.map(() => null);
    lastShown.current = new Map();
    entries.current = new Map();
    tickCount.current = 0;
    cursor.current = 0;
    extraBusy.current = false;

    if (!list.length) {
      publish([]);
      return () => { generation.current += 1; };
    }

    const hadDisplay = slotsRef.current.length > 0;
    let next = 0;
    let readyCount = 0;
    let committed = false;
    const commit = () => {
      if (gen !== generation.current || committed) return;
      committed = true;
      const composition = compose();
      // Nada carregou: remove os artistas antigos em vez de mantê-los indefinidamente.
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

    // Mantém a composição anterior até a nova estar pronta; só força a troca após o timeout.
    const forceTimer = window.setTimeout(() => {
      if (readyCount > 0) commit();
    }, (hadDisplay ? SETTLE_TIMEOUT_REPLACE_MS : SETTLE_TIMEOUT_FIRST_MS + FIRST_START_DELAY_MS));

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

    // Artistas de reserva prontos, priorizando os que ficaram mais tempo fora da tela.
    const reserve: Artist[] = [];
    states.current.forEach((state, index) => {
      const artist = artists.current[index];
      if (state === "ready" && artist && !shown.has(artist.key)) reserve.push(artist);
    });
    reserve.sort((a, b) => (lastShown.current.get(a.key) ?? -1) - (lastShown.current.get(b.key) ?? -1));

    const next = current.slice();
    const length = current.length;
    const start = cursor.current % length;
    const updates = Math.min(2, length);
    const used = new Set<number>();
    let reserveIndex = 0;

    for (let k = 0; k < updates; k += 1) {
      const position = (start + k * Math.ceil(length / 2)) % length;
      if (used.has(position)) continue;
      used.add(position);
      const slot = next[position];
      if (reserveIndex < reserve.length) {
        // Outro artista dos resultados entra neste lugar.
        const incoming = reserve[reserveIndex++];
        lastShown.current.set(slot.key, now);
        lastShown.current.set(incoming.key, now);
        next[position] = enter(incoming);
      } else if (slot.visuals.length > 1) {
        // Sem reserva: o mesmo artista alterna entre sua foto e as capas dos álbuns.
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

  // Um único timer, independente de re-renderizações; pausa com a janela oculta.
  useEffect(() => {
    let timer: number | undefined;
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
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

  return (
    <div className="otd-dynamic-bg" aria-hidden="true" data-count={slots.length}>
      {slots.map((slot, index) => (
        <div
          key={index}
          className="otd-bg-slot"
          data-artist={slot.key}
          data-kind={slot.kind}
          style={getRect(index, slots.length)}
        >
          <SlotImage url={slot.url} kind={slot.kind} />
        </div>
      ))}
      <div className="otd-bg-overlay" />
    </div>
  );
}
