import React from "react";
import ReactDOM from "react-dom/client";
import { CRMApp } from "@/components/crm/CRMApp";
import "@/app/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CRMApp />
  </React.StrictMode>,
);
