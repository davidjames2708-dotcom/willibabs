import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Priscilla Webmail",
  description: "A professional webmail workspace for client communication."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
