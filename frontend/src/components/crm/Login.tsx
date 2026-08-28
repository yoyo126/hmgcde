import { useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { SessionUser } from "@/lib/types";
import { HmLogo } from "./HmLogo";

/**
 * Écran de connexion. Il remplace l'authentification ChatGPT : l'application
 * a désormais ses propres comptes, en base.
 */
export function Login({ onSignedIn }: { onSignedIn: (user: SessionUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { user } = await api.post<{ user: SessionUser }>("/auth/login", { email, password });
      onSignedIn(user);
    } catch (failure) {
      setError(
        failure instanceof ApiError ? failure.message : "Connexion impossible, réessayez.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <HmLogo className="login-logo" />
        <h1>Achats filiales</h1>
        <p className="login-company">HM GROUP</p>
        <p className="login-intro">
          Commandes et répartition pour CPTE&nbsp;Conseil, HM&nbsp;Pose, HM&nbsp;Instal et
          HM&nbsp;PAC.
        </p>

        <label className="login-field">
          <span>Adresse e-mail</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="prenom@hmgroup.fr"
          />
        </label>

        <label className="login-field">
          <span>Mot de passe</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error && <p className="login-error">{error}</p>}

        <button className="primary-btn login-submit" type="submit" disabled={pending}>
          <LogIn size={17} />
          {pending ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
