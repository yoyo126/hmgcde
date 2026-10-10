/**
 * Génère les clés VAPID, à coller dans backend/.env.
 *
 *   npm --prefix backend run cles-push
 *
 * Elles identifient ce serveur auprès du service de remise des navigateurs.
 * À générer une seule fois : les changer invalide tous les abonnements
 * existants, et chacun devrait réactiver ses notifications.
 */
import webpush from "web-push";

const cles = webpush.generateVAPIDKeys();
console.log("");
console.log("À ajouter dans backend/.env :");
console.log("");
console.log(`PUSH_PUBLIC_KEY=${cles.publicKey}`);
console.log(`PUSH_PRIVATE_KEY=${cles.privateKey}`);
console.log("PUSH_SUJET=mailto:achats@crm-hmgroup.fr");
console.log("");
console.log("Puis redémarrer le service. Ne jamais versionner la clé privée.");
console.log("");
