"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

// User roles
export type UserRole =
  | "admin"
  | "organizer"
  | "reviewer"
  | "staff"
  | "verifier";

// Event assignment
export interface AssignedEvent {
  id: number;
  code: string;
  name: string;
}

// Session assignment (for staff check-in)
export interface AssignedSession {
  eventId: number;
  sessionId: number;
  sessionName: string;
  sessionType: string | null;
  room: string | null;
  startTime: string;
  endTime: string;
}

// User interface
export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  assignedEvents: AssignedEvent[];
  assignedSessions?: AssignedSession[]; // For staff/verifier: sessions they can check-in
  assignedCategories?: string[]; // For reviewers: abstract categories they can review
  assignedPresentationTypes?: string[]; // For reviewers: presentation types they can review
}

// Auth context type
interface AuthContextType {
  user: User | null;
  token: string | null;
  isAdmin: boolean;
  isLoading: boolean;
  canAccessEvent: (eventId: number) => boolean;
  getAccessibleEventIds: () => number[];
  currentEvent: AssignedEvent | null;
  setCurrentEvent: (event: AssignedEvent | null) => void;
  login: (user: User, token: string, rememberMe?: boolean) => void;
  logout: () => void;
  hasAccess: (page: string) => boolean;
}

// Role-based page access
const rolePageAccess: Record<UserRole, string[]> = {
  admin: ["*"], // All pages
  organizer: ["/reports", "/members", "/verification"],
  reviewer: ["/abstracts"],
  staff: ["/checkin"],
  verifier: ["/verification"],
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_UNAUTHORIZED_EVENT = "accp-backoffice-auth:unauthorized";

function clearStoredAuth() {
  localStorage.removeItem("backoffice_token");
  localStorage.removeItem("backoffice_user");
  sessionStorage.removeItem("backoffice_token");
  sessionStorage.removeItem("backoffice_user");
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [currentEvent, setCurrentEvent] = useState<AssignedEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const resetAuthState = () => {
    setUser(null);
    setToken(null);
    setCurrentEvent(null);
    clearStoredAuth();
  };

  // Load user from storage on mount (check both localStorage and sessionStorage)
  useEffect(() => {
    const localToken = localStorage.getItem("backoffice_token");
    const localUser = localStorage.getItem("backoffice_user");
    const sessionToken = sessionStorage.getItem("backoffice_token");
    const sessionUser = sessionStorage.getItem("backoffice_user");

    let storedToken: string | null = null;
    let storedUser: string | null = null;
    let shouldSkipRestore = false;

    // Prefer complete localStorage session first (remember me), then sessionStorage
    if (localToken && localUser) {
      storedToken = localToken;
      storedUser = localUser;
    } else if (sessionToken && sessionUser) {
      storedToken = sessionToken;
      storedUser = sessionUser;
    }

    // Incomplete persisted auth should be cleared to avoid ghost state
    if (
      !storedToken &&
      !storedUser &&
      (localToken || localUser || sessionToken || sessionUser)
    ) {
      clearStoredAuth();
      shouldSkipRestore = true;
    }

    // Clear expired token before restoring auth state
    if (!shouldSkipRestore && storedToken && isTokenExpired(storedToken)) {
      clearStoredAuth();
      shouldSkipRestore = true;
    }

    if (!shouldSkipRestore && storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setToken(storedToken);

        // Auto-select first event for non-admin
        if (
          parsedUser.role !== "admin" &&
          parsedUser.assignedEvents?.length > 0
        ) {
          setCurrentEvent(parsedUser.assignedEvents[0]);
        }
      } catch {
        clearStoredAuth();
      }
    } else if (!shouldSkipRestore && (storedToken || storedUser)) {
      clearStoredAuth();
    }

    setIsLoading(false);
  }, []);

  // Auto-clear auth state if token expires during active session
  useEffect(() => {
    if (!token) return;

    if (isTokenExpired(token)) {
      resetAuthState();
    }
  }, [token]);

  // Centralized 401 handling from API client
  useEffect(() => {
    const handleUnauthorized = () => {
      resetAuthState();
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);

    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, []);

  const isAdmin = user?.role === "admin";

  const canAccessEvent = (eventId: number): boolean => {
    if (!user) return false;
    if (isAdmin) return true;
    return user.assignedEvents.some((e) => e.id === eventId);
  };

  const getAccessibleEventIds = (): number[] => {
    if (!user) return [];
    if (isAdmin) return [];
    return user.assignedEvents.map((e) => e.id);
  };

  const hasAccess = (page: string): boolean => {
    if (!user) return false;
    const allowedPages = rolePageAccess[user.role];
    if (allowedPages.includes("*")) return true;
    return allowedPages.some((p) => page.startsWith(p));
  };

  const login = (
    newUser: User,
    newToken: string,
    rememberMe: boolean = true,
  ) => {
    setUser(newUser);
    setToken(newToken);

    // Use localStorage for "remember me", sessionStorage otherwise
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem("backoffice_token", newToken);
    storage.setItem("backoffice_user", JSON.stringify(newUser));

    // Clear the other storage to avoid conflicts
    const otherStorage = rememberMe ? sessionStorage : localStorage;
    otherStorage.removeItem("backoffice_token");
    otherStorage.removeItem("backoffice_user");

    if (newUser.role !== "admin" && newUser.assignedEvents.length > 0) {
      setCurrentEvent(newUser.assignedEvents[0]);
    } else {
      setCurrentEvent(null);
    }
  };

  const logout = () => {
    resetAuthState();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAdmin,
        isLoading,
        canAccessEvent,
        getAccessibleEventIds,
        currentEvent,
        setCurrentEvent,
        login,
        logout,
        hasAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
