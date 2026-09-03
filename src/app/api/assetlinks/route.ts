/**
 * Digital Asset Links. Se sirve en /.well-known/assetlinks.json (ver el rewrite
 * en next.config.ts). Vincula la app de Android (TWA) con este dominio para que
 * abra a pantalla completa, sin la barra de direcciones.
 *
 * Variables de entorno:
 *  - ANDROID_PACKAGE_NAME        p. ej. "app.calorcaribe.twa"
 *  - ANDROID_CERT_FINGERPRINTS   huellas SHA-256 separadas por coma
 *                                (las imprime Bubblewrap / PWABuilder / Play Console)
 */

export const dynamic = "force-static";

export function GET() {
  const pkg = process.env.ANDROID_PACKAGE_NAME || "app.calorcaribe.twa";
  const fingerprints = (process.env.ANDROID_CERT_FINGERPRINTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return Response.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: pkg,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]);
}
