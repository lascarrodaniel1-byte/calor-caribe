// Condiciones de las reglas básicas de D&D 5e con efectos reales. Antes eran texto libre en la ficha; ahora el
// programa reconoce las del catálogo (por su nombre, aunque lleve una nota: «paralizado 1 minuto») y las aplica
// solo en ataques, salvaciones y pruebas. Las condiciones que no están en el catálogo siguen siendo texto libre.

export interface Condicion {
  id: string;
  nombre: string;
  patron: RegExp;
  /** Resumen de la regla, tal como se le enseña al DM. */
  regla: string;
  /** Sus propios ataques y pruebas de característica. */
  ataca?: "ventaja" | "desventaja";
  pruebas?: "desventaja";
  /** Ataques contra quien la sufre. */
  contraCuerpo?: "ventaja" | "desventaja";
  contraDistancia?: "ventaja" | "desventaja";
  incapacitado?: boolean;
  velocidad0?: boolean;
  /** Falla automáticamente las salvaciones de estos atributos. */
  falla?: ("fue" | "des")[];
  salvDesDesv?: boolean;
  /** Un impacto cuerpo a cuerpo a quemarropa es crítico. */
  critCuerpo?: boolean;
}

export const CATALOGO: Condicion[] = [
  { id: "cegado", nombre: "cegado", patron: /cegad|ciego/i, regla: "no ve: falla las pruebas que requieren vista; sus ataques tienen desventaja y los ataques contra él, ventaja", ataca: "desventaja", contraCuerpo: "ventaja", contraDistancia: "ventaja" },
  { id: "hechizado", nombre: "hechizado", patron: /hechizad|encantad/i, regla: "no puede atacar a quien lo hechizó ni tomarlo como objetivo de efectos dañinos; quien lo hechizó tiene ventaja en las pruebas sociales contra él" },
  { id: "ensordecido", nombre: "ensordecido", patron: /ensordecid|sordo/i, regla: "no oye: falla las pruebas que requieren oído" },
  { id: "asustado", nombre: "asustado", patron: /asustad|aterrad|despavorid/i, regla: "desventaja en pruebas y ataques mientras vea la fuente del miedo; no puede acercarse voluntariamente a ella", ataca: "desventaja", pruebas: "desventaja" },
  { id: "agarrado", nombre: "agarrado", patron: /agarrad|apresad/i, regla: "su velocidad es 0 y no la mejora; termina si quien lo agarra queda incapacitado o lo apartan de su alcance", velocidad0: true },
  { id: "incapacitado", nombre: "incapacitado", patron: /incapacitad/i, regla: "no puede realizar acciones ni reacciones", incapacitado: true },
  { id: "invisible", nombre: "invisible", patron: /invisible/i, regla: "no se le ve sin magia o sentidos especiales; sus ataques tienen ventaja y los ataques contra él, desventaja", ataca: "ventaja", contraCuerpo: "desventaja", contraDistancia: "desventaja" },
  { id: "paralizado", nombre: "paralizado", patron: /paralizad|paralítico/i, regla: "incapacitado y sin moverse ni hablar; falla las salvaciones de FUE y DES; los ataques contra él tienen ventaja y los cuerpo a cuerpo a quemarropa son críticos", incapacitado: true, velocidad0: true, falla: ["fue", "des"], contraCuerpo: "ventaja", contraDistancia: "ventaja", critCuerpo: true },
  { id: "petrificado", nombre: "petrificado", patron: /petrificad[oa]/i, regla: "convertido en piedra: incapacitado, sin moverse, falla las salvaciones de FUE y DES, los ataques contra él tienen ventaja y resiste todo el daño", incapacitado: true, velocidad0: true, falla: ["fue", "des"], contraCuerpo: "ventaja", contraDistancia: "ventaja" },
  { id: "envenenado", nombre: "envenenado", patron: /envenenad/i, regla: "desventaja en tiradas de ataque y pruebas de característica", ataca: "desventaja", pruebas: "desventaja" },
  { id: "derribado", nombre: "derribado", patron: /derribad|tumbad|caíd[oa]\b/i, regla: "solo puede arrastrarse (o levantarse gastando la mitad de su movimiento); sus ataques tienen desventaja; los ataques cuerpo a cuerpo contra él tienen ventaja y los de distancia, desventaja", ataca: "desventaja", contraCuerpo: "ventaja", contraDistancia: "desventaja" },
  { id: "retenido", nombre: "retenido", patron: /retenid|inmovilizad|^atrapad[oa]\s*(\(|$)|enredad/i, regla: "velocidad 0; desventaja en sus ataques y en las salvaciones de DES; los ataques contra él tienen ventaja", ataca: "desventaja", contraCuerpo: "ventaja", contraDistancia: "ventaja", velocidad0: true, salvDesDesv: true },
  { id: "aturdido", nombre: "aturdido", patron: /aturdid/i, regla: "incapacitado, sin moverse y hablando a duras penas; falla las salvaciones de FUE y DES; los ataques contra él tienen ventaja", incapacitado: true, velocidad0: true, falla: ["fue", "des"], contraCuerpo: "ventaja", contraDistancia: "ventaja" },
  { id: "nervio", nombre: "brazo entumecido", patron: /brazo entumecido|nervio da[ñn]ado/i, regla: "un brazo no le responde (nervio golpeado): suelta lo que sostiene con él; desventaja en sus ataques y en pruebas de característica", ataca: "desventaja", pruebas: "desventaja" },
  { id: "pierna", nombre: "pierna entumecida", patron: /pierna entumecida/i, regla: "no puede moverse (velocidad 0) y tiene desventaja en las salvaciones de DES (nervio de la pierna golpeado)", velocidad0: true, salvDesDesv: true },
  { id: "inconsciente", nombre: "inconsciente", patron: /inconsciente|dormid[oa]\b|en coma/i, regla: "incapacitado, tirado, sin moverse ni enterarse; suelta lo que sostiene; falla las salvaciones de FUE y DES; los ataques contra él tienen ventaja y los cuerpo a cuerpo a quemarropa son críticos", incapacitado: true, velocidad0: true, falla: ["fue", "des"], contraCuerpo: "ventaja", contraDistancia: "ventaja", critCuerpo: true },
];

const AGOTAMIENTO = /agotamiento\s*(\d)/i;

/** Niveles de agotamiento (1-6) de una lista de condiciones. */
export function nivelAgotamiento(conds: string[]): number {
  let n = 0;
  for (const c of conds) {
    const m = AGOTAMIENTO.exec(c);
    if (m) n = Math.max(n, Number(m[1]));
  }
  return Math.min(6, n);
}

export const REGLA_AGOTAMIENTO = [
  "1: desventaja en pruebas de característica",
  "2: velocidad a la mitad",
  "3: desventaja en ataques y salvaciones",
  "4: PV máximos a la mitad",
  "5: velocidad 0",
  "6: muerte",
];

/** La condición del catálogo a la que se refiere el texto (si alguna). */
export function reconocer(texto: string): Condicion | undefined {
  // «sin conocimiento / inconsciente (anemia)» etc.: basta que el nombre aparezca.
  return CATALOGO.find((c) => c.patron.test(texto));
}

export interface Efectos {
  ids: string[];
  ataca: "ventaja" | "desventaja" | null;
  pruebas: "desventaja" | null;
  incapacitado: boolean;
  velocidad0: boolean;
  falla: Set<string>;
  salvDesDesv: boolean;
  salvDesv: boolean;
  contraCuerpo: "ventaja" | "desventaja" | null;
  contraDistancia: "ventaja" | "desventaja" | null;
  critCuerpo: boolean;
  /** Por fuente, sin anular: una ventaja y una desventaja de cualquier origen se cancelan entre sí al tirar (regla del libro). */
  atacaV: boolean; atacaD: boolean; cuerpoV: boolean; cuerpoD: boolean; distV: boolean; distD: boolean;
  agotamiento: number;
  /** Líneas legibles de por qué. */
  motivos: string[];
}

/** Junta ventaja y desventaja de varias fuentes: si hay de las dos, se anulan. */
function juntar(a: ("ventaja" | "desventaja" | undefined)[]): "ventaja" | "desventaja" | null {
  const v = a.includes("ventaja");
  const d = a.includes("desventaja");
  return v && d ? null : v ? "ventaja" : d ? "desventaja" : null;
}

export function efectos(conds: string[]): Efectos {
  const hallados = new Map<string, Condicion>();
  for (const t of conds) {
    const c = reconocer(t);
    if (c) hallados.set(c.id, c);
  }
  const lista = [...hallados.values()];
  const ag = nivelAgotamiento(conds);
  const motivos = lista.map((c) => c.nombre);
  if (ag) motivos.push(`agotamiento ${ag}`);
  return {
    ids: lista.map((c) => c.id),
    // Con ventaja y desventaja a la vez no se suman: se anulan (regla general).
    ataca: juntar([...lista.map((c) => c.ataca), ag >= 3 ? "desventaja" : undefined]),
    pruebas: juntar([...lista.map((c) => c.pruebas), ag >= 1 ? "desventaja" : undefined]) === "desventaja" ? "desventaja" : null,
    incapacitado: lista.some((c) => c.incapacitado),
    velocidad0: lista.some((c) => c.velocidad0) || ag >= 5,
    falla: new Set(lista.flatMap((c) => c.falla ?? [])),
    salvDesDesv: lista.some((c) => c.salvDesDesv),
    salvDesv: ag >= 3,
    contraCuerpo: juntar(lista.map((c) => c.contraCuerpo)),
    contraDistancia: juntar(lista.map((c) => c.contraDistancia)),
    critCuerpo: lista.some((c) => c.critCuerpo),
    atacaV: lista.some((c) => c.ataca === "ventaja"),
    atacaD: lista.some((c) => c.ataca === "desventaja") || ag >= 3,
    cuerpoV: lista.some((c) => c.contraCuerpo === "ventaja"), cuerpoD: lista.some((c) => c.contraCuerpo === "desventaja"),
    distV: lista.some((c) => c.contraDistancia === "ventaja"), distD: lista.some((c) => c.contraDistancia === "desventaja"),
    agotamiento: ag,
    motivos,
  };
}

/** Texto para la ficha: cada condición reconocida con su efecto en pocas palabras. */
export function textoEfectos(conds: string[]): string {
  const e = efectos(conds);
  if (!e.ids.length && !e.agotamiento) return "";
  const lineas = e.ids.map((id) => {
    const c = CATALOGO.find((x) => x.id === id)!;
    return `${c.nombre}: ${c.regla}`;
  });
  if (e.agotamiento) lineas.push(`agotamiento ${e.agotamiento}: ${REGLA_AGOTAMIENTO.slice(0, e.agotamiento).join("; ")}`);
  return lineas.join(" | ");
}

/** Por qué un personaje no puede usar un poder ahora (muerto, a 0 PV o incapacitado); null si puede. */
export function motivoNoActua(p: { nombre: string; pv: number; condiciones: string[] }): string | null {
  if (p.condiciones.includes("muerto")) return `${p.nombre} está muerto`;
  if (p.pv <= 0) return `${p.nombre} está a 0 PV`;
  const e = efectos(p.condiciones);
  if (e.incapacitado) return `${p.nombre} está ${e.motivos.join(", ")}: no puede actuar`;
  return null;
}

/** Añade una condición a una lista sin duplicarla; el agotamiento solo sube de nivel, nunca baja por añadir. */
export function agregarCondicion(lista: string[], texto: string): boolean {
  const nuevoAg = AGOTAMIENTO.exec(texto);
  if (nuevoAg) {
    const actual = nivelAgotamiento(lista);
    if (Number(nuevoAg[1]) <= actual) return false;
    const resto = lista.filter((x) => !AGOTAMIENTO.test(x));
    lista.splice(0, lista.length, ...resto, texto);
    return true;
  }
  if (lista.some((x) => mismaCondicion(x, texto))) return false;
  lista.push(texto);
  return true;
}

/** Quita de una lista las condiciones que corresponden al mismo nombre del catálogo (para no duplicar). */
export function mismaCondicion(a: string, b: string): boolean {
  if (a.toLowerCase() === b.toLowerCase()) return true;
  const ca = reconocer(a);
  const cb = reconocer(b);
  if (ca && cb) return ca.id === cb.id;
  const aa = AGOTAMIENTO.test(a), ab = AGOTAMIENTO.test(b);
  return aa && ab;
}

export const REGLAS_CONDICIONES = `## Condiciones (el programa aplica sus efectos)
- Aplica y quita condiciones con la herramienta condicion (sirve para personajes, criaturas y PNJ en combate). Las del catálogo —cegado, hechizado, ensordecido, asustado, agarrado, incapacitado, invisible, paralizado, petrificado, envenenado, derribado, retenido, aturdido, inconsciente y agotamiento 1-6— tienen efectos reales: el programa da ventaja o desventaja en ataques, falla automáticamente salvaciones de FUE/DES, vuelve críticos los impactos a quemarropa sobre paralizados e inconscientes, e impide atacar a quien está incapacitado. No los apliques tú «de palabra»: usa la herramienta, con la duración si la hay.
- Quien está incapacitado (o aturdido, paralizado, petrificado, inconsciente) no actúa ni reacciona: no le des turno. Derribado: levantarse cuesta la mitad del movimiento. Agarrado: velocidad 0. Un efecto ya terminado se quita con condicion {accion: quitar}.
- Las condiciones de la lista que aplican las criaturas con sus habilidades (condicion en habilidad_criatura) se registran solas.`;
