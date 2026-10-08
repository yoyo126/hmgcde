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

/**
 * Relit un CSV : même format que celui qu'on produit, et aussi celui qu'un
 * tableur réenregistre. Point-virgule par défaut, virgule acceptée quand le
 * fichier n'a pas de point-virgule du tout — un export anglophone, par
 * exemple. Le BOM de tête est retiré : sans cela la première colonne
 * s'appellerait « ﻿ID » et ne serait jamais reconnue.
 */
export const lireCsv = (texte: string): string[][] => {
  const contenu = texte.replace(/^\uFEFF/, "");
  const separateur = contenu.includes(";") ? ";" : ",";
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let cellule = "";
  let entreGuillemets = false;

  for (let i = 0; i < contenu.length; i += 1) {
    const caractere = contenu[i];
    if (entreGuillemets) {
      if (caractere === '"') {
        if (contenu[i + 1] === '"') {
          cellule += '"';
          i += 1;
        } else {
          entreGuillemets = false;
        }
      } else {
        cellule += caractere;
      }
      continue;
    }
    if (caractere === '"') {
      entreGuillemets = true;
      continue;
    }
    if (caractere === separateur) {
      ligne.push(cellule);
      cellule = "";
      continue;
    }
    if (caractere === "\n" || caractere === "\r") {
      // Un CRLF ne vaut qu'une fin de ligne.
      if (caractere === "\r" && contenu[i + 1] === "\n") i += 1;
      ligne.push(cellule);
      lignes.push(ligne);
      ligne = [];
      cellule = "";
      continue;
    }
    cellule += caractere;
  }
  if (cellule || ligne.length) {
    ligne.push(cellule);
    lignes.push(ligne);
  }
  // Les lignes vides d'un tableur ne disent rien : on les écarte.
  return lignes.filter((valeurs) => valeurs.some((valeur) => valeur.trim()));
};

/**
 * Relit un nombre écrit à la française comme à l'anglaise : « 1 234,56 »,
 * « 1234.56 », avec ou sans symbole monétaire. Renvoie NaN si ce n'en est pas
 * un — une cellule vide ne vaut pas zéro, elle ne vaut rien.
 */
export const nombreDepuisCsv = (texte: string) => {
  const brut = (texte || "").trim();
  if (!brut) return NaN;
  const nettoye = brut
    .replace(/[\s\u00a0]/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const valeur = Number(nettoye);
  return Number.isFinite(valeur) ? valeur : NaN;
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
