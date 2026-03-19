import type { Metadata } from "next";
import "./globals.css";
import { AdminShell } from "@/components/layout/AdminShell";

export const metadata: Metadata = {
  title: "Partnr Execution OS",
  description: "Leadership task tracking and follow-through system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
