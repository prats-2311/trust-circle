import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trust Circle",
    short_name: "Trust Circle",
    description: "Scammers pretend to be someone you trust. So we ask that person.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#F4F6F4",
    theme_color: "#1E5A47",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
