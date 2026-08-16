import { useEffect, useState } from "react";
import { Bell, LogOut, Menu, Search } from "lucide-react";
import { Dashboard } from "./Dashboard";
import { NewOrder } from "./NewOrder";
import { MobileNav, Sidebar, type ScreenId } from "./Sidebar";
import {
  OrdersScreen,
  ProductsScreen,
  SettingsScreen,
  UsersScreen,
} from "./OtherScreens";
import { PurchaseRequests } from "./PurchaseRequests";
import { TariffImports } from "./TariffImports";
import {
  getNewPurchaseRequestCount,
  type StoredOrder,
} from "@/lib/order-storage";
import type { SessionUser } from "@/lib/types";

const ROLE_LABELS: Record<SessionUser["role"], string> = {
  admin: "Administrateur",
  acheteur: "Commandes",
  lecteur: "Lecture seule",
};

/** Initiales affichées dans la pastille utilisateur. */
const initials = (user: SessionUser) =>
  (user.name || user.email)
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";

export function CRMApp({
  user,
  onSignOut,
}: {
  user: SessionUser;
  onSignOut: () => void;
}) {
  const [screen, setScreen] = useState<ScreenId>("dashboard"),
    [menu, setMenu] = useState(false),
    [draftOrders, setDraftOrders] = useState<StoredOrder[]>([]),
    [orderToOpen, setOrderToOpen] = useState<string | null>(null),
    [requestNotifications, setRequestNotifications] = useState(() =>
      getNewPurchaseRequestCount(),
    );
  useEffect(() => {
    const refresh = () =>
      setRequestNotifications(getNewPurchaseRequestCount());
    window.addEventListener("hm-purchasing-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("hm-purchasing-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const navigate = (next: ScreenId) => {
    setDraftOrders([]);
    if (next !== "orders") setOrderToOpen(null);
    setScreen(next);
  };
  const openOrder = (orderId: string) => {
    setOrderToOpen(orderId);
    setScreen("orders");
  };
  const finalizeRequest = (orders: StoredOrder[]) => {
    setDraftOrders(orders);
    setScreen("new-order");
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
    ) : screen === "orders" ? (
      <OrdersScreen onNavigate={navigate} initialOpenOrder={orderToOpen} />
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
        active={screen}
        onChange={navigate}
        open={menu}
        onClose={() => setMenu(false)}
        requestNotifications={requestNotifications}
      />
      <div className="main-shell">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setMenu(true)}>
            <Menu size={21} />
          </button>
          <div className="top-search">
            <Search size={17} />
            <input placeholder="Rechercher dans HM Group…" />
            <kbd>⌘ K</kbd>
          </div>
          <div className="top-actions">
            <button
              aria-label={`${requestNotifications} nouvelle(s) demande(s) d’achat`}
              onClick={() => navigate("purchase-requests")}
            >
              <Bell size={19} />
              {requestNotifications > 0 && (
                <b className="top-notification">{requestNotifications}</b>
              )}
            </button>
            <div className="top-user">
              <div className="avatar">{initials(user)}</div>
              <div>
                <strong>{user.name || user.email}</strong>
                <small>{ROLE_LABELS[user.role]}</small>
              </div>
            </div>
            <button aria-label="Se déconnecter" title="Se déconnecter" onClick={onSignOut}>
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main>{content}</main>
      </div>
      <MobileNav
        active={screen}
        onChange={navigate}
        requestNotifications={requestNotifications}
      />
    </div>
  );
}
