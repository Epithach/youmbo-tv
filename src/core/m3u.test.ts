import { describe, expect, it } from 'vitest';
import { parseM3u, UNGROUPED } from './m3u';

describe('parseM3u', () => {
  it('lit les attributs IPTV classiques', () => {
    const playlist = parseM3u(
      [
        '#EXTM3U url-tvg="http://epg.example.com/guide.xml"',
        '#EXTINF:-1 tvg-id="tf1.fr" tvg-name="TF1" tvg-logo="http://logo/tf1.png" group-title="France",TF1 HD',
        'http://iptv.example.com/live/u/p/1.ts',
      ].join('\n'),
    );

    expect(playlist.epgUrl).toBe('http://epg.example.com/guide.xml');
    expect(playlist.groups).toEqual(['France']);
    expect(playlist.channels).toEqual([
      {
        id: '0',
        name: 'TF1 HD',
        url: 'http://iptv.example.com/live/u/p/1.ts',
        group: 'France',
        logo: 'http://logo/tf1.png',
        tvgId: 'tf1.fr',
      },
    ]);
  });

  it('ne coupe pas le nom sur une virgule à l’intérieur des guillemets', () => {
    const { channels } = parseM3u(
      '#EXTM3U\n#EXTINF:-1 group-title="Sport, Foot",Canal, le direct\nhttp://x/1',
    );
    expect(channels[0].group).toBe('Sport, Foot');
    expect(channels[0].name).toBe('Canal, le direct');
  });

  it('garde l’ordre des groupes et regroupe les chaînes', () => {
    const { groups, channels } = parseM3u(
      [
        '#EXTM3U',
        '#EXTINF:-1 group-title="B",b1',
        'http://x/b1',
        '#EXTINF:-1 group-title="A",a1',
        'http://x/a1',
        '#EXTINF:-1 group-title="B",b2',
        'http://x/b2',
      ].join('\n'),
    );
    expect(groups).toEqual(['B', 'A']);
    expect(channels.map((c) => c.group)).toEqual(['B', 'A', 'B']);
  });

  it('accepte #EXTGRP, les lignes inconnues, le BOM et les CRLF', () => {
    const { channels } = parseM3u(
      '\uFEFF#EXTM3U\r\n#EXTINF:-1,Chaîne\r\n#EXTGRP:Info\r\n#EXTVLCOPT:http-user-agent=VLC\r\nhttp://x/1\r\n',
    );
    expect(channels).toHaveLength(1);
    expect(channels[0]).toMatchObject({ name: 'Chaîne', group: 'Info', url: 'http://x/1' });
  });

  it('retire les faux titres de section', () => {
    const { channels } = parseM3u(
      [
        '#EXTM3U',
        '#EXTINF:-1 group-title="France",##### GENERAL #####',
        'http://x/0',
        '#EXTINF:-1 group-title="France",===== INFO =====',
        'http://x/00',
        '#EXTINF:-1 group-title="France",TF1',
        'http://x/1',
      ].join('\n'),
    );
    expect(channels.map((c) => [c.id, c.name])).toEqual([['0', 'TF1']]);
  });

  it('utilise un nom et un groupe par défaut', () => {
    const { channels, groups } = parseM3u('#EXTM3U\nhttp://x/stream.m3u8');
    expect(channels[0]).toMatchObject({ name: 'http://x/stream.m3u8', group: UNGROUPED });
    expect(groups).toEqual([UNGROUPED]);
  });
});
