/**
 * Filtres et totaux des commandes.
 *
 * Ce calcul répond à la question « combien avons-nous commandé chez
 * untel, entre telle et telle date » : il porte des montants, donc il
 * vit à part et il est vérifié automatiquement.
 *
 * Les commandes enregistrent leur date en toutes lettres (« 26 septembre
 * 2026 ») parce que c'est ce qui s'affiche et ce qui s'imprime. Pour
 * comparer deux dates il faut donc la relire, accents compris.
 */

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** Retire les accents pour comparer « fevrier » et « février ». */
const sansAccent = (texte: string) =>
  texte.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Relit une date écrite en toutes lettres et la ramène à minuit, heure
 * locale, pour que la comparaison avec les bornes du filtre soit juste.
 * Accepte aussi le format « 26/09/2026 » et l'ISO, au cas où.
 */
export const lireDateFr = (valeur: string): Date | null => {
  if (!valeur) return null;
  const texte = valeur.trim();

  const enLettres = texte.match(/^(\d{1,2})\s+(\p{L}+)\s+(\d{4})$/u);
  if (enLettres) {
    const mois = MOIS.findIndex((nom) => sansAccent(nom) === sansAccent(enLettres[2]));
    if (mois >= 0) return new Date(Number(enLettres[3]), mois, Number(enLettres[1]));
  }

  const enChiffres = texte.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (enChiffres) {
    return new Date(
      Number(enChiffres[3]),
      Number(enChiffres[2]) - 1,
      Number(enChiffres[1]),
    );
  }

  const iso = texte.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  return null;
};

type CommandeFiltrable = {
  id: string;
  reference: string;
  supplier: string;
  date: string;
  total: number;
  status: string;
};

export type CritèresCommandes = {
  recherche?: string;
  statut?: string;
  fournisseur?: string;
  /** Bornes au format d'un champ date HTML : « 2026-09-01 ». */
  du?: string;
  au?: string;
};

/**
 * Applique tous les critères. Une commande dont la date est illisible
 * n'est jamais écartée par un filtre de dates : mieux vaut la montrer
 * que la perdre.
 */
export const filtrerCommandes = <T extends CommandeFiltrable>(
  commandes: T[],
  criteres: CritèresCommandes,
): T[] => {
  const recherche = (criteres.recherche || "").trim().toLowerCase();
  const debut = lireDateFr(criteres.du || "");
  const fin = lireDateFr(criteres.au || "");
  // La borne haute inclut le jour entier : « au 26/09 » garde le 26.
  if (fin) fin.setHours(23, 59, 59, 999);

  return commandes.filter((commande) => {
    if (criteres.statut && commande.status !== criteres.statut) return false;
    if (criteres.fournisseur && commande.supplier !== criteres.fournisseur) return false;

    if (recherche) {
      const paille =
        `${commande.id} ${commande.reference} ${commande.supplier} ${commande.status}`.toLowerCase();
      if (!paille.includes(recherche)) return false;
    }

    if (debut || fin) {
      const date = lireDateFr(commande.date);
      if (date) {
        if (debut && date < debut) return false;
        if (fin && date > fin) return false;
      }
    }
    return true;
  });
};

export type Totaux = {
  nombre: number;
  montant: number;
  parFournisseur: { fournisseur: string; nombre: number; montant: number }[];
};

/** Nombre de commandes et montant, en tout et par fournisseur. */
export const totauxCommandes = (commandes: CommandeFiltrable[]): Totaux => {
  const parFournisseur = new Map<string, { nombre: number; montant: number }>();
  let montant = 0;

  for (const commande of commandes) {
    const valeur = Number.isFinite(commande.total) ? commande.total : 0;
    montant += valeur;
    const nom = commande.supplier || "Sans fournisseur";
    const cumul = parFournisseur.get(nom) || { nombre: 0, montant: 0 };
    parFournisseur.set(nom, {
      nombre: cumul.nombre + 1,
      montant: cumul.montant + valeur,
    });
  }

  return {
    nombre: commandes.length,
    montant,
    parFournisseur: [...parFournisseur.entries()]
      .map(([fournisseur, cumul]) => ({ fournisseur, ...cumul }))
      .sort((a, b) => b.montant - a.montant),
  };
};
