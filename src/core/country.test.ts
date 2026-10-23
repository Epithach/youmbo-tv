import { describe, expect, it } from 'vitest';
import { detectCountry, displayGroupName, indexByCountry, INTERNATIONAL } from './country';
import type { Channel } from './m3u';

const channels = (...names: string[]): Channel[] =>
  names.map((name, i) => ({ id: String(i), name, url: `http://x/${i}`, group: 'g' }));

describe('detectCountry', () => {
  it.each([
    // Nom de pays dans la catégorie, quel que soit le préfixe de région
    ['|EU| FRANCE GÉNÉRAL', 'FR'],
    ['|EU| FR SOCCER PPV', 'FR'],
    ['|EU| BELGIQUE HD', 'BE'],
    ['|EU| SWISS HD', 'CH'],
    ['|AR| MOROCCO', 'MA'],
    ['|AR| TUNISA', 'TN'],
    ['|AS| TURKEY | SPOR', 'TR'],
    ['|AM| COSTA RICA', 'CR'],
    ['|AS| SOUTH KOREA', 'KR'],
    ['|ES| ESPAÑA HEVC', 'ES'],
    ['|AS| TAMIL', 'IN'],
    ['JAPAN', 'JP'],
    // Le premier pays cité l'emporte
    ['|NA| CANADA FR', 'CA'],
    ['|EU| FRANCE CARRIBEAN', 'FR'],
    // Code pays en préfixe
    ['|DE| SPORT', 'DE'],
    ['|UK| NEWS', 'GB'],
    ['|ALB| MUSIC', 'AL'],
    ['|NA| TELEMUNDO', 'US'],
    // Régions
    ['|AR| BEIN SPORTS AFC', 'ARAB'],
    ['|AF| C+ AFRIQUE', 'AFRICA'],
    ['|SA| LATINO', 'LATAM'],
    ['|BLN| SPORTS', 'BALKANS'],
    // Rien de concluant
    ['FORMULA 1 + MOTO GP', INTERNATIONAL],
    ['4K UHD', INTERNATIONAL],
  ])('%s → %s', (category, code) => {
    expect(detectCountry(category, [])).toBe(code);
  });

  it('ne confond pas un mot-clé avec un morceau de mot', () => {
    expect(detectCountry('|AR| BEIN ENTERTAINMENT', [])).toBe('ARAB'); // pas BE
    expect(detectCountry('|AF| SOMALIA', [])).toBe('SO'); // pas MALI
    expect(detectCountry('|EU| ROMANIA', [])).toBe('RO'); // pas OMAN
  });

  it('ignore les variantes entre parenthèses', () => {
    expect(detectCountry('|AR| BEIN SPORTS (UK)', [])).toBe('ARAB');
  });

  it('se rabat sur le préfixe majoritaire des chaînes', () => {
    const french = channels('FR - LIGUE1+ HD', 'FR - LIGUE1+ 2', 'FR| DISNEY+ 1', 'FR - L1+ 4');
    expect(detectCountry('|EU| LIGUE 1+ VIP', french)).toBe('FR');
    expect(detectCountry('|EU| DAZN LA LIGA', french)).toBe('FR');
  });

  it('ignore un préfixe de chaînes minoritaire', () => {
    const mixed = channels('FR - A', 'UK - B', 'DE - C', 'ES - D');
    expect(detectCountry('|EU| PPV EVENTS', mixed)).toBe('EUROPE');
  });
});

describe('displayGroupName', () => {
  it.each([
    ['|EU| FRANCE SPORTS', 'FRANCE SPORTS'],
    ['|AS| TURKEY | SPOR', 'TURKEY | SPOR'],
    ['[UK] NEWS', 'NEWS'],
    ['4K UHD', '4K UHD'],
    ['|FR|', '|FR|'],
  ])('%s → %s', (group, shown) => {
    expect(displayGroupName(group)).toBe(shown);
  });
});

describe('indexByCountry', () => {
  const groups = ['|UK| GENERAL', '|EU| FRANCE INFO', '|AR| BEIN SPORTS', '4K UHD', '|DE| SPORT'];
  const playlist = {
    groups,
    channels: groups.map((group, i) => ({ id: String(i), name: `c${i}`, url: `u${i}`, group })),
  };
  const index = indexByCountry(playlist);

  it('met la France en premier, puis les pays, les régions et International', () => {
    expect(index.map((e) => e.code)).toEqual(['FR', 'DE', 'GB', 'ARAB', INTERNATIONAL]);
    expect(index.map((e) => e.name)).toEqual([
      'France',
      'Allemagne',
      'Royaume-Uni',
      'Monde arabe',
      'International',
    ]);
  });

  it('rattache catégories et chaînes à leur pays', () => {
    expect(index[0]).toMatchObject({ groups: ['|EU| FRANCE INFO'] });
    expect(index[0].channels.map((c) => c.name)).toEqual(['c1']);
  });
});
