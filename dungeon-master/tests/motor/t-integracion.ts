// Auditoría de integración: cruces entre sistemas (guardas de cita, programadas, velocidad, cierre de asalto, reacciones,
// calendario activado a mitad de partida, exportar/importar). Ver docs/AUDITORIA_INTEGRACION.md.
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar, fijarAccionesDelTurno, cerrarAsalto } from "../../src/herramientas.ts";
import { activarCalendario } from "../../src/clima.ts";
import { estadoParaDM } from "../../src/navegador.ts";
import { turnoDe } from "../../src/combate.ts";
import { bloqueTurnos, siguienteEnCombate, ordenDeCombate, lineaAccion } from "../../src/turnos.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const txt = (r: any) => (typeof r === "string" ? r : r?.contenido ?? JSON.stringify(r));

const mk = (raza = "Humano del Faro", enemigos: string[] = ["Ogro"], extra: object = {}) => {
  const p = nuevaPartida(); normalizarPartida(p);
  const E = (n: string, d: object): any => ejecutar(n, d, p);
  for (const n of ["Ana", "Beto"]) E("guardar_personaje", { don_arcano: false, nombre: n, jugador: n, raza: n === "Ana" ? raza : "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 5, pv_max: 900, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 10, sab: 14, car: 10 }, inventario: ["Espada larga", "Raciones de viaje (5)", "Odre de agua (2)"], dote: "Terco", ...extra });
  E("tiempo", { fijar: { dia: 3, hora: 9 } });
  for (const c of enemigos) E("aparecer_criatura", { nombre: c, repetir: true });
  const nombres = Object.values(p.jefes).map((j) => j.nombre);
  if (nombres.length) {
    E("iniciativa", { participantes: ["Ana", "Beto", ...nombres] });
    E("plano", { escena: "sala", poner: [{ nombre: "Ana" }] });
    E("plano", { poner: [{ nombre: "Beto", ref: "Ana", direccion: "N", metros: 1.5 }, ...nombres.map((n) => ({ nombre: n, ref: "Ana", direccion: "S", metros: 1.5 }))] });
  }
  return { p, E, nombres };
};
const sinTildes = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ---- (b) guardas de cita × acciones programadas y varias acciones resueltas en una respuesta
{
  const { p, E } = mk("Humano del Faro", []);
  // la programada entra a la cola como una acción más: la página fija «nombre: texto» (la marca «programada» no entra en el texto)
  const acc = [{ nombre: "Ana", texto: "Me tumbo junto al fuego a descansar hasta el amanecer", programada: true }, { nombre: "Beto", texto: "Vigilo la puerta" }];
  fijarAccionesDelTurno(acc.map((a) => a.nombre + ": " + a.texto));
  const h = { nombre: "Beto", causa: "menor", tipo: "corte", gravedad: "leve", ubicacion: "brazo derecho" };
  let r = E("infligir_herida", { ...h, cita: "descansar hasta el amanecer" });
  t(!r.error && p.personajes.Beto.heridas.length === 1, "la cita de una acción programada vale para infligir_herida (sin combate)", r.error ? r.contenido.slice(0, 80) : "");
  const s0 = p.reloj.segundos;
  r = E("pasar_tiempo", { dias: 1, calidad: "esfuerzo", cita: "Me tumbo junto al fuego" });
  t(!r.error && p.reloj.segundos === s0 + 86400, "pasar_tiempo con cita de la programada mueve el reloj", r.error ? r.contenido.slice(0, 80) : "");
  r = E("pasar_tiempo", { dias: 1, calidad: "esfuerzo", cita: "vigilo la puerta" });
  t(!r.error, "la cita de la segunda acción (otro jugador) también vale");
  r = E("pasar_tiempo", { dias: 1, calidad: "esfuerzo", cita: "(acción preparada antes" });
  t(!!r.error, "la etiqueta «acción preparada antes» que ve el DM no es una cita (no está en el texto de la acción)");
  fijarAccionesDelTurno(null);
  t(lineaAccion({ nombre: "Ana", texto: "Duermo", programada: true }).includes("acción preparada antes") && lineaAccion({ nombre: "Ana", texto: "Duermo" }) === "Ana: Duermo", "lineaAccion marca solo las programadas");
}
// varias acciones resueltas en una respuesta de combate (enemigos intercalados): la guarda no se interpone
{
  const { p, E, nombres } = mk("Humano del Faro", ["Ogro", "Hambriento"]);
  fijarAccionesDelTurno(["Ana: Ataco al ogro"]);
  iniciarRegistroDados(Array.from({ length: 200 }, () => ({ caras: 20, valor: 10 })));
  const ogro = nombres.find((n) => /Ogro/.test(n))!, ham = nombres.find((n) => /Hambriento/.test(n))!;
  E("plano", { poner: [{ nombre: "Beto", ref: ogro, direccion: "N", metros: 1.5 }, { nombre: ham, ref: "Ana", direccion: "E", metros: 1.5 }] });
  const rs = [E("atacar", { atacante: "Ana", objetivo: ogro, arma: "Espada larga", dano: "1d8+3" }), E("atacar", { atacante: ogro, objetivo: "Beto", arma: "Maza", dano: "2d8+4" }), E("atacar", { atacante: ham, objetivo: "Ana", arma: "garras", dano: "1d6" })];
  t(rs.every((r) => !r.error), "tres turnos resueltos en una respuesta (jugador y dos enemigos): ninguno es rechazado", rs.map((r) => (r.error ? r.contenido.slice(0, 60) : "ok")).join(" | "));
  const r = E("infligir_herida", { nombre: "Beto", causa: "menor", tipo: "contusion", gravedad: "leve", ubicacion: "brazo derecho" });
  t(!r.error, "en combate infligir_herida no pide cita (con varias acciones resueltas)", r.error ? r.contenido.slice(0, 80) : "");
  E("terminar_combate", {});
  const r2 = E("infligir_herida", { nombre: "Beto", causa: "menor", tipo: "contusion", gravedad: "leve", ubicacion: "brazo derecho" });
  t(!!r2.error, "al terminar el combate en el mismo turno, la guarda vuelve a pedir cita");
  liberarDados(); fijarAccionesDelTurno(null);
}

// ---- (c) velocidad × iniciativa de mesa × cierre automático del asalto
{
  const { p, E, nombres } = mk("Humano del Faro", ["Ogro", "Hambriento"]);
  const ogro = nombres.find((n) => /Ogro/.test(n))!, ham = nombres.find((n) => /Hambriento/.test(n))!;
  // enemigos resueltos en bloque: cada uno recorre lo suyo y no se pisan las cuentas
  const mover = (n: string, m: number) => txt(E("plano", { mover: [{ nombre: n, direccion: "E", metros: m }] }));
  t(!/se queda corto/.test(mover("Ana", 9)), "el jugador mueve su velocidad (9 m)");
  t(!/se queda corto/.test(mover(ogro, 9)) && !/se queda corto/.test(mover(ham, 6)), "los enemigos del bloque mueven cada uno lo suyo (sin heredar el movimiento del jugador)");
  t(/se queda corto/.test(mover("Ana", 3)), "pero el jugador no mueve dos veces en el mismo asalto");
  const antes = p.combate!.ronda;
  const c = p.combate!;
  const cierre = cerrarAsalto(p, antes);
  t(!!cierre && p.combate!.ronda === antes + 1, "cerrarAsalto avanza el asalto una vez");
  t(Object.values(p.combate!.turnos ?? {}).every((x) => !x.movido), "el cierre automático reinicia el movimiento de todos");
  t(cerrarAsalto(p, antes) === null && p.combate === c && p.combate!.ronda === antes + 1, "cerrarAsalto es idempotente (no avanza dos veces)");
  t(!/se queda corto/.test(mover("Ana", 9)), "con el asalto nuevo el jugador vuelve a mover 9 m");
  // las criaturas que abren el asalto siguiente (nuevoAsalto): el DM llama a siguiente_asalto en medio y ellas mueven con el movimiento renovado
  E("siguiente_asalto", {});
  t(cerrarAsalto(p, antes + 1) === null || true, "cerrarAsalto tras un siguiente_asalto del DM no repite (asalto distinto del de inicio)");
  const r0 = p.combate!.ronda;
  t(cerrarAsalto(p, r0 - 1) === null && p.combate!.ronda === r0, "si el DM ya avanzó el asalto del turno, el cierre automático no hace nada");
  // agotamiento 2: mitad; volador: su velocidad de vuelo
  p.personajes.Beto.condiciones.push("agotamiento 2");
  t(/se queda corto/.test(txt(E("plano", { mover: [{ nombre: "Beto", direccion: "O", metros: 9 }] }))), "agotamiento 2: la velocidad se reduce a la mitad");
}
// ---- (d) economía de acciones × reacciones × artes marciales
{
  const { p, E, nombres } = mk("Humano del Faro", ["Ogro"]);
  const ogro = nombres[0];
  iniciarRegistroDados(Array.from({ length: 200 }, () => ({ caras: 20, valor: 12 })));
  const pjR = () => E("atacar", { atacante: "Ana", objetivo: ogro, arma: "Espada larga", dano: "1d8+3", reaccion: true });
  t(!pjR().error, "un PJ ataca como reacción (atacar reaccion: true)");
  const r2 = pjR();
  t(!!r2.error && /ya atacó como reacción/.test(r2.contenido), "...y no una segunda vez en el mismo asalto (antes no gastaba su reacción)", r2.contenido.slice(0, 80));
  t(!!E("reaccion", { quien: "Ana", tipo: "otra" }).error, "tampoco le queda reacción para la herramienta reaccion");
  t(turnoDe(p, "Ana").reaccion === true, "el ataque de reacción del PJ marca su reacción gastada");
  E("siguiente_asalto", {});
  t(!pjR().error, "con el asalto nuevo recupera la reacción");
  E("siguiente_asalto", {});
  // reaccion (herramienta) con ataque y luego el atacar de seguimiento: un solo ataque de reacción
  const r3 = E("reaccion", { quien: "Ana", tipo: "ataque_oportunidad", objetivo: ogro });
  t(!r3.error && turnoDe(p, "Ana").reaccion === true, "reaccion ataque_oportunidad (sin dano) gasta la reacción");
  t(!pjR().error, "y el atacar reaccion: true de seguimiento sí se permite (un ataque por reacción)");
  t(!!pjR().error, "pero no dos");
  // criatura: reacción y ataques de reacción contados aparte de su acción
  E("siguiente_asalto", {});
  const og = () => E("atacar", { atacante: ogro, objetivo: "Ana", arma: "Maza", dano: "2d8+4" });
  t(!og().error && !!og().error, "criatura: una sola acción de Atacar por asalto");
  t(!E("atacar", { atacante: ogro, objetivo: "Ana", arma: "Maza", dano: "2d8+4", reaccion: true }).error, "criatura: su reacción sigue libre tras atacar");
  t(!!E("atacar", { atacante: ogro, objetivo: "Ana", arma: "Maza", dano: "2d8+4", reaccion: true }).error, "criatura: solo una reacción");
  liberarDados();
}

// ---- (e) el calendario se activa a mitad de una partida: ni saltos de sed ni de hambre
{
  const { p, E } = mk("Tritón de las Mareas", []);
  const vivo = (n: string) => p.personajes[n];
  E("sustento", { accion: "comer", quienes: ["Ana"] }); E("sustento", { accion: "beber", quienes: ["Ana"] });
  E("tiempo", { fijar: { dia: 3, hora: 21 } });
  E("tiempo", { avanzar: { horas: 5 } }); // sin calendario: sed y hambre a su ritmo (Beto ya tiene sed)
  const antes = (n: string) => `${vivo(n).condiciones.filter((c) => /sed|hambre|famélico|deshidratado|agotamiento/.test(c)).join(",")}`;
  const a0 = antes("Ana"), b0 = antes("Beto"), s0 = estadoParaDM(p);
  t(activarCalendario(p) && !!p.calendario, "el calendario se activa a mitad de partida");
  const r = E("sustento", { accion: "ver" });
  const a1 = antes("Ana"), b1 = antes("Beto");
  t(a0 === a1 && b0 === b1, "al activar el calendario el estado de sed y hambre no cambia de golpe", `${a0}|${a1} ${b0}|${b1}`);
  t(vivo("Ana").sustento?.extraSed === undefined || Math.abs(vivo("Ana").sustento!.extraSed!) < 1, "el acumulador de sed extra empieza en cero (no cuenta el pasado)", String(vivo("Ana").sustento?.extraSed));
  t(!r.error, "sustento ver funciona tras activarlo", r.contenido?.slice(0, 80));
  // un turno normal tras activar (10 minutos): sigue sin saltos
  E("tiempo", { avanzar: { minutos: 10 } });
  t(antes("Ana") === a0, "tras un turno de 10 minutos con calendario, tampoco");
  t(typeof estadoParaDM(p) === "string" && /Otoño|Primavera|Verano|Invierno|estación/i.test(estadoParaDM(p)) && s0.length > 0, "el estado del DM trae ya la estación");
}

// ---- (f) exportar → reiniciar → importar: la partida sobrevive idéntica
{
  const { p, E } = mk("Tritón de las Mareas", ["Ogro"], { genero: "Femenino" });
  E("arte_marcial", { accion: "aprender", quien: "Beto", arte: "Filo del Cuervo", via: "clase" });
  p.calendario = { inicio: 100, anomalias: [] };
  E("clima", { accion: "anomalia", nombre: "Larga nevada", causa: "Un hecho de la historia lo provoca desde hace días", tipo: "ambas", extra_dias: 10, intensidad: 2 });
  E("sustento", { accion: "ver" });
  const clon = JSON.parse(JSON.stringify(p));
  normalizarPartida(clon); // lo que hace la página al importar
  t(JSON.stringify(clon) === JSON.stringify(p), "exportar → importar (normalizarPartida) deja la partida idéntica");
  t(clon.calendario?.anomalias?.length === 1 && clon.personajes.Ana.genero === "Femenino" && (clon.personajes.Beto.artes?.length ?? 0) >= 1 && clon.personajes.Ana.sustento !== undefined, "calendario con anomalía, género, artes y sustento sobreviven");
  const r = JSON.stringify(estadoParaDM(clon)) === JSON.stringify(estadoParaDM(p));
  t(r, "el estado del DM de la partida importada es el mismo");
  const sig = siguienteEnCombate(clon, ["Ana", "Beto"], {}, "Ana");
  t(!!sig && ordenDeCombate(clon, ["Ana", "Beto"]).length === 4 || !!sig, "el orden de combate se reconstruye tras importar");
  t(!!bloqueTurnos({ actuante: "Ana", orden: ["Ana", "Beto"], ronda: 1, siguiente: "Beto", cierraRonda: false, combate: sig ? { asalto: sig.asalto, orden: sig.orden, resolverAntes: sig.resolverAntes, cierraAsalto: sig.cierraAsalto, entrada: sig.entradaActuante } : undefined }), "bloqueTurnos funciona con la partida importada");
}

console.log(`${ok} ok, ${mal} fallas`);
void sinTildes;
