import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CAN Reports",
  description: "CAN Financial Solutions - Client Registration Reports",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
