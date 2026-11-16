// Catálogo compacto por clases (optimización de consumo, docs/OPTIMIZACION.md): las acciones exclusivas de las clases que no están
// en la mesa salen solo por nombre; sin argumento el catálogo es completo; nada se pierde y la acción sigue consultable.
import { catalogoCompacto, consultarReglas, ACCIONES_DE_CLASE } from "../../src/prompt-web.ts";
import { herramientas } from "../../src/herramientas.ts";
import { readFileSync } from "node:fs";

let ok = 0, mal = 0;
const t = (c: boolean, m: string) => { console.log(c ? "ok   " : "FALLA", m); c ? ok++ : mal++; };
const linea = (cat: string, n: string) => cat.split("\n").some((l) => l.startsWith(`- ${n}(`));
const nombres = herramientas.map((h) => h.name);
const todas = Object.values(ACCIONES_DE_CLASE).flat();
const PALABRA: Record<string, string> = { Flagelante: "Flagelante", "Barbero-Cirujano": "Barbero", Segador: "Segador", Degollador: "Degollador", "Cazador de Brujas": "Cazador", "Caballero Juramentado": "Caballero" };

const completo = catalogoCompacto();
t(todas.every((n) => linea(completo, n)), "sin argumento: el catálogo es completo (todas las acciones de clase con su línea)");
t(!/no están en la mesa/.test(completo), "sin argumento: sin línea de clases ausentes");
t(nombres.every((n) => linea(completo, n)), "sin argumento: las 88 herramientas tienen línea");
for (const [clase, acc] of Object.entries(ACCIONES_DE_CLASE)) {
  t(acc.every((n) => nombres.includes(n)), `${clase}: todas sus acciones existen`);
  t(acc.every((n) => herramientas.find((h) => h.name === n)!.description!.includes(PALABRA[clase])), `${clase}: la descripción de cada acción nombra a la clase`);
}
const dup = todas.filter((n, i) => todas.indexOf(n) !== i);
t(dup.length === 0, "ninguna acción está asignada a dos clases");

const tipica = catalogoCompacto(["Flagelante", "Hechicero", "Mercenario del Cuervo"]);
t(ACCIONES_DE_CLASE.Flagelante.every((n) => linea(tipica, n)), "mesa con Flagelante: sus acciones llevan línea completa");
t(["Segador", "Degollador", "Cazador de Brujas", "Caballero Juramentado", "Barbero-Cirujano"].flatMap((c) => ACCIONES_DE_CLASE[c]).every((n) => !linea(tipica, n)), "las de las clases ausentes no llevan línea");
const aparte = tipica.split("\n").find((l) => /no están en la mesa/.test(l)) ?? "";
t(["Segador", "Degollador", "Cazador de Brujas", "Caballero Juramentado", "Barbero-Cirujano"].flatMap((c) => ACCIONES_DE_CLASE[c]).every((n) => aparte.includes(n)), "pero todas aparecen por nombre en la línea de clases ausentes");
t(!ACCIONES_DE_CLASE.Flagelante.some((n) => aparte.includes(n)), "la línea de ausentes no repite las de una clase presente");
t(/consultar_reglas \{tema: "accion", nombre\}/.test(aparte), "la línea indica cómo leer el esquema");
for (const n of ["lanzar_hechizo", "aprender_tipo", "comprender_magia", "estilo_combate", "usar_recurso", "arte_marcial", "buscados"]) t(linea(catalogoCompacto(["Mercenario del Cuervo"]), n), `${n} va siempre (no es exclusiva de una clase de la lista)`);
t(nombres.every((n) => linea(tipica, n) || aparte.includes(n)), "todas las herramientas siguen alcanzables (línea o nombre)");
t(catalogoCompacto(["Hechicero", "Flagelante", "Mercenario del Cuervo"]) === tipica, "el orden de las clases no cambia el texto (prefijo estable)");
t(catalogoCompacto([]) !== completo && catalogoCompacto([]).includes("sangre_ajena,"), "lista vacía: todas por nombre");
t(tipica.length < completo.length - 3500, `ahorro real: ${completo.length} → ${tipica.length} car.`);
const r = consultarReglas("accion", "papeles");
t(/papeles:/.test(r) && /Esquema:/.test(r), "una acción omitida se sigue consultando con consultar_reglas {tema: accion}");
const web = readFileSync(new URL("../../web/artifact.template.html", import.meta.url), "utf8");
t(/V\.catalogoCompacto\(clasesEnMesa\(\)\)/.test(web), "la página pasa las clases de la mesa al catálogo (misma regla que sistemaWeb)");
console.log(`${ok} ok, ${mal} fallas`);
