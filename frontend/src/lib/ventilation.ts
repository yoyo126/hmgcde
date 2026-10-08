import type { CompanyKey, StoredOrder } from "./types";

/**
 * Ventilation des achats entre les sociétés, en euros.
 *
 * La répartition d'une commande existe depuis toujours, mais en quantités :
 * elle partait en colonnes dans l'e-mail du fournisseur et s'arrêtait là.
 * Rien ne disait ce qu'une société avait consommé sur le mois, alors que
 * c'est cette question qui décide de la refacturation entre les quatre
 * sociétés du groupe.
 *
 * Ce calcul porte des montants, et c'est lui qui dira à la comptabilité qui
 * doit payer quoi : il vit à part et il est vérifié automatiquement
 * (frontend/tests/ventilation.test.ts).
 *
 * Le total retenu est celui que porte la commande — le même que l'écran
 * Commandes affiche. Ce que la répartition ne couvre pas reste donc visible
 * en « non ventilé » plutôt que d'être réparti au jugé : une ligne livrée
 * globalement n'a pas de destinataire, et lui en inventer un serait inventer
 * une écriture.
 */

/** Arrondi au centime : des montants qui se comparent et qui s'additionnent. */
const auCentime = (valeur: number) =>
  Number.isFinite(valeur) ? Math.round(valeur * 100) / 100 : 0;

export type MontantsParSociete = Record<CompanyKey, number>;

const aucunMontant = (societes: CompanyKey[]) =>
  Object.fromEntries(societes.map((societe) => [societe, 0])) as MontantsParSociete;

export type Ventilation = {
  /** Montant imputé à chaque société. */
  parSociete: MontantsParSociete;
  /** Somme des montants imputés. */
  ventile: number;
  /** Ce qui n'est imputé à personne : livraisons globales, reliquats. */
  nonVentile: number;
  /** Total des commandes retenues, tel qu'elles le portent. */
  total: number;
  nombre: number;
};

/**
 * Ventile un ensemble de commandes. Le montant d'une ligne va à une société
 * au prorata de ce qu'elle reçoit : son prix unitaire multiplié par sa part.
 */
export const ventilerCommandes = (
  commandes: StoredOrder[],
  societes: CompanyKey[],
): Ventilation => {
  const parSociete = aucunMontant(societes);
  let total = 0;

  for (const commande of commandes) {
    total += Number.isFinite(commande.total) ? commande.total : 0;
    for (const ligne of commande.lines || []) {
      if (!ligne.dispatch) continue;
      for (const societe of societes) {
        const quantite = ligne.dispatch[societe] || 0;
        if (quantite > 0) parSociete[societe] += quantite * (ligne.unitPrice || 0);
      }
    }
  }

  for (const societe of societes) parSociete[societe] = auCentime(parSociete[societe]);
  const ventile = auCentime(
    societes.reduce((somme, societe) => somme + parSociete[societe], 0),
  );
  const arrondi = auCentime(total);

  return {
    parSociete,
    ventile,
    nonVentile: auCentime(arrondi - ventile),
    total: arrondi,
    nombre: commandes.length,
  };
};

export type VentilationFournisseur = Ventilation & { fournisseur: string };

/** La même ventilation, fournisseur par fournisseur, du plus gros au plus petit. */
export const ventilerParFournisseur = (
  commandes: StoredOrder[],
  societes: CompanyKey[],
): VentilationFournisseur[] => {
  const parNom = new Map<string, StoredOrder[]>();
  for (const commande of commandes) {
    const nom = commande.supplier || "Sans fournisseur";
    parNom.set(nom, [...(parNom.get(nom) || []), commande]);
  }
  return [...parNom.entries()]
    .map(([fournisseur, liste]) => ({
      fournisseur,
      ...ventilerCommandes(liste, societes),
    }))
    .sort((a, b) => b.total - a.total || a.fournisseur.localeCompare(b.fournisseur));
};

export type CommandeVentilee = {
  commande: StoredOrder;
  parSociete: MontantsParSociete;
  ventile: number;
  nonVentile: number;
};

/** Commande par commande : c'est ce détail qui se rapproche d'une facture. */
export const ventilerChaqueCommande = (
  commandes: StoredOrder[],
  societes: CompanyKey[],
): CommandeVentilee[] =>
  commandes.map((commande) => {
    const { parSociete, ventile, nonVentile } = ventilerCommandes([commande], societes);
    return { commande, parSociete, ventile, nonVentile };
  });

/**
 * Part d'une société dans ce qui a été ventilé, en pourcentage à une décimale.
 * Zéro quand rien n'est ventilé : une division par zéro afficherait « NaN % ».
 */
export const partEnPourcent = (montant: number, ventile: number) =>
  ventile > 0 ? Math.round((montant / ventile) * 1000) / 10 : 0;
