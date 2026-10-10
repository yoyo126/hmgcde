/**
 * Agent de service des notifications.
 *
 * Il vit en dehors de la page : c'est lui qui reçoit le message quand
 * l'application est fermée, et c'est tout son intérêt. Il ne fait que deux
 * choses — afficher la notification, et ouvrir l'application quand on clique
 * dessus.
 */

self.addEventListener("push", (evenement) => {
  let charge = {};
  try {
    charge = evenement.data ? evenement.data.json() : {};
  } catch {
    charge = { titre: "Achats filiales", corps: evenement.data?.text() || "" };
  }

  evenement.waitUntil(
    self.registration.showNotification(charge.titre || "Achats filiales", {
      body: charge.corps || "",
      icon: "/logo-achat-filiale.png",
      badge: "/favicon.svg",
      // Un seul fil : une deuxième demande remplace la première au lieu
      // d'empiler des notifications que personne ne lira toutes.
      tag: "demande-achat",
      renotify: true,
      data: { lien: charge.lien || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (evenement) => {
  evenement.notification.close();
  const lien = evenement.notification.data?.lien || "/";

  evenement.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      // Si l'application est déjà ouverte quelque part, on la ramène au
      // premier plan plutôt que d'en ouvrir une seconde.
      for (const fenetre of fenetres) {
        if ("focus" in fenetre) return fenetre.focus();
      }
      return self.clients.openWindow(lien);
    }),
  );
});
