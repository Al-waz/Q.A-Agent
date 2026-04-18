"use client";

import type { ReactNode } from "react";
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps & { children: ReactNode }): JSX.Element {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
