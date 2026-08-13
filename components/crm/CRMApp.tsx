"use client";
import { useState } from "react";
import { Bell, Menu, Search } from "lucide-react";
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
import type { StoredOrder } from "@/lib/order-storage";
export function CRMApp() {
  const [screen, setScreen] = useState<ScreenId>("dashboard"),
    [menu, setMenu] = useState(false),
    [draftOrders, setDraftOrders] = useState<StoredOrder[]>([]);
  const navigate = (next: ScreenId) => {
    setDraftOrders([]);
    setScreen(next);
  };
  const finalizeRequest = (orders: StoredOrder[]) => {
    setDraftOrders(orders);
    setScreen("new-order");
  };
  const content =
    screen === "dashboard" ? (
      <Dashboard onNavigate={navigate} />
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
      <OrdersScreen onNavigate={navigate} />
    ) : screen === "products" ? (
      <ProductsScreen />
    ) : screen === "tariff-imports" ? (
      <TariffImports />
    ) : screen === "users" ? (
      <UsersScreen />
    ) : (
      <SettingsScreen />
    );
  return (
    <div className="app-shell">
      <Sidebar
        active={screen}
        onChange={navigate}
        open={menu}
        onClose={() => setMenu(false)}
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
            <button>
              <Bell size={19} />
              <span />
            </button>
            <div className="top-user">
              <div className="avatar">YD</div>
              <div>
                <strong>Administrateur HM</strong>
                <small>Administrateur</small>
              </div>
            </div>
          </div>
        </header>
        <main>{content}</main>
      </div>
      <MobileNav active={screen} onChange={navigate} />
    </div>
  );
}
