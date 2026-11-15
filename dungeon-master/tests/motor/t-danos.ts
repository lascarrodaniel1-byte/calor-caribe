// Catálogo de tipos de daño (src/danos.ts): alias, tildes/mayúsculas, puente con armadura, esquema zod y COBERTURA de los
// tipos literales que usan hoy el bestiario, las guaridas, las trampas, el juramento y las herramientas, y su cableado (fase A):
// tipoHerida, resistencias raciales y Furia por tipo canónico, y atacar/habilidades/modificar_personaje/nave con alias.
import { readFileSync } from "node:fs";
import { ALIAS_DE_DANO, PSEUDO_TIPOS_NO_DANO, TIPOS_DANO_CANONICOS, aVocabularioArmadura, deVocabularioArmadura, esFisico, etiqueta, normalizarTipo, tipoDanoSchema, tipoHeridaDe } from "../../src/danos.ts";
import { aplicarDanoAPersonaje } from "../../src/rasgos.ts";
import { normalizarTipo as _nt, notaDano as _nd } from "../../src/danos.ts";
const danoConResistencia = (p: any, dano: number, tipo?: string) => { const r = aplicarDanoAPersonaje(p, dano, _nt(tipo)); return { dano: r.final, nota: _nd(r.detalle) }; }; // atajo de prueba: el tipo llega como texto libre
import type { TipoDano } from "../../src/danos.ts";
import { TIPOS_DANO_ARMADURA as TIPOS_ARMADURA } from "../../src/armadura.ts";
import { BESTIARIO } from "../../src/bestiario.ts";
import { GUARIDAS } from "../../src/guarida.ts";
import { VOTOS } from "../../src/juramento_base.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const fuente = (f: string) => readFileSync(new URL(`../../src/${f}`, import.meta.url), "utf8");

// 1) Cada alias → su canónico, y cada canónico se reconoce a sí mismo (idempotencia).
for (const x of ALIAS_DE_DANO) t(normalizarTipo(x.alias) === x.tipo, `alias «${x.alias}» → ${x.tipo}`, String(normalizarTipo(x.alias)));
for (const c of TIPOS_DANO_CANONICOS) {
  t(normalizarTipo(c) === c, `canónico «${c}» idempotente`);
  const n = normalizarTipo(c); t(normalizarTipo(n) === n, `normalizar(normalizar(${c})) igual`);
  t(etiqueta(c) === c && /^\p{Ll}+$/u.test(etiqueta(c)), `etiqueta(${c}) con tilde y minúsculas`, etiqueta(c));
}
t(new Set(TIPOS_DANO_CANONICOS).size === 13, "13 tipos canónicos sin repetir");
const vistos = new Map<string, TipoDano>();
for (const x of ALIAS_DE_DANO) { const k = x.alias.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); t(!vistos.has(k) || vistos.get(k) === x.tipo, `alias «${x.alias}» no contradice otro`); vistos.set(k, x.tipo); }
t(ALIAS_DE_DANO.every((x) => TIPOS_DANO_CANONICOS.includes(x.tipo)), "todos los alias apuntan a un canónico");
t(ALIAS_DE_DANO.filter((x) => x.dudoso).every((x) => x.dudoso!.length > 20), "los alias dudosos llevan su justificación");
t(["calor", "hielo", "rayo", "luz"].every((a) => ALIAS_DE_DANO.some((x) => x.alias === a && x.dudoso)), "calor, hielo, rayo y luz marcados como dudosos");

// 2) Tildes, mayúsculas, espacios y «daño de…».
for (const [s, e] of [["CORTE", "cortante"], ["  Frío  ", "frío"], ["FRIO", "frío"], ["Eléctrica", "eléctrico"], ["ELECTRICA", "eléctrico"], ["Ácido", "ácido"], ["acido", "ácido"],
  ["necrotico", "necrótico"], ["PSÍQUICO", "psíquico"], ["Psiquico", "psíquico"], ["Sónico", "trueno"], ["contusión", "contundente"], ["Perforación", "perforante"],
  ["daño de fuego", "fuego"], ["Daño cortante", "cortante"], ["daño por veneno", "veneno"], ["energia   de  fuerza", "fuerza"], ["\tTrueno\n", "trueno"]] as const)
  t(normalizarTipo(s) === e, `«${s}» → ${e}`, String(normalizarTipo(s)));

// 3) Lo desconocido y los pseudo-tipos no son tipos.
for (const s of ["", "   ", "xyz", "mágico", "no mágico", "plata", "adamantina", "mágico/plata", "daño", "daño de", "contundente o cortante", "sagrado fuego"]) t(normalizarTipo(s) === undefined, `«${s}» → undefined`, String(normalizarTipo(s)));
t(normalizarTipo(undefined) === undefined && normalizarTipo(null) === undefined && normalizarTipo(5 as any) === undefined, "undefined, null y no-texto → undefined");
t(PSEUDO_TIPOS_NO_DANO.every((p) => normalizarTipo(p) === undefined), "ningún pseudo-tipo (mágico, plata…) se reconoce como tipo");

// 4) Puente con armadura.ts.
t(aVocabularioArmadura("cortante") === "corte" && aVocabularioArmadura("perforante") === "punta" && aVocabularioArmadura("contundente") === "contundente", "puente: cortante→corte, perforante→punta, contundente→contundente");
for (const c of TIPOS_DANO_CANONICOS.filter((x) => !esFisico(x))) t(aVocabularioArmadura(c) === undefined && !esFisico(c), `no físico ${c}: sin puente`);
t(aVocabularioArmadura(undefined) === undefined && !esFisico(undefined), "puente y esFisico con undefined");
t(TIPOS_DANO_CANONICOS.filter(esFisico).length === 3, "exactamente 3 tipos físicos");
t(TIPOS_ARMADURA.every((a) => deVocabularioArmadura(a) === normalizarTipo(a) && aVocabularioArmadura(deVocabularioArmadura(a)) === a), "ida y vuelta con el vocabulario de armadura");
t(TIPOS_ARMADURA.every((a) => aVocabularioArmadura(normalizarTipo(a)) === a), `el vocabulario de armadura (${TIPOS_ARMADURA.join("/")}) da la vuelta completa`);
t(TIPOS_DANO_CANONICOS.filter(esFisico).every((c) => (TIPOS_ARMADURA as readonly string[]).includes(aVocabularioArmadura(c)!)), "todo físico cae en un valor de armadura");

// 5) Esquema zod.
for (const [s, e] of [["perforante", "perforante"], ["punta", "perforante"], ["Hielo", "frío"], ["RAYO", "eléctrico"], ["sagrado", "radiante"], ["fuerza", "fuerza"]] as const) {
  const r = tipoDanoSchema.safeParse(s); t(r.success && r.data === e, `zod acepta «${s}» → ${e}`, JSON.stringify(r.success ? r.data : r.error.issues));
}
{
  const r = tipoDanoSchema.safeParse("mágico");
  const m = r.success ? "" : r.error.issues[0].message;
  t(!r.success && /desconocido/.test(m) && /cortante/.test(m) && /no son tipos/.test(m), "zod rechaza «mágico» con mensaje claro", m);
  t(!tipoDanoSchema.safeParse("basura").success && !tipoDanoSchema.safeParse("").success && !tipoDanoSchema.safeParse(3).success && !tipoDanoSchema.safeParse(undefined).success, "zod rechaza basura, vacío, número y undefined");
  const o = tipoDanoSchema.optional().safeParse(undefined); t(o.success && o.data === undefined, "zod .optional() deja pasar undefined");
}

// 6) COBERTURA: los tipos literales de hoy.
// Excepciones explícitas: palabras que aparecen tras «daño…» en la prosa y NO son tipos de daño.
const EXCEPCIONES: Record<string, string> = {
  "mágico": "pseudo-tipo: describe la fuente (FuenteDano.magico), no el elemento",
  "hierro": "material («hierro frío»): FuenteDano.material",
  "agua": "medio, no tipo: «daño de agua» no existe en el juego",
  "cuerpo": "«daño cuerpo a cuerpo»: alcance, no tipo",
  "mayor": "gramática («daño mayor»)",
  de: "gramática («doble daño del agua y de la sal»)", o: "gramática", un: "gramática", a: "gramática", que: "gramática", dentro: "gramática («daño dentro de…»)",
};
const hallados = new Map<string, Set<string>>(); // texto crudo → dónde
const ver = (v: string | undefined, donde: string) => { if (v === undefined) return; (hallados.get(v) ?? hallados.set(v, new Set()).get(v)!).add(donde); };

for (const c of BESTIARIO) {
  for (const h of c.habilidades ?? []) ver(h.tipo_dano, `bestiario/${c.nombre}/${h.nombre}`);
  if (c.traga) ver(c.traga.tipo_dano, `bestiario/${c.nombre}/traga`);
  for (const a of ((c as any).ataques ?? []) as any[]) ver(a.tipo_dano ?? a.tipo, `bestiario/${c.nombre}/ataque ${a.nombre ?? ""}`);
}
t(BESTIARIO.length === 46, "el bestiario tiene 46 criaturas", String(BESTIARIO.length));
for (const [jefe, g] of Object.entries(GUARIDAS)) for (const h of g.acciones) ver(h.tipo_dano, `guarida/${jefe}/${h.nombre}`);
for (const f of ["bestiario.ts", "guarida.ts", "trampas.ts", "herramientas.ts", "juramento_base.ts"]) {
  for (const m of fuente(f).matchAll(/tipo_dano\s*[:=]\s*["']([^"']+)["']/g)) ver(m[1], `${f} (texto)`);
}
// Prosa: «daño [de|al|no] X» en rasgos del bestiario y ventajas de juramento, y las listas «corte, punta y contundente».
const prosa = [...BESTIARIO.flatMap((c) => [...(c.rasgos ?? []), c.descripcion].map((s) => [s, `bestiario/${c.nombre}`] as const)), ...VOTOS.map((v) => [v.ventaja, `juramento/${v.id}`] as const)];
for (const [s, donde] of prosa) {
  for (const m of s.matchAll(/da[ñn]o\s+(?:no\s+)?(?:de\s+|al\s+|del\s+)?(\p{L}+)((?:\s*,\s*\p{L}+)*(?:\s+y\s+\p{L}+)?)/giu)) {
    ver(m[1], `${donde} (prosa)`);
    for (const x of m[2].split(/\s*,\s*|\s+y\s+/).filter(Boolean)) ver(x, `${donde} (prosa)`);
  }
  for (const m of s.matchAll(/(?:inmune|vulnerable|resiste|resistencia)\s+(?:al?|el)\s+(\p{L}+)/giu)) if (/^(fuego|frío|frio|veneno|ácido|acido|necrótico|necrotico|radiante|psíquico|psiquico|trueno|eléctrico|hielo|rayo)$/iu.test(m[1])) ver(m[1], `${donde} (prosa)`);
}
// tipoHerida usa el catálogo: cada tipo canónico da una herida (solo descriptiva) y cada alias, la de su canónico.
const HERIDA: Record<string, string> = { cortante: "corte", perforante: "perforacion", contundente: "contusion", fuego: "quemadura", ácido: "quemadura", frío: "quemadura", eléctrico: "quemadura", radiante: "quemadura", veneno: "necrotica", necrótico: "necrotica", trueno: "contusion", psíquico: "contusion", fuerza: "contusion" };
for (const c of TIPOS_DANO_CANONICOS) t(tipoHeridaDe(c) === HERIDA[c], `tipoHeridaDe(${c}) = ${HERIDA[c]}`, tipoHeridaDe(c));
t(Object.keys(HERIDA).length === TIPOS_DANO_CANONICOS.length, "la tabla de heridas cubre todos los tipos");
t(tipoHeridaDe(undefined) === "contusion", "sin tipo: contusión (como siempre)");
for (const x of ALIAS_DE_DANO) t(tipoHeridaDe(normalizarTipo(x.alias)) === HERIDA[x.tipo], `herida por alias «${x.alias}»`);
t(fuente("bestiario.ts").includes("tipoHeridaDe(h.tipo_dano)") && !/function tipoHerida\b/.test(fuente("bestiario.ts")), "el bestiario usa el catálogo (sin regex propias)");
t(!/esDanoFisico/.test(fuente("rasgos.ts")), "rasgos.ts ya no tiene esDanoFisico (usa esFisico del catálogo)");
t(!/\/(?:veneno|fr\[ií\]o|fuego)[^/]*\/i\.test\(tipo\)/.test(fuente("rasgos.ts")), "las razas ya no usan regex sobre texto libre");

// Resistencias raciales y de la Furia por tipo canónico (cualquier alias; sin falsos positivos ni negativos).
{
  const mkp = (raza: string, furia = false) => ({ raza, furia: furia ? { activa: true, asaltos: 5 } : undefined }) as any;
  const r = (p: any, x: string) => danoConResistencia(p, 10, x).dano;
  for (const x of ["veneno", "tóxico", "ponzoña", "Veneno"]) t(r(mkp("Enano de Karak-Dûm"), x) === 5, `Enano resiste «${x}»`);
  for (const x of ["frío", "hielo", "gélido", "escarcha", "Frio"]) t(r(mkp("Tritón de las Mareas"), x) === 5, `Tritón resiste «${x}»`);
  for (const x of ["fuego", "llama", "calor", "abrasador", "ígneo", "ardiente"]) t(r(mkp("Cenizo"), x) === 5, `Cenizo resiste «${x}» (el calor y lo abrasador ya cuentan)`);
  for (const x of ["llama sagrada", "radiante", "sagrado", "quemadura", "fuegos fatuos", "mágico"]) t(r(mkp("Cenizo"), x) === 10, `Cenizo NO resiste «${x}» (falso positivo de la regex vieja o no es tipo)`);
  t(r(mkp("Enano de Karak-Dûm"), "fuego") === 10 && r(mkp("Tritón de las Mareas"), "veneno") === 10 && r(mkp("Humano del Faro"), "veneno") === 10, "cada raza solo resiste lo suyo");
  for (const x of ["corte", "cortante", "punta", "perforante", "contundente", "filo", "golpe"]) t(r(mkp("Humano del Faro", true), x) === 5, `Furia resiste «${x}»`);
  for (const x of ["fuego", "frío", "radiante", "eléctrico", "trueno", "psíquico"]) t(r(mkp("Humano del Faro", true), x) === 10, `Furia no resiste «${x}»`);
}

const sinReconocer: string[] = [];
for (const [v, donde] of hallados) {
  if (normalizarTipo(v)) continue;
  if (EXCEPCIONES[v.toLowerCase()]) continue;
  sinReconocer.push(`«${v}» en ${[...donde].slice(0, 3).join("; ")}`);
}
t(hallados.size > 10, `se examinaron ${hallados.size} valores distintos de tipo de daño`);
t(sinReconocer.length === 0, "cobertura: todo tipo literal de hoy lo reconoce el catálogo", sinReconocer.join(" | "));
// Los tipos que el juego usa de verdad hoy están todos (sin contar el exótico «fuerza»).
const usados = new Set([...hallados.keys()].map((v) => normalizarTipo(v)).filter(Boolean));
for (const c of ["cortante", "perforante", "contundente", "fuego", "veneno", "necrótico", "psíquico", "trueno", "radiante", "eléctrico"]) t(usados.has(c as TipoDano), `el juego usa hoy «${c}» y el catálogo lo cubre`);
t(Object.keys(EXCEPCIONES).every((k) => [...hallados.keys()].some((v) => v.toLowerCase() === k)), "ninguna excepción sobra (todas aparecen en los datos)", Object.keys(EXCEPCIONES).filter((k) => ![...hallados.keys()].some((v) => v.toLowerCase() === k)).join(","));

console.log(`${ok} ok, ${mal} fallas`);
