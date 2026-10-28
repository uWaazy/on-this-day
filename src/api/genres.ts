export type MainGenre = {
  id: string;
  label: string;
  patterns: RegExp[];
};

// MusicBrainz stores community genres at many levels. These broad families
// group regional genres and styles so the picker stays useful instead of
// exposing hundreds of subgenre labels.
export const MAIN_GENRES: MainGenre[] = [
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
  { id: "piseiro", label: "Piseiro", patterns: [/\bpiseiro\b/] },
];

function normalizeGenre(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}&]+/gu, " ")
    .trim();
}

export function classifyMainGenres(genres: string[] | undefined): string[] {
  if (!genres?.length) return [];
  const names = genres.map(normalizeGenre);
  return MAIN_GENRES
    .filter((genre) => names.some((name) => genre.patterns.some((pattern) => pattern.test(name))))
    .map((genre) => genre.id);
}
