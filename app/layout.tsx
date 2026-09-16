import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Encodr — Media Encoding Workspace",
  description: "Submit media, monitor live encoding progress, and review ready-to-ship renditions.",
  applicationName: "Encodr",
  keywords: ["media encoding", "transcoding", "video", "SSE", "encode jobs"],
  icons: {
    icon: "/encodr-icon.svg",
    shortcut: "/encodr-icon.svg",
    apple: "/encodr-icon.svg",
  },
  openGraph: {
    title: "Encodr — Media Encoding Workspace",
    description: "Submit media, watch live processing, and review output renditions.",
    type: "website",
    siteName: "Encodr",
  },
  twitter: {
    card: "summary",
    title: "Encodr — Media Encoding Workspace",
    description: "A focused media encoding workspace with live progress.",
  },
};

export const viewport: Viewport = {
  themeColor: "#070708",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
