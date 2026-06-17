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

function cleanPathname(pathname: string) {
  return pathname.split(/[?#]/)[0] || "/";
}

export function getActivePublicNavigationHref(pathname: string) {
  const currentPathname = cleanPathname(pathname);

  if (currentPathname === "/") {
    return "/";
  }

  if (currentPathname === "/reports" || currentPathname.startsWith("/reports/")) {
    return "/reports";
  }

  return null;
}

export function getActiveHeaderActionHref(pathname: string) {
  const currentPathname = cleanPathname(pathname);

  if (currentPathname === "/report" || currentPathname.startsWith("/report/")) {
    return "/report/new";
  }

  if (currentPathname === "/me" || currentPathname.startsWith("/me/")) {
    return "/me/profile";
  }

  if (currentPathname === "/login") {
    return "/login";
  }

  return null;
}

export function getActiveMobileNavigationHref(pathname: string) {
  const currentPathname = cleanPathname(pathname);
  const publicHref = getActivePublicNavigationHref(currentPathname);

  if (publicHref) {
    return publicHref;
  }

  if (currentPathname === "/report" || currentPathname.startsWith("/report/")) {
    return "/report/new";
  }

  if (currentPathname === "/me" || currentPathname.startsWith("/me/")) {
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
