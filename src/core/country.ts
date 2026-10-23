import type { Channel, Playlist } from './m3u';

/**
 * Classement des catégories par pays.
 *
 * Les fournisseurs n'indiquent pas le pays de façon structurée : on le devine
 * à partir des conventions de nommage courantes, de la plus fiable à la moins
 * fiable :
 *   1. un nom de pays dans la catégorie (`|EU| FRANCE SPORTS`, `|AR| MOROCCO`) ;
 *   2. un code pays en préfixe (`|DE| SPORT`, `|UK| NEWS`) ;
 *   3. le préfixe majoritaire des chaînes (`FR - LIGUE1+` dans `|EU| LIGUE 1+`) ;
 *   4. une région en préfixe (`|AR| BEIN SPORTS` → Monde arabe) ;
 *   5. sinon « International ».
 */

export const DEFAULT_COUNTRY = 'FR';
/** Pseudo-pays qui regroupe tout le catalogue. */
export const ALL_COUNTRIES = 'ALL';
export const INTERNATIONAL = 'INTL';

interface CountryDefinition {
  /** Nom affiché, en français. */
  name: string;
  /** Mots-clés (majuscules, sans accents) reconnus dans un nom de catégorie. */
  keywords?: string[];
  /** Région plutôt que pays : listée après les pays. */
  region?: boolean;
}

const COUNTRIES: Record<string, CountryDefinition> = {
  FR: { name: 'France', keywords: ['FRANCE', 'FRANCAIS', 'FRENCH', 'FR'] },
  BE: { name: 'Belgique', keywords: ['BELGIQUE', 'BELGIUM', 'BELGIE', 'BE'] },
  CH: { name: 'Suisse', keywords: ['SUISSE', 'SWISS', 'SWITZERLAND', 'SCHWEIZ'] },
  LU: { name: 'Luxembourg', keywords: ['LUXEMBOURG'] },
  ES: { name: 'Espagne', keywords: ['ESPANA', 'SPAIN', 'ESPAGNE'] },
  IT: { name: 'Italie', keywords: ['ITALIA', 'ITALY', 'ITALIE'] },
  DE: { name: 'Allemagne', keywords: ['DEUTSCHLAND', 'GERMANY', 'ALLEMAGNE'] },
  AT: { name: 'Autriche', keywords: ['AUSTRIA', 'AUTRICHE', 'OSTERREICH'] },
  NL: { name: 'Pays-Bas', keywords: ['NEDERLAND', 'NETHERLANDS', 'HOLLAND', 'PAYS-BAS'] },
  PT: { name: 'Portugal', keywords: ['PORTUGAL'] },
  GB: { name: 'Royaume-Uni', keywords: ['UK', 'ENGLAND', 'SCOTTISH', 'SCOTLAND', 'CYMRU'] },
  IE: { name: 'Irlande', keywords: ['IRELAND', 'IRLANDE'] },
  PL: { name: 'Pologne', keywords: ['POLAND', 'POLSKA', 'POLOGNE'] },
  GR: { name: 'Grèce', keywords: ['GREECE', 'GRECE'] },
  CY: { name: 'Chypre', keywords: ['CYPRUS', 'CHYPRE'] },
  CZ: { name: 'Tchéquie', keywords: ['CZECH', 'CZECHIA'] },
  RO: { name: 'Roumanie', keywords: ['ROMANIA', 'ROUMANIE'] },
  RS: { name: 'Serbie', keywords: ['SERBIA', 'SERBIE'] },
  HR: { name: 'Croatie', keywords: ['CROATIA', 'CROATIE'] },
  BA: { name: 'Bosnie-Herzégovine', keywords: ['BOSNIA', 'BOSNIE'] },
  SI: { name: 'Slovénie', keywords: ['SLOVENIA', 'SLOVENIE'] },
  MK: { name: 'Macédoine du Nord', keywords: ['MACEDONIA', 'MACEDOINE'] },
  ME: { name: 'Monténégro', keywords: ['MONTENEGRO'] },
  AL: { name: 'Albanie', keywords: ['ALBANIA', 'ALBANIE'] },
  XK: { name: 'Kosovo', keywords: ['KOSOVO'] },
  BG: { name: 'Bulgarie', keywords: ['BULGARIA', 'BULGARIE'] },
  HU: { name: 'Hongrie', keywords: ['HUNGARY', 'HONGRIE'] },
  RU: { name: 'Russie', keywords: ['RUSSIA', 'RUSSIE'] },
  BY: { name: 'Biélorussie', keywords: ['BELARUS'] },
  LT: { name: 'Lituanie', keywords: ['LITHUANIA', 'LITUANIE'] },
  LV: { name: 'Lettonie', keywords: ['LATVIA', 'LETTONIE'] },
  UA: { name: 'Ukraine', keywords: ['UKRAINE'] },
  SE: { name: 'Suède', keywords: ['SWEDEN', 'SUEDE', 'SVERIGE'] },
  DK: { name: 'Danemark', keywords: ['DENMARK', 'DANEMARK'] },
  NO: { name: 'Norvège', keywords: ['NORWAY', 'NORVEGE'] },
  FI: { name: 'Finlande', keywords: ['FINLAND', 'FINLANDE'] },
  MT: { name: 'Malte', keywords: ['MALTA', 'MALTE'] },
  AM: { name: 'Arménie', keywords: ['ARMENIA', 'ARMENIE'] },
  GE: { name: 'Géorgie', keywords: ['GEORGIA', 'GEORGIE'] },
  AZ: { name: 'Azerbaïdjan', keywords: ['AZERBAIJAN', 'AZERBAYCAN'] },
  TR: { name: 'Turquie', keywords: ['TURKEY', 'TURKIYE', 'TURQUIE'] },
  IL: { name: 'Israël', keywords: ['ISRAEL'] },
  MA: { name: 'Maroc', keywords: ['MOROCCO', 'MAROC'] },
  DZ: { name: 'Algérie', keywords: ['ALGERIA', 'ALGERIE'] },
  TN: { name: 'Tunisie', keywords: ['TUNISIA', 'TUNISA', 'TUNISIE'] },
  LY: { name: 'Libye', keywords: ['LIBYA', 'LIBYE'] },
  EG: { name: 'Égypte', keywords: ['EGYPT', 'EGYPTE'] },
  MR: { name: 'Mauritanie', keywords: ['MAURITANIA', 'MAURITANIE'] },
  SD: { name: 'Soudan', keywords: ['SUDAN', 'SOUDAN'] },
  LB: { name: 'Liban', keywords: ['LEBANON', 'LIBAN'] },
  SY: { name: 'Syrie', keywords: ['SYRIA', 'SYRIE'] },
  JO: { name: 'Jordanie', keywords: ['JORDAN', 'JORDANIE'] },
  PS: { name: 'Palestine', keywords: ['PALESTINE'] },
  IQ: { name: 'Irak', keywords: ['IRAQ', 'IRAK'] },
  SA: { name: 'Arabie saoudite', keywords: ['SAUDI', 'SAOUDI', 'KSA'] },
  AE: { name: 'Émirats arabes unis', keywords: ['UAE', 'EMIRATES', 'ABU DHABI', 'DUBAI'] },
  QA: { name: 'Qatar', keywords: ['QATAR'] },
  KW: { name: 'Koweït', keywords: ['KUWAIT', 'KOWEIT'] },
  BH: { name: 'Bahreïn', keywords: ['BAHRAIN'] },
  OM: { name: 'Oman', keywords: ['OMAN'] },
  YE: { name: 'Yémen', keywords: ['YEMEN'] },
  IR: { name: 'Iran', keywords: ['IRAN'] },
  AF: { name: 'Afghanistan', keywords: ['AFGHANISTAN'] },
  PK: { name: 'Pakistan', keywords: ['PAKISTAN'] },
  IN: {
    name: 'Inde',
    keywords: [
      'INDIA',
      'INDE',
      'TAMIL',
      'PUNJABI',
      'GUJARATI',
      'MALAYALAM',
      'MARATHI',
      'TELUGU',
      'KANNADA',
      'BHOJPURI',
      'ASSAM',
    ],
  },
  BD: { name: 'Bangladesh', keywords: ['BANGLADESH', 'BANGLA'] },
  NP: { name: 'Népal', keywords: ['NEPAL'] },
  LK: { name: 'Sri Lanka', keywords: ['SRI LANKA', 'SRILANKA'] },
  VN: { name: 'Viêt Nam', keywords: ['VIETNAM'] },
  TH: { name: 'Thaïlande', keywords: ['THAILAND', 'THAILANDE'] },
  MY: { name: 'Malaisie', keywords: ['MALAYSIA', 'MALAISIE'] },
  ID: { name: 'Indonésie', keywords: ['INDONESIA', 'INDONESIE'] },
  PH: { name: 'Philippines', keywords: ['PHILIPPINES'] },
  HK: { name: 'Hong Kong', keywords: ['HONG KONG', 'HONGKONG'] },
  KR: { name: 'Corée du Sud', keywords: ['SOUTH KOREA', 'KOREA', 'COREE'] },
  JP: { name: 'Japon', keywords: ['JAPAN', 'JAPON'] },
  AU: { name: 'Australie', keywords: ['AUSTRALIA', 'AUSTRALIE'] },
  NZ: { name: 'Nouvelle-Zélande', keywords: ['NEW ZEALAND', 'NOUVELLE-ZELANDE'] },
  US: { name: 'États-Unis', keywords: ['USA', 'UNITED STATES'] },
  CA: { name: 'Canada', keywords: ['CANADA'] },
  MX: { name: 'Mexique', keywords: ['MEXICO', 'MEXIQUE'] },
  BR: { name: 'Brésil', keywords: ['BRAZIL', 'BRASIL', 'BRESIL'] },
  AR: { name: 'Argentine', keywords: ['ARGENTINA', 'ARGENTINE'] },
  CL: { name: 'Chili', keywords: ['CHILE', 'CHILI'] },
  CO: { name: 'Colombie', keywords: ['COLOMBIA', 'COLOMBIE'] },
  PE: { name: 'Pérou', keywords: ['PERU', 'PEROU'] },
  EC: { name: 'Équateur', keywords: ['ECUADOR', 'EQUATEUR'] },
  BO: { name: 'Bolivie', keywords: ['BOLIVIA', 'BOLIVIE'] },
  PY: { name: 'Paraguay', keywords: ['PARAGUAY'] },
  UY: { name: 'Uruguay', keywords: ['URUGUAY'] },
  CR: { name: 'Costa Rica', keywords: ['COSTA RICA'] },
  PA: { name: 'Panama', keywords: ['PANAMA'] },
  GT: { name: 'Guatemala', keywords: ['GUATEMALA'] },
  HN: { name: 'Honduras', keywords: ['HONDURAS'] },
  SV: { name: 'Salvador', keywords: ['EL SALVADOR'] },
  NI: { name: 'Nicaragua', keywords: ['NICARAGUA'] },
  DO: { name: 'République dominicaine', keywords: ['DOMINICANA', 'DOMINICAN'] },
  HT: { name: 'Haïti', keywords: ['HAITI'] },
  SR: { name: 'Suriname', keywords: ['SURINAME'] },
  SN: { name: 'Sénégal', keywords: ['SENEGAL'] },
  ML: { name: 'Mali', keywords: ['MALI'] },
  CM: { name: 'Cameroun', keywords: ['CAMEROON', 'CAMEROUN'] },
  CG: { name: 'Congo', keywords: ['CONGO'] },
  GH: { name: 'Ghana', keywords: ['GHANA'] },
  NG: { name: 'Nigeria', keywords: ['NIGERIA'] },
  SO: { name: 'Somalie', keywords: ['SOMALIA', 'SOMALIE'] },

  ARAB: { name: 'Monde arabe', region: true },
  AFRICA: { name: 'Afrique', keywords: ['AFRIQUE', 'AFRICA'], region: true },
  BALKANS: { name: 'Balkans', region: true },
  CARIBBEAN: { name: 'Caraïbes', keywords: ['CARIBBEAN', 'CARRIBEAN', 'CARAIBES'], region: true },
  LATAM: { name: 'Amérique latine', keywords: ['LATINO', 'LATAM'], region: true },
  AMERICAS: { name: 'Amériques', region: true },
  ASIA: { name: 'Asie', region: true },
  KURDISTAN: { name: 'Kurdistan', keywords: ['KURDISTAN', 'KURDISH'], region: true },
  EUROPE: { name: 'Europe', region: true },
  [INTERNATIONAL]: { name: 'International', region: true },
};

/** Préfixes de catégorie (`|XX|`) qui désignent un pays ou une région. */
const PREFIXES: Record<string, string> = {
  UK: 'GB',
  EN: 'GB',
  ALB: 'AL',
  NA: 'US',
  AR: 'ARAB',
  AF: 'AFRICA',
  BLN: 'BALKANS',
  SA: 'LATAM',
  AM: 'AMERICAS',
  AS: 'ASIA',
  EU: 'EUROPE',
};

/** Préfixes de chaîne (`FR - TF1`) assez fiables pour en déduire un pays. */
const CHANNEL_PREFIXES: Record<string, string> = {
  FR: 'FR',
  BE: 'BE',
  SW: 'CH',
  UK: 'GB',
  ES: 'ES',
  DE: 'DE',
  IT: 'IT',
  NL: 'NL',
  PT: 'PT',
  PL: 'PL',
  GR: 'GR',
  CY: 'CY',
  USA: 'US',
  CA: 'CA',
  CAFR: 'CA',
  IN: 'IN',
  TR: 'TR',
  RO: 'RO',
  BG: 'BG',
  HU: 'HU',
  CZ: 'CZ',
  DK: 'DK',
  SE: 'SE',
  NOR: 'NO',
  RUS: 'RU',
  PAK: 'PK',
  ALB: 'AL',
  LAT: 'LATAM',
};

/** Part minimale des chaînes d'une catégorie qui doivent partager le même préfixe. */
const CHANNEL_PREFIX_MAJORITY = 0.8;

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const keywordToCode = new Map<string, string>();
for (const [code, definition] of Object.entries(COUNTRIES)) {
  for (const keyword of definition.keywords ?? []) keywordToCode.set(keyword, code);
}

// Mots-clés les plus longs d'abord, pour que « SOUTH KOREA » passe avant « KOREA ».
const KEYWORDS = new RegExp(
  `(?:^|[^A-Z0-9])(${[...keywordToCode.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|')})(?![A-Z0-9])`,
);

const CATEGORY_PREFIX = /^\s*[|[]\s*([A-Z0-9]{2,4})\s*[|\]]\s*/;
const CHANNEL_PREFIX = /^\s*(?:[|[]\s*([A-Z0-9]{2,4})\s*[|\]]|([A-Z]{2,4})\s*[-:|])/;

/** Pays d'une catégorie d'après son nom seul, ou `undefined` si rien de concluant. */
export function countryFromCategory(category: string): string | undefined {
  const name = normalize(category);
  const prefix = CATEGORY_PREFIX.exec(name)?.[1];
  // Les parenthèses précisent une variante (`BEIN SPORTS (UK)`), pas le pays de la catégorie.
  const rest = (prefix ? name.replace(CATEGORY_PREFIX, '') : name).replace(/\([^)]*\)/g, ' ');

  const keyword = KEYWORDS.exec(rest)?.[1];
  if (keyword) return keywordToCode.get(keyword);

  if (!prefix) return undefined;
  const mapped = PREFIXES[prefix] ?? prefix;
  const definition = COUNTRIES[mapped];
  // Une région (|EU|, |AR|…) reste un dernier recours, après les chaînes.
  return definition && !definition.region ? mapped : undefined;
}

function regionFromCategory(category: string): string | undefined {
  const prefix = CATEGORY_PREFIX.exec(normalize(category))?.[1];
  const mapped = prefix ? PREFIXES[prefix] : undefined;
  return mapped && COUNTRIES[mapped]?.region ? mapped : undefined;
}

function countryFromChannels(channels: readonly Channel[]): string | undefined {
  const counts = new Map<string, number>();
  for (const channel of channels) {
    const match = CHANNEL_PREFIX.exec(normalize(channel.name));
    const code = match ? CHANNEL_PREFIXES[match[1] ?? match[2]] : undefined;
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  for (const [code, count] of counts) {
    if (count >= channels.length * CHANNEL_PREFIX_MAJORITY) return code;
  }
  return undefined;
}

export function detectCountry(category: string, channels: readonly Channel[]): string {
  return (
    countryFromCategory(category) ??
    countryFromChannels(channels) ??
    regionFromCategory(category) ??
    INTERNATIONAL
  );
}

export function countryName(code: string): string {
  return COUNTRIES[code]?.name ?? code;
}

/** Nom de catégorie à afficher : le préfixe `|XX|` est redondant une fois trié par pays. */
export function displayGroupName(group: string): string {
  return group.replace(/^\s*[|[]\s*[A-Za-z0-9]{2,4}\s*[|\]]\s*/, '') || group;
}

export interface CountryEntry {
  code: string;
  name: string;
  /** Catégories du pays, dans l'ordre de la playlist. */
  groups: string[];
  channels: Channel[];
}

/**
 * Regroupe la playlist par pays. Ordre : la France, puis les pays par ordre
 * alphabétique, puis les régions, et « International » en dernier.
 */
export function indexByCountry(playlist: Playlist): CountryEntry[] {
  const channelsByGroup = new Map<string, Channel[]>();
  for (const channel of playlist.channels) {
    const list = channelsByGroup.get(channel.group);
    if (list) list.push(channel);
    else channelsByGroup.set(channel.group, [channel]);
  }

  const entries = new Map<string, CountryEntry>();
  for (const group of playlist.groups) {
    const channels = channelsByGroup.get(group) ?? [];
    const code = detectCountry(group, channels);
    let entry = entries.get(code);
    if (!entry) {
      entry = { code, name: countryName(code), groups: [], channels: [] };
      entries.set(code, entry);
    }
    entry.groups.push(group);
    for (const channel of channels) entry.channels.push(channel);
  }

  const rank = (code: string) =>
    code === DEFAULT_COUNTRY ? 0 : code === INTERNATIONAL ? 3 : COUNTRIES[code]?.region ? 2 : 1;
  const collator = new Intl.Collator('fr');

  return [...entries.values()].sort(
    (a, b) => rank(a.code) - rank(b.code) || collator.compare(a.name, b.name),
  );
}
