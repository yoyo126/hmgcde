
import { useEffect, useState } from "react";
import {
  CATALOG_CHANGED_EVENT,
  getCatalogProducts,
} from "./tariff-storage";

export const useCatalogProducts = () => {
  const [products, setProducts] = useState(() => getCatalogProducts());

  useEffect(() => {
    const refresh = () => setProducts(getCatalogProducts());
    window.addEventListener(CATALOG_CHANGED_EVENT, refresh);
    window.addEventListener("hm-settings-updated", refresh);
    window.addEventListener("storage", refresh);
    refresh();
    return () => {
      window.removeEventListener(CATALOG_CHANGED_EVENT, refresh);
      window.removeEventListener("hm-settings-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return products;
};
