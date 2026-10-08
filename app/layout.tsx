import "./globals.css";
import ClientFixes from "./client-fixes";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Progresso Acha",
  description: "Prospecção inteligente, CRM e vendas."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><ClientFixes />{children}</body></html>;
}
