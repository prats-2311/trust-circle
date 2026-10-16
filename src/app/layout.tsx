import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-atkinson",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trust Circle",
  description: "Scammers pretend to be someone you trust. So we ask that person.",
};

export const viewport: Viewport = { themeColor: "#f4f6f4" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={atkinson.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
