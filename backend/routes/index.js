import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth, requireRole, requireWriteAccess } from "../middleware/auth.js";
import * as auth from "../controllers/auth.controller.js";
import * as bootstrap from "../controllers/bootstrap.controller.js";
import * as catalog from "../controllers/catalog.controller.js";
import * as orders from "../controllers/orders.controller.js";
import * as purchaseRequests from "../controllers/purchase-requests.controller.js";
import * as settings from "../controllers/settings.controller.js";
import * as users from "../controllers/users.controller.js";

const router = Router();

// Freine les tentatives de mot de passe en rafale.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives de connexion. Réessayez dans quelques minutes." },
});

router.get("/health", (req, res) => res.json({ ok: true, service: "hmgcde-api" }));

// --- Authentification -----------------------------------------------------
router.post("/auth/login", loginLimiter, auth.login);
router.post("/auth/logout", auth.logout);
router.get("/auth/me", auth.me);

// --- Chargement initial ---------------------------------------------------
router.get("/bootstrap", requireAuth, bootstrap.bootstrap);

// --- Catalogue ------------------------------------------------------------
router.get("/catalog", requireAuth, catalog.list);
router.put("/catalog/products", requireWriteAccess, catalog.save);
router.post("/catalog/products/delete", requireWriteAccess, catalog.remove);
router.post("/catalog/prices", requireWriteAccess, catalog.savePrices);
router.post("/catalog/imports", requireWriteAccess, catalog.saveImport);
router.get("/catalog/history", requireAuth, catalog.history);

// --- Commandes ------------------------------------------------------------
router.get("/orders", requireAuth, orders.list);
router.get("/orders/next-code", requireAuth, orders.nextCode);
router.put("/orders", requireWriteAccess, orders.save);
router.put("/orders/batch", requireWriteAccess, orders.saveMany);
router.delete("/orders/:code", requireWriteAccess, orders.remove);

// --- Demandes d'achat -----------------------------------------------------
router.get("/purchase-requests", requireAuth, purchaseRequests.list);
router.get("/purchase-requests/next-code", requireAuth, purchaseRequests.nextCode);
router.put("/purchase-requests", requireWriteAccess, purchaseRequests.save);
router.delete("/purchase-requests/:code", requireWriteAccess, purchaseRequests.remove);

// --- Paramètres et sociétés ----------------------------------------------
router.get("/settings", requireAuth, settings.read);
router.put("/settings", requireWriteAccess, settings.save);
router.get("/companies", requireAuth, settings.companies);

// --- Utilisateurs (administrateurs uniquement) ---------------------------
router.get("/users", requireRole("admin"), users.list);
router.post("/users", requireRole("admin"), users.create);
router.put("/users/:id", requireRole("admin"), users.update);
router.delete("/users/:id", requireRole("admin"), users.remove);

export default router;
