import webpush from "web-push";
import { query } from "../db/pool.js";
import { config } from "../config/index.js";

/**
 * Notifications du navigateur.
 *
 * Une demande d'achat qui dort sur l'écran d'accueil n'alerte personne : il
 * faut être connecté pour la voir. Le navigateur sait recevoir une
 * notification même fermé — sur un Mac, dans le centre de notifications ; sur
 * un iPhone, à condition que le site ait été ajouté à l'écran d'accueil.
 *
 * Les clés VAPID identifient le serveur auprès du service de remise du
 * navigateur. Elles se génèrent une fois : `npm --prefix backend run cles-push`.
 */

const configure = () => {
  if (!config.push.publicKey || !config.push.privateKey) return false;
  webpush.setVapidDetails(config.push.sujet, config.push.publicKey, config.push.privateKey);
  return true;
};

export const notificationsActives = () =>
  Boolean(config.push.publicKey && config.push.privateKey);

export const listSubscriptions = (userId) =>
  query(
    `SELECT id, endpoint, appareil, created_at, last_sent_at
       FROM hmgcde_push_subscriptions WHERE user_id = ? ORDER BY id`,
    [userId],
  );

export const saveSubscription = async ({ userId, endpoint, p256dh, auth, appareil }) => {
  await query(
    `INSERT INTO hmgcde_push_subscriptions (user_id, endpoint, p256dh, auth, appareil)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id), p256dh = VALUES(p256dh),
       auth = VALUES(auth), appareil = VALUES(appareil)`,
    [userId, endpoint, p256dh, auth, (appareil || "").slice(0, 255)],
  );
  return listSubscriptions(userId);
};

export const deleteSubscription = async (userId, endpoint) => {
  await query(
    "DELETE FROM hmgcde_push_subscriptions WHERE user_id = ? AND endpoint = ?",
    [userId, endpoint],
  );
  return listSubscriptions(userId);
};

/**
 * Envoie à tous les abonnés dont le rôle traite les demandes d'achat, sauf à
 * l'auteur : se notifier soi-même d'une action qu'on vient de faire n'apprend
 * rien et use la confiance qu'on accorde aux alertes.
 */
export const notifier = async ({ titre, corps, lien, sauf }) => {
  if (!configure()) return { envoyees: 0, raison: "clés VAPID absentes" };

  const abonnes = await query(
    `SELECT s.id, s.endpoint, s.p256dh, s.auth
       FROM hmgcde_push_subscriptions s
       JOIN hmgcde_users u ON u.id = s.user_id
      WHERE u.is_active = 1 AND u.role IN ('admin', 'acheteur')
        AND (? IS NULL OR u.id <> ?)`,
    [sauf ?? null, sauf ?? null],
  );
  if (!abonnes.length) return { envoyees: 0, raison: "aucun abonné" };

  const charge = JSON.stringify({ titre, corps, lien });
  const caduques = [];
  let envoyees = 0;

  await Promise.all(
    abonnes.map(async (abonne) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: abonne.endpoint,
            keys: { p256dh: abonne.p256dh, auth: abonne.auth },
          },
          charge,
        );
        envoyees += 1;
      } catch (error) {
        // 404 et 410 : le navigateur a révoqué l'abonnement. Le garder
        // reviendrait à réessayer indéfiniment une adresse morte.
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          caduques.push(abonne.id);
        } else {
          console.error("[push] envoi impossible :", error?.statusCode, error?.body || error?.message);
        }
      }
    }),
  );

  if (caduques.length) {
    await query(
      `DELETE FROM hmgcde_push_subscriptions WHERE id IN (${caduques.map(() => "?").join(",")})`,
      caduques,
    );
  }
  if (envoyees) {
    await query(
      `UPDATE hmgcde_push_subscriptions SET last_sent_at = NOW()
        WHERE endpoint IN (${abonnes.map(() => "?").join(",")})`,
      abonnes.map((a) => a.endpoint),
    ).catch(() => {});
  }
  return { envoyees, retirees: caduques.length };
};
