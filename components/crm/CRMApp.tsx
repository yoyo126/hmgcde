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
export function CRMApp() {
  const [screen, setScreen] = useState<ScreenId>("dashboard"),
    [menu, setMenu] = useState(false);
  const content =
    screen === "dashboard" ? (
      <Dashboard onNavigate={setScreen} />
    ) : screen === "new-order" ? (
      <NewOrder onNavigate={setScreen} />
    ) : screen === "purchase-requests" ? (
      <PurchaseRequests />
    ) : screen === "orders" ? (
      <OrdersScreen />
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
        onChange={setScreen}
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
      <MobileNav active={screen} onChange={setScreen} />
    </div>
  );
}
