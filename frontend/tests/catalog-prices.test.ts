import assert from "node:assert/strict";
import test from "node:test";
import { cleComposant, cleProduit, fusionnerPrix } from "../src/lib/catalog-prices.ts";
import type { Product } from "../src/lib/types.ts";

/**
 * Un prix saisi doit survivre à l'enregistrement.
 *
 * Défaut constaté le 26/09/2026 : le catalogue était réécrit par-dessus les
 * prix qui venaient d'être appliqués. L'historique gardait la trace du
 * changement, mais aucune offre ne portait le montant : toute saisie de prix
 * était perdue en silence.
 */

const catalogue = (): Product[] => [
  {
    id: 12,
    name: "Gaine ICT 25",
    family: "Électricité",
    subfamily: "Consommables",
    unit: "Pièce",
    kind: "simple",
    offers: [
      { supplier: "YESS ELECTRIQUE", supplierName: "", reference: "", brand: "", price: 0, packaging: "", packagingType: "fixed" },
      { supplier: "REXEL", supplierName: "", reference: "", brand: "", price: 4, packaging: "", packagingType: "fixed" },
    ],
  },
  {
    id: 30,
    name: "Coffret triphasé",
    family: "Électricité",
    subfamily: "Coffrets",
    unit: "Coffret",
    kind: "ensemble",
    contents: [
      { name: "Coude 90°", quantity: 2, unitPrice: 0, supplierPrices: { REXEL: 0, "YESS ELECTRIQUE": 0 } },
    ],
    offers: [
      { supplier: "REXEL", supplierName: "", reference: "", brand: "", price: 0, packaging: "", packagingType: "fixed" },
    ],
  },
];

test("le prix saisi se retrouve sur l'offre du bon fournisseur", () => {
  const resultat = fusionnerPrix(catalogue(), { [cleProduit(12, "YESS ELECTRIQUE")]: 25.5 });
  const produit = resultat.find((p) => p.id === 12)!;
  assert.equal(produit.offers.find((o) => o.supplier === "YESS ELECTRIQUE")!.price, 25.5);
});

test("les autres fournisseurs gardent leur prix", () => {
  const resultat = fusionnerPrix(catalogue(), { [cleProduit(12, "YESS ELECTRIQUE")]: 25.5 });
  const produit = resultat.find((p) => p.id === 12)!;
  assert.equal(produit.offers.find((o) => o.supplier === "REXEL")!.price, 4);
});

test("le prix d'un élément de coffret est reporté", () => {
  const resultat = fusionnerPrix(
    catalogue(),
    {},
    { [cleComposant(30, "Coude 90°", "REXEL")]: 5.6 },
  );
  const coffret = resultat.find((p) => p.id === 30)!;
  assert.equal(coffret.contents![0].supplierPrices!.REXEL, 5.6);
  assert.equal(coffret.contents![0].supplierPrices!["YESS ELECTRIQUE"], 0);
});

test("un prix à zéro est une valeur, pas une absence", () => {
  // Remettre un prix à zéro doit effacer l'ancien, pas le laisser en place.
  const resultat = fusionnerPrix(catalogue(), { [cleProduit(12, "REXEL")]: 0 });
  assert.equal(resultat.find((p) => p.id === 12)!.offers.find((o) => o.supplier === "REXEL")!.price, 0);
});

test("sans saisie, le catalogue ressort intact", () => {
  const depart = catalogue();
  assert.equal(fusionnerPrix(depart, {}, {}), depart);
});

test("un produit non concerné n'est pas modifié", () => {
  const resultat = fusionnerPrix(catalogue(), { [cleProduit(12, "REXEL")]: 9 });
  assert.equal(resultat.find((p) => p.id === 30)!.offers[0].price, 0);
});
