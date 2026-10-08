/**
 * Export CSV.
 *
 * Rien ne sortait de l'application : la comptabilité travaille sur tableur, et
 * recopier des montants à la main est le plus sûr moyen de s'en écarter.
 *
 * Le format est celui qu'attend un Excel français : point-virgule en
 * séparateur — la virgule sert aux décimales —, fins de ligne CRLF, et un BOM
 * UTF-8 en tête, sans lequel « société » arrive en charabia.
 */

export type Cellule = string | number;

/** Nombre à la française. Pas de séparateur de milliers : Excel s'en charge. */
export const nombreCsv = (valeur: number) =>
  (Number.isFinite(valeur) ? valeur : 0).toFixed(2).replace(".", ",");

/** Une cellule n'est encadrée que si son contenu l'exige. */
const cellule = (valeur: Cellule) => {
  const texte = typeof valeur === "number" ? nombreCsv(valeur) : valeur;
  return /[";\n\r]/.test(texte) ? `"${texte.replaceAll('"', '""')}"` : texte;
};

export const enCsv = (lignes: Cellule[][]) =>
  lignes.map((ligne) => ligne.map(cellule).join(";")).join("\r\n");

/**
 * Nom de fichier daté, pour retrouver l'export six mois plus tard. Les bornes
 * sont celles des champs de date de l'écran (« 2026-09-01 »).
 */
export const nomCsv = (base: string, du = "", au = "") => {
  const bornes = [du, au].filter(Boolean).join("_au_");
  return `${base}${bornes ? `_${bornes}` : ""}.csv`;
};

/** Déclenche le téléchargement. Le BOM est ajouté ici, une seule fois. */
export const telechargerCsv = (nom: string, lignes: Cellule[][]) => {
  const blob = new Blob([`﻿${enCsv(lignes)}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nom;
  lien.click();
  URL.revokeObjectURL(url);
};
