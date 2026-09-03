import { NextRequest } from "next/server";
import { enviarPush, listarSubs } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Envía una notificación de prueba a un dispositivo (por endpoint). */
export async function POST(request: NextRequest) {
  let endpoint: string | undefined;
  try {
    const body = await request.json();
    endpoint = body.endpoint;
  } catch {
    /* ignore */
  }
  if (!endpoint) {
    return Response.json({ error: "Falta endpoint" }, { status: 400 });
  }

  const reg = (await listarSubs()).find((r) => r.endpoint === endpoint);
  if (!reg) {
    return Response.json(
      { error: "Este dispositivo no está suscrito" },
      { status: 404 },
    );
  }

  const res = await enviarPush(reg, {
    title: "Prueba de avisos de calor",
    body: "Los avisos con la app cerrada quedaron activados en este dispositivo.",
    tag: "clima-push",
    url: "/calor",
  });

  return Response.json({ resultado: res }, { status: res === "ok" ? 200 : 502 });
}
