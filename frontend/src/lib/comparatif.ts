// Extension explicite : vérifié par `node --test`, qui ne devine pas
// l'extension d'un import relatif.
import { analyseConditionnement, type Famille } from "./conditionnement.ts";

/**
 * Comparaison des tarifs d'un produit entre fournisseurs.
 *
 * Deux fournisseurs ne proposent presque jamais le même conditionnement : une
 * couronne de 50 m chez l'un, de 100 m chez l'autre, des manchons par cent
 * ici et à la pièce ailleurs. Comparer les prix affichés revient alors à
 * comparer des choses différentes — et désigne régulièrement le mauvais
 * fournisseur comme le moins cher.
 *
 * Ce calcul ramène chaque offre à son prix unitaire — l'euro du mètre, l'euro
 * de la pièce — et ne désigne un meilleur prix que lorsque les offres sont
 * effectivement comparables. Quand elles ne le sont pas, il le dit plutôt que
 * de trancher au hasard.
 *
 * Ce calcul oriente des décisions d'achat : il vit à part et il est vérifié
 * automatiquement (frontend/tests/comparatif.test.ts).
 */

export type OffreAComparer = {
  fournisseur: string;
  prix: number;
  conditionnement: string;
};

export type OffreComparee = OffreAComparer & {
  /** Prix d'une unité : l'euro du mètre, ou l'euro de la pièce. */
  unitaire: number | null;
  unite: Famille | null;
  /** Combien d'unités dans le conditionnement de ce fournisseur. */
  parConditionnement: number | null;
};

export type Comparatif = {
  offres: OffreComparee[];
  /** Le fournisseur le moins cher à l'unité, quand la comparaison tient. */
  meilleur: string | null;
  /** Ce qui empêche de comparer, le cas échéant. */
  obstacle: string | null;
  /** Nombre d'offres chiffrées, comparables ou non. */
  chiffrees: number;
};

/** Arrondi à quatre décimales : un câble à 0,8106 €/m ne s'arrondit pas à 0,81. */
const auQuatrieme = (valeur: number) => Math.round(valeur * 10000) / 10000;

/**
 * Prix d'une unité, d'après le conditionnement. « Couronne de 100 m » à
 * 81,06 € fait 0,8106 €/m.
 */
export const prixUnitaire = (prix: number, conditionnement?: string) => {
  const mesure = analyseConditionnement(conditionnement);
  if (!mesure || !mesure.quantite || !prix || prix <= 0) return null;
  return { valeur: auQuatrieme(prix / mesure.quantite), unite: mesure.famille, par: mesure.quantite };
};

export const comparer = (offres: OffreAComparer[]): Comparatif => {
  const comparees: OffreComparee[] = offres.map((offre) => {
    const unitaire = prixUnitaire(offre.prix, offre.conditionnement);
    return {
      ...offre,
      unitaire: unitaire?.valeur ?? null,
      unite: unitaire?.unite ?? null,
      parConditionnement: unitaire?.par ?? null,
    };
  });

  const chiffrees = comparees.filter((offre) => offre.prix > 0);
  const lisibles = chiffrees.filter((offre) => offre.unitaire !== null);

  if (chiffrees.length < 2) {
    return { offres: comparees, meilleur: null, obstacle: null, chiffrees: chiffrees.length };
  }

  // Un conditionnement illisible ne se compare pas : plutôt que de l'écarter
  // en silence, on nomme le fournisseur dont la fiche est à compléter.
  const aCompleter = chiffrees.filter((offre) => offre.unitaire === null);
  if (aCompleter.length) {
    return {
      offres: comparees,
      meilleur: null,
      obstacle: `conditionnement à renseigner chez ${aCompleter
        .map((offre) => offre.fournisseur)
        .join(", ")}`,
      chiffrees: chiffrees.length,
    };
  }

  const unites = new Set(lisibles.map((offre) => offre.unite));
  if (unites.size > 1) {
    return {
      offres: comparees,
      meilleur: null,
      obstacle: "un fournisseur vend au mètre, l’autre à la pièce",
      chiffrees: chiffrees.length,
    };
  }

  const moinsCher = lisibles.reduce((meilleur, offre) =>
    (offre.unitaire ?? Infinity) < (meilleur.unitaire ?? Infinity) ? offre : meilleur,
  );
  // Des prix unitaires égaux ne désignent personne : annoncer un gagnant
  // laisserait croire à un écart qui n'existe pas.
  const exAequo = lisibles.filter((offre) => offre.unitaire === moinsCher.unitaire).length > 1;

  return {
    offres: comparees,
    meilleur: exAequo ? null : moinsCher.fournisseur,
    obstacle: exAequo ? "deux fournisseurs au même prix unitaire" : null,
    chiffrees: chiffrees.length,
  };
};

/** « 0,81 €/m » ou « 1,25 €/pièce », pour l'affichage. */
export const libelleUnitaire = (valeur: number, unite: Famille) =>
  `${valeur.toFixed(valeur < 1 ? 3 : 2).replace(".", ",")} €/${unite === "longueur" ? "m" : "pièce"}`;
