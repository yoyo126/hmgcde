import React from "react";
import ReactDOM from "react-dom/client";
import { AppRoot } from "@/components/crm/AppRoot";
// Une seule feuille de style. Les deux précédentes se superposaient :
// chaque conteneur de la première gardait sa bordure, la seconde tentait
// de les rattraper. D'où les cadres dans les cadres.
import "@/app/app.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>,
);
