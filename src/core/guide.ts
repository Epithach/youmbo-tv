import type { Programme } from './epg';
import type { Channel } from './m3u';

const DAY = 86_400_000;

export type ProgrammeStatus = 'live' | 'replay' | 'past' | 'future';

/** Où en est une émission : en direct, disponible en replay, passée ou à venir. */
export function programmeStatus(
  programme: Programme,
  channel: Channel,
  now: number,
): ProgrammeStatus {
  if (programme.start <= now && now < programme.end) return 'live';
  if (programme.start > now) return 'future';
  const inArchive =
    channel.archiveDays !== undefined && now - programme.start <= channel.archiveDays * DAY;
  return inArchive && programme.archived !== false ? 'replay' : 'past';
}

export const STATUS_LABELS: Record<ProgrammeStatus, string> = {
  live: '● En direct · OK pour regarder',
  replay: '↺ Replay disponible · OK pour regarder',
  past: 'Émission passée',
  future: 'À venir',
};
