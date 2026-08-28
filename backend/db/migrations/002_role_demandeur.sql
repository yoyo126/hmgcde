-- ---------------------------------------------------------------------------
-- Nouveau profil « demandeur » : saisit ses demandes d'achat, consulte le
-- reste, et n'a accès ni aux prix ni aux paramètres.
-- ---------------------------------------------------------------------------

ALTER TABLE hmgcde_users
  MODIFY COLUMN role ENUM('admin','acheteur','demandeur','lecteur')
  NOT NULL DEFAULT 'acheteur';
