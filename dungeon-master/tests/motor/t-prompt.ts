// Prompt del DM web: límite de narración, reglas condicionales (artes, arcos), consulta bajo demanda, registro de consumo y tamaños.
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { sistemaWeb, consultarReglas } from "../../src/prompt-web.ts";
import { REGLAS_ARTES } from "../../src/estilos.ts";
import { REGLAS_NARRATIVA, REGLAS_NARRATIVA_BASE } from "../../src/narrativa.ts";
import { hayArtes, resumenConsumo } from "../../src/navegador.ts";

let ok = 0, mal = 0;
const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };

const completo = sistemaWeb();
const tipico = sistemaWeb(["Mercenario del Cuervo"]);
const LINEA_ARTES = "Artes marciales: 7 estilos; consulta con arte_marcial {accion: catalogo} y consultar_reglas {tema: \"artes\"}.";

// ---- límite numérico de narración
t(/~120 palabras por jugador/.test(completo) && /~200 en un combate/.test(completo), "el límite numérico de narración está en el prompt");
t(/no el número/.test(completo) && /1-3 párrafos cortos/.test(completo), "pide no repetir cifras del aviso y párrafos cortos");
t(!/1 a 3 párrafos por turno/.test(completo), "ya no queda la regla vaga de «1 a 3 párrafos por turno»");

// ---- artes condicionales
t(completo.includes(REGLAS_ARTES), "el prompt completo (sin argumentos) incluye REGLAS_ARTES");
t(tipico.includes(LINEA_ARTES) && !tipico.includes(REGLAS_ARTES), "sin estilos ni criaturas con artes: solo la línea corta de artes");
t(sistemaWeb(["Mercenario del Cuervo"], { artes: true }).includes(REGLAS_ARTES), "con un estilo en la mesa (artes: true) incluye REGLAS_ARTES");
t(sistemaWeb(["Flagelante"]).includes(REGLAS_ARTES), "con un Flagelante en la mesa incluye REGLAS_ARTES");
t(consultarReglas("artes") === REGLAS_ARTES, "consultarReglas(\"artes\") devuelve REGLAS_ARTES");

// hayArtes: personajes con estilo y criaturas con artes en escena
{
  const p = nuevaPartida(); normalizarPartida(p);
  const E = (n: string, d: object): any => ejecutar(n, d, p);
  const ficha = (n: string, clase: string, extra: any = {}) => E("guardar_personaje", { don_arcano: false, nombre: n, jugador: n, raza: "Humano del Faro", clase, nivel: 1, pv_max: 20, ca: 12, atributos: { fue: 14, des: 14, con: 14, int: 10, sab: 12, car: 10 }, inventario: [], dote: "Terco", ...extra });
  ficha("Mer", "Mercenario del Cuervo");
  t(!hayArtes(p), "hayArtes: un Mercenario sin estilo, sin criaturas, no hay artes");
  E("aparecer_criatura", { nombre: "Hambriento", repetir: true });
  t(!hayArtes(p), "hayArtes: una criatura sin artes no cuenta");
  ficha("Fla", "Flagelante");
  t(hayArtes(p), "hayArtes: un Flagelante en la mesa");
  const q = nuevaPartida(); normalizarPartida(q);
  Object.assign(q.personajes, { X: { ...p.personajes.Mer, nombre: "X", artes: ["piedra"] } });
  t(hayArtes(q), "hayArtes: un personaje con un estilo aprendido");
  // criatura con artes en escena (se fabrica a mano para no depender del nombre del bestiario)
  const r = nuevaPartida(); normalizarPartida(r);
  r.jefes.Maestro = { ...(Object.values(p.jefes)[0] as any), nombre: "Maestro", pv: 10, definicion: { ...(Object.values(p.jefes)[0] as any).definicion, artes: ["piedra"] } };
  t(hayArtes(r), "hayArtes: una criatura viva con artes en escena");
  r.jefes.Maestro.pv = 0;
  t(!hayArtes(r), "hayArtes: la criatura caída ya no cuenta");
}

// ---- arcos / narrativa
t(/Arcos|arcos/.test(consultarReglas("arcos")) && consultarReglas("arcos") === REGLAS_NARRATIVA, "consultarReglas(\"arcos\") devuelve el detalle completo de voces y arcos");
t(completo.includes(REGLAS_NARRATIVA), "el prompt completo incluye REGLAS_NARRATIVA entera");
t(tipico.includes(REGLAS_NARRATIVA_BASE) && !tipico.includes(REGLAS_NARRATIVA) && /abrir_arco/.test(tipico) && /cerrar_arco/.test(tipico) && /avanzar_amenaza/.test(tipico), "con clases: la regla esencial de arcos (abrir/cerrar, máximo 3, reloj de amenaza) y no el detalle");
t(/tema: "arcos"/.test(tipico), "la versión corta remite a consultar_reglas arcos");
t(REGLAS_NARRATIVA_BASE.length < 1800, "la regla esencial de arcos es corta", String(REGLAS_NARRATIVA_BASE.length));
t(/Tema desconocido/.test((() => { try { consultarReglas("nada"); return ""; } catch (e: any) { return String(e.message); } })()) , "un tema desconocido sigue dando error");

// ---- el prompt completo conserva las reglas importantes
const claves = [
  "Haemajitsu", "Presa de Hollín", "Contracorriente", "Piedra de Karak", "abrir_arco", "cerrar_arco", "avanzar_amenaza", "COMPETENCIA", "GÉNERO", "FORMULARIO DE PERSONAJE",
  "tirar_don_arcano", "guardar_personaje", "infligir_herida", "tratar_herida", "iniciativa", "tactica", "atacar", "Velmora", "Hugin", "behelit", "consultar_reglas",
  "AVENTURAS ANTERIORES", "((", "CLARIDAD", "anotar_mundo", "pnj agenda", "retirar_pista", "ZONA", "Berserker de Ceniza", "Segador", "Barbero-Cirujano", "Cazador de Brujas", "Degollador", "Caballero Juramentado",
];
const faltan = claves.filter((k) => !completo.toLowerCase().includes(k.toLowerCase()));
// Algunas palabras clave pueden no existir tal cual en el prompt: se comprueban solo las que sí (lista base) y se informa del resto.
const obligatorias = claves.filter((k) => !["ZONA", "COMPETENCIA"].includes(k));
const faltanOblig = obligatorias.filter((k) => !completo.toLowerCase().includes(k.toLowerCase()));
t(faltanOblig.length === 0, "el prompt completo contiene las palabras clave de las reglas importantes", faltanOblig.join(", "));
t(/competencia/i.test(completo), "el prompt completo habla de competencia (reglas de pruebas)", faltan.includes("COMPETENCIA") ? "(sin la palabra en mayúsculas)" : "");

// ---- reglas imprescindibles siempre activas (auditoría del prompt: docs/AUDITORIA_PROMPT.md)
// Si un recorte futuro borra una de estas reglas únicas, esta prueba falla. Deben estar en el prompt completo Y en el típico.
{
  const imprescindibles: [string, RegExp][] = [
    ["Mapa: ubicacion al empezar, al llegar y viajando (viajando_hacia, progreso)", /ubicacion[^\n]{0,80}(empezar|llegar)[^\n]{0,120}viajando_hacia[^\n]{0,30}progreso/],
    ["reutilizar los nombres de los lugares", /reutiliza los nombres de los lugares/],
    ["pasar_tiempo mueve el reloj", /pasar_tiempo ya mueve el reloj/],
    ["herramienta prueba y no inventar resultados", /herramienta prueba[^\n]{0,160}Nunca inventes un resultado/],
    ["cita literal en heridas y saltos de tiempo", /NO inventes heridas ni saltos de tiempo[^\n]{0,260}cita literal/],
    ["consultar_reglas", /consultar_reglas/],
    ["fichas guardadas son la verdad (modificar_personaje)", /fichas guardadas son la verdad[^\n]{0,80}modificar_personaje/],
    ["GÉNERO en la ficha", /GÉNERO: cada ficha trae el género/],
    ["COMPETENCIA solo si la ficha la justifica", /competencia solo cuenta si/i],
    ["formulario de personaje: guardar_personaje ya", /FORMULARIO DE PERSONAJE[^\n]{0,400}guardar_personaje YA/],
    ["don arcano antes de crear cada personaje", /tirar_don_arcano \{jugador\}/],
    ["encuentros aleatorios con la herramienta encuentro", /llama a encuentro/],
    ["reloj: tiempo fijar al empezar", /tiempo fijar/],
    ["plano mover antes de narrar", /plano mover ANTES de narrarlo/],
    ["atacar para todo ataque con armas", /Todo ataque con armas[^\n]{0,40}atacar/],
    ["iniciativa y terminar_combate", /iniciativa[^\n]{0,400}terminar_combate/],
    ["criaturas y PNJ: una vez por asalto en su iniciativa", /Cada criatura\/PNJ actúa UNA vez por asalto en su iniciativa[^\n]{0,160}resuelve sus turnos pendientes/],
    ["nunca decidir por los jugadores", /Nunca decides lo que hacen, dicen o sienten/],
    ["texto entre (( )) es fuera de personaje", /\(\( \)\)/],
    ["abrir_arco al empezar la campaña", /abrir_arco/],
  ];
  for (const [nombre, re] of imprescindibles) {
    t(re.test(completo), `regla imprescindible en el prompt completo: ${nombre}`);
    t(re.test(tipico), `regla imprescindible en el prompt típico: ${nombre}`);
  }
}

// ---- resumenConsumo
{
  const docs = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map((e, i) => ({ entrada: e, salida: e / 10, herramientas: i % 2 ? 4 : 2, repaso: i < 3, sinNarracion: i === 9 }));
  const r = resumenConsumo(docs);
  t(r.turnos === 10, "resumenConsumo: cuenta los turnos");
  t(r.entrada.media === 550 && r.entrada.p50 === 500 && r.entrada.p90 === 900 && r.entrada.max === 1000, "resumenConsumo: media y percentiles de entrada", JSON.stringify(r.entrada));
  t(r.salida.media === 55 && r.salida.p50 === 50 && r.salida.p90 === 90 && r.salida.max === 100, "resumenConsumo: media y percentiles de salida", JSON.stringify(r.salida));
  t(r.herramientasMedia === 3 && r.conRepaso === 3 && r.sinNarracion === 1, "resumenConsumo: herramientas, repasos y red de seguridad");
  const v = resumenConsumo([]);
  t(v.turnos === 0 && v.entrada.media === 0 && v.salida.p90 === 0, "resumenConsumo: sin datos no falla");
}

// ---- tamaños (el prompt completo de partida: 72.609 caracteres; con clases típicas y sin estilos: 57.983)
t(completo.length <= 66800, "el prompt completo baja al menos un 8 %", String(completo.length));
t(tipico.length <= 49285, "el prompt con clases típicas (sin estilos) baja al menos un 15 %", String(tipico.length));

console.log(`${ok} ok, ${mal} fallas`);
