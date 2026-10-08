import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  enTetesReferences,
  lignesReferences,
  lireReferences,
} from "../src/lib/references-csv.ts";
import { enCsv } from "../src/lib/export-csv.ts";
import type { Product } from "../src/lib/types.ts";

/**
 * Ce fichier sert à rattacher un devis fournisseur au catalogue depuis un
 * tableur, puis à rendre le travail à l'application. Il écrit des prix et des
 * références : un aller-retour qui déraille abîmerait le catalogue.
 */

const FOURNISSEURS = ["YESS ELECTRIQUE", "REXEL"];

const produit = (
  id: number,
  name: string,
  offers: Product["offers"],
): Product => ({
  id,
  code: `HM-${String(id).padStart(4, "0")}`,
  name,
  family: "Électricité",
  subfamily: "Consommables",
  unit: "Pièce",
  kind: "simple",
  offers,
});

const offre = (supplier: string, reference: string, price: number) => ({
  supplier,
  supplierName: "",
  reference,
  brand: "À renseigner",
  price,
  packaging: "Couronne de 100 m",
  packagingType: "fixed" as const,
});

const CATALOGUE: Product[] = [
  produit(12, "Gaine ICTA 20", [offre("YESS ELECTRIQUE", "0083-0455", 40)]),
  produit(13, "Gaine ICTA 25", [offre("REXEL", "RX-55", 12.5)]),
  produit(14, "Coude ouvrable 25", []),
];

const aller = () => enCsv(lignesReferences(CATALOGUE, FOURNISSEURS));

test("l'en-tête ouvre deux colonnes par fournisseur", () => {
  assert.deepEqual(enTetesReferences(FOURNISSEURS), [
    "ID",
    "Code",
    "Famille",
    "Produit",
    "Conditionnement",
    "YESS ELECTRIQUE réf",
    "YESS ELECTRIQUE prix HT",
    "REXEL réf",
    "REXEL prix HT",
  ]);
});

test("un produit sans offre chez un fournisseur laisse ses cellules vides", () => {
  // « 0,00 » se relirait comme un prix voulu et écraserait le prix du jour.
  const lignes = lignesReferences(CATALOGUE, FOURNISSEURS);
  const coude = lignes.find((ligne) => ligne[0] === "14")!;
  assert.deepEqual(coude.slice(5), ["", "", "", ""]);
});

test("une référence « À renseigner » n'est pas recopiée comme une vraie", () => {
  const avecDefaut = [produit(20, "Manchon 32", [offre("REXEL", "À renseigner", 3)])];
  const ligne = lignesReferences(avecDefaut, FOURNISSEURS)[1];
  assert.equal(ligne[7], "");
  assert.equal(ligne[8], 3);
});

test("réimporter un export qu'on n'a pas touché n'écrit rien", () => {
  // Sans cela, un aller-retour par le tableur réécrirait tout le catalogue.
  const resultat = lireReferences(aller(), CATALOGUE, FOURNISSEURS);
  assert.deepEqual(resultat.references, []);
  assert.deepEqual(resultat.overrides, {});
  assert.deepEqual(resultat.inconnus, []);
});

test("une référence remplie est apprise, et le prix suit", () => {
  // On remplit les cellules comme le ferait un tableur, puis on rend le
  // fichier : c'est exactement l'aller-retour qu'on attend de l'utilisateur.
  const lignes = lignesReferences(CATALOGUE, FOURNISSEURS);
  const coude = lignes.find((ligne) => ligne[0] === "14")!;
  coude[5] = "1922-3995";
  coude[6] = "60,00";
  const resultat = lireReferences(enCsv(lignes), CATALOGUE, FOURNISSEURS);
  assert.deepEqual(resultat.references, [
    {
      productId: 14,
      supplier: "YESS ELECTRIQUE",
      reference: "1922-3995",
      supplierName: "Coude ouvrable 25",
    },
  ]);
  assert.deepEqual(resultat.overrides, { "14|||YESS ELECTRIQUE": 60 });
});

test("une cellule vidée n'efface pas une référence connue", () => {
  const efface = aller().replace("0083-0455", "");
  const resultat = lireReferences(efface, CATALOGUE, FOURNISSEURS);
  assert.deepEqual(resultat.references, []);
});

test("les prix se relisent à la française comme à l'anglaise", () => {
  const entete = "ID;YESS ELECTRIQUE réf;YESS ELECTRIQUE prix HT";
  const fr = lireReferences(`${entete}\r\n12;0083-0455;1 234,56`, CATALOGUE, FOURNISSEURS);
  assert.equal(fr.overrides["12|||YESS ELECTRIQUE"], 1234.56);
  const en = lireReferences(`${entete}\r\n12;0083-0455;1234.56`, CATALOGUE, FOURNISSEURS);
  assert.equal(en.overrides["12|||YESS ELECTRIQUE"], 1234.56);
  const euro = lireReferences(`${entete}\r\n12;0083-0455;41,00 €`, CATALOGUE, FOURNISSEURS);
  assert.equal(euro.overrides["12|||YESS ELECTRIQUE"], 41);
});

test("une cellule de prix vide ou illisible ne vaut pas zéro", () => {
  const entete = "ID;YESS ELECTRIQUE réf;YESS ELECTRIQUE prix HT";
  const vide = lireReferences(`${entete}\r\n12;0083-0455;`, CATALOGUE, FOURNISSEURS);
  assert.deepEqual(vide.overrides, {});
  const texte = lireReferences(`${entete}\r\n12;0083-0455;à voir`, CATALOGUE, FOURNISSEURS);
  assert.deepEqual(texte.overrides, {});
});

test("un identifiant inconnu est signalé, pas appliqué au hasard", () => {
  const entete = "ID;YESS ELECTRIQUE réf;YESS ELECTRIQUE prix HT";
  const resultat = lireReferences(`${entete}\r\n9999;X-1;10,00`, CATALOGUE, FOURNISSEURS);
  assert.deepEqual(resultat.inconnus, ["9999"]);
  assert.deepEqual(resultat.references, []);
  assert.deepEqual(resultat.overrides, {});
});

test("une colonne de fournisseur inconnu est signalée", () => {
  const resultat = lireReferences(
    "ID;SONEPAR réf;SONEPAR prix HT\r\n12;S-1;10,00",
    CATALOGUE,
    FOURNISSEURS,
  );
  assert.deepEqual(resultat.colonnesIgnorees, ["SONEPAR réf", "SONEPAR prix HT"]);
  assert.deepEqual(resultat.references, []);
});

test("l'ordre des colonnes n'a pas d'importance", () => {
  const resultat = lireReferences(
    "YESS ELECTRIQUE prix HT;Produit;ID;YESS ELECTRIQUE réf\r\n55,00;Gaine ICTA 20;12;0083-9999",
    CATALOGUE,
    FOURNISSEURS,
  );
  assert.equal(resultat.references[0].reference, "0083-9999");
  assert.equal(resultat.overrides["12|||YESS ELECTRIQUE"], 55);
});

test("une cellule contenant un point-virgule survit à l'aller-retour", () => {
  const avecPointVirgule = [
    produit(30, "Cosses anneaux jaunes 6²; lot de 10", [offre("REXEL", "B650/6E", 20)]),
  ];
  const lignes = lignesReferences(avecPointVirgule, FOURNISSEURS);
  assert.ok(enCsv(lignes).includes('"Cosses anneaux jaunes 6²; lot de 10"'));
  const resultat = lireReferences(enCsv(lignes), avecPointVirgule, FOURNISSEURS);
  assert.deepEqual(resultat.references, []);
  assert.deepEqual(resultat.overrides, {});
});

test("à défaut d'identifiant, le code suffit", () => {
  // Un fichier préparé ailleurs ne connaît pas les identifiants de la base,
  // mais il connaît les codes produit.
  const resultat = lireReferences(
    "Code;YESS ELECTRIQUE réf\r\nHM-0012;0083-0455bis",
    CATALOGUE,
    FOURNISSEURS,
  );
  assert.equal(resultat.references[0].productId, 12);
  assert.equal(resultat.references[0].reference, "0083-0455bis");
});

test("le code se reconnaît sans égard à la casse", () => {
  const resultat = lireReferences(
    "Code;REXEL réf\r\nhm-0013;RX-99",
    CATALOGUE,
    FOURNISSEURS,
  );
  assert.equal(resultat.references[0].productId, 13);
});

test("l'identifiant prime sur le code quand les deux sont là", () => {
  const resultat = lireReferences(
    "ID;Code;REXEL réf\r\n13;HM-0012;RX-77",
    CATALOGUE,
    FOURNISSEURS,
  );
  assert.equal(resultat.references[0].productId, 13);
});

test("un code inconnu est signalé, pas appliqué au hasard", () => {
  const resultat = lireReferences(
    "Code;REXEL réf\r\nHM-9999;RX-1",
    CATALOGUE,
    FOURNISSEURS,
  );
  assert.deepEqual(resultat.inconnus, ["HM-9999"]);
  assert.deepEqual(resultat.references, []);
});

test("un fichier vide ou sans colonne clé ne fait rien", () => {
  assert.deepEqual(lireReferences("", CATALOGUE, FOURNISSEURS).references, []);
  assert.deepEqual(
    lireReferences("Produit;Prix HT\r\nGaine;12,00", CATALOGUE, FOURNISSEURS).overrides,
    {},
  );
});
