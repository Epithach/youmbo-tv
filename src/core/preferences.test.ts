import { describe, expect, it } from 'vitest';
import type { TrackOption } from '../player/types';
import { baseLanguage, defaultPreferences, pickTracks } from './preferences';

const track = (
  id: string,
  type: TrackOption['type'],
  language: string,
  label = language,
  forced = false,
): TrackOption => ({ id, type, language, label, forced, selected: false });

/** Pistes typiques d'un film du fournisseur (VO anglaise par défaut). */
const film = [
  track('1', 'audio', 'eng', 'English AC3 5.1'),
  track('2', 'audio', 'fre', 'Français (Audio-Description)'),
  track('3', 'audio', 'fre', 'French AC3 5.1'),
  track('4', 'subtitle', 'fre', 'French Forced', true),
  track('5', 'subtitle', 'fre', 'French Complet'),
  track('6', 'subtitle', 'eng', 'English SDH'),
];

describe('baseLanguage', () => {
  it.each([
    ['fre', 'fr'],
    ['fra', 'fr'],
    ['fr-CA', 'fr'],
    ['ENG', 'en'],
    ['yue', 'yue'],
    [undefined, undefined],
  ])('%s → %s', (code, base) => {
    expect(baseLanguage(code)).toBe(base);
  });
});

describe('pickTracks', () => {
  it('VF et sous-titres forcés, sans l’audiodescription', () => {
    expect(pickTracks(film, { audioLanguage: 'fr', subtitles: 'forced' })).toEqual({
      audio: '3',
      subtitle: '4',
    });
  });

  it('sous-titres complets dans la langue choisie', () => {
    expect(pickTracks(film, { audioLanguage: 'fr', subtitles: 'always' })).toEqual({
      audio: '3',
      subtitle: '5',
    });
  });

  it('version originale : piste du fichier, sous-titres français', () => {
    expect(pickTracks(film, { audioLanguage: 'original', subtitles: 'always' })).toEqual({
      audio: undefined,
      subtitle: '5',
    });
  });

  it('sans piste dans la langue : on garde celle du fichier et pas de sous-titres', () => {
    expect(pickTracks(film, { audioLanguage: 'de', subtitles: 'forced' })).toEqual({
      audio: undefined,
      subtitle: null,
    });
  });

  it('sous-titres désactivés', () => {
    expect(pickTracks(film, { audioLanguage: 'en', subtitles: 'off' }).subtitle).toBeNull();
  });
});

describe('defaultPreferences', () => {
  it('suit le pays choisi', () => {
    expect(defaultPreferences('FR')).toEqual({ audioLanguage: 'fr', subtitles: 'forced' });
    expect(defaultPreferences('GB').audioLanguage).toBe('en');
    expect(defaultPreferences('ARAB').audioLanguage).toBe('original');
  });
});
