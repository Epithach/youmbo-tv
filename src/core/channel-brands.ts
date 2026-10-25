import type { Channel } from './m3u';
import { normalize } from './text';

/** Une « marque » de chaînes : DAZN pour DAZN 1, DAZN 2, DAZN 3… */
export interface ChannelBrand {
  key: string;
  name: string;
  logo?: string;
  channels: Channel[];
}

/** Mentions de qualité ou de format, sans rapport avec la chaîne elle-même. */
const QUALITY = /\b(UHD|FHD|HD|SD|4K|HEVC|H\.?265|H\.?264|HDR|50 ?FPS|60 ?FPS|LQ|HQ|RAW)\b/gi;

/**
 * Nom de la marque d'une chaîne : sans préfixe de pays (« FR - »), sans
 * mention de qualité, sans numéro final (« DAZN 2 » → « DAZN »).
 * Les numéros collés au nom font partie de la marque (TF1, M6, W9).
 */
export function brandName(channelName: string): string {
  const name = channelName
    .replace(/^\s*[A-Z]{2,3}\s*[-|:]\s*/, '')
    .replace(/[[(][^\])]*[\])]/g, ' ')
    .replace(QUALITY, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const withoutNumber = name.replace(/\s+\d{1,2}$/, '').trim();
  return withoutNumber || name || channelName.trim();
}

/** Regroupe les chaînes par marque, dans l'ordre de leur première apparition. */
export function groupByBrand(channels: readonly Channel[]): ChannelBrand[] {
  const brands = new Map<string, ChannelBrand>();
  for (const channel of channels) {
    const name = brandName(channel.name);
    const key = normalize(name);
    const brand = brands.get(key);
    if (brand) {
      brand.channels.push(channel);
      if (!brand.logo) brand.logo = channel.logo || undefined;
    } else {
      brands.set(key, { key, name, logo: channel.logo || undefined, channels: [channel] });
    }
  }
  return [...brands.values()];
}
