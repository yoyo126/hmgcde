-- Abonnements aux notifications du navigateur.
--
-- Une ligne par appareil et par navigateur : le même utilisateur peut être
-- abonné depuis son Mac et depuis son téléphone, et chaque abonnement a sa
-- propre adresse de remise. C'est le navigateur qui la fournit, elle est
-- opaque pour nous et elle peut expirer — d'où la suppression automatique
-- quand le service de remise la déclare caduque.
CREATE TABLE IF NOT EXISTS hmgcde_push_subscriptions (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED NOT NULL,
  endpoint      VARCHAR(512) NOT NULL,
  p256dh        VARCHAR(255) NOT NULL,
  auth          VARCHAR(255) NOT NULL,
  appareil      VARCHAR(255) NOT NULL DEFAULT '',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_sent_at  DATETIME     NULL,
  PRIMARY KEY (id),
  -- Un même navigateur ne s'abonne qu'une fois : réactiver ne crée pas de doublon.
  UNIQUE KEY uq_push_endpoint (endpoint),
  KEY idx_push_user (user_id),
  CONSTRAINT fk_push_user FOREIGN KEY (user_id)
    REFERENCES hmgcde_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
