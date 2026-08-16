# Achats filiales HM Group

Préparation, répartition et suivi des commandes de fournitures pour les quatre
sociétés du groupe : **CPTE Conseil**, **HM Pose**, **HM Instal** et **HM PAC**.

Le parcours : demande d'achat ou commande directe → choix des produits par
catégorie → quantités globales → répartition automatique entre les sociétés
selon leur nombre d'équipes → ajustement manuel dans le récapitulatif →
affectation aux fournisseurs → e-mail fournisseur prêt à envoyer → suivi des
statuts, impression avec ou sans prix, historique des prix.

## Architecture

```
frontend/   Interface React + Vite (SPA)
  src/components/crm/   Les écrans (tableau de bord, commandes, produits…)
  src/lib/              Cache applicatif, client API, types partagés
backend/    API Node + Express
  routes/ controllers/ models/ middleware/
  db/                   Connexion MySQL, migrations, amorçage
```

En développement, Vite sert l'interface sur `:5173` et relaie `/api` vers
Express sur `:3001`. En production, Express sert les deux : l'interface
compilée (`frontend/dist`) et l'API, sur une seule origine — le cookie de
session suit sans configuration particulière.

## Installation

Prérequis : **Node 20.11+** et **MySQL 8**.

```bash
npm run install:all
```

Puis la configuration du backend :

```bash
cp backend/.env.example backend/.env
```

Renseignez `DB_USER`, `DB_PASSWORD`, `DB_NAME`, et générez un secret de session :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Créez enfin le schéma et les données de départ :

```bash
npm run setup
```

Cette commande crée la base si besoin, applique les migrations, insère les
quatre sociétés, les sept fournisseurs, le catalogue de 75 produits (dont les
coffrets et cartons composés) et un compte administrateur. **Le mot de passe
généré s'affiche une seule fois** : notez-le.

## Développement

Deux terminaux :

```bash
npm run dev:api
```

```bash
npm run dev:web
```

L'interface est alors sur http://127.0.0.1:5173.

## Production

```bash
npm run build     # compile l'interface dans frontend/dist
npm start         # Express sert l'API et l'interface sur le port 3001
```

Les migrations s'appliquent au démarrage du serveur (désactivable avec
`AUTO_MIGRATE=false`). Un déploiement se résume donc à récupérer le code,
recompiler l'interface et redémarrer le service.

## Base de données

Toutes les tables sont préfixées `hmgcde_`, afin de pouvoir un jour cohabiter
avec le CRM HM Group sans collision de noms.

| Table | Contenu |
| --- | --- |
| `hmgcde_companies` | Les quatre sociétés et leur nombre d'équipes (base du dispatch) |
| `hmgcde_suppliers` | Fournisseurs et adresses e-mail de commande |
| `hmgcde_products` | Catalogue |
| `hmgcde_product_components` | Contenu des coffrets, cartons et kits |
| `hmgcde_product_component_prices` | Prix d'un sous-produit chez un fournisseur |
| `hmgcde_supplier_products` | Référence, prix et conditionnement par fournisseur |
| `hmgcde_purchase_requests` / `_lines` | Demandes d'achat |
| `hmgcde_orders` / `_lines` | Commandes fournisseurs |
| `hmgcde_order_line_dispatch` | Répartition d'une ligne entre les sociétés |
| `hmgcde_price_history` | Historique des prix (manuel et imports) |
| `hmgcde_tariff_imports` | Journal des imports de tarifs |
| `hmgcde_settings` | Textes des e-mails, adresse de livraison |
| `hmgcde_users` | Comptes et rôles |

La suppression d'un produit ou d'un fournisseur est **logique** (`is_deleted`,
`is_active`) : les commandes passées et l'historique des prix restent lisibles.

## Comptes et rôles

| Rôle | Droits |
| --- | --- |
| `admin` | Accès complet, gestion des comptes |
| `acheteur` | Création et suivi des commandes, catalogue, tarifs |
| `lecteur` | Consultation seule |

L'authentification est une session Express classique stockée en MySQL, avec
mots de passe hachés en bcrypt. **L'e-mail est la clé unique des comptes** :
c'est le pivot prévu pour partager un jour l'authentification avec le CRM
HM Group.

Créer ou réinitialiser un compte en ligne de commande :

```bash
npm --prefix backend run create-user -- jean@hmgroup.fr "Jean Dupont" acheteur
```

## API

Toutes les routes sont sous `/api` et exigent une session, sauf la connexion.

| Méthode | Route | Rôle |
| --- | --- | --- |
| `POST` | `/auth/login` · `/auth/logout` · `GET /auth/me` | Session |
| `GET` | `/bootstrap` | Charge toute l'application en un aller-retour |
| `GET` | `/catalog` | Catalogue complet (offres et ensembles inclus) |
| `PUT` | `/catalog/products` | Enregistre le catalogue |
| `POST` | `/catalog/products/delete` | Suppression logique |
| `POST` | `/catalog/prices` | Saisie manuelle de prix |
| `POST` | `/catalog/imports` | Import d'un tarif fournisseur |
| `GET` | `/orders` · `PUT /orders` · `PUT /orders/batch` | Commandes |
| `GET` | `/purchase-requests` · `PUT /purchase-requests` | Demandes d'achat |
| `GET` | `/settings` · `PUT /settings` | Paramètres et fournisseurs |
| `GET` | `/users` · `POST` · `PUT /:id` · `DELETE /:id` | Comptes (admin) |

## Historique technique

L'application tournait auparavant sur Cloudflare Workers avec une
authentification ChatGPT, et stockait toutes ses données dans le
`localStorage` du navigateur. La version 3.0 la rend autonome : Node, Express
et MySQL, avec des comptes propres — les données sont partagées entre les
sites au lieu de vivre dans un seul navigateur.
