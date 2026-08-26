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
  IconUserCheck,
  IconReportAnalytics,
  IconSettings,
  IconLogout,
  IconUsersGroup,
  IconX,
  IconChevronDown,
  IconTicket,
  IconMailForward,
  IconMailBolt,
  IconBriefcase,
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
    href: "/sponsors",
    label: "Sponsor Hub",
    icon: IconBriefcase,
  },
  {
    type: "submenu",
    label: "Abstracts",
    icon: IconFileText,
    children: [
      { href: "/abstracts", label: "All Abstracts" },
      { href: "/abstract-categories", label: "Categories" },
    ],
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
      { href: "/student-eligibility", label: "Postgrad Eligibility" },
    ],
  },
  {
    type: "link",
    href: "/members",
    label: "Members",
    icon: IconUsers,
  },
  {
    type: "link",
    href: "/team-registrations",
    label: "Team Registrations",
    icon: IconUsersGroup,
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
    href: "/checkins",
    label: "Checked-in List",
    icon: IconUserCheck,
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
    href: "/email-retrosend",
    label: "Email Retrosend",
    icon: IconMailForward,
  },
  {
    type: "link",
    href: "/email-manual",
    label: "Manual Email",
    icon: IconMailBolt,
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

      // Sponsor Hub is admin-only.
      if (item.href === "/sponsors") return null;

      if (role === "team_registration_viewer") {
        if (item.href === "/team-registrations") return item;
        return null;
      }

      // Verifier specific restrictions
      if (role === "verifier") {
        // Only show Verification related items
        if (item.label === "ATTENDEE MANAGEMENT") return item;
        if (item.label === "Registrations" && item.children) {
          return {
            ...item,
            children: item.children.filter(
              (child) => child.href === "/verification" || child.href === "/student-eligibility",
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
              (child) => child.href === "/registrations" || child.href === "/verification",
            ),
          };
        }
        if (item.label === "Abstracts" && item.children) {
          return {
            ...item,
            children: item.children.filter((child) => child.href === "/abstracts"),
          };
        }
        return null;
      }

      // Reviewer specific restrictions
      if (role === "reviewer") {
        // Only show Abstracts submenu
        if (item.label === "Abstracts" && item.children) {
          return {
            ...item,
            children: item.children.filter((child) => child.href === "/abstracts"),
          };
        }
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
      if (item.href === "/email-retrosend") return null;
      if (item.href === "/email-manual") return null;
      if (item.href === "/settings") return null;

      return item;
    })
    .filter(Boolean);

  return (
    <aside
      className={`
        sidebar
        transform transition-transform duration-300 ease-out
        lg:translate-x-0
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
      `}
    >
      {/* Brand */}
      <div className="flex items-center justify-between px-5 h-16 shrink-0">
        <Link href="/" className="flex items-center gap-2.5" onClick={onClose}>
          <Image src="/logo.png" alt="Logo" width={28} height={28} className="w-7 h-auto" />
          <span className="text-white font-bold text-sm tracking-tight">ConferenceHub</span>
        </Link>
        <button onClick={onClose} className="lg:hidden p-1.5 hover:bg-white/10 rounded-lg text-zinc-500">
          <IconX size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <ul className="space-y-0.5">
          {filteredMenu.map((item, index) => {
            if (!item) return null;

            if (item.type === "category") {
              return (
                <li key={index} className="px-5 pt-6 pb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-600">
                    {item.label}
                  </span>
                </li>
              );
            }

            if (item.type === "link" && item.href) {
              const Icon = item.icon!;
              const isActive = isActiveLink(item.href);
              return (
                <li key={index} className="relative">
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`sidebar-link ${isActive ? "active" : ""}`}
                  >
                    <Icon size={18} stroke={1.5} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            }

            if (item.type === "submenu" && item.children) {
              const Icon = item.icon!;
              const isExpanded = expandedMenus.includes(item.label);
              const isActive = isSubmenuActive(item.children);

              return (
                <li key={index}>
                  <button
                    onClick={() => toggleSubmenu(item.label)}
                    className={`sidebar-link w-full justify-between ${isActive ? "!text-white" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} stroke={1.5} />
                      <span>{item.label}</span>
                    </div>
                    <IconChevronDown
                      size={14}
                      className={`text-zinc-600 transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"}`}
                    />
                  </button>

                  <ul
                    className={`overflow-hidden transition-all duration-200 ease-out ${isExpanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}
                  >
                    {item.children.map((child, childIndex) => {
                      const isChildActive = isActiveLink(child.href);
                      return (
                        <li key={childIndex}>
                          <Link
                            href={child.href}
                            onClick={onClose}
                            className={`
                              flex items-center gap-2.5 text-[13px] font-medium
                              py-1.5 pl-14 pr-4 mx-2.5 rounded-md transition-colors duration-150
                              ${isChildActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"}
                            `}
                          >
                            <span className={`w-1 h-1 rounded-full shrink-0 ${isChildActive ? "bg-emerald-400" : "bg-zinc-700"}`} />
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

      {/* Logout */}
      <div className="p-2.5 border-t border-zinc-800/80 shrink-0">
        <button
          onClick={handleLogout}
          className="sidebar-link w-full !text-zinc-500 hover:!text-red-400 hover:!bg-red-500/10"
        >
          <IconLogout size={18} stroke={1.5} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
