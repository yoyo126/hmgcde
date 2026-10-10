import { strict as assert } from "node:assert";
import { test } from "node:test";
import { comparer, libelleUnitaire, prixUnitaire } from "../src/lib/comparatif.ts";

/**
 * Ce calcul oriente des décisions d'achat.
 *
 * Le défaut qu'il ferme : l'écran Produits désignait le « meilleur prix » en
 * comparant les prix affichés. Deux fournisseurs ne proposant presque jamais
 * le même conditionnement, il montrait régulièrement le mauvais — une
 * couronne de 50 m à 45 € paraissant moins chère qu'une de 100 m à 81 €,
 * alors qu'elle coûte 0,90 €/m contre 0,81.
 */

test("le prix unitaire se déduit du conditionnement", () => {
  assert.deepEqual(prixUnitaire(81.06, "Couronne de 100 m"), {
    valeur: 0.8106,
    unite: "longueur",
    par: 100,
  });
  assert.deepEqual(prixUnitaire(20, "100 Pièce"), {
    valeur: 0.2,
    unite: "piece",
    par: 100,
  });
  assert.deepEqual(prixUnitaire(5, "Pièce"), { valeur: 5, unite: "piece", par: 1 });
});

test("sans conditionnement lisible, ni prix nul, il n'y a pas de prix unitaire", () => {
  assert.equal(prixUnitaire(81.06, "À renseigner"), null);
  assert.equal(prixUnitaire(81.06, "Couronne"), null);
  assert.equal(prixUnitaire(0, "Couronne de 100 m"), null);
  assert.equal(prixUnitaire(81.06, undefined), null);
});

test("la couronne la moins chère n'est pas le câble le moins cher", () => {
  // C'est tout le sujet : 45 € est inférieur à 81 €, mais 0,90 €/m ne l'est
  // pas par rapport à 0,81 €/m.
  const resultat = comparer([
    { fournisseur: "YESS", prix: 45, conditionnement: "Couronne de 50 m" },
    { fournisseur: "REXEL", prix: 81, conditionnement: "Couronne de 100 m" },
  ]);
  assert.equal(resultat.meilleur, "REXEL");
  assert.equal(resultat.obstacle, null);
  assert.equal(resultat.offres.find((o) => o.fournisseur === "YESS")?.unitaire, 0.9);
  assert.equal(resultat.offres.find((o) => o.fournisseur === "REXEL")?.unitaire, 0.81);
});

test("à conditionnement égal, le moins cher reste le moins cher", () => {
  const resultat = comparer([
    { fournisseur: "YESS", prix: 20, conditionnement: "100 Pièce" },
    { fournisseur: "REXEL", prix: 26, conditionnement: "100 Pièce" },
  ]);
  assert.equal(resultat.meilleur, "YESS");
});

test("un conditionnement à renseigner suspend la comparaison, et le dit", () => {
  // Trancher en ignorant l'offre illisible reviendrait à désigner un gagnant
  // sans avoir regardé tous les concurrents.
  const resultat = comparer([
    { fournisseur: "YESS", prix: 45, conditionnement: "Couronne de 50 m" },
    { fournisseur: "CEDEO", prix: 30, conditionnement: "À renseigner" },
  ]);
  assert.equal(resultat.meilleur, null);
  assert.match(resultat.obstacle ?? "", /CEDEO/);
});

test("des mètres et des pièces ne se comparent pas", () => {
  const resultat = comparer([
    { fournisseur: "YESS", prix: 45, conditionnement: "Couronne de 50 m" },
    { fournisseur: "REXEL", prix: 3, conditionnement: "Pièce" },
  ]);
  assert.equal(resultat.meilleur, null);
  assert.match(resultat.obstacle ?? "", /mètre/);
});

test("une seule offre chiffrée ne désigne pas de meilleur prix", () => {
  // Il n'y a rien à comparer : annoncer un vainqueur serait du bruit.
  const resultat = comparer([
    { fournisseur: "YESS", prix: 45, conditionnement: "Couronne de 50 m" },
    { fournisseur: "REXEL", prix: 0, conditionnement: "Couronne de 100 m" },
  ]);
  assert.equal(resultat.meilleur, null);
  assert.equal(resultat.obstacle, null);
  assert.equal(resultat.chiffrees, 1);
});

test("deux fournisseurs au même prix unitaire ne départagent personne", () => {
  const resultat = comparer([
    { fournisseur: "YESS", prix: 40, conditionnement: "Couronne de 50 m" },
    { fournisseur: "REXEL", prix: 80, conditionnement: "Couronne de 100 m" },
  ]);
  assert.equal(resultat.meilleur, null);
  assert.match(resultat.obstacle ?? "", /même prix/);
});

test("aucune offre chiffrée : rien à dire", () => {
  const resultat = comparer([
    { fournisseur: "YESS", prix: 0, conditionnement: "Couronne de 50 m" },
    { fournisseur: "REXEL", prix: 0, conditionnement: "Couronne de 100 m" },
  ]);
  assert.equal(resultat.meilleur, null);
  assert.equal(resultat.chiffrees, 0);
});

test("le libellé distingue le mètre de la pièce, et garde les petits prix lisibles", () => {
  assert.equal(libelleUnitaire(0.8106, "longueur"), "0,811 €/m");
  assert.equal(libelleUnitaire(2.3826, "longueur"), "2,38 €/m");
  assert.equal(libelleUnitaire(0.2, "piece"), "0,200 €/pièce");
  assert.equal(libelleUnitaire(5, "piece"), "5,00 €/pièce");
});
