// Varias acciones en una sola llamada a `motor` (bloque 2): la página ejecuta la lista en orden con `ejecutar`; una acción que falla (datos
// inválidos, acción desconocida) no lanza ni corta las demás y devuelve su error. Aquí se comprueba la base: `ejecutar` nunca lanza con
// entradas malas y las acciones independientes de una lista dan el mismo estado que llamadas sueltas (dados fijos).
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const sinXY = (m: any) => JSON.stringify(m, (k, v) => (k === "x" || k === "y" ? undefined : v)); // la posición de un lugar nuevo en el mapa es aleatoria
const mk = () => { const p = nuevaPartida(); normalizarPartida(p); return p; };
const fichaAna = { don_arcano: false, nombre: "Aldo", jugador: "Ana", raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 3, pv_max: 30, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 12, car: 10 }, inventario: [] };
/** Lo mismo que hace `motor.execute` de la página con una lista: en orden, sin cortarse por un error. */
const lote = (p: any, lista: { accion: string; datos: any }[]) => lista.map(({ accion, datos }) => { const r = ejecutar(String(accion), datos ?? {}, p); return { accion, resultado: r.contenido, aviso: r.aviso, ...(r.error ? { error: true } : {}) }; });

{
  const p = mk();
  let res: any[] = [];
  let lanzo = false;
  iniciarRegistroDados([{ caras: 20, valor: 14 }, { caras: 6, valor: 4 }]);
  try {
    res = lote(p, [
      { accion: "guardar_personaje", datos: fichaAna },
      { accion: "tirar_dados", datos: { expresion: "1d20", motivo: "daño del hacha" } },
      { accion: "tirar_dados", datos: {} },                    // datos inválidos
      { accion: "no_existe", datos: {} },                       // acción desconocida
      { accion: "ubicacion", datos: { lugar: "Posada del Cuervo Ahogado", region: "Aldenmar", tipo: "posada" } },
      { accion: "tirar_dados", datos: { expresion: "1d6", motivo: "daño" } },
    ]);
  } catch { lanzo = true; } finally { liberarDados(); }
  t(!lanzo && res.length === 6, "una lista con errores no lanza y devuelve un resultado por acción", String(res.length));
  t(!res[0].error && !res[1].error && !!res[2].error && !!res[3].error && !res[4].error && !res[5].error, "solo fallan las acciones malas (índices 2 y 3); las demás siguen", res.map((r) => r.error ? "E" : "-").join(""));
  t(/Argumentos no válidos/.test(res[2].resultado) && /desconocida/.test(res[3].resultado), "el error dice qué falló (datos o acción desconocida)");
  t(/14/.test(res[1].resultado) && /4/.test(res[5].resultado), "los dados se consumen en orden (14 y 4)", `${res[1].resultado} | ${res[5].resultado}`.slice(0, 120));
  t(!!p.personajes.Aldo && !!p.mapa && /Posada del Cuervo Ahogado/.test(JSON.stringify(p.mapa)), "la ficha y la ubicación quedaron registradas pese a los errores del medio");
  t(typeof res[1].aviso === "string" && /🎲|1d20/.test(res[1].aviso) && typeof res[5].aviso === "string" && !res[2].aviso && !res[3].aviso, "las acciones buenas dejan su aviso de pantalla (en orden) y las malas ninguno", `${res[1].aviso} | ${res[5].aviso}`.slice(0, 100));
}
{ // misma lista en una llamada o en llamadas sueltas: mismo estado
  const a = mk(), b = mk();
  iniciarRegistroDados([{ caras: 20, valor: 7 }]); lote(a, [{ accion: "guardar_personaje", datos: fichaAna }, { accion: "tirar_dados", datos: { expresion: "1d20", motivo: "x" } }, { accion: "ubicacion", datos: { lugar: "Puente", region: "Aldenmar", tipo: "aldea" } }]); liberarDados();
  iniciarRegistroDados([{ caras: 20, valor: 7 }]);
  for (const x of [{ accion: "guardar_personaje", datos: fichaAna }, { accion: "tirar_dados", datos: { expresion: "1d20", motivo: "x" } }, { accion: "ubicacion", datos: { lugar: "Puente", region: "Aldenmar", tipo: "aldea" } }]) lote(b, [x]);
  liberarDados();
  t(JSON.stringify(a.personajes) === JSON.stringify(b.personajes) && sinXY(a.mapa) === sinXY(b.mapa), "agrupar o separar las llamadas da el mismo estado");
}
console.log(`${ok} ok, ${mal} fallas`);
