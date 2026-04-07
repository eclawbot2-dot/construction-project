import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#1e3a5f",
};

export const metadata: Metadata = {
  title: "Holy Face Church — Faith Formation",
  description: "Catechist Management Platform for Holy Face Church, Great Mills MD",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Holy Face",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
