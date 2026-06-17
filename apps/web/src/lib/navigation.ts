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

export function getActiveMobileNavigationHref(pathname: string) {
  const cleanPathname = pathname.split(/[?#]/)[0] || "/";

  if (cleanPathname === "/") {
    return "/";
  }

  if (cleanPathname === "/reports" || cleanPathname.startsWith("/reports/")) {
    return "/reports";
  }

  if (cleanPathname === "/report" || cleanPathname.startsWith("/report/")) {
    return "/report/new";
  }

  if (cleanPathname === "/me" || cleanPathname.startsWith("/me/")) {
    return "/me/reports";
  }

  return null;
}

export const placeholderRoutes = [
  "/reports",
  "/reports/[id]",
  "/report/new",
  "/login",
  "/me/reports",
  "/me/claims",
  "/admin",
] as const;
