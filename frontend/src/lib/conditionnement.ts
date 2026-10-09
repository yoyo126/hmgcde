/**
 * Unité de vente d'un fournisseur et conditionnement d'une offre.
 *
 * Un tarif donne son prix pour SON unité de vente — « 1000 Mètr », « 100
 * Pièce » — alors que l'application compte en conditionnements : une couronne
 * de 100 m, une boîte de 100. Sans conversion, importer « 810,56 € le touret
 * de 1000 m » inscrit 810,56 € sur une couronne de 100 m : dix fois trop, et
 * sur chaque bon de commande qui suit.
 *
 * La conversion se fait sur le conditionnement de CE fournisseur, jamais sur
 * celui d'un autre : le même produit peut être conditionné autrement d'un
 * fournisseur à l'autre — un changement de marque suffit. C'est pourquoi le
 * conditionnement est porté par l'offre, et pas par le produit.
 *
 * Quand l'un des deux côtés n'est pas lisible, on ne convertit pas et on le
 * dit : un prix repris tel quel qu'on sait douteux vaut mieux qu'un prix
 * converti au hasard.
 *
 * Ce calcul décide des prix écrits au catalogue : il vit à part et il est
 * vérifié automatiquement (frontend/tests/conditionnement.test.ts).
 */

export type Famille = "longueur" | "piece";

export type Mesure = { quantite: number; famille: Famille };

const sansAccent = (texte: string) =>
  texte.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Les mots qui disent une longueur, et ceux qui disent une unité. */
const LONGUEUR = ["m", "ml", "metr", "metre", "metres", "mt", "mts"];
const PIECE = ["piece", "pieces", "pce", "pces", "pc", "pcs", "u", "unite", "unites"];

const mots = (texte: string) =>
  sansAccent(texte)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

/** Premier nombre du libellé : « Couronne de 100 m » → 100. */
const premierNombre = (jetons: string[]) => {
  for (const jeton of jetons) {
    if (/^\d+([.,]\d+)?$/.test(jeton)) return Number(jeton.replace(",", "."));
  }
  return null;
};

const familleDe = (jetons: string[]): Famille | null => {
  if (jetons.some((jeton) => LONGUEUR.includes(jeton))) return "longueur";
  if (jetons.some((jeton) => PIECE.includes(jeton))) return "piece";
  return null;
};

/**
 * Unité de vente telle que l'écrit le fournisseur : « 1000 Mètr », « 100
 * Pièce », « Mètr ». Sans nombre, l'unité vaut 1.
 */
export const analyseUniteDeVente = (texte?: string): Mesure | null => {
  const jetons = mots(texte || "");
  if (!jetons.length) return null;
  const famille = familleDe(jetons);
  if (!famille) return null;
  const quantite = premierNombre(jetons) ?? 1;
  return quantite > 0 ? { quantite, famille } : null;
};

/**
 * Conditionnement d'une offre : « Couronne de 100 m », « Boîte de 100 »,
 * « Pièce ».
 *
 * Un libellé sans nombre ne vaut 1 que s'il nomme l'unité (« Pièce ») :
 * « Couronne » toute seule ne dit pas combien de mètres elle porte, et la
 * deviner écrirait un faux prix. « À renseigner » ne dit rien non plus.
 */
export const analyseConditionnement = (texte?: string): Mesure | null => {
  const jetons = mots(texte || "");
  if (!jetons.length) return null;
  const quantite = premierNombre(jetons);
  const famille = familleDe(jetons);

  if (quantite === null) {
    // « Pièce », « Unité » : une seule, et on sait de quoi.
    return famille === "piece" ? { quantite: 1, famille } : null;
  }
  if (!quantite) return null;
  // « Boîte de 100 » ne nomme pas son unité : ce sont des pièces.
  return { quantite, famille: famille ?? "piece" };
};

export type ResultatConversion =
  /** Le prix a été ramené au conditionnement de l'offre. */
  | { etat: "convertie"; prix: number; depuis: string; vers: string }
  /** Le fournisseur vend déjà au conditionnement de l'offre. */
  | { etat: "identique"; prix: number }
  /** On ne sait pas comparer : le prix est repris tel quel. */
  | { etat: "indeterminee"; prix: number; raison: string };

/** Arrondi au centime : c'est un prix, il s'écrit avec deux décimales. */
const auCentime = (valeur: number) => Math.round(valeur * 100) / 100;

/**
 * Ramène le prix d'un tarif au conditionnement de l'offre du fournisseur.
 *
 * `uniteDeVente` vient du tarif (« 1000 Mètr »), `conditionnement` de l'offre
 * de ce fournisseur pour ce produit (« Couronne de 100 m »).
 */
export const convertirPrix = (
  prix: number,
  uniteDeVente?: string,
  conditionnement?: string,
): ResultatConversion => {
  const vente = analyseUniteDeVente(uniteDeVente);
  const cible = analyseConditionnement(conditionnement);

  if (!vente) {
    return {
      etat: "indeterminee",
      prix,
      raison: "unité de vente du fournisseur illisible",
    };
  }
  if (!cible) {
    return {
      etat: "indeterminee",
      prix,
      raison: "conditionnement de ce fournisseur à renseigner",
    };
  }
  if (vente.famille !== cible.famille) {
    return {
      etat: "indeterminee",
      prix,
      raison: "unité de vente et conditionnement incomparables",
    };
  }
  if (vente.quantite === cible.quantite) return { etat: "identique", prix };

  return {
    etat: "convertie",
    prix: auCentime((prix * cible.quantite) / vente.quantite),
    depuis: uniteDeVente || "",
    vers: conditionnement || "",
  };
};

/** Le prix à retenir, quel que soit l'état de la conversion. */
export const prixRetenu = (resultat: ResultatConversion) => resultat.prix;

/**
 * Prix au mètre d'un tarif vendu à la longueur.
 *
 * Il ne dépend que de l'unité de vente du fournisseur, pas du
 * conditionnement : il se calcule donc même quand le conditionnement n'est
 * pas renseigné. Et c'est le repère le plus simple qui existe pour un câble
 * — deux fournisseurs ne proposent jamais la même longueur de couronne, mais
 * le prix au mètre se compare toujours.
 *
 * Quatre décimales : la colonne qui le reçoit en garde autant, et un câble
 * à 0,8106 €/m ne doit pas s'arrondir à 0,81 avant d'être enregistré.
 */
export const prixAuMetre = (prix: number, uniteDeVente?: string) => {
  const vente = analyseUniteDeVente(uniteDeVente);
  if (!vente || vente.famille !== "longueur" || !vente.quantite) return null;
  return Math.round((prix / vente.quantite) * 10000) / 10000;
};
