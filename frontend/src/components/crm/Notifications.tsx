import { useEffect, useState } from "react";
import { ArrowLeft, Bell, BellOff, Check, Smartphone } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  abonnementLocal,
  activer,
  desactiver,
  essai,
  lireEtat,
  navigateurCompatible,
  surIphoneHorsEcranAccueil,
  type Abonnement,
} from "@/lib/notifications";

/**
 * Notifications du navigateur, appareil par appareil.
 *
 * Une demande d'achat n'alertait personne : il fallait être connecté pour la
 * voir sur l'écran d'accueil. Le navigateur, lui, sait recevoir une
 * notification même fermé — c'est le système d'exploitation qui l'affiche.
 *
 * L'abonnement appartient à l'appareil et non à la session : il survit à la
 * déconnexion. Le Mac et le téléphone s'abonnent donc séparément.
 */
export function Notifications({ onBack }: { onBack?: () => void } = {}) {
  const [disponible, setDisponible] = useState(false);
  const [clePublique, setClePublique] = useState<string | null>(null);
  const [abonnements, setAbonnements] = useState<Abonnement[]>([]);
  const [icimeme, setIcimeme] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const rafraichir = async () => {
    const etat = await lireEtat();
    setDisponible(etat.disponible);
    setClePublique(etat.clePublique);
    setAbonnements(etat.abonnements);
    setIcimeme(await abonnementLocal());
  };

  useEffect(() => {
    rafraichir()
      .catch((echec) =>
        setErreur(echec instanceof ApiError ? echec.message : "Chargement impossible."),
      )
      .finally(() => setChargement(false));
  }, []);

  const agir = async (action: () => Promise<unknown>, reussite: string) => {
    setErreur(null);
    setMessage(null);
    setOccupe(true);
    try {
      await action();
      await rafraichir();
      setMessage(reussite);
    } catch (echec) {
      setErreur(echec instanceof Error ? echec.message : "Action impossible.");
    } finally {
      setOccupe(false);
    }
  };

  const compatible = navigateurCompatible();
  const iphoneAInstaller = surIphoneHorsEcranAccueil();
  const abonneIci = Boolean(icimeme && abonnements.some((a) => a.endpoint === icimeme));

  return (
    <div className="screen">
      <div className="page-title standard">
        <div>
          {onBack && (
            <button className="back-link" onClick={onBack}>
              <ArrowLeft size={16} /> Rubriques
            </button>
          )}
          <span className="eyebrow">ALERTES</span>
          <h1>Notifications</h1>
          <p>
            Être prévenu d’une nouvelle demande d’achat, même sans être
            connecté à l’application.
          </p>
        </div>
      </div>

      <section className="panel notifications-panel">
        {chargement ? (
          <p className="notifications-etat">Chargement…</p>
        ) : !disponible ? (
          <div className="import-error">
            <BellOff size={18} />
            Les notifications ne sont pas configurées sur ce serveur. Il manque
            les clés d’envoi — voir <code>PUSH_PUBLIC_KEY</code> dans la
            configuration.
          </div>
        ) : !compatible ? (
          <div className="import-error">
            <BellOff size={18} />
            Ce navigateur ne sait pas recevoir de notifications.
          </div>
        ) : (
          <>
            <div className="notifications-tete">
              <span className={"notifications-pastille " + (abonneIci ? "active" : "")}>
                {abonneIci ? <Bell size={20} /> : <BellOff size={20} />}
              </span>
              <div>
                <strong>
                  {abonneIci
                    ? "Cet appareil est prévenu"
                    : "Cet appareil n’est pas prévenu"}
                </strong>
                <small>
                  {abonneIci
                    ? "Une nouvelle demande d’achat s’affichera ici, même application fermée."
                    : "Activez pour recevoir les demandes d’achat sur cet appareil."}
                </small>
              </div>
              <div className="settings-actions">
                {abonneIci ? (
                  <>
                    <button
                      className="secondary-btn"
                      disabled={occupe}
                      onClick={() => void agir(essai, "Notification d’essai envoyée.")}
                    >
                      Essayer
                    </button>
                    <button
                      className="danger-btn"
                      disabled={occupe}
                      onClick={() =>
                        void agir(desactiver, "Cet appareil ne sera plus prévenu.")
                      }
                    >
                      <BellOff size={16} /> Désactiver
                    </button>
                  </>
                ) : (
                  <button
                    className="primary-btn"
                    disabled={occupe || !clePublique}
                    onClick={() =>
                      void agir(
                        () => activer(clePublique!),
                        "Cet appareil recevra les nouvelles demandes.",
                      )
                    }
                  >
                    <Bell size={16} /> Activer sur cet appareil
                  </button>
                )}
              </div>
            </div>

            {iphoneAInstaller && (
              <div className="notifications-avis">
                <Smartphone size={18} />
                <span>
                  <strong>Sur iPhone, une étape avant</strong>
                  Apple n’autorise les notifications que depuis un site ajouté à
                  l’écran d’accueil. Dans Safari : Partager → « Sur l’écran
                  d’accueil », puis rouvrez l’application depuis l’icône et
                  revenez ici.
                </span>
              </div>
            )}

            {erreur && <div className="import-error">{erreur}</div>}
            {message && (
              <div className="import-success">
                <Check size={18} /> {message}
              </div>
            )}

            <div className="notifications-liste">
              <h2>Vos appareils prévenus</h2>
              {abonnements.length === 0 ? (
                <p className="notifications-etat">Aucun appareil pour l’instant.</p>
              ) : (
                abonnements.map((abonnement) => (
                  <div className="notifications-appareil" key={abonnement.id}>
                    <Smartphone size={17} />
                    <div>
                      <strong>{abonnement.appareil || "Appareil"}</strong>
                      <small>
                        {abonnement.endpoint === icimeme ? "Celui-ci · " : ""}
                        {abonnement.last_sent_at
                          ? `dernier envoi ${abonnement.last_sent_at}`
                          : "aucun envoi pour l’instant"}
                      </small>
                    </div>
                  </div>
                ))
              )}
            </div>

            <p className="notifications-note">
              L’abonnement appartient à l’appareil, pas à votre session : il
              continue de fonctionner une fois déconnecté. Chaque appareil
              s’active séparément.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
