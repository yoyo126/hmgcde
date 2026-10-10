import { api } from "./api";
import { IS_DEMO } from "./demo-mode";

/**
 * Notifications du navigateur.
 *
 * L'abonnement appartient à l'appareil, pas à la session : une fois accordé,
 * le serveur peut prévenir ce navigateur même déconnecté, même fermé. C'est
 * tout l'intérêt — une demande d'achat qui attend sur l'écran d'accueil
 * n'alerte personne.
 *
 * Chaque appareil s'abonne pour lui-même. Le Mac et le téléphone sont deux
 * abonnements distincts, et se désabonner de l'un ne touche pas l'autre.
 */

export type Abonnement = {
  id: number;
  endpoint: string;
  appareil: string;
  created_at: string;
  last_sent_at: string | null;
};

export type EtatNotifications = {
  disponible: boolean;
  clePublique: string | null;
  abonnements: Abonnement[];
};

/** Le navigateur sait-il recevoir des notifications ? */
export const navigateurCompatible = () =>
  !IS_DEMO &&
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

/**
 * Sur iPhone, Apple n'autorise les notifications que si le site a été ajouté
 * à l'écran d'accueil et ouvert depuis là. Le dire franchement évite de
 * laisser quelqu'un cliquer en vain.
 */
export const surIphoneHorsEcranAccueil = () => {
  if (typeof window === "undefined") return false;
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const autonome =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
  return iOS && !autonome;
};

export const lireEtat = () => api.get<EtatNotifications>("/notifications");

/** La clé publique arrive en base64url ; l'API du navigateur veut des octets. */
const enOctets = (base64url: string) => {
  const complement = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + complement).replace(/-/g, "+").replace(/_/g, "/");
  const binaire = atob(base64);
  return Uint8Array.from(binaire, (caractere) => caractere.charCodeAt(0));
};

/** Nom lisible de l'appareil, pour s'y retrouver dans la liste des abonnements. */
const nomAppareil = () => {
  const ua = navigator.userAgent;
  const systeme = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Mac/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : "Appareil";
  const navigateur = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "navigateur";
  return `${systeme} · ${navigateur}`;
};

const agent = () =>
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw-notifications.js`);

/** Abonne CET appareil. Renvoie la liste à jour, ou lève une erreur parlante. */
export const activer = async (clePublique: string) => {
  if (!navigateurCompatible()) {
    throw new Error("Ce navigateur ne sait pas recevoir de notifications.");
  }
  if (surIphoneHorsEcranAccueil()) {
    throw new Error(
      "Sur iPhone, ajoutez d’abord le site à l’écran d’accueil (Partager → Sur l’écran d’accueil), puis rouvrez-le depuis là.",
    );
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Les notifications ont été refusées pour ce site. À réautoriser dans les réglages du navigateur."
        : "Autorisation non accordée.",
    );
  }

  const enregistrement = await agent();
  await navigator.serviceWorker.ready;
  const abonnement =
    (await enregistrement.pushManager.getSubscription()) ||
    (await enregistrement.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: enOctets(clePublique),
    }));

  const { endpoint, keys } = abonnement.toJSON() as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  const { abonnements } = await api.post<{ abonnements: Abonnement[] }>(
    "/notifications/abonnements",
    { endpoint, keys, appareil: nomAppareil() },
  );
  return abonnements;
};

/** Désabonne cet appareil, et lui seul. */
export const desactiver = async () => {
  const enregistrement = await navigator.serviceWorker.getRegistration(
    import.meta.env.BASE_URL,
  );
  const abonnement = await enregistrement?.pushManager.getSubscription();
  const endpoint = abonnement?.endpoint;
  if (abonnement) await abonnement.unsubscribe();
  if (!endpoint) return null;
  const { abonnements } = await api.post<{ abonnements: Abonnement[] }>(
    "/notifications/abonnements/retrait",
    { endpoint },
  );
  return abonnements;
};

/** Cet appareil est-il déjà abonné ? */
export const abonnementLocal = async () => {
  if (!navigateurCompatible()) return null;
  const enregistrement = await navigator.serviceWorker.getRegistration(
    import.meta.env.BASE_URL,
  );
  const abonnement = await enregistrement?.pushManager.getSubscription();
  return abonnement?.endpoint ?? null;
};

export const essai = () => api.post<{ envoyees: number }>("/notifications/essai");
