import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Dashboard } from "./Dashboard";
import { NewOrder } from "./NewOrder";
import { MobileNav, Sidebar, type ScreenId } from "./Sidebar";
import {
  OrdersScreen,
  ProductsScreen,
  SettingsScreen,
  UsersScreen,
} from "./OtherScreens";
import { Comparatif } from "./Comparatif";
import { Notifications } from "./Notifications";
import { PurchaseRequests } from "./PurchaseRequests";
import { Ventilation } from "./Ventilation";
import { TariffImports } from "./TariffImports";
import {
  getPendingPurchaseRequestCount,
  type StoredOrder,
} from "@/lib/order-storage";
import type { SessionUser } from "@/lib/types";
import { usePermissions } from "./permissions-context";

export function CRMApp({
  user,
  onSignOut,
}: {
  user: SessionUser;
  onSignOut: () => void;
}) {
  const can = usePermissions();
  const [screen, setScreen] = useState<ScreenId>("dashboard"),
    // Recliquer sur l'entrée déjà active remet l'écran à son point de
    // départ : sans cela, on restait bloqué dans une sous-rubrique des
    // paramètres, le menu ne répondant plus.
    [visite, setVisite] = useState(0),
    [menu, setMenu] = useState(false),
    [draftOrders, setDraftOrders] = useState<StoredOrder[]>([]),
    [orderToOpen, setOrderToOpen] = useState<string | null>(null),
    // La pastille suit les demandes qui attendent encore une commande,
    // pas celles qu'on n'a pas encore ouvertes : la lire n'est pas la
    // traiter.
    [requestNotifications, setRequestNotifications] = useState(() =>
      getPendingPurchaseRequestCount(),
    );
  useEffect(() => {
    const refresh = () =>
      setRequestNotifications(getPendingPurchaseRequestCount());
    window.addEventListener("hm-purchasing-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("hm-purchasing-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  // Un écran interdit ne s'ouvre pas, même en forçant la navigation.
  const allowed = (id: ScreenId) => {
    if (id === "users") return can.canManageUsers;
    if (id === "settings" || id === "tariff-imports") return can.canSeeSettings;
    if (id === "new-order") return can.canManagePurchasing;
    if (id === "ventilation") return can.canSeePrices;
    if (id === "comparatif") return can.canSeePrices;
    if (id === "purchase-requests") return can.canRequest || can.canManagePurchasing;
    return true;
  };

  const navigate = (next: ScreenId) => {
    if (!allowed(next)) return;
    setDraftOrders([]);
    if (next !== "orders") setOrderToOpen(null);
    if (next === screen) setVisite((n) => n + 1);
    setScreen(next);
    setMenu(false);
  };
  const openOrder = (orderId: string) => {
    setOrderToOpen(orderId);
    setScreen("orders");
  };
  const finalizeRequest = (orders: StoredOrder[]) => {
    setDraftOrders(orders);
    setScreen("new-order");
  };
  /**
   * Reprend une commande existante dans l'écran de création. Même chemin que
   * la finalisation d'une demande d'achat : l'écran sait déjà rouvrir une
   * commande, il n'y avait simplement aucun bouton pour y mener.
   */
  const editOrder = (order: StoredOrder) => {
    if (!allowed("new-order")) return;
    setDraftOrders([order]);
    setScreen("new-order");
    setMenu(false);
  };
  const content =
    screen === "dashboard" ? (
      <Dashboard onNavigate={navigate} onOpenOrder={openOrder} />
    ) : screen === "new-order" ? (
      <NewOrder
        key={draftOrders[0]?.id || "new-order"}
        initialOrder={draftOrders[0]}
        remainingDrafts={Math.max(0, draftOrders.length - 1)}
        onNextDraft={() => setDraftOrders((current) => current.slice(1))}
        onNavigate={navigate}
      />
    ) : screen === "purchase-requests" ? (
      <PurchaseRequests onFinalize={finalizeRequest} />
    ) : screen === "ventilation" ? (
      <Ventilation />
    ) : screen === "orders" ? (
      <OrdersScreen
        onNavigate={navigate}
        onEditOrder={editOrder}
        initialOpenOrder={orderToOpen}
      />
    ) : screen === "notifications" ? (
      <Notifications onBack={() => navigate("settings")} />
    ) : screen === "comparatif" ? (
      <Comparatif onBack={() => navigate("settings")} />
    ) : screen === "products" ? (
      <ProductsScreen onBack={() => navigate("settings")} />
    ) : screen === "tariff-imports" ? (
      <TariffImports onBack={() => navigate("settings")} />
    ) : screen === "users" ? (
      <UsersScreen onBack={() => navigate("settings")} />
    ) : (
      <SettingsScreen onNavigate={navigate} />
    );
  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        active={screen}
        onChange={navigate}
        open={menu}
        onClose={() => setMenu(false)}
        onSignOut={onSignOut}
        requestNotifications={requestNotifications}
      />
      <div className="main-shell">
        <button
          className="menu-btn"
          aria-label="Ouvrir le menu"
          onClick={() => setMenu(true)}
        >
          <Menu size={21} />
        </button>
        <main key={`${screen}-${visite}`}>{content}</main>
      </div>
      <MobileNav
        active={screen}
        onChange={navigate}
        requestNotifications={requestNotifications}
      />
    </div>
  );
}
