import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PwaSetup from "@/components/PwaSetup";
import InstallPrompt from "@/components/InstallPrompt";
import TerminosGate from "@/components/TerminosGate";
import { AppStateProvider } from "@/lib/store";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Calor Caribe · monitor de sensación térmica y consumo de energía",
    template: "%s · Calor Caribe",
  },
  description:
    "Monitorea la sensación térmica por municipio de la costa Caribe durante El Niño, recibe alertas según tus comorbilidades, calcula tu factura de luz y planifica el uso de electrodomésticos para no pasar de la meta de consumo.",
  applicationName: "Calor Caribe",
  appleWebApp: {
    capable: true,
    title: "Calor Caribe",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e4d64",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppStateProvider>
          <PwaSetup />
          <Header />
          <InstallPrompt />
          <main className="flex-1 flex flex-col">{children}</main>
          <Footer />
          <TerminosGate />
        </AppStateProvider>
      </body>
    </html>
  );
}
