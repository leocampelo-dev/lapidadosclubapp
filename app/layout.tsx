import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lapidados Club",
  description: "Plataforma de nutrição esportiva e acompanhamento de pacientes",
  manifest: "/manifest.json",
  themeColor: "#E85D04",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lapidados Club",
  },
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
