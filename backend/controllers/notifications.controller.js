import { asyncHandler, HttpError } from "../middleware/errors.js";
import { config } from "../config/index.js";
import * as notifications from "../models/notifications.js";

/**
 * Abonnements aux notifications du navigateur. Chaque appareil s'abonne pour
 * lui-même : le Mac et le téléphone sont deux abonnements distincts.
 */

export const etat = asyncHandler(async (req, res) => {
  res.json({
    disponible: notifications.notificationsActives(),
    clePublique: config.push.publicKey || null,
    abonnements: notifications.notificationsActives()
      ? await notifications.listSubscriptions(req.session.user.id)
      : [],
  });
});

export const abonner = asyncHandler(async (req, res) => {
  if (!notifications.notificationsActives()) {
    throw new HttpError(503, "Les notifications ne sont pas configurées sur ce serveur.");
  }
  const { endpoint, keys, appareil } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new HttpError(400, "Abonnement incomplet.");
  }
  res.json({
    abonnements: await notifications.saveSubscription({
      userId: req.session.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      appareil,
    }),
  });
});

export const desabonner = asyncHandler(async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) throw new HttpError(400, "Abonnement inconnu.");
  res.json({
    abonnements: await notifications.deleteSubscription(req.session.user.id, endpoint),
  });
});

/** Envoi d'essai, pour vérifier que l'appareil reçoit bien. */
export const essai = asyncHandler(async (req, res) => {
  const resultat = await notifications.notifier({
    titre: "Achats filiales",
    corps: "Notification d’essai : cet appareil est bien abonné.",
    lien: "/",
    sauf: null,
  });
  res.json(resultat);
});
