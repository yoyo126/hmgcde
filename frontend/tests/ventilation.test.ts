import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  partEnPourcent,
  ventilerChaqueCommande,
  ventilerCommandes,
  ventilerParFournisseur,
} from "../src/lib/ventilation.ts";
import { enCsv, nomCsv, nombreCsv } from "../src/lib/export-csv.ts";
import type { CompanyKey, StoredOrder } from "../src/lib/types.ts";

/**
 * Ce calcul dit à la comptabilité quelle société doit payer quoi : c'est lui
 * qui sert de base à la refacturation entre les quatre sociétés du groupe.
 */

const SOCIETES: CompanyKey[] = ["cpte", "pose", "instal", "pac"];

const commande = (
  id: string,
  supplier: string,
  total: number,
  lines: StoredOrder["lines"],
): StoredOrder => ({
  id,
  reference: `Commande ${id}`,
  supplier,
  date: "26 septembre 2026",
  total,
  status: "Envoyée",
  lines,
});

const ligne = (
  quantity: number,
  unitPrice: number,
  dispatch?: Partial<Record<CompanyKey, number>>,
) => ({
  productId: 1,
  name: "Gaine ICTA 20",
  packaging: "Couronne de 100 m",
  quantity,
  unitPrice,
  ...(dispatch
    ? { dispatch: { cpte: 0, pose: 0, instal: 0, pac: 0, ...dispatch } }
    : {}),
});

test("chaque société porte le prix de ce qu'elle reçoit", () => {
  const resultat = ventilerCommandes(
    [commande("A", "REXEL", 100, [ligne(10, 10, { cpte: 4, pose: 3, instal: 2, pac: 1 })])],
    SOCIETES,
  );
  assert.deepEqual(resultat.parSociete, { cpte: 40, pose: 30, instal: 20, pac: 10 });
  assert.equal(resultat.ventile, 100);
  assert.equal(resultat.nonVentile, 0);
  assert.equal(resultat.total, 100);
});

test("une ligne sans répartition n'est imputée à personne", () => {
  // Livraison globale : deviner le destinataire serait inventer une écriture.
  const resultat = ventilerCommandes(
    [commande("A", "REXEL", 150, [ligne(10, 10, { cpte: 10 }), ligne(5, 10)])],
    SOCIETES,
  );
  assert.equal(resultat.parSociete.cpte, 100);
  assert.equal(resultat.ventile, 100);
  assert.equal(resultat.nonVentile, 50);
});

test("les centimes ne dérivent pas sur beaucoup de lignes", () => {
  // 0,1 + 0,2 en flottant donne 0,30000000000000004 : les montants d'un
  // tableau comptable ne peuvent pas traîner ça.
  const lignes = Array.from({ length: 30 }, () => ligne(1, 0.1, { pose: 1 }));
  const resultat = ventilerCommandes([commande("A", "CEDEO", 3, lignes)], SOCIETES);
  assert.equal(resultat.parSociete.pose, 3);
  assert.equal(resultat.nonVentile, 0);
});

test("un total absurde ne casse pas la somme", () => {
  const abimee = commande("A", "REXEL", NaN, [ligne(2, 5, { pac: 2 })]);
  const resultat = ventilerCommandes([abimee], SOCIETES);
  assert.equal(resultat.parSociete.pac, 10);
  assert.equal(Number.isFinite(resultat.total), true);
  assert.equal(Number.isFinite(resultat.nonVentile), true);
});

test("la ventilation par fournisseur va du plus gros au plus petit", () => {
  const jeu = [
    commande("A", "REXEL", 100, [ligne(10, 10, { cpte: 10 })]),
    commande("B", "CEDEO", 300, [ligne(10, 30, { pose: 6, instal: 4 })]),
    commande("C", "REXEL", 50, [ligne(5, 10, { pac: 5 })]),
  ];
  const parFournisseur = ventilerParFournisseur(jeu, SOCIETES);
  assert.deepEqual(
    parFournisseur.map((f) => f.fournisseur),
    ["CEDEO", "REXEL"],
  );
  assert.equal(parFournisseur[0].parSociete.pose, 180);
  assert.equal(parFournisseur[1].total, 150);
  assert.equal(parFournisseur[1].parSociete.cpte, 100);
  assert.equal(parFournisseur[1].parSociete.pac, 50);
});

test("une commande sans fournisseur reste comptée, sous un nom lisible", () => {
  const orpheline = { ...commande("A", "", 40, [ligne(4, 10, { cpte: 4 })]) };
  assert.equal(ventilerParFournisseur([orpheline], SOCIETES)[0].fournisseur, "Sans fournisseur");
});

test("le détail commande par commande garde le lien avec la commande", () => {
  const jeu = [commande("A", "REXEL", 100, [ligne(10, 10, { cpte: 6, pose: 4 })])];
  const detail = ventilerChaqueCommande(jeu, SOCIETES);
  assert.equal(detail[0].commande.id, "A");
  assert.equal(detail[0].parSociete.cpte, 60);
  assert.equal(detail[0].ventile, 100);
});

test("une part ne vaut jamais NaN, même sans rien à ventiler", () => {
  assert.equal(partEnPourcent(40, 100), 40);
  assert.equal(partEnPourcent(1, 3), 33.3);
  assert.equal(partEnPourcent(0, 0), 0);
});

test("le CSV sort au format qu'attend un Excel français", () => {
  const csv = enCsv([
    ["Société", "Montant HT"],
    ["HM Pose", 1234.5],
  ]);
  assert.equal(csv, "Société;Montant HT\r\nHM Pose;1234,50");
  assert.equal(nombreCsv(0.1 + 0.2), "0,30");
});

test("une cellule qui contient un point-virgule ou un guillemet est encadrée", () => {
  // Sans cela, « REXEL; agence de Nice » glisserait sur deux colonnes.
  assert.equal(enCsv([["REXEL; agence"]]), '"REXEL; agence"');
  assert.equal(enCsv([['Coude 90" cuivre']]), '"Coude 90"" cuivre"');
  assert.equal(enCsv([["Sur\ndeux lignes"]]), '"Sur\ndeux lignes"');
  assert.equal(enCsv([["REXEL"]]), "REXEL");
});

test("le nom du fichier porte la période exportée", () => {
  assert.equal(
    nomCsv("repartition-societes", "2026-09-01", "2026-09-30"),
    "repartition-societes_2026-09-01_au_2026-09-30.csv",
  );
  assert.equal(nomCsv("repartition-societes"), "repartition-societes.csv");
  assert.equal(nomCsv("commandes", "2026-09-01"), "commandes_2026-09-01.csv");
});
