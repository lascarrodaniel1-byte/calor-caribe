// El juramento del Caballero Juramentado: lo que le da su poder mágico. Cuanto más jura, más fuerte es su magia y más
// duele romperlo (como una liga estirada): desde la debilidad hasta que su propio poder lo queme y no vuelva a usar magia.
import { tirar } from "./dados.js";
import type { Partida, Personaje } from "./estado.js";
import { infligir, pvMaxEfectivo } from "./heridas.js";
import { agregarCondicion, nivelAgotamiento } from "./condiciones.js";
import { distanciaPlano } from "./espacio.js";
import { NOMBRE_DIRECCION as NOMBRE_DIR_ES } from "./mapa.js";
import { RECURSOS_CLASE, ALDESCANSAR } from "./recursos.js";
import { MAESTRIAS } from "./magia.js";
import { mod, valor } from "./reglas.js";
import { alcanceSentido, DIOS, esCaballero, intensidad, juramentoActivo, MAX_VOTOS, reservaMax, VOTOS, type Juramento } from "./juramento_base.js";

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function caballero(partida: Partida, quien: string): Personaje {
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(quien) || (x.jugador && norm(x.jugador) === norm(quien)));
  if (!p) throw new Error(`No hay ningún personaje llamado «${quien}».`);
  if (!esCaballero(p)) throw new Error(`${p.nombre} no es un Caballero Juramentado.`);
  return p;
}

const idVoto = (t: string) => VOTOS.find((v) => norm(v.id) === norm(t) || norm(v.nombre) === norm(t));

/** La magia del Caballero depende de su juramento: cuantos más votos, más maestría y más hechizos. */
function ajustarMagia(p: Personaje) {
  const n = intensidad(p);
  const m = p.magia;
  if (!m) return;
  const maestria = n >= 5 ? "maestro" : n >= 3 ? "adepto" : "iniciado";
  m.maestria = maestria;
  m.escuelas = ["curacion", "proteccion"];
  m.atributo = "car";
  const base = ["Cerrar la carne", "Escudo de sal", ...(n >= 3 ? ["Sutura arcana"] : []), ...(n >= 5 ? ["Restaurar"] : [])];
  for (const h of base) if (!m.hechizos.includes(h)) m.hechizos.push(h);
}

export function juramento(partida: Partida, d: { quien: string; accion: "jurar" | "añadir_voto" | "ver" | "expiar"; votos?: string[] }): string {
  const p = caballero(partida, d.quien);
  const j = p.juramento;
  if (d.accion === "ver") return j ? `${p.nombre}: ${listaVotos(j)}${j.roto ? ` · ROTO (${j.roto.voto}): ${j.roto.consecuencia}` : ""}${j.perdido ? " · PERDIDO" : ""}. Reserva de imposición de manos ${j.reserva}/${reservaMax(p)} PV.` : `${p.nombre} aún no ha jurado.`;
  if (d.accion === "jurar" || d.accion === "añadir_voto") {
    const nuevos = (d.votos ?? []).map((t) => {
      const v = idVoto(t);
      if (!v) throw new Error(`No existe el voto «${t}». Los votos de ${DIOS}: ${VOTOS.map((x) => x.nombre).join(", ")}.`);
      return v;
    });
    if (!nuevos.length) throw new Error(`Di qué votos jura (${VOTOS.map((x) => x.nombre).join(", ")}).`);
    if (d.accion === "jurar" && j) throw new Error(`${p.nombre} ya juró; para sumar votos usa añadir_voto.`);
    if (d.accion === "añadir_voto" && !j) throw new Error(`${p.nombre} aún no ha jurado: usa jurar.`);
    if (j?.perdido) throw new Error(`${p.nombre} rompió su juramento sin remedio: ya no puede volver a jurar.`);
    if (j?.roto) throw new Error(`${p.nombre} tiene el juramento roto: antes debe expiar.`);
    const ids = [...new Set([...(j?.votos ?? []), ...nuevos.map((v) => v.id)])];
    if (ids.length > MAX_VOTOS) throw new Error(`Como mucho ${MAX_VOTOS} votos a la vez.`);
    const antes = reservaMax(p);
    p.juramento = { dios: DIOS, votos: ids, reserva: j?.reserva ?? 0, carga: j?.carga ?? 0 };
    if (!j) p.juramento.reserva = reservaMax(p);
    else p.juramento.reserva += reservaMax(p) - antes;
    ajustarMagia(p);
    const n = ids.length;
    return [
      `${p.nombre} jura ante ${DIOS}: ${nuevos.map((v) => `«${v.nombre}» (${v.promesa})`).join("; ")}.`,
      `Intensidad ${n}/${MAX_VOTOS}: su magia es de ${p.magia.maestria}, su reserva de imposición de manos es de ${reservaMax(p)} PV y su castigo divino hace +${2 + (n >= 5 ? 2 : n >= 3 ? 1 : 0)}d8.`,
      n >= 3 ? "Cuanto más estira la liga, más duele soltarla: romper un voto ahora tendría consecuencias graves." : "",
    ].filter(Boolean).join("\n");
  }
  // expiar
  if (!j) throw new Error(`${p.nombre} no ha jurado.`);
  if (j.perdido) throw new Error(`${p.nombre} rompió su juramento sin remedio: no hay expiación posible.`);
  if (!j.roto) throw new Error(`${p.nombre} no tiene el juramento roto.`);
  const era = j.roto.voto;
  delete j.roto;
  j.reserva = 0; // la recupera con un descanso largo
  ajustarMagia(p);
  return `${p.nombre} expía su falta (${era}) y vuelve a jurar ante ${DIOS}: sus poderes responden otra vez. La reserva de imposición de manos vuelve a llenarse con el próximo descanso largo. (Haz que la expiación se viva: un rito, una penitencia, una misión.)`;
}

const listaVotos = (j: Juramento) => `jura ante ${j.dios}: ${j.votos.map((id) => VOTOS.find((v) => v.id === id)?.nombre ?? id).join(", ")} (intensidad ${j.votos.length}/${MAX_VOTOS})`;

/** Romper un voto: cuanto más había jurado, peor. */
export function romperJuramento(partida: Partida, d: { quien: string; voto: string; motivo: string }): string {
  const p = caballero(partida, d.quien);
  const j = p.juramento;
  if (!j) throw new Error(`${p.nombre} no ha jurado: no tiene nada que romper.`);
  if (j.perdido) throw new Error(`${p.nombre} ya perdió su juramento.`);
  if (j.roto) throw new Error(`${p.nombre} ya tiene el juramento roto (${j.roto.voto}).`);
  const v = idVoto(d.voto);
  if (!v || !j.votos.includes(v.id)) throw new Error(`${p.nombre} no juró el voto «${d.voto}». Sus votos: ${j.votos.map((id) => VOTOS.find((x) => x.id === id)?.nombre).join(", ")}.`);
  const n = j.votos.length;
  const lineas = [`⛓ ${p.nombre} rompe su voto de «${v.nombre}» (${v.promesa}) — ${d.motivo}. La liga estaba estirada a intensidad ${n}/${MAX_VOTOS}:`];
  let consecuencia: string;
  const dano = n <= 2 ? 0 : tirar(`${[0, 0, 0, 2, 4, 6][n]}d10`).total;
  if (n === 1) { agregarCondicion(p.condiciones, "agotamiento 1"); consecuencia = "Debilidad: agotamiento 1 hasta que expíe."; }
  else if (n === 2) { agregarCondicion(p.condiciones, `agotamiento ${Math.max(2, nivelAgotamiento(p.condiciones))}`); consecuencia = "Debilidad: agotamiento 2 hasta que expíe."; }
  else if (n === 3) { agregarCondicion(p.condiciones, `agotamiento ${Math.max(2, nivelAgotamiento(p.condiciones))}`); consecuencia = `Su propio poder lo quema: ${dano} de daño radiante, agotamiento 2 y los poderes callan hasta que expíe.`; }
  else if (n === 4) { agregarCondicion(p.condiciones, `agotamiento ${Math.max(3, nivelAgotamiento(p.condiciones))}`); consecuencia = `Su propio poder lo abrasa: ${dano} de daño radiante, una herida grave, agotamiento 3 y los poderes callan; solo una gran expiación (una misión) lo puede remediar.`; }
  else { agregarCondicion(p.condiciones, `agotamiento ${Math.max(3, nivelAgotamiento(p.condiciones))}`); consecuencia = `La liga estalla: ${dano} de daño radiante, una herida crítica y pierde para siempre el juramento y toda su magia divina.`; }
  p.pv = Math.max(0, p.pv - dano);
  if (n >= 4) lineas.push(infligir(p, { causa: n === 4 ? "golpe_masivo" : "critico", tipo: "quemadura", descripcion: "su propio poder lo abrasa" }));
  j.roto = { voto: v.nombre, motivo: d.motivo, consecuencia };
  j.reserva = 0;
  if (n >= 5) {
    j.perdido = true;
    if (p.magia) { p.magia.maestria = "profano"; p.magia.escuelas = []; p.magia.hechizos = []; }
  }
  lineas.push(consecuencia);
  if (dano) lineas.push(`${p.nombre}: PV ${p.pv}/${pvMaxEfectivo(p)}.`);
  lineas.push(n >= 5 ? "No hay vuelta atrás: ni expiación ni nuevo juramento. Narra la caída con peso." : "Narra la ruptura: la luz de Ka'i lo abandona. Hasta que expíe, sus poderes (imposición de manos, castigo divino, sentido divino, hechizos) callan.");
  return lineas.join("\n");
}

/** Gasta PV de la reserva de imposición de manos (para curar, tratar una herida o castigar). */
export function gastarReserva(p: Personaje, cantidad: number): void {
  if (!esCaballero(p)) return;
  if (!p.juramento) throw new Error(`${p.nombre} aún no ha jurado: sin juramento no tiene poder (juramento {accion: jurar}).`);
  if (p.juramento.perdido) throw new Error(`${p.nombre} perdió su juramento para siempre: ya no usa magia divina.`);
  if (p.juramento.roto) throw new Error(`${p.nombre} tiene el juramento roto (${p.juramento.roto.voto}): sus poderes callan hasta que expíe.`);
  if (p.juramento.reserva < cantidad) throw new Error(`${p.nombre} solo tiene ${p.juramento.reserva} PV en su reserva de imposición de manos (hacen falta ${cantidad}); se llena con un descanso largo.`);
  p.juramento.reserva -= cantidad;
}

/** Un uso de magia divina que recae sobre el propio Caballero (castigo divino): una marca de Ceniza cada cuatro usos. */
export function usoDivino(p: Personaje): string {
  const jr = p.juramento;
  if (!jr) return "";
  jr.carga = (jr.carga ?? 0) + 1;
  if (jr.carga % 4 !== 0) return `La luz de Ka'i lo protege de la Ceniza (${jr.carga % 4}/4).`;
  jr.carga = 0;
  p.ceniza += 1;
  return `Cuarto uso de magia divina: una marca de Ceniza para ${p.nombre} (${p.ceniza}).`;
}

export function imponerManos(partida: Partida, d: { quien: string; objetivo: string; pv: number }): string {
  const p = caballero(partida, d.quien);
  if (p.pv <= 0) throw new Error(`${p.nombre} está a 0 PV: no puede imponer las manos.`);
  const o = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(d.objetivo) || (x.jugador && norm(x.jugador) === norm(d.objetivo)));
  if (!o) throw new Error(`No hay ningún personaje llamado «${d.objetivo}».`);
  if (o.condiciones.includes("muerto")) throw new Error(`${o.nombre} está muerto: la imposición de manos no devuelve a los muertos.`);
  const falta = pvMaxEfectivo(o) - o.pv;
  if (falta <= 0) throw new Error(`${o.nombre} no está herido (PV ${o.pv}/${pvMaxEfectivo(o)}).`);
  const cura = Math.min(d.pv, falta);
  gastarReserva(p, cura);
  o.pv += cura;
  return `${p.nombre} impone las manos sobre ${o.nombre}: la luz de ${DIOS} le devuelve ${cura} PV (${o.pv}/${pvMaxEfectivo(o)}). Reserva: ${p.juramento!.reserva}/${reservaMax(p)}. Curar PV no deja Ceniza; cerrar una herida sí (usa tratar_herida con magia divina).`;
}

const MALDITOS = /no-muerto|vampiro|espectro/i;

RECURSOS_CLASE["Caballero Juramentado"] = [
  {
    nombre: "Sentido divino",
    desde: 1,
    max: (p) => Math.max(1, 1 + mod(valor(p, "car"))),
    recarga: "largo",
    efecto: (p, partida) => {
      if (!juramentoActivo(p)) throw new Error(`${p.nombre} no tiene poder: ${p.juramento ? "su juramento está roto o perdido" : "aún no ha jurado"}.`);
      const alc = alcanceSentido(p);
      const hallados = Object.values(partida?.jefes ?? {})
        .filter((j) => MALDITOS.test(j.definicion.temple ?? "") || MALDITOS.test(j.definicion.nombre))
        .map((j) => {
          const dd = partida ? distanciaPlano(partida, p.nombre, j.nombre) : null;
          return { j, dd };
        });
      const dentro = hallados.filter((x) => !x.dd || x.dd.metros <= alc);
      const fuera = hallados.length - dentro.length;
      return `Sentido divino (${alc} m): ${dentro.length ? dentro.map((x) => `siente a ${x.j.nombre}${x.dd ? ` a ${x.dd.metros} m al ${NOMBRE_DIR_ES[x.dd.dir]}` : " (en la escena, sin posición en el plano)"}`).join("; ") : "no siente a ningún no-muerto ni corrupto en la escena"}${fuera ? ` (y ${fuera} más fuera de alcance)` : ""}. También nota lo corrupto o maldito de la historia que esté en ese radio (decídelo tú, sin dar más detalle que «algo corrupto»).`;
    },
  },
];

ALDESCANSAR.push((p, tipo) => {
  if (tipo === "largo" && p.juramento && juramentoActivo(p)) p.juramento.reserva = reservaMax(p);
});

export const REGLAS_JURAMENTO = `## Caballero Juramentado: el juramento a Ka'i
- El Caballero jura ante Ka'i, el dios del sol (muerto): honor y fe. El juramento es lo que le da su poder mágico. Al crear su ficha, llama a juramento {accion: jurar, votos} con 1 a 3 votos de la lista acordes a su trasfondo (Verdad, Amparo, Lealtad, Luz, Descanso, Merced; hasta 5 a lo largo de la partida con añadir_voto). Sin juramento no tiene poder.
- Es una liga estirada: cuantos más votos, más maestría (iniciado, adepto con 3, maestro con 5), más reserva de imposición de manos (nivel × (3 + 2 × votos) PV) y más castigo divino... y más duele romperlo. Si en la historia viola un voto, llama a romper_juramento: con 1-2 votos, debilidad; con 3, su poder lo quema; con 4, lo abrasa y deja herida grave; con 5, pierde el juramento y toda magia divina para siempre. Se expía (juramento {accion: expiar}) tras un rito o una misión, salvo con 5 votos.
- Poderes automáticos: sentido divino con usar_recurso (18 m, 36 m desde el nivel 4); imposición de manos con imposicion_manos (cura PV, sin Ceniza); cerrar una herida con tratar_herida (magia divina) cuesta 5 PV de la reserva; castigo divino con atacar {castigo: true} (nivel 2+, 5 PV de la reserva). Gracias al juramento, su magia deja la cuarta parte de la Ceniza (una marca cada cuatro usos).
- Nivel 5: su magia divina puede expulsar la Podre de una herida (tratar_herida con magia divina; cuesta 10 PV de la reserva), algo que ninguna otra magia consigue. Rota la liga, pierde también esto.
- Desde el nivel 3, cada voto jurado concede una ventaja mientras lo cumple (la ficha la muestra; aplícala).`;
