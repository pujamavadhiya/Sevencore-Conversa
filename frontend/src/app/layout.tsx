import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { BRANDING } from "@/lib/branding";

export const metadata: Metadata = {
  title: `${BRANDING.name} - ${BRANDING.tagline}`,
  description: BRANDING.positioning,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          <Sidebar />
          <div className="main-content">
            <Header />
            <main className="page-body">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
