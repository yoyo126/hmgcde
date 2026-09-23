import assert from "node:assert/strict";
import test from "node:test";
import { repartir } from "../src/lib/dispatch.ts";

/**
 * Cette répartition décide quelle filiale est servie, donc quelle filiale
 * paie. Elle est vérifiée à chaque poussée.
 */

test("une société sans équipe n'est jamais servie", () => {
  // Cas réel signalé : CPTE 3, HM Pose 4, HM Instal 2, HM PAC 0.
  const equipes = [3, 4, 2, 0];
  for (let quantite = 1; quantite <= 500; quantite += 1) {
    const parts = repartir(quantite, equipes);
    assert.equal(
      parts[3],
      0,
      `quantité ${quantite} : ${parts[3]} article(s) attribué(s) à une société sans équipe`,
    );
  }
});

test("le total réparti égale toujours la quantité commandée", () => {
  const jeux = [
    [3, 4, 2, 0],
    [3, 4, 2, 2],
    [1, 1, 1, 1],
    [5, 0, 0, 0],
    [7, 3, 0, 11],
  ];
  for (const equipes of jeux) {
    for (let quantite = 1; quantite <= 200; quantite += 1) {
      const somme = repartir(quantite, equipes).reduce((a, b) => a + b, 0);
      assert.equal(somme, quantite, `équipes ${equipes}, quantité ${quantite}`);
    }
  }
});

test("aucune part négative", () => {
  for (let quantite = 0; quantite <= 100; quantite += 1) {
    for (const part of repartir(quantite, [3, 4, 2, 0])) {
      assert.ok(part >= 0, `part négative pour la quantité ${quantite}`);
    }
  }
});

test("la répartition suit le nombre d'équipes", () => {
  // 90 articles pour 3/4/2 équipes : exactement 30, 40, 20.
  assert.deepEqual(repartir(90, [3, 4, 2, 0]), [30, 40, 20, 0]);
  // À équipes égales, parts égales.
  assert.deepEqual(repartir(8, [1, 1, 1, 1]), [2, 2, 2, 2]);
  // Une seule société avec des équipes reçoit tout.
  assert.deepEqual(repartir(13, [0, 5, 0, 0]), [0, 13, 0, 0]);
});

test("sans aucune équipe configurée, rien n'est réparti d'office", () => {
  // Mieux vaut laisser l'acheteur répartir à la main que d'inventer une clé.
  assert.deepEqual(repartir(10, [0, 0, 0, 0]), [0, 0, 0, 0]);
});

test("une quantité nulle ne distribue rien", () => {
  assert.deepEqual(repartir(0, [3, 4, 2, 1]), [0, 0, 0, 0]);
});
