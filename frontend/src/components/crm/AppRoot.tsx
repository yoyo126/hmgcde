import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { API_ERROR_EVENT, SESSION_LOST_EVENT, api } from "@/lib/api";
import { DEMO_USER, IS_DEMO, resetDemoState } from "@/lib/demo-mode";
import { hydrate, resetStore, store } from "@/lib/store";
import type { SessionUser } from "@/lib/types";
import { CRMApp } from "./CRMApp";
import { Login } from "./Login";

type Phase = "loading" | "signed-out" | "ready" | "error";

/**
 * Racine de l'application : vérifie la session, charge les données, puis
 * affiche soit l'écran de connexion, soit le CRM.
 */
export function AppRoot() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      // L'aperçu de démonstration n'a pas de serveur : ni session, ni connexion.
      if (IS_DEMO) {
        await hydrate();
        setUser(DEMO_USER);
        setPhase("ready");
        return;
      }
      const session = await api.get<{ user: SessionUser | null }>("/auth/me");
      if (!session.user) {
        resetStore();
        setUser(null);
        setPhase("signed-out");
        return;
      }
      await hydrate();
      setUser(store.user ?? session.user);
      setPhase("ready");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Chargement impossible.");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Une session expirée en cours d'utilisation ramène à l'écran de connexion.
  useEffect(() => {
    const onSessionLost = () => {
      resetStore();
      setUser(null);
      setPhase("signed-out");
    };
    const onApiError = (event: Event) => {
      const detail = (event as CustomEvent<{ context: string; message: string }>).detail;
      setNotice(`Échec : ${detail.context} — ${detail.message}`);
    };
    window.addEventListener(SESSION_LOST_EVENT, onSessionLost);
    window.addEventListener(API_ERROR_EVENT, onApiError);
    return () => {
      window.removeEventListener(SESSION_LOST_EVENT, onSessionLost);
      window.removeEventListener(API_ERROR_EVENT, onApiError);
    };
  }, []);

  const signOut = useCallback(async () => {
    if (IS_DEMO) {
      // Pas de session à fermer : le bouton remet la démonstration à zéro.
      resetDemoState();
      window.location.reload();
      return;
    }
    await api.post("/auth/logout").catch(() => {});
    resetStore();
    setUser(null);
    setPhase("signed-out");
  }, []);

  if (phase === "loading") {
    return (
      <div className="app-loading">
        <div className="app-loading-dot" />
        <p>Chargement des achats HM Group…</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="app-loading">
        <AlertTriangle size={28} />
        <p>{error}</p>
        <button className="primary-btn" onClick={() => void load()}>
          Réessayer
        </button>
      </div>
    );
  }

  if (phase === "signed-out" || !user) {
    return <Login onSignedIn={() => void load()} />;
  }

  return (
    <>
      {IS_DEMO && (
        <div className="app-demo-banner">
          Aperçu de démonstration — les données restent dans ce navigateur et ne
          sont partagées avec personne.
        </div>
      )}
      {notice && (
        <div className="app-notice" role="alert">
          <AlertTriangle size={17} />
          <span>{notice}</span>
          <button aria-label="Fermer" onClick={() => setNotice(null)}>
            <X size={16} />
          </button>
        </div>
      )}
      <CRMApp user={user} onSignOut={signOut} />
    </>
  );
}
