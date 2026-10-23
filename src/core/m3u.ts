export interface Channel {
  /** Identifiant stable dans la playlist (position), utile pour les listes. */
  id: string;
  name: string;
  url: string;
  group: string;
  logo?: string;
  tvgId?: string;
  /** Identifiant Xtream de la chaîne : sert à demander son programme (EPG). */
  streamId?: number;
}

export interface Playlist {
  channels: Channel[];
  /** Groupes dans l'ordre d'apparition. */
  groups: string[];
  /** URL du guide XMLTV annoncée dans l'en-tête (`url-tvg` / `x-tvg-url`). */
  epgUrl?: string;
}

export const UNGROUPED = 'Sans catégorie';

/**
 * Les fournisseurs glissent des faux titres dans les listes (`##### GENERAL #####`,
 * `===== SPORT =====`) : ce ne sont pas des chaînes, on les retire.
 */
export function isSeparator(name: string): boolean {
  return /^\s*(#{3,}|={3,}|-{3,}|\*{3,}|•{3,})/.test(name);
}

const ATTRIBUTE = /([\w-]+)="([^"]*)"/g;

function parseAttributes(text: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of text.matchAll(ATTRIBUTE)) {
    attributes[match[1].toLowerCase()] = match[2];
  }
  return attributes;
}

/** Position de la virgule qui sépare les attributs du nom, hors guillemets. */
function findTitleComma(text: string): number {
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) return i;
  }
  return -1;
}

/**
 * Parse une playlist M3U / M3U8 "étendue" au format IPTV.
 * Linéaire et tolérant : les lignes inconnues sont ignorées, une entrée sans
 * `#EXTINF` prend son URL comme nom.
 */
export function parseM3u(source: string): Playlist {
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
  const channels: Channel[] = [];
  const groups: string[] = [];
  const seenGroups = new Set<string>();
  let epgUrl: string | undefined;

  let pending: { name: string; attributes: Record<string, string> } | undefined;
  let pendingGroup: string | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') continue;

    if (line.startsWith('#EXTM3U')) {
      const attributes = parseAttributes(line);
      epgUrl = attributes['url-tvg'] ?? attributes['x-tvg-url'] ?? epgUrl;
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      const body = line.slice('#EXTINF:'.length);
      const comma = findTitleComma(body);
      const attributesPart = comma === -1 ? body : body.slice(0, comma);
      pending = {
        name: comma === -1 ? '' : body.slice(comma + 1).trim(),
        attributes: parseAttributes(attributesPart),
      };
      continue;
    }

    if (line.startsWith('#EXTGRP:')) {
      pendingGroup = line.slice('#EXTGRP:'.length).trim();
      continue;
    }

    if (line.startsWith('#')) continue;

    const attributes = pending?.attributes ?? {};
    const name = pending?.name || attributes['tvg-name'] || line;
    if (isSeparator(name)) {
      pending = undefined;
      pendingGroup = undefined;
      continue;
    }

    const group = attributes['group-title'] || pendingGroup || UNGROUPED;
    if (!seenGroups.has(group)) {
      seenGroups.add(group);
      groups.push(group);
    }

    channels.push({
      id: String(channels.length),
      name,
      url: line,
      group,
      logo: attributes['tvg-logo'] || undefined,
      tvgId: attributes['tvg-id'] || undefined,
    });

    pending = undefined;
    pendingGroup = undefined;
  }

  return { channels, groups, epgUrl };
}
