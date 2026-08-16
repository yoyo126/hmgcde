
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardPlus,
  Clock3,
  Euro,
  PackagePlus,
  Send,
  ShoppingCart,
} from "lucide-react";
import { money } from "@/lib/crm-data";
import { getStoredOrders } from "@/lib/order-storage";
import type { ScreenId } from "./Sidebar";

const statusClass = (status: string) =>
  status === "Reçue" ? "received" : status === "Envoyée" ? "sent" : "draft";

export function Dashboard({
  onNavigate,
  onOpenOrder,
}: {
  onNavigate: (id: ScreenId) => void;
  onOpenOrder: (orderId: string) => void;
}) {
  const [orders, setOrders] = useState(() => getStoredOrders());
  useEffect(() => {
    const refresh = () => setOrders(getStoredOrders());
    window.addEventListener("hm-purchasing-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("hm-purchasing-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const received = orders.filter((order) => order.status === "Reçue").length;
  const waiting = orders.filter((order) => order.status !== "Reçue").length;
  const total = orders.reduce((sum, order) => sum + order.total, 0);

  return (
    <div className="screen">
      <div className="welcome-row">
        <div>
          <span className="eyebrow">ACHATS HM GROUP</span>
          <h1>Bonjour <span>👋</span></h1>
          <p>Voici où en sont les achats de HM Group.</p>
        </div>
        <button className="primary-btn" onClick={() => onNavigate("new-order")}>
          <PackagePlus size={18} /> Nouvelle commande
        </button>
      </div>
      <div className="stats-grid">
        <Stat icon={<ShoppingCart />} label="Commandes" value={String(orders.length)} note="Total enregistré" tone="blue" />
        <Stat icon={<Euro />} label="Total commandé" value={money(total)} note="Toutes commandes" tone="green" />
        <Stat icon={<Clock3 />} label="En attente" value={String(waiting)} note="À suivre" tone="amber" />
        <Stat icon={<CheckCircle2 />} label="Réceptionnées" value={String(received)} note="Terminées" tone="violet" />
      </div>
      <div className="dashboard-grid">
        <section className="panel recent-panel">
          <div className="panel-head">
            <div>
              <h2>Commandes récentes</h2>
              <p>Cliquez sur une commande pour afficher son détail.</p>
            </div>
            <button className="text-btn" onClick={() => onNavigate("orders")}>
              Tout voir <ArrowRight size={16} />
            </button>
          </div>
          <div className="order-list">
            {orders.slice(0, 3).map((order) => (
              <button
                className="order-row dashboard-order-row"
                key={order.id}
                onClick={() => onOpenOrder(order.id)}
              >
                <div className="supplier-icon"><ShoppingCart size={18} /></div>
                <div className="order-main">
                  <strong>{order.supplier}</strong>
                  <span>{order.reference || order.id} · {order.lines.length} produits</span>
                </div>
                <div className="order-date">{order.date}</div>
                <div className="order-total">
                  <strong>{money(order.total)}</strong>
                  <span className={`status ${statusClass(order.status)}`}>{order.status}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
        <section className="panel quick-panel">
          <div className="panel-head"><div><h2>Accès rapides</h2><p>Les actions fréquentes</p></div></div>
          <Quick icon={<ClipboardPlus />} title="Demande d’achat" text="Besoin global de l’entrepôt" tone="violet" onClick={() => onNavigate("purchase-requests")} />
          <Quick icon={<PackagePlus />} title="Créer une commande" text="Répartir entre les filiales" tone="blue" onClick={() => onNavigate("new-order")} />
          <Quick icon={<Send />} title="Suivre les commandes" text="Envois et réceptions" tone="green" onClick={() => onNavigate("orders")} />
        </section>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string; note: string; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>;
}

function Quick({ icon, title, text, tone, onClick }: { icon: React.ReactNode; title: string; text: string; tone: string; onClick: () => void }) {
  return <button className="quick-action" onClick={onClick}><span className={`quick-icon ${tone}`}>{icon}</span><span><strong>{title}</strong><small>{text}</small></span><ArrowRight size={17} /></button>;
}
