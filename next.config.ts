import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // web-push es CommonJS y usa APIs de Node: no debe empaquetarse.
  serverExternalPackages: ["web-push"],

  // Digital Asset Links para la app de Android (TWA): enlaza el .apk con el sitio
  // para que se abra a pantalla completa sin barra del navegador.
  async rewrites() {
    return [
      {
        source: "/.well-known/assetlinks.json",
        destination: "/api/assetlinks",
      },
    ];
  },
};

export default nextConfig;
