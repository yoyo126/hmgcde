-- ---------------------------------------------------------------------------
-- Achats filiales HM Group — schéma initial
-- Toutes les tables sont préfixées hmgcde_ pour pouvoir cohabiter un jour
-- avec le CRM HM Group dans une même base sans collision de noms.
-- ---------------------------------------------------------------------------

-- Sociétés du groupe. `teams` = nombre d'équipes, base de la répartition
-- automatique des quantités entre les filiales.
CREATE TABLE IF NOT EXISTS hmgcde_companies (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code          VARCHAR(32)  NOT NULL,
  name          VARCHAR(120) NOT NULL,
  short_name    VARCHAR(40)  NOT NULL,
  color         VARCHAR(16)  NOT NULL DEFAULT '#2563eb',
  teams         INT UNSIGNED NOT NULL DEFAULT 1,
  position      INT UNSIGNED NOT NULL DEFAULT 0,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_companies_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fournisseurs. `emails` accepte plusieurs adresses séparées par ; ou ,
-- (comportement repris tel quel de l'ancien écran Paramètres).
CREATE TABLE IF NOT EXISTS hmgcde_suppliers (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(160) NOT NULL,
  emails        VARCHAR(500) NOT NULL DEFAULT '',
  position      INT UNSIGNED NOT NULL DEFAULT 0,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_suppliers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Catalogue. `kind` = 'ensemble' pour les coffrets, cartons et kits, dont le
-- détail vit dans hmgcde_product_components.
CREATE TABLE IF NOT EXISTS hmgcde_products (
  -- BIGINT : l'interface crée un produit avec un id issu de Date.now(),
  -- que l'on conserve tel quel pour ne pas rompre les références en cours.
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code          VARCHAR(40)  NULL,
  name          VARCHAR(255) NOT NULL,
  family        VARCHAR(120) NOT NULL,
  subfamily     VARCHAR(120) NOT NULL DEFAULT '',
  unit          VARCHAR(60)  NOT NULL DEFAULT 'Pièce',
  kind          ENUM('simple','ensemble') NOT NULL DEFAULT 'simple',
  bundle_label  VARCHAR(160) NULL,
  is_deleted    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_code (code),
  KEY idx_products_family (family, subfamily),
  KEY idx_products_deleted (is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contenu des produits composés (coffrets / cartons / kits).
CREATE TABLE IF NOT EXISTS hmgcde_product_components (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id    BIGINT UNSIGNED NOT NULL,
  name          VARCHAR(255) NOT NULL,
  quantity      DECIMAL(12,3) NOT NULL DEFAULT 1,
  unit_price    DECIMAL(12,4) NOT NULL DEFAULT 0,
  position      INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_components_product (product_id),
  CONSTRAINT fk_components_product FOREIGN KEY (product_id)
    REFERENCES hmgcde_products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Prix d'un sous-produit chez un fournisseur donné (supplierPrices côté front).
CREATE TABLE IF NOT EXISTS hmgcde_product_component_prices (
  component_id  INT UNSIGNED NOT NULL,
  supplier_id   INT UNSIGNED NOT NULL,
  price         DECIMAL(12,4) NOT NULL DEFAULT 0,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (component_id, supplier_id),
  KEY idx_component_prices_supplier (supplier_id),
  CONSTRAINT fk_component_prices_component FOREIGN KEY (component_id)
    REFERENCES hmgcde_product_components (id) ON DELETE CASCADE,
  CONSTRAINT fk_component_prices_supplier FOREIGN KEY (supplier_id)
    REFERENCES hmgcde_suppliers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Offre d'un fournisseur pour un produit : référence, prix, conditionnement.
-- packaging_type = 'modifiable' pour les couronnes (longueur ajustable),
-- 'fixed' pour un conditionnement imposé par le fournisseur.
CREATE TABLE IF NOT EXISTS hmgcde_supplier_products (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id     BIGINT UNSIGNED NOT NULL,
  supplier_id    INT UNSIGNED NOT NULL,
  supplier_label VARCHAR(255) NOT NULL DEFAULT '',
  reference      VARCHAR(160) NOT NULL DEFAULT 'À renseigner',
  brand          VARCHAR(160) NOT NULL DEFAULT 'À renseigner',
  price          DECIMAL(12,4) NOT NULL DEFAULT 0,
  meter_price    DECIMAL(12,4) NULL,
  packaging      VARCHAR(160) NOT NULL DEFAULT 'À renseigner',
  packaging_type ENUM('modifiable','fixed') NOT NULL DEFAULT 'fixed',
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_supplier_product (product_id, supplier_id),
  KEY idx_supplier_products_supplier (supplier_id),
  CONSTRAINT fk_supplier_products_product FOREIGN KEY (product_id)
    REFERENCES hmgcde_products (id) ON DELETE CASCADE,
  CONSTRAINT fk_supplier_products_supplier FOREIGN KEY (supplier_id)
    REFERENCES hmgcde_suppliers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Demandes d'achat (DA-2026-011…), saisies en amont des commandes.
CREATE TABLE IF NOT EXISTS hmgcde_purchase_requests (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code          VARCHAR(40)  NOT NULL,
  requester     VARCHAR(160) NOT NULL DEFAULT '',
  request_date  DATE         NOT NULL,
  status        ENUM('À commander','Partiellement commandée','Commandée')
                NOT NULL DEFAULT 'À commander',
  seen          TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_requests_code (code),
  KEY idx_requests_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hmgcde_purchase_request_lines (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id    INT UNSIGNED NOT NULL,
  product_id    BIGINT UNSIGNED NULL,
  name          VARCHAR(255) NOT NULL,
  unit          VARCHAR(60)  NOT NULL DEFAULT 'Pièce',
  quantity      DECIMAL(12,3) NOT NULL DEFAULT 1,
  supplier_id   INT UNSIGNED NULL,
  ordered       TINYINT(1)   NOT NULL DEFAULT 0,
  position      INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_request_lines_request (request_id),
  CONSTRAINT fk_request_lines_request FOREIGN KEY (request_id)
    REFERENCES hmgcde_purchase_requests (id) ON DELETE CASCADE,
  CONSTRAINT fk_request_lines_product FOREIGN KEY (product_id)
    REFERENCES hmgcde_products (id) ON DELETE SET NULL,
  CONSTRAINT fk_request_lines_supplier FOREIGN KEY (supplier_id)
    REFERENCES hmgcde_suppliers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Commandes fournisseurs (CMD-2026-049…). `reference` est le libellé métier
-- « Commande S33 du 16/08/2026 » repris dans les e-mails et les impressions.
CREATE TABLE IF NOT EXISTS hmgcde_orders (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code              VARCHAR(40)  NOT NULL,
  reference         VARCHAR(160) NOT NULL DEFAULT '',
  supplier_id       INT UNSIGNED NULL,
  supplier_name     VARCHAR(160) NOT NULL DEFAULT '',
  order_date        DATE         NOT NULL,
  status            ENUM('Brouillon','Envoyée','Reçue') NOT NULL DEFAULT 'Brouillon',
  total             DECIMAL(12,2) NOT NULL DEFAULT 0,
  source_request_id INT UNSIGNED NULL,
  email_sent_at     VARCHAR(60)  NULL,
  email_to          VARCHAR(500) NULL,
  email_subject     VARCHAR(255) NULL,
  email_body        MEDIUMTEXT   NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_code (code),
  KEY idx_orders_status (status),
  KEY idx_orders_date (order_date),
  CONSTRAINT fk_orders_supplier FOREIGN KEY (supplier_id)
    REFERENCES hmgcde_suppliers (id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_request FOREIGN KEY (source_request_id)
    REFERENCES hmgcde_purchase_requests (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lignes de commande. Le nom, le conditionnement, le prix et le détail des
-- ensembles sont figés à la commande : le catalogue peut changer ensuite sans
-- réécrire l'historique.
CREATE TABLE IF NOT EXISTS hmgcde_order_lines (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id        INT UNSIGNED NOT NULL,
  product_id      BIGINT UNSIGNED NULL,
  name            VARCHAR(255) NOT NULL,
  packaging       VARCHAR(160) NOT NULL DEFAULT '',
  quantity        DECIMAL(12,3) NOT NULL DEFAULT 0,
  unit_price      DECIMAL(12,4) NOT NULL DEFAULT 0,
  components_json JSON         NULL,
  position        INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_order_lines_order (order_id),
  CONSTRAINT fk_order_lines_order FOREIGN KEY (order_id)
    REFERENCES hmgcde_orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_lines_product FOREIGN KEY (product_id)
    REFERENCES hmgcde_products (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Répartition d'une ligne entre les sociétés : le cœur métier de l'outil.
-- Table dédiée (plutôt qu'un JSON) pour pouvoir sortir un jour « qui a
-- commandé quoi » par filiale d'une simple requête SQL.
CREATE TABLE IF NOT EXISTS hmgcde_order_line_dispatch (
  order_line_id INT UNSIGNED NOT NULL,
  company_id    INT UNSIGNED NOT NULL,
  quantity      DECIMAL(12,3) NOT NULL DEFAULT 0,
  PRIMARY KEY (order_line_id, company_id),
  KEY idx_dispatch_company (company_id),
  CONSTRAINT fk_dispatch_line FOREIGN KEY (order_line_id)
    REFERENCES hmgcde_order_lines (id) ON DELETE CASCADE,
  CONSTRAINT fk_dispatch_company FOREIGN KEY (company_id)
    REFERENCES hmgcde_companies (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historique des prix : une ligne par changement, qu'il vienne d'une saisie
-- manuelle ou d'un import de tarif. `batch_id` regroupe les changements
-- enregistrés ensemble (un import, une validation manuelle).
CREATE TABLE IF NOT EXISTS hmgcde_price_history (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_id       CHAR(36)     NOT NULL,
  changed_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source         ENUM('Manuel','Import tarif') NOT NULL DEFAULT 'Manuel',
  scope          ENUM('Produit','Sous-produit') NOT NULL DEFAULT 'Produit',
  product_id     BIGINT UNSIGNED NULL,
  product_name   VARCHAR(255) NOT NULL,
  component_name VARCHAR(255) NULL,
  supplier_id    INT UNSIGNED NULL,
  supplier_name  VARCHAR(160) NOT NULL DEFAULT '',
  old_price      DECIMAL(12,4) NOT NULL DEFAULT 0,
  new_price      DECIMAL(12,4) NOT NULL DEFAULT 0,
  user_id        INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_price_history_batch (batch_id),
  KEY idx_price_history_date (changed_at),
  KEY idx_price_history_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Journal des imports de tarifs (fichier Excel ou PDF fournisseur).
CREATE TABLE IF NOT EXISTS hmgcde_tariff_imports (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_id      CHAR(36)     NOT NULL,
  imported_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  file_name     VARCHAR(255) NOT NULL,
  supplier_name VARCHAR(160) NOT NULL DEFAULT '',
  changed_count INT UNSIGNED NOT NULL DEFAULT 0,
  added_count   INT UNSIGNED NOT NULL DEFAULT 0,
  ignored_count INT UNSIGNED NOT NULL DEFAULT 0,
  user_id       INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_tariff_imports_date (imported_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Réglages généraux (objet des e-mails, formules de politesse, adresse de
-- livraison…). Stockage clé/valeur JSON : une nouvelle option ne demande pas
-- de migration.
CREATE TABLE IF NOT EXISTS hmgcde_settings (
  setting_key   VARCHAR(80) NOT NULL,
  value         JSON        NOT NULL,
  updated_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Utilisateurs. L'e-mail est la clé unique : c'est lui qui servira de pivot
-- le jour où l'authentification sera partagée avec le CRM HM Group.
CREATE TABLE IF NOT EXISTS hmgcde_users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(190) NOT NULL,
  name          VARCHAR(160) NOT NULL DEFAULT '',
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','acheteur','lecteur') NOT NULL DEFAULT 'acheteur',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
