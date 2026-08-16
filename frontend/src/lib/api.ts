/**
 * Client HTTP de l'API Achats filiales.
 *
 * Une seule origine : en développement Vite relaie /api vers le backend, en
 * production Express sert l'interface et l'API ensemble. Le cookie de session
 * suit donc naturellement, sans jeton à gérer côté navigateur.
 */

export const API_ERROR_EVENT = "hm-api-error";
export const SESSION_LOST_EVENT = "hm-session-lost";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: "same-origin",
      headers: init.body ? { "Content-Type": "application/json" } : undefined,
      ...init,
    });
  } catch {
    throw new ApiError(0, "Serveur injoignable. Vérifiez votre connexion.");
  }

  if (response.status === 401) {
    // Session expirée : l'application doit repasser par l'écran de connexion.
    window.dispatchEvent(new Event(SESSION_LOST_EVENT));
    throw new ApiError(401, "Session expirée, reconnectez-vous.");
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(response.status, payload?.error || `Erreur ${response.status}.`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/**
 * Signale un échec d'écriture à l'interface. Les enregistrements partent en
 * arrière-plan : sans cela, une panne réseau passerait inaperçue et l'écran
 * afficherait des données que la base n'a jamais reçues.
 */
export const reportApiError = (context: string, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[API] ${context} :`, error);
  window.dispatchEvent(
    new CustomEvent(API_ERROR_EVENT, { detail: { context, message } }),
  );
};
