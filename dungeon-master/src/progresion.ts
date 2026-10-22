// Experiencia y subida de nivel (reglas básicas de D&D 5e): tabla de PX, PV por nivel, aumentos de característica y
// los rasgos de clase hasta el nivel 5. Más allá del 5 el programa sigue dando PV, competencia y aumentos, y el DM
// diseña los rasgos de clase nuevos.
import { tirar } from "./dados.js";
import { despertarMagia } from "./magia.js";
import type { Partida, Personaje } from "./estado.js";
import { CLASES } from "./mundo.js";
import { ATRIBUTOS, mod, valor, type Atributo } from "./reglas.js";

/** PX necesarios para llegar a cada nivel (índice = nivel − 1). */
export const PX_NIVEL = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
export const NIVEL_MAX = 20;
export const NIVELES_AUMENTO = [4, 8, 12, 16, 19];
/** PX por peligro de la criatura (1-5), como el valor de desafío de 5e. */
export const PX_PELIGRO: Record<number, number> = { 1: 50, 2: 200, 3: 450, 4: 700, 5: 1100 };

export const RASGOS_NIVEL: Record<string, Record<number, string[]>> = {
  "Mercenario del Cuervo": {
    2: ["Acción súbita (1 por descanso corto): una acción adicional en su turno"],
    3: ["Veterano de compañía: los críticos con 19-20 en el d20"],
    4: [],
    5: ["Ataque adicional: puede atacar dos veces cuando hace la acción de Atacar"],
  },
  "Berserker de Ceniza": {
    2: ["Ataque temerario: ventaja en sus ataques cuerpo a cuerpo de FUE, pero los ataques contra él tienen ventaja", "Sentido del peligro: ventaja en salvaciones de DES contra efectos que pueda ver"],
    3: ["Furia lúcida: el trance de la furia se aclara; ya distingue aliados de enemigos", "Furia (3 usos por descanso largo)", "Senda de la Ceniza: en furia, la ceniza de su piel arde: los atacantes cuerpo a cuerpo que lo golpean sufren 1d4 de fuego"],
    5: ["Ataque adicional: puede atacar dos veces cuando hace la acción de Atacar", "Movimiento rápido: +3 m de velocidad sin armadura pesada", "Furia que cierra las heridas: mientras dura la furia, sus heridas rojas dejan de sangrar (se reabren al terminar)"],
    6: ["Furia (4 usos por descanso largo)"],
  },
  "Caballero Juramentado": {
    2: ["Estilo de combate", "Castigo divino (atacar {castigo: true}): al impactar, gasta 5 PV de su reserva para +2d8 de daño radiante (3d8 con 3 votos, 4d8 con 5; un dado más contra no-muertos y malditos)"],
    3: ["Salud divina: casi inmune a las infecciones comunes (+5 a esas salvaciones; no a la Podre)", "Ventaja de cada voto: mientras cumple un voto jurado, obtiene su ventaja concreta (la ficha la muestra)"],
    4: ["Sentido divino mayor: su alcance sube a 36 m"],
    5: ["Ataque adicional: puede atacar dos veces cuando hace la acción de Atacar", "Luz contra la Podre: su magia divina expulsa la Podre de una herida (tratar_herida con magia divina; cuesta 10 PV de la reserva en vez de 5). Es la única magia que puede con ella"],
  },
  "Cazador de Brujas": {
    2: ["Estilo de combate"],
    3: ["Presa marcada: una vez por turno, +1d8 de daño a una criatura que ya esté herida", "Conciencia primigenia: siente a no-muertos, brujos y hechiceros a 9 m", "Runas de potencia 2 (dominan a seres de peligro 2); rastro: ahora sabe el rumbo del casteador"],
    4: [],
    5: ["Ataque adicional: puede atacar dos veces cuando hace la acción de Atacar", "Urumi: como veterano del oficio, recibe un urumi (espada-látigo de láminas de acero, 1d8 cortante, alcance 3 m) que sustituye a su látigo de metal", "Rastro: ahora sabe la región del casteador"],
    6: ["Runas de potencia 3 (dominan a seres de peligro 3)"],
    7: ["Rastro: ahora sabe el lugar exacto del casteador"],
    8: ["Runas que curan: dentro de las runas, cada asalto se cierra una herida leve y cada tres asaltos una moderada baja un nivel"],
    9: ["Runas de potencia 4 (dominan a seres de peligro 4)"],
    10: ["Rastro: reconoce al casteador por su nombre y puede seguirlo en tiempo real"],
    12: ["Runas de potencia 5 (dominan hasta a los jefes de peligro 5)"],
  },
  Degollador: {
    2: ["Acción astuta: acción adicional para Correr, Retirarse, Esconderse o forzar un acceso (Entrar y salir)"],
    3: ["Ataque furtivo 2d6", "Filo del asesino: ventaja en la iniciativa y crítico automático al impactar a un sorprendido", "Entrar y salir: no falla al abrir nada de CD 15 o menos"],
    4: ["Ojos de gato: ve en la oscuridad a 18 m (el doble si su raza ya veía en ella)"],
    5: ["Esquiva asombrosa: reacción para reducir a la mitad el daño de un ataque que ve", "Ataque furtivo 3d6"],
    8: ["Ojos en la espalda: +5 para notar emboscadas, reacciona aunque lo hayan sorprendido y los ataques por la espalda o el flanco no dan ventaja al atacante"],
  },
  Flagelante: {
    2: ["Devolver el dolor: reacción; cuando un enemigo a su alcance le hace daño, le devuelve (nivel de dolor)d4 de daño, una vez por asalto", "Movimiento sin armadura: +3 m"],
    3: ["Contacto con la sangre: curación pasiva; ya no necesita untarla, el mero contacto con la sangre de un enemigo al que hiere cuerpo a cuerpo lo cura (1d6 PV, cierra hemorragias y baja un nivel su herida más grave, una vez por asalto)", "Desviar proyectiles: reacción para reducir 1d10 + DES + nivel el daño de un proyectil"],
    4: ["Caída lenta: reduce el daño de caída en 5 × nivel"],
    5: ["Paso elusivo (paso_elusivo, reacción): se aparta del ataque con una tirada de Acrobacias; con el dolor al máximo (nivel 4) es una esquiva automática que no falla nunca", "Ataque adicional: puede atacar dos veces cuando hace la acción de Atacar", "Golpe aturdidor (1 uso por descanso corto): CON CD 8 + competencia + SAB o queda aturdido hasta el final de su próximo turno"],
  },
  Segador: {
    2: ["Invocaciones sobrenaturales: elige dos (p. ej. ojos del dios muerto, presencia sepulcral)", "Descarga con dos espacios de conjuro por descanso corto"],
    3: ["Don del pacto: su guadaña ahora cuenta como mágica y puede cambiar de forma una vez por descanso"],
    5: ["Ataque adicional: puede atacar dos veces con su arma de pacto", "Descarga sobrenatural: dos rayos"],
  },
  Hechicero: {
    2: ["Recuperación arcana: una vez al día, tras un descanso corto, recupera calor o aliento gastado igual a la mitad de su nivel (redondeando arriba)"],
    3: ["Lanza hechizos de círculo 2 de sus escuelas con maestría creciente (el precio sigue cobrándose)"],
    5: ["Aprende a lanzar hechizos de círculo 3 de sus escuelas (con un maestro o un grimorio)"],
  },
  "Barbero-Cirujano": {
    2: ["Mano de cirujano mejorada: +1 más a toda tirada de tratamiento"],
    3: ["Corte limpio: al tratar una herida, las complicaciones por fallo suben un nivel menos"],
    5: ["Ataque adicional: puede atacar dos veces cuando hace la acción de Atacar", "Mano firme (2/descanso largo)"],
  },
};

/** Los rangos de la Compañía del Cuervo Negro: el Mercenario asciende al subir de nivel. */
export const RANGOS_COMPANIA: { desde: number; rango: string; grado: string; ventaja: string }[] = [
  { desde: 1, rango: "Polluelo", grado: "recluta", ventaja: "Cama, comida y rumores de contratos en cualquier puesto de la Compañía. Cobra la paga mínima y las peores guardias" },
  { desde: 3, rango: "Cuervo", grado: "mercenario hecho", ventaja: "Contratos propios: el DM le ofrece encargos mejor pagados. Puede pedir prestadas armas comunes y armaduras ligeras del arsenal del puesto" },
  { desde: 5, rango: "Garra", grado: "sargento", ventaja: "Puede reclutar a 1d4 Polluelos para una misión (PNJ a sueldo suyo) y manda en las guardias del puesto. Los contratos le pagan el doble que a un Cuervo" },
  { desde: 8, rango: "Corax", grado: "capitán", ventaja: "Manda una escuadra de 4-6 mercenarios por contrato, requisa suministros y una montura, y la Compañía lo respalda ante la ley y la Inquisición. Conoce a los pagadores de la región" },
  { desde: 11, rango: "Ala Mayor", grado: "comandante", ventaja: "Una vez por campaña puede llamar a refuerzos de la Compañía (una compañía entera, a días de camino). Los señores y las ciudades negocian con él o ella; los desertores lo temen. Puede concursar por el puesto de mariscal (Hugin o Munin) cuando toque" },
];

export function rangoCompania(nivel: number) {
  return [...RANGOS_COMPANIA].reverse().find((r) => nivel >= r.desde) ?? RANGOS_COMPANIA[0];
}

export const pxActual = (p: Personaje) => p.px ?? PX_NIVEL[Math.max(0, p.nivel - 1)];

export function pxSiguiente(p: Personaje): number | null {
  return p.nivel >= NIVEL_MAX ? null : PX_NIVEL[p.nivel];
}

export function puedeSubir(p: Personaje): boolean {
  const s = pxSiguiente(p);
  return s !== null && pxActual(p) >= s;
}

export function textoProgresion(p: Personaje): string {
  const s = pxSiguiente(p);
  const rango = p.clase === "Mercenario del Cuervo" ? `\n  Compañía del Cuervo Negro: ${p.mariscal ? `MARISCAL ${p.mariscal}` : `${rangoCompania(p.nivel).rango} (${rangoCompania(p.nivel).grado})`}` : "";
  const rasgos = p.rasgos?.length ? ` | Rasgos de nivel: ${p.rasgos.join("; ")}` : "";
  return `${rango ? rango.slice(1) + "\n" : ""}  Experiencia: ${pxActual(p)}${s !== null ? `/${s} PX` : " PX (nivel máximo)"}${puedeSubir(p) ? " ⬆ PUEDE SUBIR DE NIVEL (subir_nivel)" : ""}${rasgos}`;
}

export interface DatosExperiencia {
  accion: "dar" | "por_criatura" | "ver";
  px?: number;
  /** por_criatura: peligro de la criatura derrotada (1-5) y cuántas. */
  peligro?: number;
  cantidad?: number;
  motivo?: string;
  /** A quién; por defecto, a todo el grupo, repartido a partes iguales. */
  quienes?: string[];
}

export function darExperiencia(partida: Partida, d: DatosExperiencia): string {
  const pjs = Object.values(partida.personajes).filter((p) => !p.condiciones.includes("muerto"));
  if (!pjs.length) throw new Error("No hay personajes a quienes dar experiencia.");
  if (d.accion === "ver") return pjs.map((p) => `${p.nombre}: ${textoProgresion(p).trim()}`).join("\n");
  let total = d.px ?? 0;
  if (d.accion === "por_criatura") {
    if (!d.peligro || !PX_PELIGRO[d.peligro]) throw new Error("por_criatura: di el peligro (1-5) de la criatura derrotada.");
    total = PX_PELIGRO[d.peligro] * (d.cantidad ?? 1);
  }
  if (!(total > 0)) throw new Error("Di cuántos PX (px) o la criatura derrotada (peligro).");
  const receptores = d.quienes?.length
    ? d.quienes.map((n) => {
        const p = pjs.find((x) => x.nombre.toLowerCase() === n.toLowerCase() || x.jugador?.toLowerCase() === n.toLowerCase());
        if (!p) throw new Error(`No hay ningún personaje «${n}».`);
        return p;
      })
    : pjs;
  const parte = Math.floor(total / receptores.length);
  const lineas: string[] = [];
  for (const p of receptores) {
    const antes = puedeSubir(p);
    p.px = pxActual(p) + parte;
    lineas.push(`${p.nombre}: +${parte} PX (${p.px}${pxSiguiente(p) !== null ? `/${pxSiguiente(p)}` : ""})${!antes && puedeSubir(p) ? " ⬆ ¡puede subir de nivel!" : ""}`);
  }
  return `Experiencia${d.motivo ? ` por ${d.motivo}` : ""}: ${total} PX repartidos entre ${receptores.length}.\n${lineas.join("\n")}${receptores.some(puedeSubir) ? "\nQuien pueda subir de nivel lo hace con subir_nivel (en un momento tranquilo, tras un descanso)." : ""}`;
}

export interface DatosSubirNivel {
  quien: string;
  pv: "promedio" | "tirar";
  /** Nivel de aumento de característica (4, 8, 12, 16, 19): +2 a una o +1 a dos. */
  aumento?: Partial<Record<Atributo, number>>;
  /** Sube sin tener los PX (hito de la historia). */
  por_hito?: boolean;
}

export function subirNivel(partida: Partida, d: DatosSubirNivel): string {
  const p = Object.values(partida.personajes).find((x) => x.nombre.toLowerCase() === d.quien.toLowerCase() || x.jugador?.toLowerCase() === d.quien.toLowerCase());
  if (!p) throw new Error(`No hay ningún personaje llamado «${d.quien}».`);
  if (p.condiciones.includes("muerto")) throw new Error(`${p.nombre} está muerto.`);
  if (p.nivel >= NIVEL_MAX) throw new Error(`${p.nombre} ya está en el nivel máximo (${NIVEL_MAX}).`);
  if (!puedeSubir(p) && !d.por_hito) throw new Error(`${p.nombre} lleva ${pxActual(p)} PX y necesita ${pxSiguiente(p)} para el nivel ${p.nivel + 1}. Dale experiencia (experiencia) o, si es un hito de la historia, pasa por_hito=true.`);
  const nuevo = p.nivel + 1;
  const cambioAtr: string[] = [];
  if (NIVELES_AUMENTO.includes(nuevo)) {
    const a = Object.entries(d.aumento ?? {}).filter(([, v]) => v);
    const malas = a.filter(([k]) => !(ATRIBUTOS as readonly string[]).includes(k)).map(([k]) => k);
    if (malas.length) throw new Error(`Característica no válida: ${malas.join(", ")}. Usa fue, des, con, int, sab o car.`);
    const suma = a.reduce((s, [, v]) => s + (v as number), 0);
    if (!a.length) throw new Error(`El nivel ${nuevo} da un aumento de característica: pasa aumento (+2 a una, o +1 a dos).`);
    if (suma !== 2 || a.some(([, v]) => (v as number) < 1 || (v as number) > 2)) throw new Error("El aumento son 2 puntos: +2 a una característica o +1 a dos distintas.");
    for (const [k, v] of a) {
      if (p.atributos[k as Atributo] + (v as number) > 20) throw new Error(`${k.toUpperCase()} no puede pasar de 20.`);
    }
    for (const [k, v] of a) {
      p.atributos[k as Atributo] += v as number;
      cambioAtr.push(`${k.toUpperCase()} +${v}`);
    }
  } else if (d.aumento && Object.keys(d.aumento).length) throw new Error(`El nivel ${nuevo} no da aumento de característica (solo en ${NIVELES_AUMENTO.join(", ")}).`);
  const c = CLASES.find((x) => x.nombre === p.clase);
  const dado = c?.dadoGolpe ?? 8;
  const fortaleza = p.clase === "Berserker de Ceniza" ? 1 : 0; // +1 PV por nivel
  const m = mod(valor(p, "con"));
  let ganado: number;
  let detalle: string;
  if (d.pv === "tirar") {
    const t = tirar(`1d${dado}`);
    ganado = Math.max(1, t.total + m + fortaleza);
    detalle = `1d${dado} → ${t.total} ${m >= 0 ? "+" : "−"} ${Math.abs(m)} (CON)${fortaleza ? " + 1 (fortaleza)" : ""}`;
  } else {
    ganado = Math.max(1, Math.floor(dado / 2) + 1 + m + fortaleza);
    detalle = `promedio ${Math.floor(dado / 2) + 1} ${m >= 0 ? "+" : "−"} ${Math.abs(m)} (CON)${fortaleza ? " + 1 (fortaleza)" : ""}`;
  }
  p.nivel = nuevo;
  p.pv_max += ganado;
  if (p.pv > 0) p.pv += ganado; // subir de nivel no cura a quien está a 0 PV
  if (p.px === undefined || p.px < PX_NIVEL[nuevo - 1]) p.px = PX_NIVEL[nuevo - 1];
  const rasgos = [...(RASGOS_NIVEL[p.clase]?.[nuevo] ?? [])];
  if (p.clase === "Mercenario del Cuervo") {
    const antes = rangoCompania(nuevo - 1), ahora = rangoCompania(nuevo);
    if (antes.rango !== ahora.rango) rasgos.push(`ASCENSO en la Compañía del Cuervo Negro: ${ahora.rango} (${ahora.grado}). ${ahora.ventaja}`);
  }
  // El Cazador de Brujas veterano recibe el urumi, el arma de los más altos de la orden.
  if (p.clase === "Cazador de Brujas" && nuevo === 5 && !p.inventario.some((x) => /urumi/i.test(x))) {
    const i = p.inventario.findIndex((x) => /l[aá]tigo de metal/i.test(x));
    if (i >= 0) p.inventario.splice(i, 1, "Urumi (espada-látigo)");
    else p.inventario.push("Urumi (espada-látigo)");
  }
  // El Mercenario con don arcano lo despierta al subir de nivel (antes dormía).
  if (p.clase === "Mercenario del Cuervo" && nuevo === 2 && p.magia?.don && p.magia.maestria === "profano") {
    p.magia.maestria = "iniciado";
    despertarMagia(p.clase, p.magia);
    rasgos.push("Don despierto: nació con talento arcano y ahora despierta. Es iniciado en Protección con Piel de hierro (SAB). Su magia, como siempre, cobra un precio");
  }
  p.rasgos = [...(p.rasgos ?? []), ...rasgos.map((r) => `nv. ${nuevo}: ${r}`)];
  const comp = 2 + Math.floor((nuevo - 1) / 4);
  return [
    `⬆ ${p.nombre} sube al nivel ${nuevo} (${p.clase}).`,
    `PV: +${ganado} (${detalle}) → ${p.pv}/${p.pv_max}.`,
    `Bonificador de competencia: +${comp}.`,
    cambioAtr.length ? `Aumento de característica: ${cambioAtr.join(", ")}.` : "",
    rasgos.length ? `Rasgos nuevos:\n- ${rasgos.join("\n- ")}` : nuevo > 5 ? "Sin rasgos de clase predefinidos para este nivel: el DM puede concederle uno acorde a su clase (anótalo en notas)." : "",
    puedeSubir(p) ? "Aún tiene PX para otro nivel." : "",
    p.clase === "Mercenario del Cuervo" && rangoCompania(p.nivel - 1).rango !== rangoCompania(p.nivel).rango ? "Haz que el ascenso se viva en la historia: una ceremonia, un oficial que le entrega la insignia, un contrato nuevo acorde a su rango." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export const REGLAS_PROGRESION = `## Experiencia y niveles
- Reparte experiencia con la herramienta experiencia al acabar un combate (por_criatura, según su peligro), un desafío o un hito. Se divide a partes iguales entre el grupo. En la ficha verás los PX y «⬆ PUEDE SUBIR DE NIVEL».
- Sube de nivel con subir_nivel en un momento tranquilo (tras un descanso): el programa suma los PV (promedio o tirada), la competencia y los rasgos de clase hasta el nivel 5; en los niveles 4, 8, 12, 16 y 19 el jugador elige un aumento de característica (+2 a una o +1 a dos). No cambies el nivel a mano con modificar_personaje salvo para corregir un error.
- Los niveles dan poder lentamente: no regales niveles por hito más de uno cada varias sesiones.`;
