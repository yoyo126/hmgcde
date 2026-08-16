import {
  BarChart3,
  Box,
  ClipboardList,
  ClipboardPlus,
  FileUp,
  PackagePlus,
  Settings,
  Users,
  X,
} from "lucide-react";
import { CRM_VERSION } from "@/lib/version";
export const navItems = [
  { id: "dashboard", label: "Tableau de bord", icon: BarChart3 },
  { id: "new-order", label: "Nouvelle commande", icon: PackagePlus },
  { id: "purchase-requests", label: "Demandes d’achat", icon: ClipboardPlus },
  { id: "orders", label: "Commandes", icon: ClipboardList },
  { id: "settings", label: "Paramètres", icon: Settings },
] as const;
export const settingsItems = [
  { id: "products", label: "Produits", icon: Box },
  { id: "tariff-imports", label: "Import tarifs", icon: FileUp },
  { id: "users", label: "Utilisateurs", icon: Users },
] as const;
export type ScreenId =
  | (typeof navItems)[number]["id"]
  | (typeof settingsItems)[number]["id"];
export function Sidebar({
  active,
  onChange,
  open,
  onClose,
  requestNotifications = 0,
}: {
  active: ScreenId;
  onChange: (id: ScreenId) => void;
  open: boolean;
  onClose: () => void;
  requestNotifications?: number;
}) {
  return (
    <>
      <div
        className={"mobile-overlay " + (open ? "visible" : "")}
        onClick={onClose}
      />
      <aside className={"sidebar " + (open ? "open" : "")}>
        <div className="brand">
          <div className="brand-mark">HM</div>
          <div>
            <strong>HM GROUP</strong>
            <small>Achats filiales</small>
          </div>
          <button className="close-sidebar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <nav>
          <p className="nav-eyebrow">GESTION</p>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={
                active === id ||
                (id === "settings" &&
                  settingsItems.some((item) => item.id === active))
                  ? "active"
                  : ""
              }
              onClick={() => {
                onChange(id);
                onClose();
              }}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "purchase-requests" && requestNotifications > 0 && (
                <b className="nav-notification">{requestNotifications}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">YD</div>
          <div>
            <strong>Administrateur HM</strong>
            <small>Administrateur</small>
          </div>
          <span className="online-dot" />
          <small className="crm-version">Version {CRM_VERSION}</small>
        </div>
      </aside>
    </>
  );
}
export function MobileNav({
  active,
  onChange,
  requestNotifications = 0,
}: {
  active: ScreenId;
  onChange: (id: ScreenId) => void;
  requestNotifications?: number;
}) {
  return (
    <nav className="mobile-nav">
      {navItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={
            active === id ||
            (id === "settings" &&
              settingsItems.some((item) => item.id === active))
              ? "active"
              : ""
          }
          onClick={() => onChange(id)}
        >
          <Icon size={20} />
          {id === "purchase-requests" && requestNotifications > 0 && (
            <b className="mobile-notification">{requestNotifications}</b>
          )}
          <span>
            {label === "Nouvelle commande"
              ? "Commander"
              : label === "Demandes d’achat"
                ? "Demandes"
                : label === "Tableau de bord"
                  ? "Accueil"
                  : label}
          </span>
        </button>
      ))}
    </nav>
  );
}
