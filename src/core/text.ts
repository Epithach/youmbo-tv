/** Majuscules sans accents : « Comédie » → « COMEDIE », pour comparer des libellés. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Expression qui trouve l'un des mots-clés (en majuscules) comme mot entier
 * dans un texte normalisé ; le mot trouvé est dans le groupe 1. Les plus longs
 * sont essayés d'abord, pour que « SOUTH KOREA » passe avant « KOREA ».
 */
export function keywordPattern(keywords: readonly string[]): RegExp {
  const alternatives = [...keywords].sort((a, b) => b.length - a.length).map(escapeRegExp);
  return new RegExp(`(?:^|[^A-Z0-9])(${alternatives.join('|')})(?![A-Z0-9])`);
}
