/**
 * Vidéos de fond de l'accueil (essai de design), libres de droits :
 * - Sintel et Big Buck Bunny : Blender Foundation, licence CC-BY 3.0 ;
 * - Jellyfish : jell.yfish.us, libre d'utilisation.
 * Extraits servis par test-videos.co.uk et download.blender.org.
 */
export const HOME_VIDEOS = {
  tv: [
    'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_5MB.mp4',
    'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_5MB.mp4',
  ],
  flix: [
    'https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4',
    'https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_5MB.mp4',
  ],
} as const;

/** Une vidéo au hasard pour un côté de l'accueil. */
export function randomHomeVideo(side: keyof typeof HOME_VIDEOS): string {
  const list = HOME_VIDEOS[side];
  return list[Math.floor(Math.random() * list.length)];
}
