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
  check("chargement initial", boot.status === 200, JSON.stringify(boot.payload));
  if (boot.status !== 200) return;
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
  //    La commande part sans numéro : c'est le serveur qui la numérote.
  const product = data.products[0];
  const supplier = product.offers[0].supplier;
  const order = {
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

  const code = saved.payload?.code;
  check("le serveur attribue le numéro", /^CMD-\d{4}-\d{3,}$/.test(code || ""), `reçu « ${code} »`);

  const stored = saved.payload?.orders?.find((item) => item.id === code);
  check("la commande est relue depuis la base", Boolean(stored));
  check("la répartition par société est conservée", stored?.lines?.[0]?.dispatch?.cpte === 4,
    JSON.stringify(stored?.lines?.[0]?.dispatch));
  check("le fournisseur est conservé", stored?.supplier === supplier);
  // \w ne couvre pas les accents : « 12 août 2026 » ne matchait pas.
  check(
    "la date est renvoyée en français",
    /^\d{1,2} [\p{L}éûô]+ \d{4}$/u.test(stored?.date || ""),
    `reçu « ${stored?.date} »`,
  );

  // 7 bis. Deux créations lancées en même temps ne doivent jamais se
  //        télescoper. Le numéro était calculé par le navigateur : deux
  //        personnes qui commandaient en même temps obtenaient le même, et
  //        l'enregistrement de la seconde écrasait la première.
  const avant = saved.payload?.orders?.length || 0;
  const lancees = [1, 2, 3, 4, 5];
  const simultanees = await Promise.all(
    lancees.map((n) =>
      call("PUT", "/orders", {
        order: { ...order, reference: `Commande simultanée ${n}`, total: 10 * n },
      }),
    ),
  );
  check(
    "cinq commandes créées en même temps sont toutes acceptées",
    simultanees.every((reponse) => reponse.status === 200),
    simultanees.map((reponse) => reponse.status).join(", "),
  );
  const codesSimultanes = simultanees.map((reponse) => reponse.payload?.code);
  check(
    "chacune reçoit son propre numéro",
    new Set(codesSimultanes).size === lancees.length,
    codesSimultanes.join(", "),
  );
  const relecture = await call("GET", "/orders");
  const toutes = relecture.payload?.orders || [];
  check(
    "aucune commande n'a été écrasée",
    toutes.length === avant + lancees.length,
    `${toutes.length} commandes pour ${avant + lancees.length} attendues`,
  );
  check(
    "les cinq commandes se relisent une à une",
    lancees.every((n) =>
      toutes.some((item) => item.reference === `Commande simultanée ${n}`),
    ),
  );

  // 7 ter. Une commande existante se corrige, et un numéro inconnu est refusé
  //        au lieu d'être créé par un écran resté ouvert.
  const corrigee = await call("PUT", "/orders", {
    order: { ...order, id: code, reference: "Commande de test corrigée", total: 150 },
  });
  check("une commande existante se corrige", corrigee.status === 200, JSON.stringify(corrigee.payload));
  check("le numéro ne change pas à la correction", corrigee.payload?.code === code);
  check(
    "la correction est bien en base",
    corrigee.payload?.orders?.find((item) => item.id === code)?.reference ===
      "Commande de test corrigée",
  );
  const inconnue = await call("PUT", "/orders", { order: { ...order, id: "CMD-1999-001" } });
  check(
    "une commande inconnue est refusée au lieu d'être recréée",
    inconnue.status === 404,
    `statut ${inconnue.status}`,
  );

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

  // 8 bis. Import d'un tarif fournisseur : le prix ET la référence.
  //        Les références apprises partaient dans une seconde requête, qui
  //        renvoyait le produit tel qu'il était AVANT l'import. La référence
  //        était apprise et le prix qui venait d'être importé repassait à son
  //        ancienne valeur : un tarif ne s'appliquait qu'à moitié.
  const offreApres = (payload) =>
    payload?.products
      ?.find((item) => item.id === product.id)
      ?.offers?.find((offer) => offer.supplier === supplier);

  // Un coffret n'a pas de prix à lui : il vaut son contenu. Un tarif doit donc
  // pouvoir chiffrer ce contenu, sinon l'ensemble reste à zéro pour toujours.
  const elementCoffret = bundle?.contents?.[0]?.name;
  const cleElement = `${bundle?.id}|||${elementCoffret}|||${supplier}`;

  const imported = await call("POST", "/catalog/imports", {
    overrides: { [priceKey]: 67.9 },
    componentPrices: elementCoffret ? { [cleElement]: 3.25 } : {},
    newProducts: [],
    history: {
      id: crypto.randomUUID(),
      fileName: "tarif-test.xlsx",
      supplier,
      changed: 1,
      added: 0,
      ignored: 0,
    },
    changes: [
      { product: product.name, supplier, oldPrice: 42.5, newPrice: 67.9, scope: "Produit" },
    ],
    references: [
      {
        productId: product.id,
        supplier,
        reference: "REF-TEST-001",
        supplierName: "LIBELLE FOURNISSEUR TEST",
      },
    ],
  });
  check("import de tarif enregistré", imported.status === 200, JSON.stringify(imported.payload));
  const apresImport = offreApres(imported.payload);
  check(
    "le prix importé survit à la référence apprise",
    apresImport?.price === 67.9,
    `reçu ${apresImport?.price}`,
  );
  check(
    "la référence fournisseur est apprise",
    apresImport?.reference === "REF-TEST-001",
    `reçu « ${apresImport?.reference} »`,
  );
  check(
    "le libellé du fournisseur est conservé",
    apresImport?.supplierName === "LIBELLE FOURNISSEUR TEST",
    `reçu « ${apresImport?.supplierName} »`,
  );
  check("l'import figure au journal", (imported.payload?.importHistory?.length || 0) > 0);
  const coffretApres = imported.payload?.products?.find((item) => item.id === bundle?.id);
  check(
    "un import peut chiffrer le contenu d'un coffret",
    coffretApres?.contents?.find((item) => item.name === elementCoffret)
      ?.supplierPrices?.[supplier] === 3.25,
    JSON.stringify(
      coffretApres?.contents?.find((item) => item.name === elementCoffret)?.supplierPrices,
    ),
  );

  // Un tarif suivant sans référence lisible ne doit pas effacer celle qu'on
  // vient d'apprendre.
  const reimport = await call("POST", "/catalog/imports", {
    overrides: { [priceKey]: 70 },
    newProducts: [],
    history: {
      id: crypto.randomUUID(),
      fileName: "tarif-test-2.xlsx",
      supplier,
      changed: 1,
      added: 0,
      ignored: 0,
    },
    changes: [],
    references: [{ productId: product.id, supplier, reference: "", supplierName: "" }],
  });
  const apresReimport = offreApres(reimport.payload);
  check("second import enregistré", reimport.status === 200, JSON.stringify(reimport.payload));
  check(
    "le nouveau prix est en base",
    apresReimport?.price === 70,
    `reçu ${apresReimport?.price}`,
  );
  check(
    "une référence vide n'efface pas celle qui est connue",
    apresReimport?.reference === "REF-TEST-001",
    `reçu « ${apresReimport?.reference} »`,
  );

  // 9. Demande d'achat. Numérotée par le serveur, elle aussi.
  const request = await call("PUT", "/purchase-requests", {
    request: {
      requester: "Entrepôt HM Group",
      date: "12 août 2026",
      status: "À commander",
      seen: false,
      lines: [{ productId: product.id, name: product.name, unit: product.unit, quantity: 3 }],
    },
  });
  check("demande d'achat enregistrée", request.status === 200, JSON.stringify(request.payload));
  const codeDemande = request.payload?.code;
  check(
    "le serveur attribue le numéro de demande",
    /^DA-\d{4}-\d{3,}$/.test(codeDemande || ""),
    `reçu « ${codeDemande} »`,
  );
  check(
    "la demande est relue avec ses lignes",
    request.payload?.requests?.find((item) => item.id === codeDemande)?.lines?.length === 1,
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

  // 11. Profil « demandeur » : saisit ses demandes, ne voit pas les prix.
  const created = await call("POST", "/users", {
    email: "demandeur@hmgroup.fr",
    name: "Chef d'équipe",
    password: "demande-hm-2026",
    role: "demandeur",
  });
  check("compte demandeur créé", created.status === 200 || created.status === 201,
    JSON.stringify(created.payload));

  // L'identifiant n'a pas à être une adresse : l'application n'écrit jamais
  // aux comptes, et exiger une adresse obligeait à inventer des boîtes qui
  // n'existent pas, comme « admin@hmgroup.fr ».
  const nomSimple = await call("POST", "/users", {
    email: "magasinier",
    name: "Magasinier",
    password: "magasin-hm-2026",
    role: "lecteur",
  });
  check(
    "un identifiant simple est accepté",
    nomSimple.status === 200 || nomSimple.status === 201,
    JSON.stringify(nomSimple.payload),
  );
  const tropCourt = await call("POST", "/users", {
    email: "ab",
    name: "Trop court",
    password: "motdepasse-hm-2026",
    role: "lecteur",
  });
  check(
    "un identifiant de moins de trois caractères est refusé",
    tropCourt.status === 400,
    `statut ${tropCourt.status}`,
  );

  await call("POST", "/auth/logout");
  const asRequester = await call("POST", "/auth/login", {
    email: "demandeur@hmgroup.fr",
    password: "demande-hm-2026",
  });
  check("connexion du demandeur", asRequester.status === 200, JSON.stringify(asRequester.payload));

  if (asRequester.status === 200) {
    const view = await call("GET", "/bootstrap");
    const seenProducts = view.payload?.products || [];
    check(
      "le demandeur ne reçoit aucun prix produit",
      seenProducts.every((item) => item.offers.every((offer) => offer.price === 0)),
    );
    check(
      "le demandeur ne reçoit aucun total de commande",
      (view.payload?.orders || []).every((item) => item.total === 0),
    );
    check("le demandeur ne reçoit pas l'historique des prix",
      (view.payload?.priceHistory || []).length === 0);

    const own = await call("PUT", "/purchase-requests", {
      request: {
        requester: "Chef d'équipe",
        date: "12 août 2026",
        status: "À commander",
        seen: false,
        lines: [{ productId: product.id, name: product.name, unit: product.unit, quantity: 2 }],
      },
    });
    check("le demandeur peut créer une demande d'achat", own.status === 200,
      JSON.stringify(own.payload));

    const refusedOrder = await call("PUT", "/orders", { order });
    check("le demandeur ne peut pas passer commande", refusedOrder.status === 403,
      `statut ${refusedOrder.status}`);
    const refusedSettings = await call("PUT", "/settings", { settings: data.settings });
    check("le demandeur ne peut pas toucher aux paramètres", refusedSettings.status === 403,
      `statut ${refusedSettings.status}`);
    const refusedUsers = await call("GET", "/users");
    check("le demandeur ne voit pas les comptes", refusedUsers.status === 403,
      `statut ${refusedUsers.status}`);
  }

  // 12. Déconnexion.
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
