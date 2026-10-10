# Première mise en ligne sur le VPS

Les commandes dans l'ordre, telles qu'elles seront lancées. Le serveur héberge
aussi le CRM HM Group et l'outil compta : **rien ici ne les nomme**, et c'est
volontaire. Les règles absolues sont dans `CLAUDE.md`, à la racine.

Les commandes marquées **`sudo`** sont les seules à demander les droits
d'administration. Il y en a cinq.

## 1. La base et son compte — `sudo`

```sql
CREATE DATABASE achats_hmgroup CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'achats_hmgroup'@'localhost' IDENTIFIED BY 'MOT_DE_PASSE_GÉNÉRÉ';
GRANT ALL PRIVILEGES ON achats_hmgroup.* TO 'achats_hmgroup'@'localhost';
FLUSH PRIVILEGES;
```

Droits sur cette base **et aucune autre** : jamais `ON *.*`. Le `CREATE` lui
est nécessaire — les migrations et la table des sessions se créent au
démarrage du serveur. La base `crm_hmgroup` et son compte ne sont pas touchés.

Mot de passe à générer avec `openssl rand -base64 24`.

## 2. Le code

Sous l'utilisateur `achats` :

```bash
git clone --branch refactor/node-mysql https://github.com/yoyo126/hmgcde.git /home/achats/app
mkdir -p /home/achats/logs /home/achats/sauvegardes
```

`main` est 133 commits en retard : la branche de production est
`refactor/node-mysql`.

## 3. La configuration

`/home/achats/app/backend/.env`, puis `chmod 600` :

```
NODE_ENV=production
PORT=3001
HOST=127.0.0.1

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=achats_hmgroup
DB_PASSWORD=…
DB_NAME=achats_hmgroup

SESSION_SECRET=…
SEED_ADMIN_EMAIL=…
SEED_ADMIN_PASSWORD=
```

`SESSION_SECRET` doit être propre à cet outil — le partager avec le CRM
permettrait de forger des sessions d'une application à l'autre. À générer :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`SEED_ADMIN_PASSWORD` reste **vide** : l'amorçage en génère un et l'affiche une
seule fois.

## 4. Schéma, catalogue et premier compte

```bash
cd /home/achats/app && npm run install:all && npm run setup
```

`npm run setup` crée les tables, les quatre sociétés, les sept fournisseurs,
les 75 produits et le compte administrateur. **Noter le mot de passe affiché :
il ne sera pas remontré.** À ne lancer qu'une fois, et jamais ensuite.

## 5. Démarrage et démarrage automatique

```bash
cd /home/achats/app && pm2 start ecosystem.config.cjs && pm2 save
pm2 startup systemd -u achats --hp /home/achats
```

La dernière commande imprime une ligne `sudo env PATH=…` : c'est elle qu'il
faut exécuter, et elle crée l'unité **`pm2-achats.service`**. `pm2-ubuntu.service`,
celle du CRM, n'est pas touchée. Les `pm2 save` se font **sous `achats`**,
jamais sous `ubuntu`.

## 6. Nginx — `sudo`

```bash
sudo cp /home/achats/app/deploiement/nginx-achats.conf /etc/nginx/sites-available/achats
sudo ln -s /etc/nginx/sites-available/achats /etc/nginx/sites-enabled/achats
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t` **avant** le rechargement, et `reload` et non `restart` : un restart
couperait le CRM le temps du redémarrage.

Note : tant que ce bloc n'existe pas, `achats.crm-hmgroup.fr` est capté par le
bloc du CRM, qui est le seul en place.

## 7. HTTPS — `sudo`

```bash
sudo certbot --nginx -d achats.crm-hmgroup.fr
```

Certbot ajoute le bloc 443 et la redirection depuis le port 80, et n'a pas à
toucher au certificat du CRM. Le renouvellement automatique est déjà en place
sur cette machine.

## 8. Sauvegarde quotidienne

```bash
printf '[mysqldump]\nuser=achats_hmgroup\npassword=…\n' > /home/achats/.my.cnf
chmod 600 /home/achats/.my.cnf
/home/achats/app/deploiement/sauvegarde.sh   # un essai, pour vérifier
crontab -e                                   # sous l'utilisateur achats
```

La ligne de cron — elle appelle le script **dans le dépôt**, pour qu'une
correction arrive par le déploiement et non à la main :

```
15 3 * * * /home/achats/app/deploiement/sauvegarde.sh >> /home/achats/logs/sauvegarde.log 2>&1
```

Dump de `achats_hmgroup` seule, compressé, 14 jours de rétention, et le script
refuse de conserver un dump vide. **Tester une restauration** avant d'ouvrir
l'outil aux utilisateurs.

## 9. Vérifications avant d'ouvrir

- [ ] `pm2 list` sous `achats` montre `achats-filiales` en ligne — et sous
      `ubuntu`, `crm-hmgroup` toujours en ligne
- [ ] `curl -fsS http://127.0.0.1:3001/api/health` répond
- [ ] Depuis l'extérieur, le port 3001 n'est **pas** joignable
- [ ] `https://achats.crm-hmgroup.fr` affiche l'écran de connexion, et non le CRM
- [ ] `https://crm-hmgroup.fr` répond toujours normalement
- [ ] Le pied de la barre latérale affiche **Version 3.3.0**
- [ ] La connexion demande bien un mot de passe — si l'application s'ouvre
      directement, le build contient le mode démonstration : tout arrêter
- [ ] Mot de passe de l'administrateur changé depuis l'écran Utilisateurs
- [ ] Un second administrateur créé
- [ ] Un compte `demandeur` d'essai ne voit **aucun prix**

## Les mises à jour suivantes

```bash
cd /home/achats/app && ./deploy.sh
```
