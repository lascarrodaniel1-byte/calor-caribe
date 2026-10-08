// Mesa multijugador: un servidor web al que los jugadores se conectan desde el
// navegador. Uso: npm run servidor [-- --nueva]   (PORT y DM_CLAVE opcionales)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cargar, guardar } from "./archivo.js";
import { fichaTexto, nuevaPartida } from "./estado.js";
import { comando, MENSAJE_NUEVA, MENSAJE_REANUDAR, MODELO, RUTA, turno, type Salida } from "./motor.js";

const PUERTO = Number(process.env.PORT ?? 8080);
const CLAVE = process.env.DM_CLAVE ?? "";
const aqui = dirname(fileURLToPath(import.meta.url));
const PAGINA = join(aqui, "..", "web", "index.html");
const RUTA_REGISTRO = RUTA.replace(/\.json$/, "") + "-registro.json";
const MAX_REGISTRO = 600;

/** Lo que se ve en la mesa. Se guarda para que quien entre tarde vea lo que pasó. */
type Evento =
  | { t: "dm"; texto: string }
  | { t: "aviso"; texto: string }
  | { t: "info"; texto: string }
  | { t: "jugador"; nombre: string; texto: string }
  | { t: "sistema"; texto: string };

const nueva = process.argv.includes("--nueva");
let partida = !nueva ? cargar(RUTA) : null;
const reanudada = partida !== null && partida.historial.length > 0;
partida ??= nuevaPartida();
const mesa = partida;

let registro: Evento[] = [];
if (reanudada && existsSync(RUTA_REGISTRO)) {
  try {
    registro = JSON.parse(readFileSync(RUTA_REGISTRO, "utf8")) as Evento[];
  } catch {
    registro = [];
  }
}
const guardarRegistro = () => writeFileSync(RUTA_REGISTRO, JSON.stringify(registro.slice(-MAX_REGISTRO)));

// ---------------------------------------------------------------- conexiones

interface Conexion {
  res: ServerResponse;
  nombre: string;
}
const conexiones = new Set<Conexion>();
let ocupado = false;
const pendientes: { nombre: string; texto: string }[] = [];

function enviar(c: Conexion, datos: unknown) {
  c.res.write(`data: ${JSON.stringify(datos)}\n\n`);
}

function difundir(datos: unknown) {
  for (const c of conexiones) enviar(c, datos);
}

function jugadores() {
  return [...new Set([...conexiones].map((c) => c.nombre))];
}

function difundirEstado() {
  difundir({ t: "estado", ocupado, jugadores: jugadores(), esperando: pendientes.length });
}

function anotar(e: Evento) {
  registro.push(e);
  if (registro.length > MAX_REGISTRO) registro = registro.slice(-MAX_REGISTRO);
  difundir(e);
}

function salidaMesa(): Salida {
  let narrando = false;
  return {
    texto(delta) {
      if (!narrando) {
        narrando = true;
        registro.push({ t: "dm", texto: "" });
        difundir({ t: "dm_inicio" });
      }
      const ultimo = [...registro].reverse().find((e) => e.t === "dm") as { t: "dm"; texto: string };
      ultimo.texto += delta;
      difundir({ t: "dm_delta", d: delta });
    },
    aviso(texto) {
      narrando = false;
      anotar({ t: "aviso", texto });
      difundir({ t: "fichas" });
    },
    info(texto) {
      narrando = false;
      anotar({ t: "info", texto });
    },
  };
}

async function procesar() {
  if (ocupado) return;
  while (pendientes.length) {
    const lote = pendientes.splice(0);
    const texto = lote.map((p) => `${p.nombre}: ${p.texto}`).join("\n");
    ocupado = true;
    difundirEstado();
    try {
      await turno(mesa, texto, salidaMesa());
    } catch (err) {
      anotar({ t: "info", texto: `Error inesperado: ${(err as Error).message}` });
    }
    ocupado = false;
    guardarRegistro();
    difundir({ t: "fichas" });
    difundirEstado();
  }
}

async function turnoInicial() {
  ocupado = true;
  try {
    await turno(mesa, reanudada ? MENSAJE_REANUDAR : MENSAJE_NUEVA, salidaMesa());
  } catch (err) {
    anotar({ t: "info", texto: `Error inesperado: ${(err as Error).message}` });
  }
  ocupado = false;
  guardarRegistro();
  difundirEstado();
  void procesar();
}

// ---------------------------------------------------------------- HTTP

function autorizado(url: URL, req: IncomingMessage) {
  if (!CLAVE) return true;
  return url.searchParams.get("clave") === CLAVE || req.headers["x-clave"] === CLAVE;
}

function json(res: ServerResponse, estado: number, datos: unknown) {
  res.writeHead(estado, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(datos));
}

function leerCuerpo(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let cuerpo = "";
    req.on("data", (trozo) => {
      cuerpo += trozo;
      if (cuerpo.length > 10_000) {
        reject(new Error("Mensaje demasiado largo"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(cuerpo));
    req.on("error", reject);
  });
}

const limpiarNombre = (n: string | null) => (n ?? "").replace(/[\r\n:]/g, " ").trim().slice(0, 30);

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(readFileSync(PAGINA));
    return;
  }

  if (!autorizado(url, req)) return json(res, 401, { error: "Clave incorrecta" });

  if (req.method === "GET" && url.pathname === "/eventos") {
    const nombre = limpiarNombre(url.searchParams.get("nombre"));
    if (!nombre) return json(res, 400, { error: "Falta el nombre" });
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    const c: Conexion = { res, nombre };
    const yaEstaba = jugadores().includes(nombre);
    conexiones.add(c);
    enviar(c, { t: "historia", eventos: registro });
    if (!yaEstaba) anotar({ t: "sistema", texto: `${nombre} se sienta a la mesa.` });
    difundirEstado();
    const latido = setInterval(() => res.write(": latido\n\n"), 25_000);
    req.on("close", () => {
      clearInterval(latido);
      conexiones.delete(c);
      if (!jugadores().includes(nombre)) anotar({ t: "sistema", texto: `${nombre} se levanta de la mesa.` });
      difundirEstado();
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/fichas") {
    return json(res, 200, { fichas: Object.values(mesa.personajes).map((p) => ({ nombre: p.nombre, jugador: p.jugador ?? "", texto: fichaTexto(p) })) });
  }

  if (req.method === "POST" && url.pathname === "/accion") {
    let datos: { nombre?: string; texto?: string };
    try {
      datos = JSON.parse(await leerCuerpo(req));
    } catch {
      return json(res, 400, { error: "Petición no válida" });
    }
    const nombre = limpiarNombre(datos.nombre ?? null);
    const texto = (datos.texto ?? "").trim().slice(0, 2000);
    if (!nombre || !texto) return json(res, 400, { error: "Faltan el nombre o el texto" });

    if (texto.startsWith("/")) {
      const r = comando(mesa, texto);
      if (!r) return json(res, 200, { privado: "Comando desconocido. Escribe /ayuda." });
      if (r.publico) {
        anotar({ t: "aviso", texto: `${nombre}: ${r.texto}` });
        return json(res, 200, { ok: true });
      }
      return json(res, 200, { privado: r.texto });
    }

    anotar({ t: "jugador", nombre, texto });
    pendientes.push({ nombre, texto });
    difundirEstado();
    void procesar();
    return json(res, 200, { ok: true });
  }

  json(res, 404, { error: "No encontrado" });
});

servidor.listen(PUERTO, "0.0.0.0", () => {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i!.address);
  const sufijo = CLAVE ? `/?clave=${encodeURIComponent(CLAVE)}` : "";
  console.log(`⚔️  Mesa de Velmora abierta (modelo: ${MODELO}, partida: ${RUTA})`);
  console.log(`   En este equipo:   http://localhost:${PUERTO}${sufijo}`);
  for (const ip of ips) console.log(`   En la misma red:  http://${ip}:${PUERTO}${sufijo}`);
  console.log(`   Por internet:     cloudflared tunnel --url http://localhost:${PUERTO}  (y comparte la URL que te dé)`);
  if (!CLAVE) console.log("   Consejo: define DM_CLAVE para que solo entre quien tenga la clave.");
  void turnoInicial();
});

process.on("SIGINT", () => {
  guardar(RUTA, mesa);
  guardarRegistro();
  console.log("\nPartida guardada. ¡Hasta la próxima!");
  process.exit(0);
});
