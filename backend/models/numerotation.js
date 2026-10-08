/**
 * Attribution des numéros métier : CMD-2026-049, DA-2026-012.
 *
 * Le numéro était calculé par le navigateur, à partir des seules commandes
 * qu'il avait en mémoire. Deux personnes qui créaient une commande en même
 * temps — ou une personne dont l'écran était resté ouvert pendant qu'un
 * collègue commandait — tombaient donc sur le même numéro. Et comme
 * l'enregistrement se faisait en « INSERT … ON DUPLICATE KEY UPDATE », la
 * seconde commande écrasait silencieusement la première, lignes et
 * répartition entre les sociétés comprises.
 *
 * Le numéro est désormais attribué ici, côté serveur, qui seul voit toutes
 * les commandes. Deux requêtes peuvent encore se croiser entre la lecture du
 * dernier numéro et l'insertion : la contrainte d'unicité de la base a le
 * dernier mot, et quand elle refuse un numéro on reprend le suivant au lieu
 * d'écrire par-dessus ce qui est déjà enregistré.
 *
 * Ce fichier ne touche pas la base : il est vérifié automatiquement
 * (backend/tests/numerotation.test.js).
 */

/**
 * Une insertion refusée parce que le numéro vient d'être pris. mysql2 donne
 * le nom, le pilote le numéro : on accepte les deux.
 */
export const estDoublon = (error) =>
  error?.code === "ER_DUP_ENTRY" || error?.errno === 1062;

/**
 * Nombre d'essais. Dix collisions d'affilée ne sont pas une course perdue
 * mais une anomalie : mieux vaut échouer franchement que boucler.
 */
export const TENTATIVES = 10;

/**
 * Demande un numéro, tente l'insertion, recommence si la base répond que ce
 * numéro est déjà pris. Toute autre erreur remonte telle quelle : une panne
 * ne doit pas se déguiser en collision et faire perdre l'enregistrement.
 *
 * `prochainNumero` lit le dernier numéro utilisé, `inserer` écrit avec le
 * numéro proposé et laisse remonter le refus de la base.
 */
export const attribuerNumero = async (prochainNumero, inserer, tentatives = TENTATIVES) => {
  let derniereCollision = null;
  for (let essai = 1; essai <= tentatives; essai += 1) {
    const numero = await prochainNumero();
    try {
      await inserer(numero);
      return numero;
    } catch (error) {
      if (!estDoublon(error)) throw error;
      derniereCollision = numero;
    }
  }
  throw new Error(
    `Numéro indisponible : ${tentatives} tentatives, toutes déjà prises ` +
      `(dernière : ${derniereCollision}).`,
  );
};
