import { describe, expect, it } from 'vitest';
import { describeTrack, parseMkvTracks, readStart, type MediaTrack } from './mkv';

/** Construit un élément EBML (taille < 127 octets, codée sur 1 octet). */
function el(id: number[], ...content: (number[] | string)[]): number[] {
  const bytes = content.flatMap((part) =>
    typeof part === 'string' ? [...new TextEncoder().encode(part)] : part,
  );
  return [...id, 0x80 | bytes.length, ...bytes];
}

const uint = (id: number[], value: number) => el(id, [value]);

function track(number: number, type: number, codec: string, extra: number[][] = []) {
  return el([0xae], uint([0xd7], number), uint([0x83], type), el([0x86], codec), ...extra);
}

const language = (code: string) => el([0x22, 0xb5, 0x9c], code);
const name = (text: string) => el([0x53, 0x6e], text);
const notDefault = uint([0x88], 0);
const forced = uint([0x55, 0xaa], 1);

function mkv(...tracks: number[][]): Uint8Array {
  const header = el([0x1a, 0x45, 0xdf, 0xa3], el([0x42, 0x82], 'matroska'));
  const tracksElement = el([0x16, 0x54, 0xae, 0x6b], ...tracks);
  // Segment de taille « inconnue » (tous les bits à 1), comme dans les fichiers diffusés en flux.
  const segment = [0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
  return new Uint8Array([...header, ...segment, ...tracksElement]);
}

describe('parseMkvTracks', () => {
  it('lit les pistes vidéo, audio et sous-titres avec leur langue', () => {
    const tracks = parseMkvTracks(
      mkv(
        track(1, 1, 'V_MPEG4/ISO/AVC'),
        track(2, 2, 'A_AC3', [language('fre'), name('VFF')]),
        track(3, 2, 'A_AC3', [language('eng'), notDefault]),
        track(4, 17, 'S_TEXT/UTF8', [language('fre'), forced]),
      ),
    );
    expect(tracks.map((t) => [t.number, t.kind, t.language, t.codec])).toEqual([
      [1, 'video', 'eng', 'V_MPEG4/ISO/AVC'],
      [2, 'audio', 'fre', 'A_AC3'],
      [3, 'audio', 'eng', 'A_AC3'],
      [4, 'subtitle', 'fre', 'S_TEXT/UTF8'],
    ]);
    expect(tracks[1]).toMatchObject({ name: 'VFF', isDefault: true });
    expect(tracks[2].isDefault).toBe(false);
    expect(tracks[3].isForced).toBe(true);
  });

  it('renvoie une liste vide pour un fichier qui n’est pas un MKV', () => {
    expect(parseMkvTracks(new TextEncoder().encode('#EXTM3U\nhttp://x'))).toEqual([]);
    expect(parseMkvTracks(new Uint8Array())).toEqual([]);
  });

  it('supporte un début de fichier tronqué', () => {
    const full = mkv(track(1, 2, 'A_AAC', [language('fre')]));
    expect(parseMkvTracks(full.subarray(0, full.length - 4))).toEqual([]);
  });
});

describe('describeTrack', () => {
  const base: MediaTrack = {
    number: 1,
    kind: 'audio',
    codec: 'A_AC3',
    isDefault: true,
    isForced: false,
  };

  it.each([
    [{ language: 'fre' }, 'Français'],
    [{ language: 'fr-CA', name: 'VFQ' }, 'Français (VFQ)'],
    [{ language: 'eng', name: 'English SDH' }, 'Anglais (English SDH)'],
    [{ language: 'fre', isForced: true }, 'Français (forcés)'],
    [{ language: 'fre', isForced: true, name: 'French Forced' }, 'Français (French Forced)'],
    [{ language: 'yue' }, 'Cantonais'],
    [{ language: 'xyz' }, 'xyz'],
    [{}, 'Langue inconnue'],
  ])('%o → %s', (extra, label) => {
    expect(describeTrack({ ...base, ...extra })).toBe(label);
  });
});

describe('readStart', () => {
  it('lit les premiers octets puis coupe la réponse', async () => {
    let cancelled = false;
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        controller.enqueue(new Uint8Array(4).fill(sent));
      },
      cancel() {
        cancelled = true;
      },
    });
    expect([...(await readStart(body, 6))]).toEqual([1, 1, 1, 1, 2, 2]);
    expect(cancelled).toBe(true);
  });

  it('s’arrête à la fin d’une réponse courte', async () => {
    const body = new Response(new Uint8Array([7, 8])).body!;
    expect([...(await readStart(body, 10))]).toEqual([7, 8]);
  });
});
