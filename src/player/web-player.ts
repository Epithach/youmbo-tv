import type Hls from 'hls.js';
import type Mpegts from 'mpegts.js';
import { proxify } from '../core/net';
import { detectStreamKind, type Player, type PlayerEvents, type PlayerState } from './types';

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

    switch (detectStreamKind(url)) {
      case 'hls':
        void this.playHls(url, generation, fail);
        break;
      case 'mpegts':
        void this.playMpegts(url, generation, fail);
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
      { enableStashBuffer: false, liveBufferLatencyChasing: true },
    );
    this.mpegts = player;
    player.on(mpegts.Events.ERROR, (type: string, details: string) =>
      fail(`Erreur flux : ${type} / ${details}`),
    );
    player.attachMediaElement(this.video);
    player.load();
    Promise.resolve(player.play()).catch(() => undefined);
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
}
