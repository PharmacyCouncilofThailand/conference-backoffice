import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ToastProvider } from "@/components/common/ToastProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ConferenceHub Backoffice",
  description: "Conference Management System - Backoffice",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          <AuthGuard>
            {children}
          </AuthGuard>
          <ToastProvider />
        </AuthProvider>
      </body>
    </html>
  );
}

