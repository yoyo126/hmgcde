import { createContext, useContext, useMemo, type ReactNode } from "react";
import { permissionsFor, type Permissions, type Role } from "@/lib/permissions";

/**
 * Droits du compte connecté, mis à disposition de tous les écrans.
 * Les écrans s'en servent pour masquer ce qui n'est pas permis ; l'API, elle,
 * refuse de son côté — l'affichage n'est jamais la seule barrière.
 */
const PermissionsContext = createContext<Permissions>(permissionsFor("lecteur"));

export const PermissionsProvider = ({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) => {
  const value = useMemo(() => permissionsFor(role), [role]);
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
};

export const usePermissions = () => useContext(PermissionsContext);
