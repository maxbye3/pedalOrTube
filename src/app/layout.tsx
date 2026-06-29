import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bike + Metro DC",
  description:
    "Multimodal journey planner for Washington, DC — intelligently combining cycling with Metro transit.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Bike + Metro DC",
    description: "Find the perfect balance between biking and Metro for your DC commute.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#003688",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
