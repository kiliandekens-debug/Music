import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { ToastProvider } from "@/components/ui/toast";
import { ServiceWorker } from "@/components/pwa/service-worker";
import "./globals.css";

/*
 * Trois voix, trois rôles.
 *
 * Archivo, grotesque industrielle, porte les titres : de la présence aux
 * grandes tailles, comme sur une pochette. Plex Sans tient l'interface, Plex
 * Mono affiche les données — BPM, tonalité, pourcentages, comptes à rebours.
 * Les deux Plex sont dessinés ensemble : les chiffres ont l'air d'appartenir à
 * l'interface plutôt que d'y être collés.
 */
const display = Archivo({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans-loaded",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Gestionnaire de production musicale : avancement des tracks, envois aux labels et préparation des sorties.",
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "black-translucent",
  },
  // L'icône d'onglet et l'icône iOS viennent des fichiers src/app/icon.png et
  // src/app/apple-icon.png (convention Next.js). Les icônes d'installation
  // sont déclarées dans public/manifest.webmanifest.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0a0f",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-canvas text-ink antialiased">
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
