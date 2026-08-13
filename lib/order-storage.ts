import { companies, initialOrders, products, type CompanyKey } from "./crm-data";
import {
  getPurchasingSettings,
  supplierRecipients,
} from "./settings-storage";

export type OrderStatus = "Brouillon" | "Envoyée" | "Reçue";
export type StoredOrderLine = {
  productId: number;
  name: string;
  packaging: string;
  quantity: number;
  unitPrice: number;
  dispatch?: Record<CompanyKey, number>;
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
export type RequestStatus =
  | "À commander"
  | "Partiellement commandée"
  | "Commandée";
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
};

const ORDERS_KEY = "hm-orders";
const REQUESTS_KEY = "hm-purchase-requests";

const localId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const isoWeek = (date: Date) => {
  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
};

export const orderReference = (date = new Date()) =>
  `Commande S${String(isoWeek(date)).padStart(2, "0")} du ${new Intl.DateTimeFormat(
    "fr-FR",
    { day: "2-digit", month: "2-digit", year: "numeric" },
  ).format(date)}`;

const referenceFromDisplayDate = (value: string) => {
  const months: Record<string, number> = {
    janvier: 0,
    février: 1,
    mars: 2,
    avril: 3,
    mai: 4,
    juin: 5,
    juillet: 6,
    août: 7,
    septembre: 8,
    octobre: 9,
    novembre: 10,
    décembre: 11,
  };
  const match = value.toLowerCase().match(/(\d{1,2})\s+([^\s]+)\s+(\d{4})/);
  if (!match || months[match[2]] === undefined) return orderReference();
  return orderReference(
    new Date(Number(match[3]), months[match[2]], Number(match[1])),
  );
};

const read = <T>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || "") as T;
  } catch {
    return fallback;
  }
};

const productLine = (productId: number, quantity: number): StoredOrderLine => {
  const product = products.find((item) => item.id === productId)!;
  const offer = product.offers[0];
  return {
    productId,
    name: product.name,
    packaging: offer.packaging,
    quantity,
    unitPrice: offer.price,
    dispatch: { cpte: quantity, pose: 0, instal: 0, pac: 0 },
  };
};

const seededSuppliers = ["YESS ELECTRIQUE", "CLIM+", "CEDEO"];
const seededOrders: StoredOrder[] = initialOrders.map((order, index) => {
  const lines = [productLine(products[index].id, index + 2)];
  return {
    ...order,
    reference: referenceFromDisplayDate(order.date),
    supplier: seededSuppliers[index],
    lines,
    email:
      order.status === "Envoyée" || order.status === "Reçue"
        ? {
            sentAt: `${order.date} à 10:${index ? "05" : "32"}`,
            to: "commandes@fournisseur.fr",
            subject: `${order.id} – Commande HM Group`,
            body: `Bonjour,\n\nVeuillez trouver notre bon de commande ${order.id}.\nLivraison chez HM Group.\n\nMerci de nous confirmer la disponibilité et le délai de livraison.\n\nCordialement,\nHM Group`,
          }
        : undefined,
  };
});

const seededRequests: StoredPurchaseRequest[] = [
  {
    id: "DA-2026-011",
    requester: "Entrepôt HM Group",
    date: "12 août 2026",
    status: "À commander",
    lines: [
      products[0],
      products[2],
      products[16],
      products[39],
      products[42],
      products[60],
    ].map((product, index) => ({
      productId: product.id,
      name: product.name,
      unit: product.unit,
      quantity: index + 1,
    })),
  },
];

const supplierAliases: Record<string, string> = {
  "Fournisseur électrique": "YESS ELECTRIQUE",
  "Fournisseur climatisation": "CLIM+",
  "Fournisseur plomberie": "CEDEO",
};

export const getStoredOrders = () =>
  read<StoredOrder[]>(ORDERS_KEY, seededOrders).map((order) => ({
    ...order,
    reference: order.reference || referenceFromDisplayDate(order.date),
    supplier: supplierAliases[order.supplier] || order.supplier,
  }));
export const getStoredRequests = () =>
  read<StoredPurchaseRequest[]>(REQUESTS_KEY, seededRequests);

const notify = () => window.dispatchEvent(new Event("hm-purchasing-updated"));

export const saveOrder = (order: StoredOrder) => {
  const current = getStoredOrders().filter((item) => item.id !== order.id);
  localStorage.setItem(ORDERS_KEY, JSON.stringify([order, ...current]));
  notify();
};

export const savePurchaseRequest = (request: StoredPurchaseRequest) => {
  const current = getStoredRequests().filter((item) => item.id !== request.id);
  localStorage.setItem(REQUESTS_KEY, JSON.stringify([request, ...current]));
  notify();
};

export const nextOrderId = () => {
  const highest = getStoredOrders().reduce((max, order) => {
    const number = Number(order.id.split("-").pop()) || 0;
    return Math.max(max, number);
  }, 48);
  return `CMD-2026-${String(highest + 1).padStart(3, "0")}`;
};

export const nextRequestId = () => {
  const highest = getStoredRequests().reduce((max, request) => {
    const number = Number(request.id.split("-").pop()) || 0;
    return Math.max(max, number);
  }, 11);
  return `DA-2026-${String(highest + 1).padStart(3, "0")}`;
};

export const createOrdersFromRequest = (
  request: StoredPurchaseRequest,
  assignments: Record<number, string>,
) => {
  const assignedLines = request.lines.filter(
    (line) => assignments[line.productId] && !line.ordered,
  );
  const suppliers = Array.from(
    new Set(assignedLines.map((line) => assignments[line.productId])),
  );
  const today = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  suppliers.forEach((supplier) => {
    const lines = assignedLines
      .filter((line) => assignments[line.productId] === supplier)
      .map((line) => {
        const product = products.find((item) => item.id === line.productId)!;
        const offer = product.offers.find((item) => item.supplier === supplier);
        return {
          productId: line.productId,
          name: line.name,
          packaging: offer?.packaging || product.offers[0].packaging,
          quantity: line.quantity,
          unitPrice: offer?.price || 0,
        };
      });
    const id = nextOrderId();
    saveOrder({
      id,
      reference: orderReference(),
      supplier,
      date: today,
      status: "Brouillon",
      total: lines.reduce(
        (sum, line) => sum + line.quantity * line.unitPrice,
        0,
      ),
      lines,
      sourceRequestId: request.id,
    });
  });
  const updatedLines = request.lines.map((line) => ({
    ...line,
    supplier: assignments[line.productId] || line.supplier,
    ordered: line.ordered || Boolean(assignments[line.productId]),
  }));
  const orderedCount = updatedLines.filter((line) => line.ordered).length;
  const status: RequestStatus =
    orderedCount === updatedLines.length
      ? "Commandée"
      : orderedCount
        ? "Partiellement commandée"
        : "À commander";
  savePurchaseRequest({ ...request, lines: updatedLines, status });
  return suppliers.length;
};

export const emptyDispatch = (): Record<CompanyKey, number> =>
  Object.fromEntries(companies.map((company) => [company.key, 0])) as Record<
    CompanyKey,
    number
  >;

export const createMailPreview = (
  order: Pick<StoredOrder, "id" | "reference" | "supplier" | "lines">,
): SentEmail => {
  const settings = getPurchasingSettings();
  const companyLabels: Record<CompanyKey, string> = {
    cpte: "CPTE Conseil",
    pose: "HM Pose",
    instal: "HM Instal",
    pac: "HM PAC",
  };
  const orderLines = order.lines
    .map((line) => {
      const dispatch = line.dispatch
        ? `\nDispatch : ${Object.entries(line.dispatch)
            .map(
              ([company, quantity]) =>
                `${companyLabels[company as CompanyKey]} ${quantity}`,
            )
            .join(" | ")}`
        : "\nDispatch : livraison globale HM Group";
      return `${line.quantity} × ${line.name} — ${line.packaging}${dispatch}`;
    })
    .join("\n");
  return {
  sentAt: new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date()),
    to: supplierRecipients(order.supplier),
    subject: settings.mailSubject,
    body: `${settings.greeting}\n\n${settings.deliveryMessage}\n\n${order.reference}\n\n${orderLines}\n\n${settings.closing}`,
  };
};

export const mailtoUrl = (email: SentEmail) =>
  `mailto:${email.to}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;

export { localId };
