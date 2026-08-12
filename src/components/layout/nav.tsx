import { IconLabel, IconRelease, IconStudio } from "@/components/ui/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: (props: { size?: number; className?: string }) => React.ReactElement;
}

/**
 * Navigation principale : trois destinations, pas une de plus.
 * Studio pour avancer les tracks, Labels pour les envois, Promotion pour les
 * sorties. Les paramètres restent accessibles par une icône discrète en bas de
 * la barre latérale, ils ne sont pas une destination de travail.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/studio", label: "Studio", icon: IconStudio },
  { href: "/labels", label: "Labels", icon: IconLabel },
  { href: "/promotion", label: "Promotion", icon: IconRelease },
];
