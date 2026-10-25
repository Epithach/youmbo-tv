import { describe, expect, it } from 'vitest';
import { brandName, groupByBrand } from './channel-brands';
import type { Channel } from './m3u';

const channel = (id: string, name: string, logo?: string): Channel => ({
  id,
  name,
  url: `http://example.test/${id}`,
  group: 'Sport',
  logo,
});

describe('brandName', () => {
  it.each([
    ['FR - DAZN 1', 'DAZN'],
    ['FR - DAZN 2 FHD', 'DAZN'],
    ['FR| beIN SPORTS 3 HD', 'beIN SPORTS'],
    ['FR - TF1', 'TF1'],
    ['FR - TF1 HD', 'TF1'],
    ['FR - M6 (backup)', 'M6'],
    ['FR - Canal+ Sport 360', 'Canal+ Sport 360'],
    ['RMC Sport 1 UHD 4K', 'RMC Sport'],
    ['FR - 13', '13'],
  ])('%s → %s', (name, brand) => {
    expect(brandName(name)).toBe(brand);
  });
});

describe('groupByBrand', () => {
  it('regroupe les déclinaisons d’une même chaîne, dans l’ordre', () => {
    const brands = groupByBrand([
      channel('1', 'FR - DAZN 1'),
      channel('2', 'FR - TF1', 'tf1.png'),
      channel('3', 'FR - DAZN 2', 'dazn.png'),
      channel('4', 'FR - DAZN 3 HD'),
    ]);
    expect(brands.map((b) => b.name)).toEqual(['DAZN', 'TF1']);
    expect(brands[0].channels.map((c) => c.id)).toEqual(['1', '3', '4']);
    // Logo de la première déclinaison qui en a un.
    expect(brands[0].logo).toBe('dazn.png');
    expect(brands[1].logo).toBe('tf1.png');
  });

  it('ne mélange pas majuscules et accents', () => {
    const brands = groupByBrand([channel('1', 'Ciné+ 1'), channel('2', 'CINE+ 2')]);
    expect(brands).toHaveLength(1);
  });
});
