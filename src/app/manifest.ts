import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Calor Caribe · calor y consumo de energía",
    short_name: "Calor Caribe",
    description:
      "Monitor de sensación térmica por municipio de la costa Caribe, alertas por comorbilidades y control de la factura de luz.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0e4d64",
    theme_color: "#0e4d64",
    lang: "es-CO",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
