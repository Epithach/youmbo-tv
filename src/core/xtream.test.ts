import { describe, expect, it } from 'vitest';
import { UNGROUPED } from './m3u';
import { buildXtreamPlaylist, parseXtreamUrl, xtreamApiUrl } from './xtream';

const credentials = { server: 'http://iptv.example.com:8080', username: 'user', password: 'pa ss' };

describe('parseXtreamUrl', () => {
  it('reconnaît un lien get.php', () => {
    expect(
      parseXtreamUrl(
        'http://iptv.example.com:8080/get.php?username=user&password=pa%20ss&type=m3u_plus&output=ts',
      ),
    ).toEqual(credentials);
  });

  it('reconnaît un lien player_api.php', () => {
    expect(
      parseXtreamUrl('http://iptv.example.com:8080/player_api.php?username=user&password=pa%20ss'),
    ).toEqual(credentials);
  });

  it('ignore les playlists M3U classiques et les liens incomplets', () => {
    expect(parseXtreamUrl('http://x/playlist.m3u')).toBeUndefined();
    expect(parseXtreamUrl('http://x/get.php?username=user')).toBeUndefined();
    expect(parseXtreamUrl('pas une url')).toBeUndefined();
  });
});

describe('xtreamApiUrl', () => {
  it('encode les identifiants', () => {
    expect(xtreamApiUrl(credentials, 'get_live_streams')).toBe(
      'http://iptv.example.com:8080/player_api.php?username=user&password=pa+ss&action=get_live_streams',
    );
  });
});

describe('buildXtreamPlaylist', () => {
  const playlist = buildXtreamPlaylist(
    credentials,
    [
      { category_id: '2', category_name: 'Sport' },
      { category_id: '1', category_name: 'France' },
      { category_id: '3', category_name: 'Vide' },
    ],
    [
      {
        stream_id: 10,
        name: 'TF1',
        category_id: '1',
        stream_icon: 'http://logo/tf1.png',
        epg_channel_id: 'tf1.fr',
      },
      { stream_id: 20, name: 'Eurosport', category_id: '2', stream_icon: '', epg_channel_id: null },
      { stream_id: 30, name: 'Orpheline', category_id: null },
      { stream_id: 40, name: '##### GENERAL #####', category_id: '1' },
    ],
  );

  it('construit les URLs de flux live en MPEG-TS', () => {
    expect(playlist.channels[0]).toEqual({
      id: '0',
      name: 'TF1',
      url: 'http://iptv.example.com:8080/live/user/pa%20ss/10.ts',
      group: 'France',
      logo: 'http://logo/tf1.png',
      tvgId: 'tf1.fr',
      streamId: 10,
    });
    expect(playlist.channels[1]).toMatchObject({ logo: undefined, tvgId: undefined });
  });

  it('garde l’ordre des catégories du fournisseur et retire les vides', () => {
    expect(playlist.groups).toEqual(['Sport', 'France', UNGROUPED]);
    expect(playlist.channels[2].group).toBe(UNGROUPED);
  });

  it('retire les faux titres de section', () => {
    expect(playlist.channels.map((c) => c.name)).toEqual(['TF1', 'Eurosport', 'Orpheline']);
  });

  it('pointe vers le guide XMLTV du fournisseur', () => {
    expect(playlist.epgUrl).toBe(
      'http://iptv.example.com:8080/xmltv.php?username=user&password=pa+ss',
    );
  });
});
