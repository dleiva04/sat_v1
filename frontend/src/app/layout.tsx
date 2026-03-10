import type { Metadata } from "next";
import { ThemeInit } from "../../.flowbite-react/init";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAT",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <body className="h-screen overflow-hidden bg-gray-50 text-gray-900 antialiased">
        <ThemeInit />
        {children}
      </body>
    </html>
  );
}
