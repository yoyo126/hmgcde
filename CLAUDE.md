# Achats filiales HM Group

Préparation, répartition et suivi des commandes de fournitures pour les quatre
sociétés du groupe. React + Vite devant, Node + Express et MySQL 8 derrière.
Voir `README.md` pour l'architecture et le parcours métier.

## Règles absolues du serveur

Cet outil partage un VPS avec deux autres applications. **Ces règles ne se
discutent pas.**

- **Ne jamais toucher au CRM** : le dossier `crm-hmgroup` de l'utilisateur
  `ubuntu`, la base `crm_hmgroup`, le process PM2 `crm-hmgroup`, son bloc
  Nginx. Ni lire pour « vérifier », ni redémarrer, ni modifier.
- **Ne jamais toucher à l'outil compta** : `/home/compta`, ses bases, son
  bloc Nginx.
- **Jamais `pm2 update` ni `pm2 save` sous l'utilisateur `ubuntu`.** Cet outil
  vit sous l'utilisateur `achats`, qui a son propre démon PM2 et sa propre
  unité `pm2-achats.service`. Celle d'`ubuntu` ne doit pas bouger.
- **Toujours `sudo nginx -t` avant de recharger Nginx**, et `reload`, jamais
  `restart` : un `restart` coupe le CRM le temps du redémarrage.
- **L'aperçu GitHub Pages reste en ligne** et ne doit pas être cassé : il sert
  de vitrine. Tout push sur la branche le republie.

## Le serveur, en bref

| | |
| --- | --- |
| Adresse | `achats.crm-hmgroup.fr` |
| Utilisateur système | `achats` |
| Code | `/home/achats/app` (branche `refactor/node-mysql`) |
| Configuration | `/home/achats/app/backend/.env`, `chmod 600` |
| Journaux | `/home/achats/logs` |
| Sauvegardes | `/home/achats/sauvegardes` |
| Port | `3001`, en écoute sur `127.0.0.1` seulement |
| Base | `achats_hmgroup`, compte `achats_hmgroup`, droits sur elle seule |
| PM2 | process `achats-filiales`, sous l'utilisateur `achats` |
| Nginx | `/etc/nginx/sites-available/achats` |

Les identifiants d'accès au serveur ne sont pas dans ce dépôt : il est public.

## Déployer

Sous l'utilisateur `achats`, depuis `/home/achats/app` :

```bash
./deploy.sh
```

Le script refuse de tourner en root ou sous un autre utilisateur, compile
l'interface, recharge le seul process `achats-filiales` et vérifie que l'API
répond. Il ne touche à rien d'autre.

## Les pièges, par ordre de gravité

1. **`VITE_DEMO=1` ne doit jamais entrer dans un build de production.** Ce
   drapeau produit l'aperçu public : l'authentification est court-circuitée et
   le visiteur est connecté d'office en administrateur. `deploy.sh` refuse de
   compiler si la variable est définie.
2. **Ne jamais lancer `npm run seed` ni `backend/scripts/smoke-test.js` sur la
   base de production.** L'amorçage recrée le catalogue et un administrateur ;
   le test de bout en bout crée un compte `demandeur@hmgroup.fr` avec un mot de
   passe connu, des commandes et des demandes. Ils sont faits pour une base
   jetable.
3. **Nginx doit transmettre `X-Forwarded-Proto`**, sinon le cookie de session
   ne passe jamais en `Secure`.
4. **`client_max_body_size` doit valoir au moins 16 Mo** dans le bloc Nginx :
   l'enregistrement du catalogue envoie un JSON qui dépasse le mégaoctet par
   défaut, et l'échec serait silencieux côté interface.

## Conventions du projet

- Code et commentaires **en français**. Les commentaires disent le *pourquoi*
  métier, pas le *comment* : ce qui a été constaté, et ce qu'on a corrigé.
- Messages de commit en français, minuscule après le préfixe, décrivant
  l'effet pour l'utilisateur : `fix: deux commandes créées en même temps
  s'écrasaient`. Voir `git log`.
- Les calculs qui portent des montants ou décident qui paie quoi vivent dans
  leur propre fichier sous `frontend/src/lib/`, et sont couverts par un test
  dans `frontend/tests/` branché dans `scripts/ci-run.sh`.
- `main` est 133 commits en retard : **la branche de travail et de production
  est `refactor/node-mysql`**. Ne pas déployer `main`.

## Vérifier son travail

Il n'y a ni Node ni npm sur le poste de développement : **la CI est le juge**.
Chaque push lance la vérification complète, dont le journal est publié sur la
branche `ci-logs`. Le lire après chaque push :

```bash
git fetch origin ci-logs && git show origin/ci-logs:logs/latest.log | tail -40
```
