/**
 * Répartition d'une quantité entre les sociétés, au prorata des équipes.
 *
 * Méthode du plus fort reste : chaque société reçoit d'abord sa part entière,
 * puis les unités restantes vont à celles dont la part décimale est la plus
 * forte — et seulement à celles qui ont des équipes.
 *
 * Ce calcul décide quelle filiale est servie, donc quelle filiale paie : il
 * vit dans son propre fichier pour être vérifié automatiquement (voir
 * frontend/tests/dispatch.test.ts).
 *
 * Défaut corrigé le 23/09/2026 : la version précédente attribuait tout le
 * reliquat d'arrondi à la DERNIÈRE société de la liste sans regarder ses
 * équipes. HM PAC étant la dernière, elle recevait des articles alors
 * qu'elle était à zéro équipe.
 */
export const repartir = (quantite: number, equipes: number[]): number[] => {
  const valides = equipes.map((e) => (Number.isFinite(e) && e > 0 ? e : 0));
  const sommeEquipes = valides.reduce((a, b) => a + b, 0);
  if (!quantite || quantite < 0 || !sommeEquipes) return equipes.map(() => 0);

  const exactes = valides.map((e) => (quantite * e) / sommeEquipes);
  const parts = exactes.map(Math.floor);
  let reste = quantite - parts.reduce((a, b) => a + b, 0);

  // Les unités restantes vont aux plus fortes décimales, à équipes égales la
  // société qui compte le plus d'équipes passe devant.
  const candidats = valides
    .map((e, i) => ({ i, decimale: exactes[i] - parts[i], equipes: e }))
    .filter((c) => c.equipes > 0)
    .sort((a, b) => b.decimale - a.decimale || b.equipes - a.equipes);

  for (let k = 0; reste > 0 && candidats.length; k += 1, reste -= 1) {
    parts[candidats[k % candidats.length].i] += 1;
  }
  return parts;
};
