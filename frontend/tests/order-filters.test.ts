import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  filtrerCommandes,
  lireDateFr,
  totauxCommandes,
} from "../src/lib/order-filters.ts";

const commande = (
  id: string,
  supplier: string,
  date: string,
  total: number,
  status = "Envoyée",
) => ({ id, reference: `Commande ${id}`, supplier, date, total, status });

const jeu = [
  commande("A", "REXEL", "2 septembre 2026", 1200),
  commande("B", "CEDEO", "26 septembre 2026", 340.5),
  commande("C", "REXEL", "1 octobre 2026", 89.9, "Brouillon"),
  commande("D", "REXEL", "28 août 2026", 500),
];

test("relit une date écrite en toutes lettres, accents compris", () => {
  assert.deepEqual(lireDateFr("26 septembre 2026"), new Date(2026, 8, 26));
  assert.deepEqual(lireDateFr("28 août 2026"), new Date(2026, 7, 28));
  assert.deepEqual(lireDateFr("1 février 2026"), new Date(2026, 1, 1));
  assert.deepEqual(lireDateFr("26/09/2026"), new Date(2026, 8, 26));
  assert.equal(lireDateFr("pas une date"), null);
  assert.equal(lireDateFr(""), null);
});

test("la borne haute garde le jour entier", () => {
  // « au 26 septembre » doit conserver la commande du 26.
  const resultat = filtrerCommandes(jeu, { du: "2026-09-02", au: "2026-09-26" });
  assert.deepEqual(
    resultat.map((c) => c.id),
    ["A", "B"],
  );
});

test("filtre par fournisseur et par statut", () => {
  assert.deepEqual(
    filtrerCommandes(jeu, { fournisseur: "REXEL" }).map((c) => c.id),
    ["A", "C", "D"],
  );
  assert.deepEqual(
    filtrerCommandes(jeu, { statut: "Brouillon" }).map((c) => c.id),
    ["C"],
  );
});

test("une date illisible n'est jamais écartée par un filtre de dates", () => {
  // Perdre une commande de vue serait pire que d'en montrer une de trop.
  const avecTrou = [...jeu, commande("E", "CEDEO", "date inconnue", 42)];
  const resultat = filtrerCommandes(avecTrou, { du: "2026-09-02", au: "2026-09-26" });
  assert.ok(resultat.some((c) => c.id === "E"));
});

test("les totaux tiennent compte du filtre en cours", () => {
  const resultat = filtrerCommandes(jeu, { fournisseur: "REXEL" });
  const totaux = totauxCommandes(resultat);
  assert.equal(totaux.nombre, 3);
  assert.equal(totaux.montant, 1789.9);
  assert.equal(totaux.parFournisseur.length, 1);
  assert.equal(totaux.parFournisseur[0].fournisseur, "REXEL");
});

test("le détail par fournisseur va du plus gros au plus petit", () => {
  const totaux = totauxCommandes(jeu);
  assert.deepEqual(
    totaux.parFournisseur.map((f) => f.fournisseur),
    ["REXEL", "CEDEO"],
  );
  assert.equal(totaux.montant, 2130.4);
});

test("un total manquant compte pour zéro, il ne casse pas la somme", () => {
  const abime = [
    ...jeu,
    { ...commande("F", "CEDEO", "3 septembre 2026", 0), total: NaN },
  ];
  assert.equal(Number.isFinite(totauxCommandes(abime).montant), true);
});
