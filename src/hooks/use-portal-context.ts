import { createContext, useContext } from "react";

export interface PortalContextType {
  obraId: string | null;
}

export const PortalContext = createContext<PortalContextType>({ obraId: null });

export function usePortalContext() {
  const context = useContext(PortalContext);
  return context;
}
