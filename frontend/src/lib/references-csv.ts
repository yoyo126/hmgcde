// Extensions explicites : ce fichier est vérifié par `node --test`, qui ne
// devine pas l'extension d'un import relatif. `allowImportingTsExtensions`
// est activé dans tsconfig.json, et Vite les résout sans broncher.
import { lireCsv, nombreDepuisCsv, type Cellule } from "./export-csv.ts";
import { cleProduit } from "./catalog-prices.ts";
import type { PriceOverride, Product, ReferenceApprise } from "./types";

/**
 * Références fournisseur : export et réimport, en CSV.
 *
 * Rattacher un devis à son catalogue ne se fait qu'une fois par produit et par
 * fournisseur — mais cette fois-là coûte une cinquantaine de recherches dans
 * un menu déroulant, ligne par ligne. Ce fichier permet de faire le même
 * travail dans un tableur, où l'on voit tout d'un coup, puis de le rendre à
 * l'application en un seul import. Les devis suivants sont alors reconnus
 * tout seuls.
 *
 * Le rattachement se fait sur la colonne ID — l'identifiant du produit en
 * base — ou, à défaut, sur la colonne Code (« HM-0012 »). Jamais sur le nom :
 * un fichier qu'on a soi-même préparé n'a pas à être deviné. Le code sert
 * quand le fichier a été préparé ailleurs que depuis cet écran, sans
 * connaître les identifiants de la base.
 *
 * Ce calcul décide des prix et des références écrits au catalogue : il vit à
 * part et il est vérifié automatiquement (frontend/tests/references-csv.test.ts).
 */

export const COLONNES_FIXES = ["ID", "Code", "Famille", "Produit", "Conditionnement"];

/** Suffixes des deux colonnes ouvertes par fournisseur. */
const REF = "réf";
const PRIX = "prix HT";

export const enTetesReferences = (fournisseurs: string[]) => [
  ...COLONNES_FIXES,
  ...fournisseurs.flatMap((nom) => [`${nom} ${REF}`, `${nom} ${PRIX}`]),
];

/**
 * Une ligne par produit, deux colonnes par fournisseur. Les ensembles
 * (coffrets, cartons) sont inclus : leur prix se calcule à partir de leur
 * contenu, mais ils portent tout de même une référence chez le fournisseur.
 */
export const lignesReferences = (
  produits: Product[],
  fournisseurs: string[],
): Cellule[][] => [
  enTetesReferences(fournisseurs),
  ...produits.map((produit) => {
    const offreDe = (fournisseur: string) =>
      produit.offers.find((offre) => offre.supplier === fournisseur);
    return [
      // En texte : `enCsv` donne deux décimales à tout nombre, et « 14,00 »
      // ne se relirait pas comme un identifiant.
      String(produit.id),
      produit.code || "",
      produit.family,
      produit.name,
      produit.offers[0]?.packaging || "",
      ...fournisseurs.flatMap((fournisseur) => {
        const offre = offreDe(fournisseur);
        const reference = offre?.reference && offre.reference !== "À renseigner"
          ? offre.reference
          : "";
        // Une offre sans prix laisse la cellule vide : « 0,00 » se relirait
        // comme un prix voulu, et écraserait le prix du jour.
        return [reference, offre?.price ? offre.price : ""];
      }),
    ];
  }),
];

export type ChangementsReferences = {
  references: ReferenceApprise[];
  overrides: PriceOverride;
  /** Identifiants du fichier qui ne correspondent à aucun produit. */
  inconnus: string[];
  /** Noms de colonnes dont le fournisseur n'a pas été reconnu. */
  colonnesIgnorees: string[];
};

/** Deux prix se valent quand ils sont égaux au centime. */
const memePrix = (a: number, b: number) => Math.abs(a - b) < 0.005;

/**
 * Relit un fichier de références et n'en retient que ce qui change.
 *
 * Réimporter un export qu'on n'a pas modifié ne doit rien écrire : sans cela
 * un aller-retour par le tableur réécrirait tout le catalogue, et le moindre
 * arrondi de cellule deviendrait une modification de prix.
 */
export const lireReferences = (
  texte: string,
  produits: Product[],
  fournisseurs: string[],
): ChangementsReferences => {
  const lignes = lireCsv(texte);
  const vide: ChangementsReferences = {
    references: [],
    overrides: {},
    inconnus: [],
    colonnesIgnorees: [],
  };
  if (lignes.length < 2) return vide;

  const entetes = lignes[0].map((cellule) => cellule.trim());
  const colonneId = entetes.findIndex((entete) => entete.toUpperCase() === "ID");
  const colonneCode = entetes.findIndex((entete) => entete.toLowerCase() === "code");
  if (colonneId < 0 && colonneCode < 0) return vide;

  // Les colonnes d'un fournisseur sont nommées « <FOURNISSEUR> réf » et
  // « <FOURNISSEUR> prix HT ». On les retrouve par le nom du fournisseur,
  // pour que l'ordre des colonnes n'ait pas d'importance.
  const colonnes = new Map<string, { reference?: number; prix?: number }>();
  const colonnesIgnorees: string[] = [];
  entetes.forEach((entete, index) => {
    if (index === colonneId || index === colonneCode) return;
    if (COLONNES_FIXES.includes(entete)) return;
    const fournisseur = fournisseurs.find(
      (nom) => entete === `${nom} ${REF}` || entete === `${nom} ${PRIX}`,
    );
    if (!fournisseur) {
      if (entete) colonnesIgnorees.push(entete);
      return;
    }
    const place = colonnes.get(fournisseur) || {};
    if (entete === `${fournisseur} ${REF}`) place.reference = index;
    else place.prix = index;
    colonnes.set(fournisseur, place);
  });

  const parId = new Map(produits.map((produit) => [produit.id, produit]));
  const parCode = new Map(
    produits
      .filter((produit) => produit.code)
      .map((produit) => [produit.code!.trim().toLowerCase(), produit]),
  );
  const references: ReferenceApprise[] = [];
  const overrides: PriceOverride = {};
  const inconnus: string[] = [];

  for (const valeurs of lignes.slice(1)) {
    const identifiant = colonneId < 0 ? "" : (valeurs[colonneId] || "").trim();
    const code = colonneCode < 0 ? "" : (valeurs[colonneCode] || "").trim();
    const produit =
      (identifiant ? parId.get(Number(identifiant)) : undefined) ||
      (code ? parCode.get(code.toLowerCase()) : undefined);
    if (!produit) {
      // On signale plutôt que d'appliquer au hasard : écrire un prix sur le
      // mauvais produit coûte plus cher qu'une ligne à reprendre.
      if (identifiant || code) inconnus.push(identifiant || code);
      continue;
    }

    for (const [fournisseur, place] of colonnes) {
      const offre = produit.offers.find((item) => item.supplier === fournisseur);

      if (place.reference !== undefined) {
        const reference = (valeurs[place.reference] || "").trim();
        const connue = offre?.reference === "À renseigner" ? "" : offre?.reference || "";
        // Une cellule vidée n'efface pas une référence connue : on ne retire
        // rien par omission, seulement par une valeur nouvelle.
        if (reference && reference !== connue) {
          references.push({
            productId: produit.id,
            supplier: fournisseur,
            reference,
            supplierName: produit.name,
          });
        }
      }

      if (place.prix !== undefined) {
        const prix = nombreDepuisCsv(valeurs[place.prix] || "");
        if (Number.isFinite(prix) && prix > 0 && !memePrix(prix, offre?.price || 0)) {
          overrides[cleProduit(produit.id, fournisseur)] = prix;
        }
      }
    }
  }

  return { references, overrides, inconnus, colonnesIgnorees };
};
