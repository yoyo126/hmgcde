import type { SessionUser } from "./types";

/**
 * Droits d'accès.
 *
 * Quatre profils, du plus large au plus étroit :
 *
 *  • admin      — tout, y compris la gestion des utilisateurs ;
 *  • acheteur   — tout le métier (commandes, catalogue, prix, paramètres),
 *                 sauf la gestion des utilisateurs ;
 *  • demandeur  — saisit ses demandes d'achat, consulte le reste, et ne voit
 *                 ni les prix ni les paramètres ;
 *  • lecteur    — consulte, n'écrit rien.
 *
 * Ces règles sont doublées côté serveur (middleware/auth.js) : ce fichier
 * décide de ce qui s'affiche, l'API décide de ce qui est permis.
 */

export type Role = SessionUser["role"];

export type Permissions = {
  /** Commandes, catalogue, imports de tarifs. */
  canManagePurchasing: boolean;
  /** Créer et modifier une demande d'achat. */
  canRequest: boolean;
  /** Voir les prix, les totaux et l'historique des tarifs. */
  canSeePrices: boolean;
  /** Écran Paramètres (fournisseurs, e-mails, équipes). */
  canSeeSettings: boolean;
  /** Gestion des comptes. */
  canManageUsers: boolean;
};

export const permissionsFor = (role: Role | undefined): Permissions => {
  switch (role) {
    case "admin":
      return {
        canManagePurchasing: true,
        canRequest: true,
        canSeePrices: true,
        canSeeSettings: true,
        canManageUsers: true,
      };
    case "acheteur":
      return {
        canManagePurchasing: true,
        canRequest: true,
        canSeePrices: true,
        canSeeSettings: true,
        canManageUsers: false,
      };
    case "demandeur":
      return {
        canManagePurchasing: false,
        canRequest: true,
        canSeePrices: false,
        canSeeSettings: false,
        canManageUsers: false,
      };
    default:
      // lecteur, ou rôle inconnu : on n'ouvre rien par défaut.
      return {
        canManagePurchasing: false,
        canRequest: false,
        canSeePrices: true,
        canSeeSettings: false,
        canManageUsers: false,
      };
  }
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrateur",
  acheteur: "Achats et commandes",
  demandeur: "Demandes d’achat",
  lecteur: "Lecture seule",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Accès complet, y compris la gestion des comptes.",
  acheteur: "Commandes, catalogue, prix et paramètres. Pas les comptes.",
  demandeur: "Saisit ses demandes d’achat. Consulte le reste, sans les prix ni les paramètres.",
  lecteur: "Consultation seule, aucune modification.",
};
