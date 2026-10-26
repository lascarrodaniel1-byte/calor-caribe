// Manos, armas de dos manos y combate con dos armas, tal como lo dicen las reglas básicas de D&D 5e:
// - Propiedades de las armas: ligera, pesada, sutil, versátil, a dos manos, arrojadiza, alcance, munición.
// - Un arma a dos manos (o una versátil empuñada con las dos) ocupa ambas manos: sin escudo ni segunda arma.
// - Escudo: +2 a la CA mientras lo empuña. Cambiar de arma es una interacción gratuita por turno; la segunda cuesta la acción de
//   Usar un objeto; ponerse o quitarse el escudo, una acción.
// - Pelea con dos armas: tras atacar con un arma ligera, la acción adicional ataca con otra arma ligera en la otra mano, sin
//   sumar el modificador de característica al daño (salvo que sea negativo o tenga el estilo de lucha con dos armas).
// - Estilos de lucha: arquería, defensa, duelo, lucha con arma a dos manos, protección y lucha con dos armas.
import type { Partida, Personaje } from "./estado.js";
import { armaduraDe, reconocerArma } from "./armadura.js";
import { mod, valor } from "./reglas.js";

export const ESTILOS = ["arqueria", "defensa", "duelo", "dos_manos", "proteccion", "dos_armas"] as const;
export type Estilo = (typeof ESTILOS)[number];
export const NOMBRE_ESTILO: Record<Estilo, string> = {
  arqueria: "Arquería (+2 a los ataques a distancia)",
  defensa: "Defensa (+1 a la CA llevando armadura)",
  duelo: "Duelo (+2 al daño con un arma en una mano y nada más en la otra)",
  dos_manos: "Lucha con arma a dos manos (repite 1 y 2 en los dados de daño)",
  proteccion: "Protección (con escudo, impone desventaja al ataque contra un aliado adyacente)",
  dos_armas: "Lucha con dos armas (suma el modificador al daño del segundo ataque)",
};

export interface Propiedades {
  nombre: string;
  ligera?: boolean;
  pesada?: boolean;
  sutil?: boolean;
  /** Daño cuando se empuña con las dos manos. */
  versatil?: string;
  dosManos?: boolean;
  arrojadiza?: { normal: number; largo: number };
  alcance?: boolean;
  municion?: boolean;
}

/** Armas conocidas, de más específica a más genérica. */
const TABLA: { patron: RegExp; p: Propiedades }[] = [
  { patron: /colmillo de hierro/i, p: { nombre: "Colmillo de Hierro", pesada: true, dosManos: true } },
  { patron: /shotel|espada curva/i, p: { nombre: "shotel", ligera: true, sutil: true } },
  { patron: /urumi|espada.l[aá]tigo/i, p: { nombre: "urumi", sutil: true, alcance: true } },
  { patron: /l[aá]tigo de (metal|eslabones|acero|cadena)/i, p: { nombre: "látigo de metal", sutil: true, alcance: true } },
  { patron: /flagelo/i, p: { nombre: "flagelo", ligera: true, sutil: true } },
  { patron: /estoque|rapier|misericordia/i, p: { nombre: "estoque", sutil: true } },
  { patron: /(sable|alfanje) de abordaje/i, p: { nombre: "sable de abordaje", ligera: true, sutil: true } },
  { patron: /hacha de abordaje/i, p: { nombre: "hacha de abordaje", ligera: true } },
  { patron: /chuzo/i, p: { nombre: "chuzo de abordaje", pesada: true, dosManos: true, alcance: true } },
  { patron: /espada corta/i, p: { nombre: "espada corta", ligera: true, sutil: true } },
  { patron: /kunai/i, p: { nombre: "kunai", ligera: true, sutil: true, arrojadiza: { normal: 6, largo: 18 } } },
  { patron: /cadenas?\b/i, p: { nombre: "cadenas", alcance: true } },
  { patron: /daga|cuchillo|pu[ñn]al|navaja|estilete/i, p: { nombre: "daga", ligera: true, sutil: true, arrojadiza: { normal: 6, largo: 18 } } },
  { patron: /espad[oó]n|mandoble|montante|atarraga/i, p: { nombre: "espadón", pesada: true, dosManos: true } },
  { patron: /espada larga|espada de bastarda|sable|alfanje/i, p: { nombre: "espada larga", versatil: "1d10" } },
  { patron: /hacha de mano|hachuela/i, p: { nombre: "hacha de mano", ligera: true, arrojadiza: { normal: 6, largo: 18 } } },
  { patron: /hacha a dos manos|gran hacha|hacha grande/i, p: { nombre: "hacha a dos manos", pesada: true, dosManos: true } },
  { patron: /hacha de batalla|hacha de guerra/i, p: { nombre: "hacha de batalla", versatil: "1d10" } },
  { patron: /alabarda|guada[ñn]a|guja|bisarma/i, p: { nombre: "arma de asta", pesada: true, dosManos: true, alcance: true } },
  { patron: /pica/i, p: { nombre: "pica", pesada: true, dosManos: true, alcance: true } },
  { patron: /martillo de guerra/i, p: { nombre: "martillo de guerra", versatil: "1d10" } },
  { patron: /maza|garrote|porra/i, p: { nombre: "maza", } },
  { patron: /bast[oó]n|cayado/i, p: { nombre: "bastón", versatil: "1d8" } },
  { patron: /jabalina/i, p: { nombre: "jabalina", arrojadiza: { normal: 9, largo: 36 } } },
  { patron: /tridente|lanza/i, p: { nombre: "lanza", versatil: "1d8", arrojadiza: { normal: 6, largo: 18 } } },
  { patron: /cerbatana/i, p: { nombre: "cerbatana", municion: true } },
  { patron: /ballesta pesada/i, p: { nombre: "ballesta pesada", municion: true, dosManos: true, pesada: true } },
  { patron: /ballesta ligera|ballesta/i, p: { nombre: "ballesta ligera", municion: true, dosManos: true } },
  { patron: /arco largo/i, p: { nombre: "arco largo", municion: true, dosManos: true, pesada: true } },
  { patron: /arco/i, p: { nombre: "arco", municion: true, dosManos: true } },
  { patron: /sierra de huesos|estaca/i, p: { nombre: "arma ligera", ligera: true } },
];

export function propiedades(texto?: string): Propiedades | undefined {
  return texto ? TABLA.find((t) => t.patron.test(texto))?.p : undefined;
}

export interface Manos {
  principal?: string;
  secundaria?: string;
  /** Empuña un arma a dos manos (o una versátil con las dos manos). */
  dosManos?: boolean;
}

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const esEscudo = (t?: string) => !!t && /escudo|rodela|adarga/i.test(t);
const contiene = (nombre: string, otro?: string) => !!otro && (norm(nombre).includes(norm(otro)) || norm(otro).includes(norm(nombre)));

function enInventario(p: Personaje, nombre: string): string | undefined {
  return p.inventario.find((x) => norm(x) === norm(nombre)) ?? p.inventario.find((x) => contiene(x, nombre));
}

/** CA real: la de la ficha (que cuenta el escudo si lo lleva) menos 2 si el escudo no está en una mano, más 1 con el estilo Defensa. */
export function caEfectiva(p: Personaje): number {
  let ca = p.ca;
  if (p.manos) {
    const tieneEscudo = p.inventario.some((x) => esEscudo(x));
    const empunado = esEscudo(p.manos.secundaria) && !p.manos.dosManos;
    if (tieneEscudo && !empunado) ca -= 2;
  }
  if (p.estilo === "defensa" && armaduraDe(p).piezas.length) ca += 1;
  if (p.pielHueso) ca += 2; // invocación del Segador
  return ca;
}

/** Al empezar un combate, quien no ha dicho qué empuña recibe lo más lógico de su inventario. */
export function autoManos(p: Personaje): string {
  if (p.manos) return "";
  const armas = p.inventario.filter((x) => reconocerArma(x) && !/virote|flecha|dardo/i.test(x));
  const principal = armas.find((x) => !propiedades(x)?.municion) ?? armas[0];
  if (!principal) { p.manos = {}; return ""; }
  const pr = propiedades(principal);
  const escudo = p.inventario.find((x) => esEscudo(x));
  const m: Manos = { principal };
  if (pr?.dosManos) m.dosManos = true;
  else if (escudo) m.secundaria = escudo;
  else {
    const otra = armas.find((x) => x !== principal && propiedades(x)?.ligera && pr?.ligera);
    if (otra) m.secundaria = otra;
  }
  p.manos = m;
  return `${p.nombre} empuña ${m.dosManos ? `${principal} a dos manos` : `${principal}${m.secundaria ? ` y ${m.secundaria}` : ""}`}.`;
}

export interface DatosEmpunar {
  quien: string;
  principal?: string;
  secundaria?: string;
  a_dos_manos?: boolean;
  /** En combate, el segundo cambio de objeto del asalto (o ponerse el escudo) gasta su acción. */
  usa_accion?: boolean;
}

function buscarPj(partida: Partida, quien: string): Personaje {
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(quien) || (x.jugador && norm(x.jugador) === norm(quien)));
  if (!p) throw new Error(`No hay ningún personaje llamado «${quien}».`);
  return p;
}

export function empunar(partida: Partida, d: DatosEmpunar): string {
  const p = buscarPj(partida, d.quien);
  if (p.condiciones.includes("muerto") || p.pv <= 0) throw new Error(`${p.nombre} no puede cambiar lo que empuña.`);
  const antes = p.manos ?? {};
  const resolver = (t?: string) => {
    if (t === undefined) return undefined;
    if (!t.trim() || /^(ninguna|nada|vac[ií]a?)$/i.test(t.trim())) return "";
    const i = enInventario(p, t);
    if (!i) throw new Error(`${p.nombre} no tiene «${t}» en el inventario (tiene: ${p.inventario.join(", ") || "nada"}).`);
    return i;
  };
  const pr = resolver(d.principal);
  const se = resolver(d.secundaria);
  const nuevo: Manos = { principal: pr === undefined ? antes.principal : pr || undefined, secundaria: se === undefined ? antes.secundaria : se || undefined, dosManos: false };
  const propsP = propiedades(nuevo.principal);
  const dos = !!nuevo.principal && (!!propsP?.dosManos || (!!d.a_dos_manos && !!propsP?.versatil));
  if (d.a_dos_manos && nuevo.principal && !propsP?.dosManos && !propsP?.versatil) throw new Error(`${nuevo.principal} no se puede empuñar a dos manos (no es versátil ni de dos manos).`);
  if (dos) {
    if (se) throw new Error(`${nuevo.principal} ocupa las dos manos: no puedes empuñar a la vez ${se}.`);
    nuevo.secundaria = undefined;
    nuevo.dosManos = true;
  } else {
    const propsS = propiedades(nuevo.secundaria);
    if (propsS?.dosManos && !esEscudo(nuevo.secundaria)) throw new Error(`${nuevo.secundaria} es un arma a dos manos: no cabe en una sola mano.`);
  }
  // Economía del turno: una interacción gratuita; la segunda, o el escudo, gastan la acción.
  const c = partida.combate;
  const costes: string[] = [];
  if (c) {
    c.turnos ??= {};
    const clave = Object.keys(c.turnos).find((k) => norm(k) === norm(p.nombre)) ?? p.nombre;
    const t = (c.turnos[clave] ??= {});
    const escudoCambia = esEscudo(antes.secundaria) !== esEscudo(nuevo.secundaria);
    if (escudoCambia) {
      if (!d.usa_accion) throw new Error(`Ponerse o quitarse el escudo cuesta una acción: confírmalo con usa_accion=true.`);
      costes.push("gasta su acción (el escudo)");
    } else {
      t.interacciones = (t.interacciones ?? 0) + 1;
      if (t.interacciones > 1) {
        if (!d.usa_accion) throw new Error(`${p.nombre} ya sacó o envainó un arma este asalto gratis; una segunda interacción gasta la acción de Usar un objeto (usa_accion=true).`);
        costes.push("gasta su acción (segundo cambio de objeto)");
      } else costes.push("es una interacción gratuita");
    }
  }
  p.manos = nuevo;
  const ca = caEfectiva(p);
  return `${p.nombre} empuña ${nuevo.dosManos ? `${nuevo.principal} con las dos manos${propsP?.versatil ? ` (daño versátil ${propsP.versatil})` : ""}` : `${nuevo.principal ?? "nada"} en la principal y ${nuevo.secundaria ?? "nada"} en la otra`}${costes.length ? ` (${costes.join("; ")})` : ""}. CA ${ca}.`;
}

export function estiloCombate(partida: Partida, d: { quien: string; estilo: Estilo }): string {
  const p = buscarPj(partida, d.quien);
  const minimo: Record<string, number> = { "Mercenario del Cuervo": 1, "Caballero Juramentado": 2, "Cazador de Brujas": 2 };
  const nv = minimo[p.clase];
  if (nv === undefined) throw new Error(`${p.nombre} (${p.clase}) no tiene un estilo de lucha que elegir (lo tienen el Mercenario, el Caballero desde el nivel 2 y el Cazador de Brujas desde el 2).`);
  if (p.nivel < nv) throw new Error(`${p.nombre} aún no tiene estilo de lucha (nivel ${nv}).`);
  if (p.estilo) throw new Error(`${p.nombre} ya eligió ${NOMBRE_ESTILO[p.estilo as Estilo]}: no se cambia.`);
  p.estilo = d.estilo;
  return `${p.nombre} adopta el estilo de lucha ${NOMBRE_ESTILO[d.estilo]}.${d.estilo === "proteccion" && !esEscudo(p.manos?.secundaria) ? " Necesita un escudo en la mano para usarlo." : ""}`;
}

export function textoManos(p: Personaje): string {
  if (!p.manos && !p.estilo) return "";
  const m = p.manos;
  const manos = m && (m.principal || m.secundaria) ? `Empuña: ${m.dosManos ? `${m.principal} (dos manos)` : `${m.principal ?? "—"} / ${m.secundaria ?? "—"}`}` : "";
  return `  ✋ ${[manos, p.estilo ? `Estilo: ${NOMBRE_ESTILO[p.estilo as Estilo]}` : ""].filter(Boolean).join(" · ")}${manos ? ` · CA ${caEfectiva(p)}` : ""}`;
}

// ---------------------------------------------------------------- ajustes al atacar

/** Suma de los números sueltos de una expresión de daño ("1d8+3+1" → 4). */
function sueltos(expr: string): number {
  return expr.replace(/\s+/g, "").replace(/-/g, "+-").split("+").filter((x) => x && !/d/i.test(x)).reduce((s, x) => s + Number(x), 0);
}
function conSueltos(expr: string, nuevo: number): string {
  const dados = expr.replace(/\s+/g, "").replace(/-/g, "+-").split("+").filter((x) => x && /d/i.test(x)).join("+").replace(/\+-/g, "-");
  return nuevo === 0 ? dados : `${dados}${nuevo > 0 ? "+" : ""}${nuevo}`;
}

export interface AjusteAtaque {
  /** Cambios que pasar a atacar. */
  dano?: string;
  bono_arma?: number;
  desventaja?: boolean;
  repetirBajos?: boolean;
  notas: string[];
}

/**
 * Reglas del libro para un ataque de un personaje: el arma debe estar en su mano, la segunda arma exige acción adicional y
 * armas ligeras, las pesadas penalizan a los pequeños, y los estilos de lucha. Lanza error si el ataque no es válido.
 */
/** Destreza mínima para atacar con dos armas (regla de la casa: el libro solo pide que sean ligeras). */
export const DES_DOS_ARMAS = 13;

export function ajustarAtaque(partida: Partida, d: { atacante: string; arma?: string; dano?: string; a_distancia?: boolean; atributo?: string; mano_secundaria?: boolean; reaccion?: boolean }): AjusteAtaque {
  const notas: string[] = [];
  const p = Object.values(partida.personajes).find((x) => norm(x.nombre) === norm(d.atacante));
  if (!p) return { notas };
  const m = p.manos;
  const res: AjusteAtaque = { notas };
  const enCombate = !!partida.combate;
  let t: { atacoLigero?: boolean; adicional?: string; interacciones?: number } | undefined;
  if (enCombate) {
    partida.combate!.turnos ??= {};
    const clave = Object.keys(partida.combate!.turnos).find((k) => norm(k) === norm(p.nombre)) ?? p.nombre;
    t = (partida.combate!.turnos[clave] ??= {});
  }
  // 1. Qué arma, y que esté en su mano.
  let arma = d.arma;
  if (d.mano_secundaria) {
    if (!m?.secundaria || m.dosManos || esEscudo(m.secundaria)) throw new Error(`${p.nombre} no tiene un arma en la mano secundaria: empuña dos armas ligeras con empuñar.`);
    arma = m.secundaria;
  } else if (!arma && m?.principal) arma = m.principal;
  const props = propiedades(arma);
  if (m && d.arma && !d.mano_secundaria && !d.a_distancia && !/estaca/i.test(d.arma)) {
    const en = contiene(d.arma, m.principal) || contiene(d.arma, m.secundaria);
    if (!en) throw new Error(`${p.nombre} no empuña «${d.arma}»: lleva ${m.dosManos ? `${m.principal} a dos manos` : `${m.principal ?? "nada"} y ${m.secundaria ?? "nada"}`}. Usa empuñar antes.`);
  }
  const dosManosAhora = !!m?.dosManos || !!props?.dosManos;
  // 2. Segundo ataque con la otra mano.
  if (d.mano_secundaria) {
    const pp = propiedades(m!.principal);
    if (!pp?.ligera || !props?.ligera) throw new Error(`Pelea con dos armas: las dos armas deben ser ligeras (${m!.principal ?? "—"} y ${m!.secundaria}).`);
    if (valor(p, "des") < DES_DOS_ARMAS) throw new Error(`Pelea con dos armas: exige destreza ${DES_DOS_ARMAS} o más (${p.nombre} tiene ${valor(p, "des")}). Con menos, la segunda arma solo sirve para parar o intimidar.`);
    if (t && !t.atacoLigero) throw new Error(`${p.nombre} aún no ha atacado con su arma ligera principal este asalto: el segundo ataque exige primero la acción de Atacar con una arma ligera.`);
    if (t?.adicional) throw new Error(`${p.nombre} ya usó su acción adicional este asalto (${t.adicional}).`);
    if (t) t.adicional = "ataque con la mano secundaria";
    // No suma el modificador de característica al daño, salvo que sea negativo o tenga el estilo con dos armas.
    if (d.dano && p.estilo !== "dos_armas") {
      const sutil = props?.sutil;
      const attr = (d.atributo as "fue" | "des" | undefined) ?? (sutil ? (valor(p, "des") > valor(p, "fue") ? "des" : "fue") : "fue");
      const mAttr = mod(valor(p, attr));
      if (mAttr > 0) {
        const flat = sueltos(d.dano);
        res.dano = conSueltos(d.dano, flat - mAttr);
        notas.push(`Segunda arma: no suma su modificador (${mAttr > 0 ? "+" : ""}${mAttr}) al daño (daño ${res.dano}).`);
      } else notas.push("Segunda arma: su modificador es negativo, así que sí se resta.");
    } else notas.push("Segunda arma: con el estilo de lucha con dos armas, sí suma su modificador al daño.");
  } else if (enCombate && !d.reaccion && !d.a_distancia && props?.ligera && t) {
    t.atacoLigero = true; // habilita el segundo ataque con la acción adicional
  }
  // 3. Armas pesadas y pequeños.
  if (props?.pesada && /mediano/i.test(p.raza)) {
    res.desventaja = true;
    notas.push(`${p.nombre} es de talla pequeña: desventaja con un arma pesada.`);
  }
  // 4. Arrojadizas: alcance normal y largo.
  // 5. Daño versátil a dos manos.
  if (props?.versatil && m?.dosManos && contiene(arma ?? "", m.principal)) notas.push(`Arma versátil a dos manos: daño ${props.versatil}.`);
  // 6. Rigidez de heridas: −1 con armas a dos manos.
  if (dosManosAhora && p.heridas.some((h) => /rigidez/i.test(`${h.descripcion} ${h.estructura}`))) { res.bono_arma = (res.bono_arma ?? 0) - 1; notas.push("Rigidez por una herida: −1 con armas a dos manos."); }
  // 7. Estilos de lucha.
  if (p.estilo === "arqueria" && d.a_distancia && props?.municion) { res.bono_arma = (res.bono_arma ?? 0) + 2; notas.push("Estilo Arquería: +2 al ataque."); }
  if (p.estilo === "duelo" && !d.a_distancia && d.dano && !d.mano_secundaria && !dosManosAhora && m && (!m.secundaria || esEscudo(m.secundaria))) {
    res.dano = `${res.dano ?? d.dano}+2`;
    notas.push("Estilo Duelo: +2 al daño.");
  }
  if (p.estilo === "dos_manos" && dosManosAhora && !d.a_distancia) { res.repetirBajos = true; notas.push("Estilo Lucha con arma a dos manos: repite los 1 y 2 de los dados de daño."); }
  return res;
}

export const REGLAS_MANOS = `## Manos, armas de dos manos y dos armas (como el libro de reglas)
- Cada arma tiene sus propiedades: ligera, pesada, sutil, versátil, a dos manos, arrojadiza, alcance, munición. Empuña con empuñar (principal, secundaria, a_dos_manos); el programa lo guarda, lo muestra en la ficha («Empuña: …») y lo comprueba al atacar: no se ataca con un arma que no se tiene en la mano. Al empezar un combate, quien no lo dijo recibe lo más lógico de su inventario.
- Un arma a dos manos (o una versátil empuñada con las dos) ocupa las dos manos: sin escudo ni segunda arma. El escudo da +2 a la CA mientras está en la mano; con un arma a dos manos, o sin él, la CA baja 2 (el programa la calcula). Ponerse o quitarse el escudo cuesta una acción; sacar o envainar un arma es una interacción gratuita por turno, y la segunda gasta la acción.
- Pelea con dos armas (exige DES 13 o más, regla de la casa): tras atacar con una arma ligera, la acción adicional ataca con otra arma ligera en la otra mano (atacar {mano_secundaria: true}). No suma el modificador de característica al daño (el programa se lo quita de dano; ponlo como siempre), salvo que sea negativo o tenga el estilo de lucha con dos armas. Una sola acción adicional por asalto: Segundo aliento, la furia y este ataque compiten por ella. Idea de fondo: el arma a dos manos pega más fuerte (dados mayores), el arma de una mano deja la otra libre para lo que se quiera (escudo, antorcha, mano vacía…) y las dos armas pegan menos cada una pero dan más versatilidad.
- Armas pesadas: desventaja para los de talla pequeña (los Medianos). Versátiles a dos manos: daño mayor. Rigidez de una herida: −1 con armas a dos manos.
- Estilo de lucha (estilo_combate; Mercenario, Caballero desde nv. 2, Cazador desde nv. 2): arquería, defensa, duelo, lucha con arma a dos manos, protección o lucha con dos armas.`;
