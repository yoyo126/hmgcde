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
import { ROLE_LABELS } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";
import { CRM_VERSION } from "@/lib/version";
import { usePermissions } from "./permissions-context";
import { HmLogo } from "./HmLogo";

/** Initiales du compte connecté. */
const initials = (user: SessionUser) =>
  (user.name || user.email)
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";
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
  user,
  active,
  onChange,
  open,
  onClose,
  requestNotifications = 0,
}: {
  user: SessionUser;
  active: ScreenId;
  onChange: (id: ScreenId) => void;
  open: boolean;
  onClose: () => void;
  requestNotifications?: number;
}) {
  const can = usePermissions();
  const visibleNav = navItems.filter(({ id }) => {
    if (id === "settings") return can.canSeeSettings;
    if (id === "new-order") return can.canManagePurchasing;
    if (id === "purchase-requests") return can.canRequest || can.canManagePurchasing;
    return true;
  });
  return (
    <>
      <div
        className={"mobile-overlay " + (open ? "visible" : "")}
        onClick={onClose}
      />
      <aside className={"sidebar " + (open ? "open" : "")}>
        <div className="brand">
          {/* Le logo porte déjà le nom du groupe : inutile de le répéter à côté,
              autant lui laisser toute la largeur pour rester lisible. */}
          <div className="brand-plate">
            <HmLogo className="brand-logo" />
          </div>
          <small className="brand-caption">Achats filiales</small>
          <button className="close-sidebar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <nav>
          <p className="nav-eyebrow">GESTION</p>
          {visibleNav.map(({ id, label, icon: Icon }) => (
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
          <div className="avatar">{initials(user)}</div>
          <div>
            <strong>{user.name || user.email}</strong>
            <small>{ROLE_LABELS[user.role]}</small>
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
  const can = usePermissions();
  const visibleNav = navItems.filter(({ id }) => {
    if (id === "settings") return can.canSeeSettings;
    if (id === "new-order") return can.canManagePurchasing;
    if (id === "purchase-requests") return can.canRequest || can.canManagePurchasing;
    return true;
  });
  return (
    <nav className="mobile-nav">
      {visibleNav.map(({ id, label, icon: Icon }) => (
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
