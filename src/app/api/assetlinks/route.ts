/**
 * Digital Asset Links. Se sirve en /.well-known/assetlinks.json (ver el rewrite
 * en next.config.ts). Vincula la app de Android (TWA) con este dominio para que
 * abra a pantalla completa, sin la barra de direcciones.
 *
 * Los valores por defecto corresponden al paquete generado con PWABuilder
 * ("Calor Caribe - Google Play package"). El certificado SHA-256 es información
 * pública. Si regeneras el .apk con OTRA clave (otro signing.keystore), cambia
 * `HUELLA_POR_DEFECTO` o define la variable de entorno ANDROID_CERT_FINGERPRINTS.
 * Con Play App Signing, añade también la huella que muestra la Play Console.
 */

export const dynamic = "force-static";

const PAQUETE_POR_DEFECTO = "app.vercel.calor_caribe.twa";
const HUELLA_POR_DEFECTO =
  "71:15:FC:BE:79:05:DC:5F:F3:EF:E7:1C:40:51:7D:97:30:28:6F:E2:51:D9:2B:44:E7:FB:DC:59:CB:E6:A8:E5";

export function GET() {
  const pkg = process.env.ANDROID_PACKAGE_NAME || PAQUETE_POR_DEFECTO;
  const fingerprints = (
    process.env.ANDROID_CERT_FINGERPRINTS || HUELLA_POR_DEFECTO
  )
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
