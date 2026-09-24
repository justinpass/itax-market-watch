import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ITAX Market Watch",
  description: "International tax intelligence dashboard for business",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
