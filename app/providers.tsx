'use client';

import { type ReactNode } from "react";

import { SettingsProvider } from "../hooks/use-settings";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return <SettingsProvider>{children}</SettingsProvider>;
}
