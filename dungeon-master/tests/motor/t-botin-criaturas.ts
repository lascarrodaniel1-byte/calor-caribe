// Botín de criaturas como datos (botinItems en bestiario.ts): las 46 fichas, coherencia texto ↔ ids (como la de resistencias), ids normalizados
// (escamas, colmillos y garras con ids distintos y valor propio), tirada por probabilidad en generar_botin {criatura} y la ficha bajo demanda.
import { BESTIARIO, fichaCriatura, lineaPiezas } from "../../src/bestiario.ts";
import { tesoroPorId } from "../../src/tesoro.ts";
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { generarBotinDe } from "../../src/botin.ts";
import { consultarReglas } from "../../src/prompt-web.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Qué palabra del texto de botín respalda cada id (si un id no está aquí, la prueba falla: hay que decidir de qué parte del texto sale)
const CLAVES: Record<string, RegExp> = {
  bolsa_cambio: /monedas?|calderilla|oro\b|baratijas|pertenencias/, anillo_difunto: /anillo/, carta_sin_enviar: /carta/, piel_lobo_ceniza: /piel/, colmillos_lobo_ceniza: /colmillos/,
  dientes_ghul: /dientes/, mortaja_ghul: /mortaja/, pendiente_ambar: /joya/, colmillo_ogro: /colmillos/, cinturon_ogro: /cinturon/, higado_troll: /higado/, hiel_bestia: /hiel/,
  aguijon_wyverno: /aguijon/, colmillo_wyverno: /colmillo/, ojo_basilisco: /ojo/, gema_bruta: /gemas?/, puas_manticora: /puas/, mechon_banshee: /mechon/, hueso_gigante: /huesos/,
  fragmento_apostol: /fragmento/, hueso_de_dios: /hueso de dios/, escamas_mena: /escamas de mena/, hiel_gorgon: /hiel de gorgon/, tesoro_dragon: /tesoro de|monedas antiguas/,
  escama_dragon: /escamas/, rubi_ojo: /gemas/, relicario_lich: /relicario/, grimorio_menor: /grimorios/, corona_lich: /corona/, baston_hueso: /baston/, lingote_plata: /riquezas/,
  astas_hueso: /astas de hueso/, collar_dientes: /collar de dientes/, colmillos_ulfhedinn: /colmillos/, garras_ulfhedinn: /garras/, piel_lobo_gris: /piel de lobo gris/,
  garras_hombre_oso: /garras/, colmillos_hombre_oso: /colmillos/, piel_oso_gris: /piel de oso gris/, talla_sagrada: /talla sagrada/, piedra_runica: /piedra tallada/,
  palabra_golem: /palabra/, sutura_calidad: /sutura/, huesos_aprovechables: /huesos/, organos_aprovechables: /organos/, piedra_animadora: /piedra o el amuleto/,
  ceniza_forjable: /cenizas calientes/, ascua_eterna: /ascua/, agua_pura: /agua pura/, vetas_metal: /vetas de metal/, pluma_viento: /pluma/, cristal_vibrante: /cristal/,
  vaso_djinn: /vaso/, joyas_pactos: /joyas de los pactos/, boton_duende: /boton/, pluma_grifo: /plumas/, huevo_grifo: /huevos/, colmillo_hidra: /colmillos/,
  moneda_antigua: /tesoros|monedas antiguas|oro\b/, perla_negra: /perlas/, joyas_ahogados: /joyas de los ahogados/, escamas_sirena: /escama/, escamas_hombre_pez: /escamas de hombre pez/,
  arpon_hueso: /arpones/, escamas_hombre_lagarto: /escamas de hombre lagarto/, lanza_hueso: /lanzas de hueso/, red_caza: /redes de caza/, hierro_frio: /hierro/, frasco_sal: /\bsal\b/,
  plumas_arpia: /plumas/, nido_arpia: /nido/, huesos_roidos: /huesos/, corona_astas: /corona de astas/, semillas_viejas: /semillas/, ofrendas_bosque: /ofrendas/, ovillo_aviso: /ovillo/,
  tijeras_hueso: /tijeras/, telar_moira: /telar/, escamas_mar_profundo: /escamas de mar profundo/, perla_luna: /perlas de luna/, luna_recuperada: /luna recuperada/,
  archivos_inquisicion: /archivos/, escrituras_marca: /escrituras/, costuras_madre: /costuras/, cera_sepulcro: /cera de sepulcro/, cristal_hondos: /cristal de los hondos/,
  mena_viva: /mena viva/, planos_fortaleza: /planos/, diario_kuru: /diario/, sello_mariscal: /sello de mariscal/, cuaderno_hugin: /cuaderno/, libro_cuentas_compania: /libro de cuentas/,
  talla: /./,
};
// Palabras del texto que obligan a tener una pieza con esa palabra en su nombre
const NOMBRES = ["escama", "colmillo", "garra", "pluma", "perla", "huevo", "hiel", "piel", "semilla", "hierro", "ojo"];
// Jefes cuyo botín de texto son solo reliquias (se crean con crear_objeto): su lista de piezas es corta o vacía a propósito
// Palabras que en el texto de un jefe nombran su reliquia (se crea con crear_objeto), no una pieza de catálogo: no exigen pieza con esa palabra
const PALABRA_DE_RELIQUIA: Record<string, string[]> = { "Vaskar, el Lobo del Eclipse": ["colmillo"], "La Madre de los Hambrientos": ["piel"], "El Que Golpea Bajo la Piedra": ["colmillo"], "Kuru, el Cazador de Leyendas": ["colmillo"] };
const SOLO_RELIQUIAS = ["Ilvara, la Tejedora de Mañanas", "Vaerth, el Sin Rostro"];

t(BESTIARIO.length === 46, "46 criaturas en el bestiario", String(BESTIARIO.length));
t(BESTIARIO.every((c) => Array.isArray(c.botinItems)), "las 46 tienen botinItems");
t(BESTIARIO.every((c) => !!c.botin && c.botin.length > 5), "las 46 conservan el texto de botín (las 10 sin él lo ganan)");
t(BESTIARIO.filter((c) => !SOLO_RELIQUIAS.includes(c.nombre)).every((c) => (c.botinItems ?? []).length >= 1), "todas tienen al menos una pieza, salvo los dos jefes de solo reliquias", SOLO_RELIQUIAS.map((n) => BESTIARIO.find((c) => c.nombre === n)?.botinItems?.length).join());
t(SOLO_RELIQUIAS.every((n) => BESTIARIO.find((c) => c.nombre === n)!.botinItems!.length === 0), "Ilvara y Vaerth: lista vacía a propósito (reliquias con crear_objeto)");
for (const c of BESTIARIO) {
  const l = c.botinItems ?? [], txt = norm(c.botin ?? "");
  const ids = l.map((i) => i.id);
  const malos = ids.filter((id) => !tesoroPorId(id));
  const sinTexto = ids.filter((id) => !CLAVES[id] || !CLAVES[id].test(txt));
  const prob = l.filter((i) => !(Number.isInteger(i.probabilidad) && i.probabilidad >= 1 && i.probabilidad <= 100));
  const sinPieza = NOMBRES.filter((n) => txt.includes(n) && !(PALABRA_DE_RELIQUIA[c.nombre] ?? []).includes(n) && !ids.some((id) => norm(tesoroPorId(id)?.nombre ?? "").includes(n)));
  t(!malos.length && !prob.length && new Set(ids).size === ids.length && !sinTexto.length && !sinPieza.length, `${c.nombre}: ids existentes, probabilidad 1-100, sin repetidos y coherentes con el texto`, `ids malos ${malos} · sin texto ${sinTexto} · prob ${prob.length} · palabras sin pieza ${sinPieza}`);
}

// Normalización: escamas, colmillos y garras con ids distintos y valor propio
const idsDe = (n: string) => BESTIARIO.find((c) => c.nombre === n)!.botinItems!.map((i) => i.id);
const escamas = ["Gorgon", "Hombre pez", "Hombre lagarto", "Sirena", "Bakunawa"].map((n) => idsDe(n).find((id) => /^escamas?_/.test(id))!);
t(escamas.every(Boolean) && new Set(escamas).size === 5, "«escamas» de 5 criaturas: 5 ids distintos", escamas.join());
t(new Set(escamas.map((id) => `${tesoroPorId(id)!.nombre}|${tesoroPorId(id)!.valor_po}`)).size === 5, "cada escama con nombre y precio propios", escamas.map((id) => `${tesoroPorId(id)!.valor_po}`).join("/"));
const colm = ["Ulfhedinn:colmillos_ulfhedinn", "Hombre oso:colmillos_hombre_oso", "Hidra:colmillo_hidra", "Ogro:colmillo_ogro", "Lobo de Ceniza:colmillos_lobo_ceniza", "Wyverno:colmillo_wyverno"];
t(colm.every((x) => idsDe(x.split(":")[0]).includes(x.split(":")[1])) && new Set(colm.map((x) => x.split(":")[1])).size === 6, "«colmillos/garras» de 6 criaturas: ids distintos", "");
t(idsDe("Ulfhedinn").includes("garras_ulfhedinn") && idsDe("Hombre oso").includes("garras_hombre_oso") && idsDe("Ulfhedinn").includes("piel_lobo_gris"), "garras y pieles con id propio");
t(["Grifo", "Arpía", "Elemental de aire"].every((n) => idsDe(n).some((id) => /pluma/.test(id))) && new Set(["Grifo", "Arpía", "Elemental de aire"].map((n) => idsDe(n).find((id) => /pluma/.test(id)))).size === 3, "«plumas»: tres ids distintos");
t(new Set(["Arpía", "Gigante de hueso", "Golem de carne"].map((n) => idsDe(n).find((id) => /hueso/.test(id)))).size === 3, "«huesos»: tres ids distintos");
t(["Sirena", "Hombre pez"].every((n) => idsDe(n).includes("joyas_ahogados")) && idsDe("Djinn").includes("joyas_pactos"), "joyas de los ahogados y joyas de los pactos, distintas");

// Generador: la criatura da sus piezas con su probabilidad (las de 100 % siempre; la única, una vez por partida)
{
  const p = normalizarPartidaNueva();
  let ok1 = true;
  for (let i = 0; i < 30; i++) { const r = generarBotinDe(p, { origen: "saqueo", cantidad: 1, criatura: "Bakunawa", incluir_viales: false }); if (!/Escamas de mar profundo/.test(r.dm) || !/Perlas de luna \(\d\)/.test(r.dm) || !/Fragmento de la luna recuperada/.test(r.dm)) ok1 = false; }
  t(ok1, "Bakunawa: escamas, perlas de luna (1-4) y luna recuperada siempre (100 %)");
  const q = normalizarPartidaNueva();
  const a = generarBotinDe(q, { origen: "jefe", cantidad: 1, criatura: "Hugin, el Pensamiento", incluir_viales: false }), b = generarBotinDe(q, { origen: "jefe", cantidad: 1, criatura: "Hugin, el Pensamiento", incluir_viales: false });
  t(/Sello de mariscal de la Compañía \[O\d+\]/.test(a.dm) && !/Sello de mariscal/.test(b.dm), "el sello de mariscal (único) sale una vez por partida con su [O#]");
  let lobo = 0, gris = 0;
  for (let i = 0; i < 400; i++) { const r = generarBotinDe(normalizarPartidaNueva(), { origen: "saqueo", cantidad: 1, criatura: "Lobo de Ceniza", incluir_viales: false }); if (/Piel de lobo de ceniza/.test(r.dm)) lobo++; if (/Colmillos de lobo de ceniza/.test(r.dm)) gris++; }
  t(lobo > 400 * 0.55 && lobo < 400 * 0.85 && gris > 400 * 0.35 && gris < 400 * 0.65, "las probabilidades se respetan (piel ≈ 70 %, colmillos ≈ 50 %)", `${lobo} ${gris}`);
  const v = generarBotinDe(normalizarPartidaNueva(), { origen: "saqueo", cantidad: 1, criatura: "Vaerth, el Sin Rostro", incluir_viales: false });
  t(!/\(p\d|trofeo/i.test(v.dm), "un jefe de solo reliquias no suelta piezas de catálogo por su ficha");
}
function normalizarPartidaNueva() { const p = nuevaPartida(); normalizarPartida(p); return p; }

// La ficha bajo demanda muestra las piezas; la del estado por turno no (no engorda)
{
  const c = BESTIARIO.find((x) => x.nombre === "Ogro")!;
  t(consultarReglas("criatura", "Ogro").includes("Piezas al saquearla") && consultarReglas("criatura", "Ogro").includes(lineaPiezas(c)), "consultar_reglas criatura: botín estructurado con %");
  t(!fichaCriatura(c, false).includes("Piezas al saquearla"), "la ficha del estado por turno no lleva las piezas");
  t(lineaPiezas({ botinItems: undefined }) === "", "sin botinItems, línea vacía");
}
console.log(`${ok} ok, ${mal} fallas`);
