import React from "react";
import ReactDOM from "react-dom/client";
import { AppRoot } from "@/components/crm/AppRoot";
import "@/app/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>,
);
