import React, { createContext, useContext } from "react";

export interface MobileMenuDrawerControls {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const MobileMenuDrawerContext = createContext<MobileMenuDrawerControls | null>(null);

export interface MobileMenuDrawerProviderProps {
  value: MobileMenuDrawerControls;
  children: React.ReactNode;
}

export function MobileMenuDrawerProvider({
  value,
  children,
}: MobileMenuDrawerProviderProps) {
  return (
    <MobileMenuDrawerContext.Provider value={value}>
      {children}
    </MobileMenuDrawerContext.Provider>
  );
}

export function useMobileMenuDrawer(): MobileMenuDrawerControls | null {
  return useContext(MobileMenuDrawerContext);
}
