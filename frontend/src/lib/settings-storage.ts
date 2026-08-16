import { defaultPurchasingSettings, persistSettings, store } from "./store";
import type { PurchasingSettings, SupplierContact } from "./types";

export type { PurchasingSettings, SupplierContact } from "./types";
export { defaultPurchasingSettings } from "./store";

/**
 * Paramètres d'achat : fournisseurs et leurs adresses, textes des e-mails,
 * nombre d'équipes par société. Lecture instantanée depuis le cache, écriture
 * envoyée à l'API.
 */

export const getPurchasingSettings = (): PurchasingSettings =>
  store.settings || defaultPurchasingSettings;

export const savePurchasingSettings = (settings: PurchasingSettings) => {
  const suppliers = settings.suppliers
    .map((supplier: SupplierContact) => ({
      name: supplier.name.trim(),
      emails: supplier.emails.trim(),
    }))
    .filter(
      (supplier, index, all) =>
        supplier.name && all.findIndex((item) => item.name === supplier.name) === index,
    );

  const next = { ...settings, suppliers };
  store.settings = next;
  void persistSettings(next);
  window.dispatchEvent(new Event("hm-settings-updated"));
};

/** Destinataires d'un fournisseur, prêts pour le champ « À » d'un e-mail. */
export const supplierRecipients = (supplier: string) =>
  getPurchasingSettings()
    .suppliers.find((item) => item.name === supplier)
    ?.emails.split(/[;,]/)
    .map((email) => email.trim())
    .filter(Boolean)
    .join(",") || "";
