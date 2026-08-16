import { companies } from "./crm-data";
import { getPurchasingSettings, supplierRecipients } from "./settings-storage";
import {
  PURCHASING_UPDATED_EVENT,
  persistOrder,
  persistOrders,
  persistRequest,
  store,
} from "./store";
import { getCatalogProducts } from "./tariff-storage";
import type {
  CompanyKey,
  SentEmail,
  StoredOrder,
  StoredPurchaseRequest,
} from "./types";

export type {
  OrderStatus,
  PurchaseRequestLine,
  RequestStatus,
  SentEmail,
  StoredOrder,
  StoredOrderLine,
  StoredPurchaseRequest,
} from "./types";

/**
 * Commandes fournisseurs et demandes d'achat.
 *
 * La logique métier est celle d'avant (répartition entre sociétés, éclatement
 * d'une demande en une commande par fournisseur, mise en forme des e-mails) ;
 * seule la persistance a changé : cache en lecture, API en écriture.
 */

const localId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const isoWeek = (date: Date) => {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

/** Libellé métier d'une commande : « Commande S33 du 16/08/2026 ». */
export const orderReference = (date = new Date()) =>
  `Commande S${String(isoWeek(date)).padStart(2, "0")} du ${new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)}`;

// --- Lecture --------------------------------------------------------------

export const getStoredOrders = (): StoredOrder[] => store.orders;
export const getStoredRequests = (): StoredPurchaseRequest[] => store.requests;

export const getNewPurchaseRequestCount = () =>
  store.requests.filter((request) => request.seen === false).length;

const notify = () => window.dispatchEvent(new Event(PURCHASING_UPDATED_EVENT));

// --- Écriture -------------------------------------------------------------

export const saveOrder = (order: StoredOrder) => {
  store.orders = [order, ...store.orders.filter((item) => item.id !== order.id)];
  notify();
  void persistOrder(order);
};

export const savePurchaseRequest = (request: StoredPurchaseRequest) => {
  store.requests = [request, ...store.requests.filter((item) => item.id !== request.id)];
  notify();
  void persistRequest(request);
};

export const markPurchaseRequestSeen = (requestId: string) => {
  const request = store.requests.find((item) => item.id === requestId);
  if (!request || request.seen !== false) return;
  savePurchaseRequest({ ...request, seen: true });
};

export const updatePurchaseRequestQuantity = (
  requestId: string,
  productId: number,
  quantity: number,
) => {
  const request = store.requests.find((item) => item.id === requestId);
  if (!request) return;
  savePurchaseRequest({
    ...request,
    lines: request.lines.map((line) =>
      line.productId === productId && !line.ordered
        ? { ...line, quantity: Math.max(1, quantity) }
        : line,
    ),
  });
};

/**
 * Numéros suivants. Ils sont calculés sur le cache pour que l'écran affiche
 * un numéro tout de suite ; le serveur reste l'autorité et corrige au besoin
 * lors de l'enregistrement.
 */
export const nextOrderId = () => {
  const year = new Date().getFullYear();
  const highest = store.orders.reduce((max, order) => {
    const number = Number(order.id.split("-").pop()) || 0;
    return Math.max(max, number);
  }, 48);
  return `CMD-${year}-${String(highest + 1).padStart(3, "0")}`;
};

export const nextRequestId = () => {
  const year = new Date().getFullYear();
  const highest = store.requests.reduce((max, request) => {
    const number = Number(request.id.split("-").pop()) || 0;
    return Math.max(max, number);
  }, 11);
  return `DA-${year}-${String(highest + 1).padStart(3, "0")}`;
};

/**
 * Éclate une demande d'achat en commandes : une par fournisseur affecté.
 * La demande passe ensuite en « Partiellement commandée » ou « Commandée ».
 */
export const createOrdersFromRequest = (
  request: StoredPurchaseRequest,
  assignments: Record<number, string>,
) => {
  const catalog = getCatalogProducts();
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

  const createdOrders: StoredOrder[] = [];
  let sequence = Number(nextOrderId().split("-").pop()) || 49;

  suppliers.forEach((supplier) => {
    const lines = assignedLines
      .filter((line) => assignments[line.productId] === supplier)
      .map((line) => {
        const product = catalog.find((item) => item.id === line.productId);
        const offer = product?.offers.find((item) => item.supplier === supplier);
        return {
          productId: line.productId,
          name: line.name,
          packaging: offer?.packaging || product?.offers[0]?.packaging || "",
          quantity: line.quantity,
          unitPrice: offer?.price || 0,
          components: product?.contents?.map(({ name, quantity }) => ({ name, quantity })),
        };
      });

    createdOrders.push({
      id: `CMD-${new Date().getFullYear()}-${String(sequence++).padStart(3, "0")}`,
      reference: orderReference(),
      supplier,
      date: today,
      status: "Brouillon",
      total: lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
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
  const status = (
    orderedCount === updatedLines.length
      ? "Commandée"
      : orderedCount
        ? "Partiellement commandée"
        : "À commander"
  ) as StoredPurchaseRequest["status"];

  // Cache d'abord, pour que l'écran enchaîne sans attendre le réseau.
  store.orders = [...createdOrders, ...store.orders];
  const updatedRequest = { ...request, lines: updatedLines, status };
  store.requests = [
    updatedRequest,
    ...store.requests.filter((item) => item.id !== request.id),
  ];
  notify();

  if (createdOrders.length) void persistOrders(createdOrders);
  void persistRequest(updatedRequest);

  return createdOrders;
};

export const emptyDispatch = (): Record<CompanyKey, number> =>
  Object.fromEntries(companies.map((company) => [company.key, 0])) as Record<CompanyKey, number>;

// --- E-mails fournisseurs -------------------------------------------------

export const createMailPreview = (
  order: Pick<StoredOrder, "id" | "reference" | "supplier" | "lines">,
): SentEmail => {
  const settings = getPurchasingSettings();
  const companyLabels = Object.fromEntries(
    companies.map((company) => [company.key, company.name]),
  ) as Record<CompanyKey, string>;

  const orderLines = order.lines
    .map((line) => {
      const dispatch = line.dispatch
        ? `\nDispatch : ${Object.entries(line.dispatch)
            .map(([company, quantity]) => `${companyLabels[company as CompanyKey]} ${quantity}`)
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

const escapeHtml = (value: string | number) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * Copie la commande dans le presse-papiers, en HTML (tableau prêt à coller
 * dans un e-mail) et en texte, avec une colonne par société servie.
 */
export const copyOrderEmail = async (order: StoredOrder) => {
  const settings = getPurchasingSettings();
  const catalog = getCatalogProducts();
  const companyColumns = companies.map((company) => ({
    key: company.key,
    label: company.short === "CPTE" ? "CPTE" : company.name,
  }));
  const activeCompanies = companyColumns.filter(({ key }) =>
    order.lines.some((line) => (line.dispatch?.[key] || 0) > 0),
  );

  const rows = order.lines
    .map((line) => {
      const dispatch = line.dispatch || emptyDispatch();
      const storedComponents =
        line.components || catalog.find((product) => product.id === line.productId)?.contents;
      const components = storedComponents?.length
        ? `<div style="margin-top:6px;color:#526071;font-size:12px">${storedComponents
            .map((item) => `${item.quantity} × ${escapeHtml(item.name)}`)
            .join("<br>")}</div>`
        : "";
      return `<tr>
        <td style="border:1px solid #b7c0cc;padding:8px"><strong>${escapeHtml(line.name)}</strong>${components}</td>
        <td style="border:1px solid #b7c0cc;padding:8px">${escapeHtml(line.packaging)}</td>
        <td style="border:1px solid #b7c0cc;padding:8px;text-align:center"><strong>${line.quantity}</strong></td>
        ${activeCompanies
          .map(
            ({ key }) =>
              `<td style="border:1px solid #b7c0cc;padding:8px;text-align:center">${dispatch[key]}</td>`,
          )
          .join("")}
      </tr>`;
    })
    .join("");

  const html = `<div style="font-family:Arial,sans-serif;color:#172033;font-size:14px">
    <p>${escapeHtml(settings.greeting)}</p>
    <p><strong>${escapeHtml(settings.deliveryMessage)}</strong></p>
    <p><strong>${escapeHtml(order.reference)}</strong></p>
    <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:13px">
      <thead><tr style="background:#263653;color:#ffffff">
        <th style="border:1px solid #263653;padding:8px;text-align:left">Produit</th>
        <th style="border:1px solid #263653;padding:8px;text-align:left">Conditionnement</th>
        <th style="border:1px solid #263653;padding:8px">Qté totale</th>
        ${activeCompanies
          .map(({ label }) => `<th style="border:1px solid #263653;padding:8px">${label}</th>`)
          .join("")}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="white-space:pre-line">${escapeHtml(settings.closing)}</p>
  </div>`;

  const textRows = order.lines.map((line) => {
    const dispatch = line.dispatch || emptyDispatch();
    const storedComponents =
      line.components || catalog.find((product) => product.id === line.productId)?.contents;
    const components = storedComponents?.length
      ? `\n${storedComponents.map((item) => `  ${item.quantity} × ${item.name}`).join("\n")}`
      : "";
    const companyValues = activeCompanies.map(({ key }) => dispatch[key]);
    return [line.name + components, line.packaging, line.quantity, ...companyValues].join("\t");
  });
  const textHeaders = [
    "Produit",
    "Conditionnement",
    "Qté totale",
    ...activeCompanies.map(({ label }) => label),
  ];
  const text = `${settings.greeting}\n\n${settings.deliveryMessage}\n\n${order.reference}\n\n${textHeaders.join("\t")}\n${textRows.join("\n")}\n\n${settings.closing}`;

  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(text);
    }
    return true;
  } catch {
    return false;
  }
};

export const mailtoUrl = (email: SentEmail, includeBody = true) =>
  `mailto:${email.to}?subject=${encodeURIComponent(email.subject)}${
    includeBody ? `&body=${encodeURIComponent(email.body)}` : ""
  }`;

export { localId };
