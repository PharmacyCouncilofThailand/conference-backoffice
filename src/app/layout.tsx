import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ToastProvider } from "@/components/common/ToastProvider";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
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
      <body className={`${outfit.variable} font-sans antialiased`}>
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

