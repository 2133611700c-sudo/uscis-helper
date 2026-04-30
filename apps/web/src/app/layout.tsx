import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "USCIS Helper",
  description: "Immigration document help for Ukrainians in the US",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
