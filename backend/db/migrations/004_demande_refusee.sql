-- ---------------------------------------------------------------------------
-- Refuser une demande d'achat.
--
-- L'écran sait refuser depuis le début, mais « Refusée » ne faisait pas
-- partie des valeurs admises par la colonne : la base rejetait
-- l'enregistrement, le cache était rechargé derrière et la demande
-- réapparaissait « À commander ». Le motif et la date du refus, eux,
-- n'avaient aucune colonne où aller : ils étaient perdus au rechargement.
-- ---------------------------------------------------------------------------

ALTER TABLE hmgcde_purchase_requests
  MODIFY COLUMN status
    ENUM('À commander','Partiellement commandée','Commandée','Refusée')
    NOT NULL DEFAULT 'À commander';

ALTER TABLE hmgcde_purchase_requests
  ADD COLUMN refusal_reason VARCHAR(500) NULL AFTER status,
  ADD COLUMN refused_at     DATETIME     NULL AFTER refusal_reason;
