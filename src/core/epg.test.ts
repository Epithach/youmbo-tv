import { describe, expect, it } from 'vitest';
import { decodeEpgText, nowAndNext, parseShortEpg, type Programme } from './epg';

const base64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));

describe('decodeEpgText', () => {
  it('décode le base64 en UTF-8', () => {
    expect(decodeEpgText(base64('Journal de 20h'))).toBe('Journal de 20h');
    expect(decodeEpgText(base64('Météo · Été'))).toBe('Météo · Été');
  });

  it('laisse un texte non encodé tel quel', () => {
    expect(decodeEpgText('Koh-Lanta')).toBe('Koh-Lanta');
    expect(decodeEpgText('Film')).toBe('Film'); // ressemble à du base64 mais n'est pas de l'UTF-8 valide
    expect(decodeEpgText(undefined)).toBe('');
  });
});

describe('parseShortEpg', () => {
  it('convertit, trie et écarte les entrées invalides', () => {
    const programmes = parseShortEpg({
      epg_listings: [
        { title: base64('Suite'), start_timestamp: '2000', stop_timestamp: '3000' },
        {
          title: base64('JT'),
          description: base64('Infos'),
          start_timestamp: 1000,
          stop_timestamp: 2000,
        },
        { title: '', start_timestamp: '3000', stop_timestamp: '4000' },
        { title: base64('Durée nulle'), start_timestamp: '5000', stop_timestamp: '5000' },
      ],
    });
    expect(programmes).toEqual([
      { title: 'JT', description: 'Infos', start: 1_000_000, end: 2_000_000 },
      { title: 'Suite', description: undefined, start: 2_000_000, end: 3_000_000 },
    ]);
  });

  it('accepte une réponse vide', () => {
    expect(parseShortEpg({})).toEqual([]);
  });
});

describe('nowAndNext', () => {
  const programmes: Programme[] = [
    { title: 'A', start: 0, end: 100 },
    { title: 'B', start: 100, end: 200 },
    { title: 'C', start: 300, end: 400 },
  ];

  it('trouve l’émission en cours et la suivante', () => {
    expect(nowAndNext(programmes, 150)).toEqual({ now: programmes[1], next: programmes[2] });
  });

  it('gère un trou dans le programme et la fin de liste', () => {
    expect(nowAndNext(programmes, 250)).toEqual({ now: undefined, next: programmes[2] });
    expect(nowAndNext(programmes, 350)).toEqual({ now: programmes[2], next: undefined });
  });
});
