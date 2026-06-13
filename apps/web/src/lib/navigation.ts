import {
  IconClipboardList,
  IconHome,
  IconSearch,
  IconUser,
} from "@tabler/icons-react";

export const publicNavigation = [
  { href: "/", label: "Beranda" },
  { href: "/reports", label: "Laporan" },
] as const;

export const mobileNavigation = [
  { href: "/", label: "Home", icon: IconHome },
  { href: "/reports", label: "Cari", icon: IconSearch },
  { href: "/report/new", label: "Lapor", icon: IconClipboardList },
  { href: "/me/reports", label: "Saya", icon: IconUser },
] as const;

export const placeholderRoutes = [
  "/reports",
  "/reports/[id]",
  "/report/new",
  "/login",
  "/me/reports",
  "/me/claims",
  "/admin",
] as const;
