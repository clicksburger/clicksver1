"use client";

import { createContext, useContext } from "react";
import type { StaffSession } from "@/features/auth/types";

const SessionContext = createContext<StaffSession | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: StaffSession;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): StaffSession {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
