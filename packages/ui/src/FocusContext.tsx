import { createContext, useContext, useMemo, type ReactNode } from "react";
import { FocusManager } from "./focus.js";

const FocusCtx = createContext<FocusManager | null>(null);

export function FocusProvider({ children }: { children: ReactNode }) {
  const manager = useMemo(() => new FocusManager(), []);
  return <FocusCtx.Provider value={manager}>{children}</FocusCtx.Provider>;
}

export function useFocusManager(): FocusManager {
  const ctx = useContext(FocusCtx);
  if (!ctx) throw new Error("useFocusManager must be inside FocusProvider");
  return ctx;
}
