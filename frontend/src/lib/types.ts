/**
 * Types partagés entre les écrans, le cache et l'API.
 * Ils reprennent exactement les formes manipulées par l'application avant le
 * passage à MySQL : les composants n'ont pas eu à changer.
 */

export type CompanyKey = "cpte" | "pose" | "instal" | "pac";

export type Company = {
  key: CompanyKey;
  name: string;
  short: string;
  color: string;
  teams?: number;
};

export type SupplierOffer = {
  supplier: string;
  supplierName: string;
  reference: string;
  brand: string;
  price: number;
  meterPrice?: number;
  packaging: string;
  packagingType: "modifiable" | "fixed";
};

export type ProductComponent = {
  name: string;
  quantity: number;
  unitPrice: number;
  supplierPrices?: Record<string, number>;
};

export type Product = {
  id: number;
  code?: string;
  name: string;
  family: string;
  subfamily: string;
  unit: string;
  kind: "simple" | "ensemble";
  bundleLabel?: string;
  contents?: ProductComponent[];
  offers: SupplierOffer[];
};

export type OrderStatus = "Brouillon" | "Envoyée" | "Reçue";

export type StoredOrderLine = {
  productId: number;
  name: string;
  packaging: string;
  quantity: number;
  unitPrice: number;
  dispatch?: Record<CompanyKey, number>;
  components?: { name: string; quantity: number }[];
};

export type SentEmail = {
  sentAt: string;
  to: string;
  subject: string;
  body: string;
};

export type StoredOrder = {
  id: string;
  reference: string;
  supplier: string;
  date: string;
  total: number;
  status: OrderStatus;
  lines: StoredOrderLine[];
  sourceRequestId?: string;
  email?: SentEmail;
};

export type RequestStatus = "À commander" | "Partiellement commandée" | "Commandée";

export type PurchaseRequestLine = {
  productId: number;
  name: string;
  unit: string;
  quantity: number;
  supplier?: string;
  ordered?: boolean;
};

export type StoredPurchaseRequest = {
  id: string;
  requester: string;
  date: string;
  status: RequestStatus;
  lines: PurchaseRequestLine[];
  seen?: boolean;
};

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

export type PriceOverride = Record<string, number>;

export type ManualPriceChange = {
  product: string;
  supplier: string;
  oldPrice: number;
  newPrice: number;
  scope: "Produit" | "Sous-produit";
};

export type ManualPriceHistoryItem = {
  id: string;
  date: string;
  changes: ManualPriceChange[];
  source?: "Manuel" | "Import tarif";
};

export type ImportHistoryItem = {
  id: string;
  date: string;
  fileName: string;
  supplier: string;
  changed: number;
  added: number;
  ignored: number;
};

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "acheteur" | "demandeur" | "lecteur";
};

export type AppUser = SessionUser & {
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};
