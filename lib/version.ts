export const CRM_VERSION = "2.1.0";

export const CRM_VERSION_HISTORY = [
  {
    version: "2.1.0",
    date: "16 août 2026",
    title: "Nouvelle interface et contrôle du dispatch",
    changes: [
      "Paramètres organisés par rubriques",
      "Récapitulatif par société ajustable avant commande",
      "Nouvelle identité visuelle desktop et mobile",
      "Historique des versions intégré",
    ],
  },
  {
    version: "2.0.0",
    date: "16 août 2026",
    title: "Catalogue et saisie rapide",
    changes: [
      "Navigation par catégories et groupes",
      "Création de produits et d’ensembles libres",
      "Sélection multiple des fournisseurs",
      "Historique complet des prix",
    ],
  },
  {
    version: "1.5.0",
    date: "15 août 2026",
    title: "Synchronisation des achats",
    changes: [
      "Catalogue synchronisé dans toutes les commandes",
      "Fournisseurs et plusieurs e-mails paramétrables",
      "Notifications des nouvelles demandes",
    ],
  },
  {
    version: "1.0.0",
    date: "13 août 2026",
    title: "Première version",
    changes: [
      "Demandes d’achat et commandes fournisseurs",
      "Dispatch CPTE Conseil, HM Pose, HM Instal et HM PAC",
      "Envoi par e-mail et impression PDF",
    ],
  },
] as const;
