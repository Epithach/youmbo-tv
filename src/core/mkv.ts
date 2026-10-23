/**
 * Lecture des pistes (audio, sous-titres) d'un fichier Matroska (MKV/WebM)
 * à partir de ses premiers octets, sans le télécharger en entier.
 *
 * Le format est de l'EBML : des éléments « identifiant + taille + contenu ».
 * On ne descend que dans Segment → Tracks → TrackEntry.
 */

export type TrackKind = 'video' | 'audio' | 'subtitle';

export interface MediaTrack {
  /** Numéro de la piste dans le fichier. */
  number: number;
  kind: TrackKind;
  /** Code langue (ISO 639-2 `fre`, ou BCP 47 `fr`), si renseigné. */
  language?: string;
  /** Nom donné par l'auteur du fichier (« VFF », « Forcés »…). */
  name?: string;
  codec: string;
  isDefault: boolean;
  isForced: boolean;
}

const ID = {
  segment: 0x18538067,
  tracks: 0x1654ae6b,
  trackEntry: 0xae,
  trackNumber: 0xd7,
  trackType: 0x83,
  codecId: 0x86,
  language: 0x22b59c,
  languageBcp47: 0x22b59d,
  name: 0x536e,
  flagDefault: 0x88,
  flagForced: 0x55aa,
  cluster: 0x1f43b675,
};

const TRACK_TYPES: Record<number, TrackKind> = { 1: 'video', 2: 'audio', 17: 'subtitle' };

interface Element {
  id: number;
  /** Début et fin du contenu. `end` vaut Infinity pour une taille inconnue. */
  start: number;
  end: number;
}

/** Lit un entier EBML de longueur variable. `keepMarker` : identifiant (garde le 1er bit). */
function readVint(bytes: Uint8Array, offset: number, keepMarker: boolean) {
  const first = bytes[offset];
  if (first === undefined || first === 0) return undefined;
  let length = 1;
  while (!(first & (0x80 >> (length - 1)))) length++;
  if (offset + length > bytes.length) return undefined;

  let value = keepMarker ? first : first & (0xff >> length);
  let allOnes = value === 0xff >> length;
  for (let i = 1; i < length; i++) {
    value = value * 256 + bytes[offset + i];
    if (bytes[offset + i] !== 0xff) allOnes = false;
  }
  return { value, length, unknown: !keepMarker && allOnes };
}

function readElement(bytes: Uint8Array, offset: number): Element | undefined {
  const id = readVint(bytes, offset, true);
  if (!id) return undefined;
  const size = readVint(bytes, offset + id.length, false);
  if (!size) return undefined;
  const start = offset + id.length + size.length;
  return { id: id.value, start, end: size.unknown ? Infinity : start + size.value };
}

function* children(bytes: Uint8Array, start: number, end: number): Generator<Element> {
  let offset = start;
  const limit = Math.min(end, bytes.length);
  while (offset < limit) {
    const element = readElement(bytes, offset);
    if (!element) return;
    yield element;
    if (element.end === Infinity) return;
    offset = element.end;
  }
}

function readUint(bytes: Uint8Array, element: Element): number {
  let value = 0;
  for (let i = element.start; i < Math.min(element.end, bytes.length); i++) {
    value = value * 256 + bytes[i];
  }
  return value;
}

function readString(bytes: Uint8Array, element: Element): string {
  const slice = bytes.subarray(element.start, Math.min(element.end, bytes.length));
  return new TextDecoder().decode(slice).replace(/\0+$/, '');
}

function parseTrackEntry(bytes: Uint8Array, entry: Element): MediaTrack | undefined {
  const track: Partial<MediaTrack> & { type?: number } = { isDefault: true, isForced: false };
  let bcp47: string | undefined;
  for (const child of children(bytes, entry.start, entry.end)) {
    switch (child.id) {
      case ID.trackNumber:
        track.number = readUint(bytes, child);
        break;
      case ID.trackType:
        track.type = readUint(bytes, child);
        break;
      case ID.codecId:
        track.codec = readString(bytes, child);
        break;
      case ID.language:
        track.language = readString(bytes, child);
        break;
      case ID.languageBcp47:
        bcp47 = readString(bytes, child);
        break;
      case ID.name:
        track.name = readString(bytes, child);
        break;
      case ID.flagDefault:
        track.isDefault = readUint(bytes, child) === 1;
        break;
      case ID.flagForced:
        track.isForced = readUint(bytes, child) === 1;
        break;
    }
  }
  const kind = track.type === undefined ? undefined : TRACK_TYPES[track.type];
  if (!kind || track.number === undefined) return undefined;
  // La langue par défaut de Matroska est l'anglais quand rien n'est indiqué.
  const language = bcp47 || track.language || 'eng';
  return {
    number: track.number,
    kind,
    language: language === 'und' ? undefined : language,
    name: track.name || undefined,
    codec: track.codec ?? '',
    isDefault: track.isDefault ?? true,
    isForced: track.isForced ?? false,
  };
}

/** Octets lus en début de fichier : les pistes y sont décrites, avant l'image et le son. */
const PROBE_BYTES = 512 * 1024;

/**
 * Télécharge le début d'un MKV (requête Range) et en lit les pistes.
 * `fetchUrl` est l'URL à appeler réellement (proxifiée en dev).
 */
export async function probeMkvTracks(fetchUrl: string): Promise<MediaTrack[]> {
  const response = await fetch(fetchUrl, { headers: { Range: `bytes=0-${PROBE_BYTES - 1}` } });
  if (!response.ok) return [];
  const buffer = await response.arrayBuffer();
  return parseMkvTracks(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, PROBE_BYTES)));
}

/** Pistes trouvées dans le début d'un fichier MKV (vide si non trouvées). */
export function parseMkvTracks(bytes: Uint8Array): MediaTrack[] {
  const segment = [...children(bytes, 0, bytes.length)].find((e) => e.id === ID.segment);
  if (!segment) return [];

  for (const element of children(bytes, segment.start, segment.end)) {
    // Les pistes sont décrites avant les données (Cluster) : inutile d'aller plus loin.
    if (element.id === ID.cluster) break;
    if (element.id !== ID.tracks) continue;
    const tracks: MediaTrack[] = [];
    for (const entry of children(bytes, element.start, element.end)) {
      if (entry.id !== ID.trackEntry) continue;
      // Piste coupée par la fin des octets lus : ses infos seraient fausses.
      if (entry.end > bytes.length) break;
      const track = parseTrackEntry(bytes, entry);
      if (track) tracks.push(track);
    }
    return tracks;
  }
  return [];
}

const LANGUAGE_NAMES: Record<string, string> = {
  fr: 'Français',
  fre: 'Français',
  fra: 'Français',
  en: 'Anglais',
  eng: 'Anglais',
  es: 'Espagnol',
  spa: 'Espagnol',
  de: 'Allemand',
  ger: 'Allemand',
  deu: 'Allemand',
  it: 'Italien',
  ita: 'Italien',
  pt: 'Portugais',
  por: 'Portugais',
  nl: 'Néerlandais',
  dut: 'Néerlandais',
  nld: 'Néerlandais',
  ar: 'Arabe',
  ara: 'Arabe',
  ja: 'Japonais',
  jpn: 'Japonais',
  ko: 'Coréen',
  kor: 'Coréen',
  zh: 'Chinois',
  chi: 'Chinois',
  zho: 'Chinois',
  ru: 'Russe',
  rus: 'Russe',
  tr: 'Turc',
  tur: 'Turc',
  pl: 'Polonais',
  pol: 'Polonais',
  hi: 'Hindi',
  hin: 'Hindi',
  yue: 'Cantonais',
  sv: 'Suédois',
  swe: 'Suédois',
  da: 'Danois',
  dan: 'Danois',
  no: 'Norvégien',
  nor: 'Norvégien',
  fi: 'Finnois',
  fin: 'Finnois',
  el: 'Grec',
  gre: 'Grec',
  ell: 'Grec',
  ro: 'Roumain',
  rum: 'Roumain',
  ron: 'Roumain',
  he: 'Hébreu',
  heb: 'Hébreu',
  th: 'Thaï',
  tha: 'Thaï',
  vi: 'Vietnamien',
  vie: 'Vietnamien',
};

/** Libellé lisible d'une piste : « Français (VFF) », « Anglais · forcés ». */
export function describeTrack(track: MediaTrack): string {
  const code = track.language?.toLowerCase().split('-')[0];
  const language = (code && LANGUAGE_NAMES[code]) || track.language || 'Langue inconnue';
  const details = [track.name && track.name !== language ? track.name : undefined];
  // « forcés » seulement si le nom ne le dit pas déjà (« French Forced »…).
  if (track.isForced && !/forc/i.test(track.name ?? '')) details.push('forcés');
  const extra = details.filter(Boolean).join(' · ');
  return extra ? `${language} (${extra})` : language;
}
