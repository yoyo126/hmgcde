import { supplierNames } from "./crm-data";

export type SupplierContact = {
  name: string;
  emails: string;
};

export type PurchasingSettings = {
  suppliers: SupplierContact[];
  mailSubject: string;
  greeting: string;
  deliveryMessage: string;
  closing: string;
  deliveryAddress: string;
};

const SETTINGS_KEY = "hm-purchasing-settings";

export const defaultPurchasingSettings: PurchasingSettings = {
  suppliers: supplierNames.map((name) => ({ name, emails: "" })),
  mailSubject: "COMMANDE HM",
  greeting: "Bonjour,",
  deliveryMessage: "A LIVRER CHEZ HM GROUP",
  closing: "Cordialement,\nHM Group",
  deliveryAddress: "Adresse de livraison HM Group à renseigner",
};

export const getPurchasingSettings = (): PurchasingSettings => {
  if (typeof window === "undefined") return defaultPurchasingSettings;
  try {
    const saved = JSON.parse(
      localStorage.getItem(SETTINGS_KEY) || "",
    ) as Partial<PurchasingSettings>;
    return {
      ...defaultPurchasingSettings,
      ...saved,
      suppliers: supplierNames.map((name) => ({
        name,
        emails:
          saved.suppliers?.find((supplier) => supplier.name === name)?.emails ||
          "",
      })),
    };
  } catch {
    return defaultPurchasingSettings;
  }
};

export const savePurchasingSettings = (settings: PurchasingSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event("hm-settings-updated"));
};

export const supplierRecipients = (supplier: string) =>
  getPurchasingSettings()
    .suppliers.find((item) => item.name === supplier)
    ?.emails.split(/[;,]/)
    .map((email) => email.trim())
    .filter(Boolean)
    .join(",") || "";
