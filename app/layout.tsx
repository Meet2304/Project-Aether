import type { Metadata, Viewport } from "next";
import { Archivo, Space_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-archivo",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aether — Trick Recorder",
  description:
    "Mobile-first skateboard trick recording. Record, clip, label and upload.",
  applicationName: "Aether",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Aether",
  },
};

export const viewport: Viewport = {
  themeColor: "#fafafa",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${archivo.variable} ${spaceMono.variable}`}>
      <body className="grain min-h-[100dvh] bg-background font-sans text-foreground antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
