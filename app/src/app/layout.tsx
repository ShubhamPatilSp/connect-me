import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./ui.css";

export const metadata: Metadata = {
  title: "Connect Me — Meet people nearby",
  description:
    "Connect Me helps you meet real people nearby, wherever you are.",
  applicationName: "Connect Me",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
