"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  IconLayoutDashboard,
  IconUsers,
  IconCalendarEvent,
  IconFileText,
  IconCreditCard,
  IconScan,
  IconReportAnalytics,
  IconSettings,
  IconLogout,
  IconUsersGroup,
  IconX,
  IconChevronDown,
  IconChevronRight,
  IconTicket,
} from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";

// Menu structure with categories - organized by workflow
const menuStructure = [
  {
    type: "link",
    href: "/",
    label: "Dashboard",
    icon: IconLayoutDashboard,
  },
  {
    type: "category",
    label: "EVENT MANAGEMENT",
  },
  {
    type: "submenu",
    label: "Events",
    icon: IconCalendarEvent,
    children: [
      { href: "/events", label: "All Events" },
      { href: "/sessions", label: "Sessions" },
      { href: "/speakers", label: "Speakers" },
    ],
  },
  {
    type: "link",
    href: "/abstracts",
    label: "Abstracts",
    icon: IconFileText,
  },
  {
    type: "category",
    label: "FINANCE & TICKETING",
  },
  {
    type: "submenu",
    label: "Tickets",
    icon: IconTicket,
    children: [
      { href: "/tickets", label: "Ticket Types" },
      { href: "/promo-codes", label: "Promo Codes" },
    ],
  },
  {
    type: "link",
    href: "/payments",
    label: "Payments",
    icon: IconCreditCard,
  },
  {
    type: "category",
    label: "ATTENDEE MANAGEMENT",
  },
  {
    type: "submenu",
    label: "Registrations",
    icon: IconUsers,
    children: [
      { href: "/registrations", label: "All Registrations" },
      { href: "/verification", label: "Student Verification" },
    ],
  },
  {
    type: "link",
    href: "/members",
    label: "Members",
    icon: IconUsers,
  },
  {
    type: "category",
    label: "OPERATIONS & REPORTS",
  },
  {
    type: "link",
    href: "/checkin",
    label: "Check-in Scanner",
    icon: IconScan,
  },
  {
    type: "link",
    href: "/reports",
    label: "Reports",
    icon: IconReportAnalytics,
  },
  {
    type: "category",
    label: "SYSTEM ADMINISTRATION",
  },
  {
    type: "link",
    href: "/users",
    label: "Users & Roles",
    icon: IconUsersGroup,
  },
  {
    type: "link",
    href: "/settings",
    label: "Settings",
    icon: IconSettings,
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const { isAdmin, logout, user } = useAuth();

  // Get user role at component level (not inside map callback)
  const role = user?.role;

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  const toggleSubmenu = (label: string) => {
    setExpandedMenus((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );
  };

  const isActiveLink = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const isSubmenuActive = (children: { href: string }[]) => {
    return children.some((child) => isActiveLink(child.href));
  };

  // Filter menu items based on role
  const filteredMenu = menuStructure
    .map((item) => {
      // Admin sees everything
      if (isAdmin) return item;

      // Verifier specific restrictions
      if (role === "verifier") {
        // Only show Verification related items
        if (item.label === "ATTENDEE MANAGEMENT") return item;
        if (item.label === "Registrations" && item.children) {
          return {
            ...item,
            children: item.children.filter(
              (child) => child.href === "/verification",
            ),
          };
        }
        return null;
      }

      // Organizer specific restrictions
      if (role === "organizer") {
        if (item.href === "/members") return item;
        if (item.label === "ATTENDEE MANAGEMENT") return item;

        if (item.label === "Registrations" && item.children) {
          return {
            ...item,
            children: item.children.filter(
              (child) => child.href === "/verification",
            ),
          };
        }
        return null;
      }

      // Reviewer specific restrictions
      if (role === "reviewer") {
        // Only show Abstracts
        if (item.href === "/abstracts") return item;
        return null;
      }

      // Staff specific restrictions
      if (role === "staff") {
        // Only show Check-in Scanner
        if (item.href === "/checkin") return item;
        return null;
      }

      // Non-admin restrictions (existing logic)

      // Hide System Administration category and its links
      if (item.label === "SYSTEM ADMINISTRATION") return null;
      if (item.href === "/users") return null;
      if (item.href === "/settings") return null;

      return item;
    })
    .filter(Boolean);

  return (
    <aside
      className={`
            sidebar fixed inset-y-0 left-0 z-50
            transform transition-transform duration-300 ease-in-out
            lg:translate-x-0
            ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
    >
      {/* Logo */}
      <div className="p-4 lg:p-6 border-b border-slate-700 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3" onClick={onClose}>
          <Image
            src="/logo.png"
            alt="Logo"
            width={40}
            height={40}
            className="w-10 h-auto object-contain"
          />
          <span className="text-white font-bold text-lg">ConferenceHub</span>
        </Link>
        <button
          onClick={onClose}
          className="lg:hidden p-2 hover:bg-slate-700 rounded-lg text-white"
        >
          <IconX size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {filteredMenu.map((item, index) => {
            if (!item) return null;

            // Category header
            if (item.type === "category") {
              return (
                <li key={index} className="px-4 py-2 mt-4 first:mt-0">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {item.label}
                  </span>
                </li>
              );
            }

            // Regular link
            if (item.type === "link" && item.href) {
              const Icon = item.icon!;
              const isActive = isActiveLink(item.href);
              return (
                <li key={index}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`sidebar-link ${isActive ? "active" : ""}`}
                  >
                    <Icon size={20} stroke={1.5} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            }

            // Submenu
            if (item.type === "submenu" && item.children) {
              const Icon = item.icon!;
              const isExpanded = expandedMenus.includes(item.label);
              const isActive = isSubmenuActive(item.children);

              return (
                <li key={index}>
                  <button
                    onClick={() => toggleSubmenu(item.label)}
                    className={`sidebar-link w-full justify-between ${isActive ? "text-white" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={20} stroke={1.5} />
                      <span>{item.label}</span>
                    </div>
                    {isExpanded ? (
                      <IconChevronDown size={16} className="text-slate-400" />
                    ) : (
                      <IconChevronRight size={16} className="text-slate-400" />
                    )}
                  </button>

                  {/* Submenu items */}
                  <ul
                    className={`
                                        overflow-hidden transition-all duration-200
                                        ${isExpanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}
                                    `}
                  >
                    {item.children.map((child, childIndex) => {
                      const isChildActive = isActiveLink(child.href);
                      return (
                        <li key={childIndex}>
                          <Link
                            href={child.href}
                            onClick={onClose}
                            className={`
                                                            flex items-center gap-3 px-4 py-2 pl-12
                                                            text-sm transition-colors
                                                            ${isChildActive
                                ? "text-white bg-slate-700/50"
                                : "text-slate-400 hover:text-white hover:bg-slate-700/30"
                              }
                                                        `}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${isChildActive ? "bg-blue-400" : "bg-slate-500"}`}
                            />
                            {child.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            }

            return null;
          })}
        </ul>
      </nav>

      {/* Logout - Sticky at bottom */}
      <div className="p-4 border-t border-slate-700 bg-slate-800 mt-auto">
        <button
          onClick={handleLogout}
          className="sidebar-link w-full text-red-400 hover:bg-red-900/30"
        >
          <IconLogout size={20} stroke={1.5} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
