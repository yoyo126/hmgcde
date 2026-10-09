import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  analyseConditionnement,
  analyseUniteDeVente,
  convertirPrix,
  prixAuMetre,
  prixAuMetreDeLOffre,
} from "../src/lib/conditionnement.ts";

/**
 * Ce calcul ramène le prix d'un tarif au conditionnement de l'offre.
 *
 * Sans lui, le devis YESSS du 24/07/2026 inscrivait 810,56 € — le touret de
 * 1000 m — sur une couronne de 100 m : dix fois trop, sur chaque bon de
 * commande qui suit.
 */

test("l'unité de vente d'un fournisseur se relit", () => {
  assert.deepEqual(analyseUniteDeVente("1000 Mètr"), { quantite: 1000, famille: "longueur" });
  assert.deepEqual(analyseUniteDeVente("100 Mètr"), { quantite: 100, famille: "longueur" });
  assert.deepEqual(analyseUniteDeVente("100 Pièce"), { quantite: 100, famille: "piece" });
  assert.deepEqual(analyseUniteDeVente("1 pièce"), { quantite: 1, famille: "piece" });
  // Sans nombre, l'unité vaut une.
  assert.deepEqual(analyseUniteDeVente("Mètr"), { quantite: 1, famille: "longueur" });
  assert.equal(analyseUniteDeVente(""), null);
  assert.equal(analyseUniteDeVente(undefined), null);
  assert.equal(analyseUniteDeVente("au détail"), null);
});

test("le conditionnement d'une offre se relit", () => {
  assert.deepEqual(analyseConditionnement("Couronne de 100 m"), {
    quantite: 100,
    famille: "longueur",
  });
  assert.deepEqual(analyseConditionnement("Couronne de 50 m"), {
    quantite: 50,
    famille: "longueur",
  });
  // Un libellé qui compte sans nommer son unité compte des pièces.
  assert.deepEqual(analyseConditionnement("Boîte de 100"), { quantite: 100, famille: "piece" });
  assert.deepEqual(analyseConditionnement("Carton de 50"), { quantite: 50, famille: "piece" });
  assert.deepEqual(analyseConditionnement("Pièce"), { quantite: 1, famille: "piece" });
  assert.deepEqual(analyseConditionnement("Rouleau de 25 mètres"), {
    quantite: 25,
    famille: "longueur",
  });
});

test("un conditionnement qui ne dit pas combien n'est pas deviné", () => {
  // « Couronne » ne dit pas sa longueur : la supposer écrirait un faux prix.
  assert.equal(analyseConditionnement("Couronne"), null);
  assert.equal(analyseConditionnement("À renseigner"), null);
  assert.equal(analyseConditionnement(""), null);
  assert.equal(analyseConditionnement(undefined), null);
});

test("le touret de 1000 m devient la couronne de 100 m", () => {
  const resultat = convertirPrix(810.56, "1000 Mètr", "Couronne de 100 m");
  assert.equal(resultat.etat, "convertie");
  assert.equal(resultat.prix, 81.06);
});

test("les quatorze câbles du devis YESSS tombent juste", () => {
  const cas: [number, string, number][] = [
    [893.58, "Couronne de 100 m", 89.36],
    [2382.52, "Couronne de 50 m", 119.13],
    [1252.59, "Couronne de 20 m", 25.05],
    [2008.23, "Couronne de 30 m", 60.25],
    [7861.67, "Couronne de 10 m", 78.62],
  ];
  for (const [prix, conditionnement, attendu] of cas) {
    const resultat = convertirPrix(prix, "1000 Mètr", conditionnement);
    assert.equal(resultat.prix, attendu, `${prix} vers ${conditionnement}`);
  }
});

test("cent pièces vendues en vrac deviennent le prix d'une pièce", () => {
  const resultat = convertirPrix(60, "100 Pièce", "Pièce");
  assert.equal(resultat.etat, "convertie");
  assert.equal(resultat.prix, 0.6);
});

test("cent pièces vendues par boîte de cent ne changent pas de prix", () => {
  const resultat = convertirPrix(20, "100 Pièce", "Boîte de 100");
  assert.equal(resultat.etat, "identique");
  assert.equal(resultat.prix, 20);
});

test("vendu à la pièce et conditionné à la pièce : rien à faire", () => {
  const resultat = convertirPrix(5, "1 Pièce", "Pièce");
  assert.equal(resultat.etat, "identique");
  assert.equal(resultat.prix, 5);
});

test("sans conditionnement connu, le prix est repris tel quel et signalé", () => {
  // Le conditionnement est propre à chaque fournisseur : celui d'un autre
  // ne peut pas servir de repère.
  const resultat = convertirPrix(60, "100 Pièce", "À renseigner");
  assert.equal(resultat.etat, "indeterminee");
  assert.equal(resultat.prix, 60);
  assert.match(resultat.etat === "indeterminee" ? resultat.raison : "", /renseigner/);
});

test("des mètres ne se convertissent pas en pièces", () => {
  const resultat = convertirPrix(100, "1000 Mètr", "Boîte de 100");
  assert.equal(resultat.etat, "indeterminee");
  assert.equal(resultat.prix, 100);
  assert.match(
    resultat.etat === "indeterminee" ? resultat.raison : "",
    /incomparables/,
  );
});

test("une unité de vente absente laisse le prix intact", () => {
  const resultat = convertirPrix(42, undefined, "Couronne de 100 m");
  assert.equal(resultat.etat, "indeterminee");
  assert.equal(resultat.prix, 42);
});

test("la conversion dit d'où elle vient et où elle va", () => {
  const resultat = convertirPrix(810.56, "1000 Mètr", "Couronne de 100 m");
  if (resultat.etat !== "convertie") throw new Error("conversion attendue");
  assert.equal(resultat.depuis, "1000 Mètr");
  assert.equal(resultat.vers, "Couronne de 100 m");
});

test("le prix au mètre se calcule sans connaître le conditionnement", () => {
  // C'est le repère le plus simple pour un câble, et il ne dépend que de
  // l'unité de vente du fournisseur.
  assert.equal(prixAuMetre(810.56, "1000 Mètr"), 0.8106);
  assert.equal(prixAuMetre(40, "100 Mètr"), 0.4);
  assert.equal(prixAuMetre(2382.52, "1000 Mètr"), 2.3825);
  assert.equal(prixAuMetre(12.5, "Mètr"), 12.5);
});

test("un produit qui ne se vend pas à la longueur n'a pas de prix au mètre", () => {
  assert.equal(prixAuMetre(60, "100 Pièce"), null);
  assert.equal(prixAuMetre(5, "1 Pièce"), null);
  assert.equal(prixAuMetre(5, ""), null);
  assert.equal(prixAuMetre(5, undefined), null);
});

test("le prix au mètre se déduit aussi d'une offre déjà enregistrée", () => {
  // Sans cela, il fallait attendre un import pour voir le moindre €/m.
  assert.equal(prixAuMetreDeLOffre(81.06, "Couronne de 100 m"), 0.8106);
  assert.equal(prixAuMetreDeLOffre(119.13, "Couronne de 50 m"), 2.3826);
  assert.equal(prixAuMetreDeLOffre(25.05, "Couronne de 20 m"), 1.2525);
});

test("une offre qui ne se compte pas en mètres n'a pas de prix au mètre", () => {
  assert.equal(prixAuMetreDeLOffre(20, "Boîte de 100"), null);
  assert.equal(prixAuMetreDeLOffre(5, "Pièce"), null);
  assert.equal(prixAuMetreDeLOffre(5, "À renseigner"), null);
  // Une couronne sans longueur ne dit pas combien de mètres elle porte.
  assert.equal(prixAuMetreDeLOffre(5, "Couronne"), null);
  // Et un prix nul ne vaut pas 0 €/m : il n'est pas encore saisi.
  assert.equal(prixAuMetreDeLOffre(0, "Couronne de 100 m"), null);
});
