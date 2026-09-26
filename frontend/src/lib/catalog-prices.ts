import type { PriceOverride, Product } from "./types";

/**
 * Report des prix saisis dans le catalogue.
 *
 * L'écran Produits tient les saisies dans un état séparé du catalogue : les
 * deux doivent être réunis avant d'être enregistrés. Tant que ce report
 * n'existait pas, l'enregistrement écrivait le catalogue d'un côté et les
 * prix de l'autre, dans un ordre qui décidait du gagnant — et les prix
 * perdaient. Toute saisie était alors effacée, sans autre trace que
 * l'historique des modifications.
 *
 * Les clés sont celles de priceKey() et componentPriceKey() :
 *   « 12|||REXEL » pour un produit, « 12|||Coude 90°|||REXEL » pour un élément.
 */

const SEPARATEUR = "|||";

export const cleProduit = (productId: number, supplier: string) =>
  `${productId}${SEPARATEUR}${supplier}`;

export const cleComposant = (productId: number, itemName: string, supplier: string) =>
  `${productId}${SEPARATEUR}${itemName}${SEPARATEUR}${supplier}`;

export const fusionnerPrix = (
  produits: Product[],
  prix: PriceOverride = {},
  prixComposants: PriceOverride = {},
): Product[] => {
  const aDesPrix = Object.keys(prix).length > 0;
  const aDesPrixComposants = Object.keys(prixComposants).length > 0;
  if (!aDesPrix && !aDesPrixComposants) return produits;

  return produits.map((produit) => ({
    ...produit,
    offers: produit.offers.map((offre) => {
      const valeur = prix[cleProduit(produit.id, offre.supplier)];
      return valeur === undefined ? offre : { ...offre, price: Number(valeur) || 0 };
    }),
    ...(produit.contents
      ? {
          contents: produit.contents.map((element) => ({
            ...element,
            supplierPrices: Object.fromEntries(
              Object.entries(element.supplierPrices || {}).map(([fournisseur, ancien]) => {
                const valeur =
                  prixComposants[cleComposant(produit.id, element.name, fournisseur)];
                return [fournisseur, valeur === undefined ? ancien : Number(valeur) || 0];
              }),
            ),
          })),
        }
      : {}),
  }));
};
