import { createContext, useContext } from "react";

export type View = "wireframes" | "docs" | "tasks" | "plan" | "flow" | "tree" | "map";

export type NavTarget =
  | { kind: "wireframe"; id: string }
  | { kind: "doc"; id: string }
  | { kind: "task"; id: string }
  | { kind: "plan" };

export const NavContext = createContext<(t: NavTarget) => void>(() => {});
export const useNavigate = (): ((t: NavTarget) => void) => useContext(NavContext);
