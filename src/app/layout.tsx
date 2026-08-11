import type { Metadata, Viewport } from "next";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { ToastProvider } from "@/components/ui/toast";
import { ServiceWorker } from "@/components/pwa/service-worker";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Gestionnaire de production musicale : pipeline de tracks, sessions de studio, suivi des labels, promotion et résultats de sortie.",
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
  themeColor: "#08080a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh bg-canvas text-ink antialiased">
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
