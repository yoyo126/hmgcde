import React from "react";
import ReactDOM from "react-dom/client";
import { AppRoot } from "@/components/crm/AppRoot";
import "@/app/globals.css";
// Chargée en dernier : elle impose la nouvelle langue visuelle.
import "@/app/refonte.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>,
);
