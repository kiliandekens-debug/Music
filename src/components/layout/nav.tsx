import {
  IconCalendar,
  IconChart,
  IconLabel,
  IconMore,
  IconRelease,
  IconSession,
  IconSettings,
  IconStudio,
  IconToday,
} from "@/components/ui/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: (props: { size?: number; className?: string }) => React.ReactElement;
}

/** Navigation principale, dans l'ordre défini pour l'application. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/aujourdhui", label: "Aujourd'hui", icon: IconToday },
  { href: "/studio", label: "Studio", icon: IconStudio },
  { href: "/sessions", label: "Sessions", icon: IconSession },
  { href: "/releases", label: "Releases", icon: IconRelease },
  { href: "/labels", label: "Labels", icon: IconLabel },
  { href: "/calendrier", label: "Calendrier", icon: IconCalendar },
  { href: "/analyses", label: "Analyses", icon: IconChart },
  { href: "/parametres", label: "Paramètres", icon: IconSettings },
];

/** Navigation inférieure sur mobile : quatre sections + « Plus ». */
export const MOBILE_NAV_ITEMS: NavItem[] = [
  { href: "/aujourdhui", label: "Aujourd'hui", icon: IconToday },
  { href: "/studio", label: "Studio", icon: IconStudio },
  { href: "/releases", label: "Releases", icon: IconRelease },
  { href: "/labels", label: "Labels", icon: IconLabel },
  { href: "/plus", label: "Plus", icon: IconMore },
];

/** Sections regroupées derrière « Plus » sur mobile. */
export const MORE_ITEMS: NavItem[] = NAV_ITEMS.filter(
  (item) => !MOBILE_NAV_ITEMS.some((m) => m.href === item.href),
);
