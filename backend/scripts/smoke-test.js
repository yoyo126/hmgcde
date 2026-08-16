/**
 * Test de bout en bout de l'API, joué par l'intégration continue.
 *
 * Il rejoue le parcours métier réel : connexion, chargement de l'application,
 * création d'une commande avec répartition entre les sociétés, modification
 * d'un prix, puis relecture pour vérifier que la base a bien tout gardé.
 */

const BASE = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3001";
const EMAIL = process.env.SMOKE_EMAIL || "admin@hmgroup.fr";
const PASSWORD = process.env.SMOKE_PASSWORD;

let cookie = "";
let failures = 0;

const call = async (method, path, body) => {
  const response = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
};

const check = (label, condition, detail = "") => {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    failures += 1;
  }
};

const run = async () => {
  console.log(`\nTest de l'API sur ${BASE}\n`);

  // 1. Le service répond.
  const health = await call("GET", "/health");
  check("le serveur répond", health.status === 200, `statut ${health.status}`);

  // 2. Sans session, l'API est fermée.
  const closed = await call("GET", "/bootstrap");
  check("l'API refuse les visiteurs non connectés", closed.status === 401);

  // 3. Mauvais mot de passe refusé.
  const wrong = await call("POST", "/auth/login", { email: EMAIL, password: "mauvais-mot-de-passe" });
  check("un mauvais mot de passe est refusé", wrong.status === 401);

  // 4. Connexion.
  const login = await call("POST", "/auth/login", { email: EMAIL, password: PASSWORD });
  check("connexion réussie", login.status === 200, JSON.stringify(login.payload));
  if (login.status !== 200) return;

  // 5. Chargement initial : le catalogue amorcé doit être là.
  const boot = await call("GET", "/bootstrap");
  const data = boot.payload || {};
  check("chargement initial", boot.status === 200);
  check("les 4 sociétés sont présentes", data.companies?.length === 4, `reçu ${data.companies?.length}`);
  check("le catalogue est amorcé", data.products?.length >= 70, `reçu ${data.products?.length}`);
  check("les fournisseurs sont présents", data.settings?.suppliers?.length >= 7);
  check(
    "le nombre d'équipes par société est connu",
    Object.keys(data.settings?.defaultTeams || {}).length === 4,
  );

  // 6. Les produits composés gardent leur contenu et leurs prix fournisseur.
  const bundle = data.products?.find((product) => product.kind === "ensemble");
  check("un produit composé existe", Boolean(bundle), "aucun coffret/carton trouvé");
  check("le composé a son contenu détaillé", (bundle?.contents?.length || 0) > 0);
  check(
    "chaque élément connaît ses prix fournisseur",
    Boolean(bundle?.contents?.[0]?.supplierPrices),
  );

  // 7. Création d'une commande avec répartition entre les sociétés.
  const { payload: next } = await call("GET", "/orders/next-code");
  const product = data.products[0];
  const supplier = product.offers[0].supplier;
  const order = {
    id: next.code,
    reference: "Commande de test automatique",
    supplier,
    date: "12 août 2026",
    status: "Brouillon",
    total: 120,
    lines: [
      {
        productId: product.id,
        name: product.name,
        packaging: product.offers[0].packaging,
        quantity: 10,
        unitPrice: 12,
        dispatch: { cpte: 4, pose: 3, instal: 2, pac: 1 },
      },
    ],
  };
  const saved = await call("PUT", "/orders", { order });
  check("commande enregistrée", saved.status === 200, JSON.stringify(saved.payload));

  const stored = saved.payload?.orders?.find((item) => item.id === next.code);
  check("la commande est relue depuis la base", Boolean(stored));
  check("la répartition par société est conservée", stored?.lines?.[0]?.dispatch?.cpte === 4,
    JSON.stringify(stored?.lines?.[0]?.dispatch));
  check("le fournisseur est conservé", stored?.supplier === supplier);
  check("la date est renvoyée en français", /\d{1,2} \w+ \d{4}/.test(stored?.date || ""));

  // 8. Modification d'un prix : le catalogue et l'historique doivent suivre.
  const priceKey = `${product.id}|||${supplier}`;
  const priced = await call("POST", "/catalog/prices", {
    prices: { [priceKey]: 42.5 },
    componentPrices: {},
    changes: [
      { product: product.name, supplier, oldPrice: 0, newPrice: 42.5, scope: "Produit" },
    ],
  });
  check("prix enregistré", priced.status === 200);
  const updated = priced.payload?.products?.find((item) => item.id === product.id);
  check(
    "le nouveau prix est en base",
    updated?.offers?.find((offer) => offer.supplier === supplier)?.price === 42.5,
  );
  check("l'historique des prix est alimenté", (priced.payload?.priceHistory?.length || 0) > 0);

  // 9. Demande d'achat.
  const { payload: nextRequest } = await call("GET", "/purchase-requests/next-code");
  const request = await call("PUT", "/purchase-requests", {
    request: {
      id: nextRequest.code,
      requester: "Entrepôt HM Group",
      date: "12 août 2026",
      status: "À commander",
      seen: false,
      lines: [{ productId: product.id, name: product.name, unit: product.unit, quantity: 3 }],
    },
  });
  check("demande d'achat enregistrée", request.status === 200, JSON.stringify(request.payload));
  check(
    "la demande est relue avec ses lignes",
    request.payload?.requests?.find((item) => item.id === nextRequest.code)?.lines?.length === 1,
  );

  // 10. Paramètres : textes d'e-mail et nombre d'équipes.
  const settings = await call("PUT", "/settings", {
    settings: {
      ...data.settings,
      mailSubject: "COMMANDE HM — test",
      defaultTeams: { ...data.settings.defaultTeams, pose: 6 },
    },
  });
  check("paramètres enregistrés", settings.status === 200, JSON.stringify(settings.payload));
  check("l'objet de l'e-mail est conservé", settings.payload?.settings?.mailSubject === "COMMANDE HM — test");
  check("le nombre d'équipes est conservé", settings.payload?.settings?.defaultTeams?.pose === 6);

  // 11. Déconnexion.
  const logout = await call("POST", "/auth/logout");
  check("déconnexion", logout.status === 200);
  const afterLogout = await call("GET", "/bootstrap");
  check("la session est bien fermée", afterLogout.status === 401);
};

run()
  .then(() => {
    console.log(failures ? `\n${failures} vérification(s) en échec.\n` : "\nToutes les vérifications passent.\n");
    process.exit(failures ? 1 : 0);
  })
  .catch((error) => {
    console.error("\nLe test a planté :", error);
    process.exit(1);
  });
