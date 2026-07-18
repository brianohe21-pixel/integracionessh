"use client";

import { createContext, useContext } from "react";

type RealtimeContextValue = {
  connected: boolean;
};

const RealtimeContext = createContext<RealtimeContextValue>({ connected: false });

export function RealtimeProvider({
  connected,
  children,
}: {
  connected: boolean;
  children: React.ReactNode;
}) {
  return (
    <RealtimeContext.Provider value={{ connected }}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtimeConnection() {
  return useContext(RealtimeContext);
}
