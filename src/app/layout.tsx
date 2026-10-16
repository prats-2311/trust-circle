import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "./ServiceWorker";

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
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only rounded-control bg-evergreen px-5 py-3 text-[18px] font-bold text-white no-underline focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
        >
          Skip to main content
        </a>
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}
