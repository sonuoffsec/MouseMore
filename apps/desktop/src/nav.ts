import { createContext, useContext } from "react";
import type { SectionId } from "./lib/catalog";

export interface Nav {
  current: SectionId;
  go: (id: SectionId) => void;
}

export const NavCtx = createContext<Nav>({ current: "overview", go: () => {} });
export const useNav = (): Nav => useContext(NavCtx);
