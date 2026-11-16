// Catálogo de tesoro (src/tesoro.ts): ids únicos, categorías cerradas, valores y longitudes, criaturas del bestiario, cobertura de las 10 criaturas
// sin botín, nombres compatibles con los regex de consumo del motor, materiales coherentes con danos.ts, fórmulas de precio y moneda,
// tema «tesoro» de consultar_reglas y que ningún id del catálogo está en el prompt fijo.
import { TESORO, CATEGORIAS_TESORO, tesoroDe, textoTesoro, precioEquipo, oroSugerido, MONEDA_PELIGRO, MULT_ORIGEN, REGLAS_TESORO } from "../../src/tesoro.ts";
import { BESTIARIO } from "../../src/bestiario.ts";
import { BASES } from "../../src/equipo.ts";
import { sistemaWeb, consultarReglas } from "../../src/prompt-web.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };

t(TESORO.length >= 100, "catálogo con al menos 100 entradas", String(TESORO.length));
t(new Set(TESORO.map((x) => x.id)).size === TESORO.length, "ids únicos");
t(new Set(TESORO.map((x) => x.nombre.toLowerCase())).size === TESORO.length, "nombres únicos");
t(TESORO.every((x) => /^[a-z][a-z0-9_]*$/.test(x.id)), "ids en snake_case");
t(CATEGORIAS_TESORO.length === 12 && TESORO.every((x) => (CATEGORIAS_TESORO as readonly string[]).includes(x.categoria)), "categorías cerradas (12)");
t(CATEGORIAS_TESORO.every((c) => TESORO.some((x) => x.categoria === c)), "cada categoría tiene entradas", CATEGORIAS_TESORO.map((c) => `${c}:${TESORO.filter((x) => x.categoria === c).length}`).join(" "));
t(TESORO.every((x) => Number.isFinite(x.valor_po) && x.valor_po > 0), "valores > 0");
t(TESORO.every((x) => [1, 2, 3, 4, 5].includes(x.peligroMin)), "peligroMin entre 1 y 5");
t(TESORO.every((x) => (x.uso ?? "").length <= 120), "uso ≤ 120 caracteres", TESORO.filter((x) => (x.uso ?? "").length > 120).map((x) => x.id).join());
t(TESORO.every((x) => (x.sabor ?? "").length <= 80), "sabor ≤ 80 caracteres", TESORO.filter((x) => (x.sabor ?? "").length > 80).map((x) => x.id).join());
t(TESORO.every((x) => !x.cant || (x.cant[0] >= 1 && x.cant[1] >= x.cant[0])), "cant bien formada");
t(TESORO.filter((x) => x.valor_po > 50).every((x) => x.peligroMin >= 3 || x.categoria === "objeto_trama"), "lo caro (>50 po) pide peligro 3+ o es un objeto único");
t(TESORO.filter((x) => x.categoria !== "objeto_trama" && x.valor_po > 50).length <= 14, "pocas entradas raras (>50 po) fuera de los objetos únicos");
t(TESORO.filter((x) => x.categoria === "objeto_trama").length >= 20 && TESORO.filter((x) => x.categoria === "objeto_trama").every((x) => x.unico), "≥ 20 objetos únicos con historia, todos marcados únicos");

// Criaturas citadas existen; las 10 sin botín (y todas las del bestiario sin él) quedan cubiertas
const nombres = new Set(BESTIARIO.map((c) => c.nombre));
const desconocidas = TESORO.flatMap((x) => x.criaturas ?? []).filter((c) => !nombres.has(c));
t(!desconocidas.length, "las criaturas del catálogo existen en el bestiario", desconocidas.join());
const SIN_BOTIN = ["Lobo de Ceniza", "Ghul de las fosas", "Ogro", "Troll de ciénaga", "Wyverno", "Basilisco", "Mantícora", "Banshee del Velo", "Gigante de hueso", "Apóstol"];
for (const n of SIN_BOTIN) t(TESORO.some((x) => x.criaturas?.includes(n)), `criatura sin botín cubierta: ${n}`);
t(BESTIARIO.filter((c) => !c.botin).every((c) => SIN_BOTIN.includes(c.nombre)), "las únicas criaturas sin botín texto son esas 10");

// Compatibilidad con los regex de consumo del motor: solo las entradas previstas los disparan
const REGEX: Record<string, { re: RegExp; permitidos: string[] }> = {
  comer: { re: /raci[oó]n|raciones|provisi[oó]n|pan\b|carne seca|queso/i, permitidos: ["raciones_viaje", "pan_duro", "carne_seca", "queso_curado"] },
  beber: { re: /raci[oó]n|provisi|agua|odre|cantimplora/i, permitidos: ["raciones_viaje", "odre_agua", "agua_pura"] },
  sal: { re: /\bsal\b/i, permitidos: ["frasco_sal"] },
  hierbas: { re: /hierbas/i, permitidos: ["hierbas_medicinales"] },
  cirugia: { re: /sierra de huesos|herramientas de cirujano/i, permitidos: ["sierra_huesos", "herramientas_cirujano"] },
  ladron: { re: /herramientas? de ladr[oó]n|ganz[uú]a/i, permitidos: ["ganzuas", "herramientas_ladron"] },
  cadenas: { re: /cadenas?/i, permitidos: ["cadenas_hierro"] },
  latigo: { re: /l[aá]tigo de metal|urumi/i, permitidos: [] },
  municion: { re: /virote|flecha|dardo/i, permitidos: [] },
  vacio: { re: /vac[ií]o/i, permitidos: [] },
};
for (const [k, { re, permitidos }] of Object.entries(REGEX)) {
  const sobran = TESORO.filter((x) => re.test(x.nombre) && !permitidos.includes(x.id)).map((x) => x.id);
  const faltan = permitidos.filter((id) => !re.test(TESORO.find((x) => x.id === id)?.nombre ?? ""));
  t(!sobran.length && !faltan.length, `regex «${k}»: solo lo previsto lo dispara`, `sobran ${sobran.join()} · faltan ${faltan.join()}`);
}
// Formato de cantidad canónico: «Nombre (N)» (sufijo), nunca «5 frascos de sal» al principio; el plural canónico no lleva número
t(TESORO.every((x) => !/^\d+\s/.test(x.nombre)), "ningún nombre empieza por un número (formato «Nombre (N)»)");
// Nombres canónicos de equipo: ya no se llama «Cota de escamas»
t(!BASES.some((b) => /cota de escamas/i.test(b.nombre)) && BASES.some((b) => b.nombre === "Armadura de escamas"), "«Armadura de escamas» es el nombre canónico (sin «Cota de escamas»)");

// Materiales coherentes con danos.ts (FuenteDano.material) y con las vulnerabilidades del bestiario
const MATERIALES = new Set(["plata", "hierro frío"]);
t(TESORO.filter((x) => x.material).every((x) => MATERIALES.has(x.material!)), "materiales de arma: solo plata y hierro frío");
t(TESORO.some((x) => x.material === "plata" && x.categoria === "herramienta") && TESORO.some((x) => x.material === "hierro frío" && x.categoria === "herramienta"), "hay armas de plata y de hierro frío");
t(TESORO.some((x) => x.id === "bano_plata" && x.material === "plata" && x.categoria === "material"), "«baño de plata» es un material consumible");
t(BESTIARIO.some((c) => (c.vulnerabilidades ?? []).some((v) => (v as any).soloMaterial === "hierro frío")), "el hierro frío es un material usado por el bestiario (duende)");

// Fórmulas: reliquia ≥ mejor encantado, por debajo de una legendaria; maldito = encantado
const peor = BASES.map((b) => ({ b, enc: precioEquipo(b.precio, "encantado"), rel: precioEquipo(b.precio, "reliquia") }));
t(peor.every((x) => x.rel >= x.enc), "reliquia ≥ encantado de su misma base");
const mejorEnc = Math.max(...peor.map((x) => x.enc)), peorRel = Math.min(...peor.map((x) => x.rel));
t(peorRel >= 5000 && peor.every((x) => x.rel <= 19000), "reliquia entre 5.000 y 19.000 (< legendaria 20.000)", `${peorRel}..${Math.max(...peor.map((x) => x.rel))}`);
t(peor.filter((x) => x.enc >= 5000).every((x) => x.rel >= Math.min(19000, x.enc)), "reliquia ≥ cualquier encantado hasta el techo", `mejor encantado ${mejorEnc}`);
t(BASES.every((b) => precioEquipo(b.precio, "maldito") === precioEquipo(b.precio, "encantado")), "maldito = encantado");

// Moneda: tabla por peligro y origen
{
  t(Object.keys(MONEDA_PELIGRO).length === 5 && MULT_ORIGEN.compra === 0 && MULT_ORIGEN.saqueo === 0.5 && MULT_ORIGEN.hallazgo === 1 && MULT_ORIGEN.jefe === 2, "moneda: 5 peligros y multiplicadores ×0 / ×0,5 / ×1 / ×2");
  iniciarRegistroDados([{ caras: 10, valor: 10 }, { caras: 10, valor: 10 }, { caras: 10, valor: 10 }, { caras: 10, valor: 10 }]);
  const v = oroSugerido(4, "hallazgo"); liberarDados();
  t(v === 120, "P4 hallazgo con 4d10 todo 10 = 120 po (4d10×3)", String(v));
  let medias = [1, 2, 3, 4, 5].map((p) => { let s = 0; for (let i = 0; i < 2000; i++) s += oroSugerido(p, "hallazgo"); return s / 2000; });
  t(medias.every((m, i) => i === 0 || m > medias[i - 1]), "la moneda crece con el peligro", medias.map((m) => m.toFixed(1)).join(" "));
  t(oroSugerido(3, "compra") === 0, "la compra no da oro");
}

// Consulta bajo demanda
{
  const r = consultarReglas("tesoro");
  t(r.includes("generar_botin") && r.includes("trofeo") && r === textoTesoro(), "consultar_reglas «tesoro» sin nombre: reglas y categorías");
  t(consultarReglas("tesoro", "trofeo").includes("Piel de lobo de ceniza"), "tesoro por categoría (trofeo)");
  t(consultarReglas("tesoro", "Ogro").includes("Colmillos de ogro"), "tesoro por criatura (Ogro)");
  t(consultarReglas("tesoro", "mantícora").includes("Púas de mantícora"), "tesoro por criatura sin tildes ni mayúsculas");
  t(consultarReglas("tesoro", "nada_raro").includes("Nada en el catálogo"), "tesoro desconocido: mensaje claro");
  t(tesoroDe("nautico").length >= 8, "categoría náutica");
  t(REGLAS_TESORO.length < 1500, "las reglas del tema son breves", String(REGLAS_TESORO.length));
}

// Nada del catálogo en el prompt fijo
{
  const s = sistemaWeb(), solo = sistemaWeb(["Mercenario del Cuervo"]);
  // Los tres consumibles básicos ya se nombraban en el prompt antes del catálogo (raciones, odre, frascos de sal, kit de sanador): se permiten por nombre, nunca por id
  const YA = ["raciones_viaje", "odre_agua", "frasco_sal", "kit_curas"];
  const dentro = TESORO.filter((x) => s.includes(`"${x.id}"`) || s.includes(x.id) || (!YA.includes(x.id) && (s.includes(x.nombre) || solo.includes(x.nombre)))).map((x) => x.id);
  t(!dentro.length, "ningún id ni nombre del catálogo está en sistemaWeb()", dentro.join());
  t(s.length <= 67600, "prompt fijo ≤ 67.600", String(s.length));
}
console.log(`${ok} ok, ${mal} fallas`);
