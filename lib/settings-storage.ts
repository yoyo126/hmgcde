import { supplierNames, type CompanyKey } from "./crm-data";

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
  defaultTeams: Record<CompanyKey, number>;
};

const SETTINGS_KEY = "hm-purchasing-settings";

export const defaultPurchasingSettings: PurchasingSettings = {
  suppliers: supplierNames.map((name) => ({ name, emails: "" })),
  mailSubject: "COMMANDE HM",
  greeting: "Bonjour,",
  deliveryMessage: "A LIVRER CHEZ HM GROUP",
  closing: "Cordialement,\nHM Group",
  deliveryAddress: "Adresse de livraison HM Group à renseigner",
  defaultTeams: { cpte: 3, pose: 4, instal: 2, pac: 2 },
};

export const getPurchasingSettings = (): PurchasingSettings => {
  if (typeof window === "undefined") return defaultPurchasingSettings;
  try {
    const saved = JSON.parse(
      localStorage.getItem(SETTINGS_KEY) || "",
    ) as Partial<PurchasingSettings>;
    const savedSuppliers = Array.isArray(saved.suppliers)
      ? saved.suppliers.filter((supplier) => supplier?.name?.trim())
      : defaultPurchasingSettings.suppliers;
    return {
      ...defaultPurchasingSettings,
      ...saved,
      suppliers: savedSuppliers,
      defaultTeams: {
        ...defaultPurchasingSettings.defaultTeams,
        ...saved.defaultTeams,
      },
    };
  } catch {
    return defaultPurchasingSettings;
  }
};

export const savePurchasingSettings = (settings: PurchasingSettings) => {
  const suppliers = settings.suppliers
    .map((supplier) => ({
      name: supplier.name.trim(),
      emails: supplier.emails.trim(),
    }))
    .filter(
      (supplier, index, all) =>
        supplier.name &&
        all.findIndex((item) => item.name === supplier.name) === index,
    );
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, suppliers }));
  window.dispatchEvent(new Event("hm-settings-updated"));
};

export const supplierRecipients = (supplier: string) =>
  getPurchasingSettings()
    .suppliers.find((item) => item.name === supplier)
    ?.emails.split(/[;,]/)
    .map((email) => email.trim())
    .filter(Boolean)
    .join(",") || "";
