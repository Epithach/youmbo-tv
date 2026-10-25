import type Hls from 'hls.js';
import type Mpegts from 'mpegts.js';
import { describeTrack, probeMkvTracks, type MediaTrack } from '../core/mkv';
import { proxify } from '../core/net';
import {
  detectStreamKind,
  type Player,
  type PlayerEvents,
  type PlayerState,
  type TrackList,
  type TrackOption,
  type TrackType,
} from './types';

/** Pistes audio exposées par certains navigateurs (Safari, Chrome avec option). */
interface BrowserAudioTrack {
  id: string;
  label: string;
  language: string;
  enabled: boolean;
}
type VideoWithAudioTracks = HTMLVideoElement & {
  audioTracks?: { length: number; [index: number]: BrowserAudioTrack };
};

/** Secondes de vidéo à avoir en réserve avant de lancer la lecture d'un flux live. */
const CUSHION_SECONDS = 2.5;
/**
 * Pause entre la fermeture d'un flux et l'ouverture du suivant : les
 * abonnements à une seule connexion ne doivent jamais en voir deux à la fois.
 */
const SWITCH_GAP_MS = 400;
const isMkv = (url: string) => /\.(mkv|webm)(\?|$)/i.test(url);

/**
 * Lecteur navigateur : hls.js pour le HLS, mpegts.js pour le MPEG-TS brut
 * (la majorité des flux IPTV), balise <video> pour le reste.
 * Les deux bibliothèques sont chargées à la demande.
 */
export class WebPlayer implements Player {
  private hls?: Hls;
  private mpegts?: Mpegts.Player;
  /** Incrémenté à chaque lecture pour ignorer les chargements devenus obsolètes. */
  private generation = 0;
  private state: PlayerState = 'idle';
  private url?: string;
  /** Pistes lues dans l'en-tête du MKV en cours : on ne le télécharge qu'une fois. */
  private probed?: { url: string; tracks: Promise<MediaTrack[]> };

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly events: PlayerEvents,
  ) {
    // `playing` ne suit pas toujours un `waiting` sur les flux live (rattrapage de
    // latence de mpegts.js) : on considère aussi que la vidéo joue dès que le temps avance.
    const markPlaying = () => {
      if (this.state === 'loading' && !video.paused) this.setState('playing');
    };
    video.addEventListener('playing', markPlaying);
    video.addEventListener('timeupdate', markPlaying);
    video.addEventListener('waiting', () => {
      if (this.state === 'playing') this.setState('loading');
    });
  }

  private setState(state: PlayerState, message?: string) {
    this.state = state;
    this.events.onStateChange(state, message);
  }

  play(url: string): void {
    const wasStreaming = this.state !== 'idle';
    this.stop();
    this.url = url;
    const generation = ++this.generation;
    this.setState('loading');
    if (wasStreaming) {
      setTimeout(() => {
        if (generation === this.generation) this.open(url, generation);
      }, SWITCH_GAP_MS);
    } else {
      this.open(url, generation);
    }
  }

  private open(url: string, generation: number) {
    const fail = (message: string) => {
      if (generation === this.generation) this.setState('error', message);
    };
    // Ex. bibliothèque de lecture introuvable : on l'affiche au lieu de rester sur « Chargement… ».
    const onLoadError = (error: Error) => fail(`Lecteur indisponible : ${error.message}`);

    switch (detectStreamKind(url)) {
      case 'hls':
        this.playHls(url, generation, fail).catch(onLoadError);
        break;
      case 'mpegts':
        this.playMpegts(url, generation, fail).catch(onLoadError);
        break;
      case 'native': {
        const start = () => {
          if (generation !== this.generation) return;
          this.video.src = proxify(url);
          this.video.play().catch((error: Error) => fail(error.message));
        };
        // MKV : pistes lues dans l'en-tête avant de lancer la vidéo, pas en même temps.
        if (isMkv(url)) void this.probe(url).then(start);
        else start();
        break;
      }
    }
  }

  private async playHls(url: string, generation: number, fail: (message: string) => void) {
    const { default: HlsClass } = await import('hls.js');
    if (generation !== this.generation) return;
    if (!HlsClass.isSupported()) return fail('HLS non supporté par ce navigateur');

    const hls = new HlsClass({
      // Chaque requête (manifeste, segments, clés) passe par le proxy en dev.
      xhrSetup: (xhr, requestUrl) => xhr.open('GET', proxify(requestUrl), true),
    });
    this.hls = hls;
    hls.on(HlsClass.Events.ERROR, (_event, data) => {
      if (data.fatal) fail(`Erreur HLS : ${data.details}`);
    });
    hls.loadSource(url);
    hls.attachMedia(this.video);
    this.video.play().catch(() => undefined);
  }

  private async playMpegts(url: string, generation: number, fail: (message: string) => void) {
    const { default: mpegts } = await import('mpegts.js');
    if (generation !== this.generation) return;
    if (!mpegts.isSupported()) return fail('MPEG-TS non supporté par ce navigateur');

    const player = mpegts.createPlayer(
      { type: 'mpegts', isLive: true, url: proxify(url) },
      {
        // Démultiplexage hors du thread principal : l'UI ne fait pas saccader la vidéo.
        enableWorker: true,
        // On privilégie la fluidité au direct strict : pas de rattrapage de latence,
        // qui vidait la réserve en permanence et provoquait coupures et sauts.
        enableStashBuffer: true,
        liveBufferLatencyChasing: false,
        liveSync: false,
        autoCleanupSourceBuffer: true,
        autoCleanupMaxBackwardDuration: 30,
        autoCleanupMinBackwardDuration: 15,
      },
    );
    this.mpegts = player;
    player.on(mpegts.Events.ERROR, (type: string, details: string) =>
      fail(`Erreur flux : ${type} / ${details}`),
    );
    player.attachMediaElement(this.video);
    player.load();
    this.playWithCushion(generation);
  }

  /**
   * Un flux live arrive en temps réel : la réserve n'augmente jamais pendant la
   * lecture. On attend donc d'avoir `CUSHION_SECONDS` d'avance avant de lancer
   * (et de relancer après une coupure) pour absorber les à-coups du réseau.
   */
  private playWithCushion(generation: number) {
    const video = this.video;
    let waitingForCushion = true;

    const bufferedAhead = () => {
      const ranges = video.buffered;
      return ranges.length ? ranges.end(ranges.length - 1) - video.currentTime : 0;
    };

    const timer = setInterval(() => {
      if (generation !== this.generation) return clearInterval(timer);
      if (waitingForCushion && bufferedAhead() >= CUSHION_SECONDS) {
        waitingForCushion = false;
        video.play().catch(() => undefined);
      }
    }, 200);

    const onWaiting = () => {
      if (generation !== this.generation) return video.removeEventListener('waiting', onWaiting);
      if (waitingForCushion) return;
      waitingForCushion = true;
      video.pause();
    };
    video.addEventListener('waiting', onWaiting);
  }

  private probe(url: string): Promise<MediaTrack[]> {
    if (this.probed?.url !== url) {
      this.probed = { url, tracks: probeMkvTracks(proxify(url)).catch(() => []) };
    }
    return this.probed.tracks;
  }

  stop(): void {
    this.generation++;
    this.hls?.destroy();
    this.hls = undefined;
    if (this.mpegts) {
      this.mpegts.pause();
      this.mpegts.unload();
      this.mpegts.detachMediaElement();
      this.mpegts.destroy();
      this.mpegts = undefined;
    }
    this.video.removeAttribute('src');
    this.video.load();
    this.setState('idle');
  }

  destroy(): void {
    this.stop();
  }

  togglePause(): void {
    if (this.video.paused) this.video.play().catch(() => undefined);
    else this.video.pause();
  }

  seekBy(seconds: number): void {
    const duration = this.duration();
    const target = this.video.currentTime + seconds;
    this.video.currentTime = Math.max(0, duration ? Math.min(target, duration - 1) : target);
  }

  position(): number {
    return this.video.currentTime || 0;
  }

  duration(): number {
    const { duration } = this.video;
    return Number.isFinite(duration) ? duration : 0;
  }

  paused(): boolean {
    return this.video.paused;
  }

  volume(): number {
    return this.video.muted ? 0 : this.video.volume;
  }

  setVolume(volume: number): void {
    this.video.muted = false;
    this.video.volume = Math.min(1, Math.max(0, volume));
  }

  async tracks(): Promise<TrackList> {
    // HLS : hls.js connaît les pistes et sait en changer.
    if (this.hls) {
      const hls = this.hls;
      const options: TrackOption[] = [
        ...hls.audioTracks.map((track, index) => ({
          id: String(index),
          type: 'audio' as const,
          label: track.name || track.lang || `Piste ${index + 1}`,
          selected: index === hls.audioTrack,
        })),
        ...hls.subtitleTracks.map((track, index) => ({
          id: String(index),
          type: 'subtitle' as const,
          label: track.name || track.lang || `Sous-titres ${index + 1}`,
          selected: index === hls.subtitleTrack,
        })),
      ];
      return { options, switchable: true };
    }

    // Fichier MKV : on lit les pistes dans son en-tête.
    if (!this.url || !isMkv(this.url)) return { options: [], switchable: false };
    const tracks = await this.probe(this.url);
    const browserAudio = (this.video as VideoWithAudioTracks).audioTracks;
    const audio = tracks.filter((track) => track.kind === 'audio');
    const defaultAudio = audio.find((track) => track.isDefault) ?? audio[0];
    const options: TrackOption[] = [
      ...audio.map((track) => ({
        id: String(track.number),
        type: 'audio' as const,
        label: describeTrack(track),
        selected: track === defaultAudio,
        language: track.language,
      })),
      ...tracks
        .filter((track) => track.kind === 'subtitle')
        .map((track) => ({
          id: String(track.number),
          type: 'subtitle' as const,
          label: describeTrack(track),
          // Le navigateur n'affiche pas les sous-titres intégrés au MKV.
          selected: false,
          language: track.language,
          forced: track.isForced || /forc/i.test(track.name ?? ''),
        })),
    ];
    return { options, switchable: Boolean(browserAudio && browserAudio.length > 1) };
  }

  selectTrack(type: TrackType, id: string | null): void {
    if (this.hls) {
      if (type === 'audio' && id !== null) this.hls.audioTrack = Number(id);
      if (type === 'subtitle') this.hls.subtitleTrack = id === null ? -1 : Number(id);
      return;
    }
    const browserAudio = (this.video as VideoWithAudioTracks).audioTracks;
    if (type !== 'audio' || !browserAudio || id === null) return;
    // Les pistes du navigateur suivent l'ordre du fichier.
    void this.tracks().then(({ options }) => {
      const index = options.filter((o) => o.type === 'audio').findIndex((o) => o.id === id);
      for (let i = 0; i < browserAudio.length; i++) browserAudio[i].enabled = i === index;
    });
  }
}
