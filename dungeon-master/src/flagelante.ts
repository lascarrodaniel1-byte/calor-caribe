// Flagelante de Haema: monje guerrero hecho para recibir daño y devolverlo. Su comunión del dolor le da más daño cuanto
// más cerca de la muerte está (cuatro niveles por cuartos de PV, sin tocar sus características), devuelve el golpe a
// quien lo hiere, cura sus heridas con la sangre ajena y ata o acerca a sus enemigos con las cadenas.
import type { Partida, Personaje } from "./estado.js";
import { danar } from "./bestiario.js";
import { aplicarCondicion, condsDe, localizar, puedeActuar, turnoDe, type DatosAtaque, type ResultadoAtaque } from "./combate.js";
import { describir, tirar } from "./dados.js";
import { bonoDolor, esFlagelante, esquivaAutomatica, nivelDolor, pasoElusivoActivo } from "./flagelante_base.js";
import { bajarZona, pvMaxEfectivo, REGLAS } from "./heridas.js";
import { reconocer } from "./condiciones.js";
import { actualizarPlano, distanciaPlano } from "./espacio.js";
import { bonoManiobra } from "./maniobras.js";
import { competencia, mod, signo, valor } from "./reglas.js";
import { RECURSOS_CLASE } from "./recursos.js";
import { exigirLibre, selloDe } from "./segador_base.js";

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const SIN_SANGRE = /no-muerto|no muerto|ghul|espectro|vampiro|esqueleto|aut[oó]mata|constructo|hambriento|ceniza viva|elemental/i;

function flagelante(partida: Partida, quien: string): Personaje {
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(quien) || (x.jugador && norm(x.jugador) === norm(quien)));
  if (!p) throw new Error(`No hay ningún personaje llamado «${quien}».`);
  if (!esFlagelante(p)) throw new Error(`${p.nombre} no es un Flagelante.`);
  return p;
}

RECURSOS_CLASE["Flagelante"] = [
  {
    nombre: "Golpe aturdidor",
    desde: 5,
    max: () => 1,
    recarga: "corto",
    efecto: (p) => `${p.nombre} golpea un punto vital: el objetivo hace una salvación de CON contra CD ${8 + competencia(p) + mod(valor(p, "sab"))} o queda aturdido hasta el final de su próximo turno (aplícalo con condicion).`,
  },
];

// ------------------------------------------------------------------ comunión del dolor

/** Antes de atacar: suma el daño de la comunión del dolor (+1 a +4 según su nivel de dolor). */
export function aplicarDolor(partida: Partida, e: DatosAtaque): { e: DatosAtaque; nota?: string } {
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(e.atacante));
  if (!p || !esFlagelante(p) || !e.dano) return { e };
  const b = bonoDolor(p);
  if (!b) return { e, nota: "🔒 Su comunión del dolor está sellada: sin daño extra." };
  return { e: { ...e, dano: `${e.dano}+${b}` }, nota: `🩸 Comunión del dolor (nivel ${nivelDolor(p)}/4): +${b} al daño.` };
}

/** Tras un golpe cuerpo a cuerpo que lo hiere, el Flagelante lo devuelve: (nivel de dolor)d4, una vez por asalto (nivel 2+). */
export function devolverDolor(partida: Partida, e: DatosAtaque, r: ResultadoAtaque): string {
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(e.objetivo));
  if (!p || !esFlagelante(p) || p.nivel < 2 || e.a_distancia) return "";
  if ((r.resultado !== "impacto" && r.resultado !== "critico") || !((r.dano ?? 0) > 0) || p.pv <= 0) return "";
  if (norm(e.atacante) === norm(p.nombre)) return "";
  const t = turnoDe(partida, p.nombre);
  if (t.reaccion) return "";
  const at = localizar(partida, e.atacante);
  const dist = distanciaPlano(partida, p.nombre, at.nombre);
  if (dist && dist.metros > 2) return "";
  t.reaccion = true;
  const n = nivelDolor(p);
  const d = tirar(`${n}d4`);
  let extra = "";
  if (at.tipo === "pj") { at.p.pv = Math.max(0, at.p.pv - d.total); extra = ` (PV ${at.p.pv}/${at.p.pv_max})`; }
  else if (at.tipo === "criatura") { extra = ` (${danar(at.j, d.total)})`; if (at.j.pv <= 0 && !r.muerto) r.muerto = at.j.nombre; }
  else if (at.n.pv !== undefined) { at.n.pv = Math.max(0, at.n.pv - d.total); extra = ` (${at.n.pv}/${at.n.pv_max ?? "?"} PV)`; }
  return `🩸 Devolver el dolor: ${p.nombre} (dolor ${n}/4) le devuelve el golpe a ${at.nombre}: ${n}d4 ${describir(d)} = ${d.total}${extra}. Gasta su reacción.`;
}

// ------------------------------------------------------------------ sangre ajena

const ORDEN = ["critica", "grave", "moderada", "leve"] as const;
const ZONAS = ["roja", "ambar", "verde"];

export function sangreAjena(partida: Partida, d: { quien: string; objetivo: string }): string {
  const p = flagelante(partida, d.quien);
  exigirLibre(p, "Sangre ajena");
  if (p.nivel >= 3) throw new Error(`Desde el nivel 3 ${p.nombre} no necesita untarse la sangre: el mero contacto con la de un enemigo al que hiere cuerpo a cuerpo lo cura solo (pasivo, una vez por asalto).`);
  const motivo = puedeActuar({ tipo: "pj", nombre: p.nombre, p });
  if (motivo) throw new Error(motivo + ".");
  const c = localizar(partida, d.objetivo);
  if (c.nombre === p.nombre) throw new Error("La sangre tiene que ser ajena.");
  const dist = distanciaPlano(partida, p.nombre, c.nombre);
  if (dist && dist.metros > 2) throw new Error(`${c.nombre} está a ${dist.metros} m: tiene que estar a su alcance para recoger su sangre.`);
  if (!sangreViva(c)) throw new Error(`${c.nombre} no tiene sangre viva que sirva: la comunión no funciona con no-muertos ni criaturas sin sangre.`);
  const herido = c.tipo === "pj" ? c.p.pv < c.p.pv_max : c.tipo === "criatura" ? c.j.pv < c.j.pv_max : c.n.pv === undefined || c.n.pv < (c.n.pv_max ?? c.n.pv + 1);
  if (!herido) throw new Error(`${c.nombre} no sangra: tiene que haber perdido PV para que haya sangre que recoger.`);
  if (partida.combate) {
    const t = turnoDe(partida, p.nombre);
    if (t.adicional) throw new Error(`${p.nombre} ya usó su acción adicional este asalto (${t.adicional}).`);
    t.adicional = "sangre ajena";
  }
  return curarConSangre(p, c.nombre, `2d6+${p.nivel}`).join("\n");
}

/** Cura al Flagelante con sangre ajena: PV, hemorragias cerradas y su herida más grave baja un nivel. */
function curarConSangre(p: Personaje, de: string, dados: string): string[] {
  const lineas: string[] = [];
  const cura = tirar(dados);
  const antes = p.pv;
  p.pv = Math.min(pvMaxEfectivo(p), p.pv + cura.total);
  lineas.push(`${p.nombre} recoge la sangre de ${de}: ${describir(cura)} → recupera ${p.pv - antes} PV (${p.pv}/${pvMaxEfectivo(p)}).`);
  for (const h of p.heridas) { h.sangrando = false; h.escalada = undefined; h.reloj = undefined; }
  const h = [...p.heridas].sort((a, b) => ZONAS.indexOf(a.zona_vital) - ZONAS.indexOf(b.zona_vital) || ORDEN.indexOf(a.gravedad) - ORDEN.indexOf(b.gravedad))[0];
  if (h) {
    bajarZona(h);
    if (h.gravedad === "leve") { p.heridas = p.heridas.filter((x) => x !== h); lineas.push(`La herida ${h.id} se cierra del todo.`); }
    else {
      h.gravedad = ORDEN[ORDEN.indexOf(h.gravedad) + 1];
      h.dias_restantes = Math.min(h.dias_restantes, tirar(REGLAS[h.gravedad].dias).total);
      lineas.push(`La herida ${h.id} se cierra un poco (ahora ${h.gravedad}) y todas dejan de sangrar.`);
    }
  } else lineas.push("No tiene heridas que cerrar.");
  lineas.push(`Su dolor baja a ${nivelDolor(p)}/4.`);
  return lineas;
}

/** ¿Es sangre viva que sirve (no no-muertos ni criaturas sin sangre)? */
function sangreViva(c: ReturnType<typeof localizar>): boolean {
  const naturaleza = c.tipo === "criatura" ? `${c.j.definicion.temple ?? ""} ${c.j.definicion.nombre} ${c.j.definicion.descripcion}` : c.tipo === "pnj" ? c.n.temple ?? "" : c.p.condiciones.join(" ");
  return !SIN_SANGRE.test(naturaleza);
}

/** Nivel 3+: el mero contacto con la sangre de un enemigo al que hiere cuerpo a cuerpo lo cura (una vez por asalto, sin acción). */
export function curacionPasiva(partida: Partida, e: DatosAtaque, r: ResultadoAtaque): string {
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(e.atacante));
  if (!p || !esFlagelante(p) || p.nivel < 3 || e.a_distancia || p.pv <= 0 || selloDe(p.sellos, "Sangre ajena")) return "";
  if (!((r.dano ?? 0) > 0) || (r.resultado !== "impacto" && r.resultado !== "critico" && r.resultado !== "roce")) return "";
  const c = localizar(partida, e.objetivo);
  if (c.nombre === p.nombre || !sangreViva(c)) return "";
  const t = turnoDe(partida, p.nombre);
  if (t.sangre) return "";
  t.sangre = true;
  return `🩸 Contacto con la sangre (pasivo): ` + curarConSangre(p, c.nombre, "1d6").join(" ");
}

// ------------------------------------------------------------------ cadenas

const ALCANCE_CADENAS = 6;

export function cadenas(partida: Partida, d: { quien: string; objetivo: string; accion: "atar" | "atraer" | "soltar" }): string {
  const p = flagelante(partida, d.quien);
  exigirLibre(p, "Cadenas");
  const m = p.manos;
  if (!p.inventario.some((x) => /cadenas?/i.test(x))) throw new Error(`${p.nombre} no lleva cadenas.`);
  if (m && !/cadenas?/i.test(`${m.principal ?? ""} ${m.secundaria ?? ""}`)) throw new Error(`${p.nombre} no empuña las cadenas: lleva ${m.principal ?? "nada"}${m.secundaria ? ` y ${m.secundaria}` : ""}. Usa empuñar antes.`);
  const at = { tipo: "pj" as const, nombre: p.nombre, p };
  const motivo = puedeActuar(at);
  if (motivo) throw new Error(motivo + ".");
  const ob = localizar(partida, d.objetivo);
  const atado = (c: typeof ob) => condsDe(c).find((x) => reconocer(x)?.id === "agarrado" && new RegExp(`cadenas de ${p.nombre}`, "i").test(x));
  if (d.accion === "soltar") {
    const x = atado(ob);
    if (!x) throw new Error(`${ob.nombre} no está atado con las cadenas de ${p.nombre}.`);
    const l = condsDe(ob); l.splice(l.indexOf(x), 1);
    return `${p.nombre} suelta las cadenas: ${ob.nombre} queda libre.`;
  }
  const dist = distanciaPlano(partida, p.nombre, ob.nombre);
  if (dist && dist.metros > ALCANCE_CADENAS) throw new Error(`${ob.nombre} está a ${dist.metros} m: las cadenas llegan a ${ALCANCE_CADENAS} m.`);
  if (partida.combate) turnoDe(partida, p.nombre); // gasta su acción (la lleva el DM)
  const a = bonoManiobra(at, "atletismo");
  const atl = bonoManiobra(ob, "atletismo"), acr = bonoManiobra(ob, "acrobacias");
  const def = atl.bono >= acr.bono ? { ...atl, hab: "Atletismo" } : { ...acr, hab: "Acrobacias" };
  const ta = tirar(`1d20${signo(a.bono)}`), td = tirar(`1d20${signo(def.bono)}`);
  const cab = `${p.nombre} lanza las cadenas a ${ob.nombre} (Atletismo ${describir(ta)}) contra ${def.hab} ${describir(td)}`;
  if (ta.total <= td.total) return `${cab} → FALLA: las cadenas se enredan en el aire o se las quita.`;
  const grande = ob.tipo === "criatura" && ob.j.definicion.peligro >= 4;
  const lineas = [`${cab} → ¡PRESA!`];
  if (d.accion === "atar") {
    lineas.push(aplicarCondicion(partida, { objetivo: ob.nombre, accion: "aplicar", condicion: "agarrado", nota: `cadenas de ${p.nombre}` }).split("\n")[0]);
    lineas.push(`${ob.nombre} queda atado (velocidad 0). Puede soltarse con una prueba de Atletismo o Acrobacias (maniobra escapar) o si ${p.nombre} queda incapacitado.`);
  } else if (grande) lineas.push(`${ob.nombre} es demasiado grande y pesado para arrastrarlo: las cadenas lo traban pero no lo mueven.`);
  else {
    const metros = dist ? Math.max(0, dist.metros - 1.5) : 0;
    if (dist && metros > 0) lineas.push(actualizarPlano(partida, { mover: [{ nombre: ob.nombre, hacia: p.nombre, metros }] }).split("\n")[0]);
    lineas.push(`${p.nombre} tira de las cadenas y atrae a ${ob.nombre} hasta su alcance${dist ? "" : " (muévelo en el plano)"}.`);
  }
  return lineas.join("\n");
}

// ------------------------------------------------------------------ paso elusivo

/** Nivel 5: declara el Paso elusivo (gasta su reacción). Con el dolor al máximo no hace falta: se hace solo y no falla. */
export function pasoElusivo(partida: Partida, d: { quien: string }): string {
  const p = flagelante(partida, d.quien);
  if (!partida.combate) throw new Error("El Paso elusivo se usa en combate.");
  if (!pasoElusivoActivo(p)) throw new Error(`${p.nombre} aún no tiene el Paso elusivo (nivel 5).`);
  const motivo = puedeActuar({ tipo: "pj", nombre: p.nombre, p });
  if (motivo) throw new Error(motivo + ".");
  if (esquivaAutomatica(p)) return `${p.nombre} tiene el dolor al máximo (4/4): su esquiva es automática y no falla nunca; se hace sola ante el siguiente golpe, sin declararla.`;
  const t = turnoDe(partida, p.nombre);
  if (t.reaccion) throw new Error(`${p.nombre} ya usó su reacción este asalto.`);
  t.reaccion = true;
  t.pasoElusivo = true;
  return `${p.nombre} se prepara para apartarse: el siguiente ataque contra él que fuera a acertar se esquiva si su tirada de Acrobacias (1d20 + DES + competencia) iguala o supera el total del ataque. Gasta su reacción. (Con el dolor al máximo es automático.)`;
}
