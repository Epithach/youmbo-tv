import type Hls from 'hls.js';
import type Mpegts from 'mpegts.js';
import { proxify } from '../core/net';
import { detectStreamKind, type Player, type PlayerEvents, type PlayerState } from './types';

/** Secondes de vidéo à avoir en réserve avant de lancer la lecture d'un flux live. */
const CUSHION_SECONDS = 2.5;

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
    this.stop();
    const generation = ++this.generation;
    this.setState('loading');

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
      case 'native':
        this.video.src = proxify(url);
        this.video.play().catch((error: Error) => fail(error.message));
        break;
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
}
