
import { useEffect, useState } from "react";
import { getPurchasingSettings } from "./settings-storage";

export const usePurchasingSettings = () => {
  const [settings, setSettings] = useState(() => getPurchasingSettings());

  useEffect(() => {
    const refresh = () => setSettings(getPurchasingSettings());
    window.addEventListener("hm-settings-updated", refresh);
    window.addEventListener("storage", refresh);
    refresh();
    return () => {
      window.removeEventListener("hm-settings-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return settings;
};
