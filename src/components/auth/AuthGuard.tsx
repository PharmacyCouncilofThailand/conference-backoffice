"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface AuthGuardProps {
  children: React.ReactNode;
}

// Pages that don't require authentication
const publicPaths = ["/login"];

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, isLoading, hasAccess } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading) {
      const isPublicPath = publicPaths.includes(pathname);

      if (!user && !isPublicPath) {
        // Not logged in and trying to access protected page
        router.replace("/login");
      } else if (user && isPublicPath) {
        // Already logged in but on login page
        if (user.role === "verifier") {
          router.replace("/verification");
        } else if (user.role === "reviewer") {
          router.replace("/abstracts");
        } else if (user.role === "organizer") {
          router.replace("/members");
        } else if (user.role === "staff") {
          router.replace("/checkin");
        } else {
          router.replace("/");
        }
      } else if (user && !hasAccess(pathname)) {
        // Logged in but no access to this page
        if (user.role === "verifier") {
          router.replace("/verification");
        } else if (user.role === "reviewer") {
          router.replace("/abstracts");
        } else if (user.role === "organizer") {
          router.replace("/members");
        } else if (user.role === "staff") {
          router.replace("/checkin");
        } else {
          router.replace("/"); // Or 403 page
        }
      }
    }
  }, [user, isLoading, pathname, router, hasAccess]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If not logged in and not on public path, show nothing while redirecting
  if (!user && !publicPaths.includes(pathname)) {
    return null;
  }

  return <>{children}</>;
}
