import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arkana Agora",
  description: "Tarot, Lenormand, numerologia e astrologia com IA — social vertical",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}