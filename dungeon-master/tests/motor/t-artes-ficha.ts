// Estilos de artes marciales en la ficha, el formulario de creación y /artes.
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { validarFicha, textoFicha, DATOS_FORMULARIO, estilosDeClase } from "../../src/formulario.ts";
import { fichaClicable, ayuda } from "../../src/ayuda.ts";
import { comando } from "../../src/mesa.ts";
import { nvl } from "../../src/niveles.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const nombres = (c: string) => (DATOS_FORMULARIO.estilos[c] ?? []).map((e) => e.nombre);

// --- el formulario ofrece por clase los estilos correctos
const merc = nombres("Mercenario del Cuervo");
t(merc.includes("Filo del Cuervo") && merc.includes("Presa de Hollín") && merc.length === 2, "Mercenario: Filo del Cuervo y Presa de Hollín", merc.join(", "));
const fla = DATOS_FORMULARIO.estilos["Flagelante"];
t(fla.length === 1 && fla[0].nombre === "Haemajitsu" && fla[0].fijo === true, "Flagelante: Haemajitsu fijo");
t(!Object.values(DATOS_FORMULARIO.estilos).flat().some((e) => e.id === "contracorriente") && !Object.entries(DATOS_FORMULARIO.estilos).some(([c, l]) => c !== "Flagelante" && l.some((e) => e.id === "haemajitsu")), "los de solo historia no aparecen (salvo el Haemajitsu fijo del Flagelante)");
t(nombres("Hechicero").length === 0, "Hechicero: ningún estilo", nombres("Hechicero").join(", "));
t(nombres("Cazador de Brujas").includes("Danza marchita") && nombres("Cazador de Brujas").includes("Callejón de Aldenmar"), "Cazador de Brujas: Danza marchita y Callejón");
t(estilosDeClase("Mercenario del Cuervo").length === 2, "estilosDeClase coincide con el formulario");

// --- validarFicha y textoFicha
const f: any = { nombre: "Brunilda", jugador: "Ana", genero: "Femenino", raza: "Humano del Faro", clase: "Mercenario del Cuervo", veterania: "curtido", personalidad: ["temerario"], base: { fue: 15, des: 14, con: 13, int: 12, sab: 10, car: 8 }, metodo: "estandar", tipo: "", linaje: "", trasfondo: "Una mercenaria veterana que busca a su hermano perdido.", extra: "", dote: "Terco" };
const est = (x: any) => validarFicha(x).filter((e) => /estilo/i.test(e));
t(est(f).length === 0 && est({ ...f, estilo: "" }).length === 0, "sin estilo se acepta (es opcional)");
t(est({ ...f, estilo: "cuervo" }).length === 0 && est({ ...f, estilo: "presa" }).length === 0, "acepta un estilo que ofrece la clase");
t(est({ ...f, estilo: "piedra" }).length === 1, "rechaza un estilo que la clase no ofrece");
t(est({ ...f, estilo: "contracorriente" }).length === 1 && est({ ...f, estilo: "inventado" }).length === 1, "rechaza los de solo historia y los inexistentes");
t(est({ ...f, clase: "Flagelante", estilo: "haemajitsu" }).length === 0, "Flagelante acepta su Haemajitsu");
t(est({ ...f, clase: "Hechicero", estilo: "presa" }).length === 1, "Hechicero no puede elegir un estilo");
const txt = textoFicha({ ...f, estilo: "cuervo" });
t(/Estilo marcial: Filo del Cuervo \(guárdalo con arte_marcial \{accion: aprender, quien: «Brunilda», arte: «Filo del Cuervo», via: «clase»\} justo después de guardar_personaje\)/.test(txt), "textoFicha incluye la línea del estilo");
t(!/Estilo marcial/.test(textoFicha(f)), "sin estilo no hay línea");

// --- la ficha: chip y pop-up
const P = nuevaPartida(); normalizarPartida(P);
const base = { don_arcano: false, nombre: "Brunilda", jugador: "Ana", raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 1, pv_max: 20, ca: 12, atributos: { fue: 14, des: 12, con: 14, int: 10, sab: 10, car: 10 }, inventario: ["Espada larga"], dote: "Terco", genero: "Femenino" };
ejecutar("guardar_personaje", base, P);
const chips = (n: string) => fichaClicable(P.personajes[n]).flat().filter((s) => s.k?.tipo === "estilo");
t(chips("Brunilda").length === 0, "sin estilo no hay chip");
const r = ejecutar("arte_marcial", { accion: "aprender", quien: "Brunilda", arte: "Presa de Hollín", via: "clase" }, P);
let c = chips("Brunilda");
t(c.length === 1 && c[0].t === "Presa de Hollín (Iniciado)" && c[0].k!.nombre === "presa", "chip «Presa de Hollín (Iniciado)»", c[0]?.t ?? JSON.stringify(r));
let a = ayuda(P, "Brunilda", "estilo", "presa");
t(/Centro del estilo: agarres/.test(a.cuerpo[0]) && /Principio: Quien agarra no suelta/.test(a.cuerpo[1]), "el pop-up da el centro y el principio");
t(/^✔ Iniciado/.test(a.cuerpo[2]) && /^🔒 Practicante, llega en el nivel 5/.test(a.cuerpo[3]) && /^🔒 Maestro/.test(a.cuerpo[4]), "nivel 1: Iniciado desbloqueada, las otras por llegar", a.cuerpo.slice(2, 5).map((x) => x.slice(0, 40)).join(" | "));
P.personajes.Brunilda.nivel = nvl(3);
c = chips("Brunilda"); a = ayuda(P, "Brunilda", "estilo", "presa");
t(c[0]?.t === "Presa de Hollín (Practicante)" && /^✔ Practicante/.test(a.cuerpo[3]) && /^🔒 Maestro, llega en el nivel/.test(a.cuerpo[4]), "nivel Practicante: dos desbloqueadas");
t(a.cuerpo[4].includes(`nivel ${nvl(7)}`) && a.cuerpo[3].length > 20, "la técnica pendiente indica el nivel real de Maestro", a.cuerpo[4].slice(0, 50));
P.personajes.Brunilda.nivel = nvl(7);
t(chips("Brunilda")[0]?.t === "Presa de Hollín (Maestro)" && ayuda(P, "Brunilda", "estilo", "presa").cuerpo.slice(2, 5).every((x) => x.startsWith("✔")), "nivel Maestro: las tres desbloqueadas");
ejecutar("guardar_personaje", { ...base, nombre: "Sangre", jugador: "Beto", clase: "Flagelante" }, P);
t(chips("Sangre").length === 1 && chips("Sangre")[0].t.startsWith("Haemajitsu"), "el Flagelante muestra el Haemajitsu de serie");
t(ayuda(P, "Brunilda", "estilo", "ninguno").titulo === "Sin estilo marcial", "la ayuda «Sin estilo» explica cómo aprender uno");

// --- /artes
const g = comando(P, "/artes");
t(!!g && !g.publico && /Haemajitsu/.test(g.texto) && /Presa de Hollín/.test(g.texto) && /Clases que lo ofrecen: Mercenario del Cuervo/.test(g.texto) && /Lo enseña:/.test(g.texto), "/artes responde con el catálogo");
t(!/Tus estilos/.test(g!.texto), "sin jugador no hay sección propia");
const m = comando(P, "/artes", "Ana");
t(/Tus estilos:\nBrunilda:\n  · Presa de Hollín \(Maestro\):/.test(m!.texto), "con su personaje, /artes añade sus estilos y técnicas", (m!.texto.split("Tus estilos:")[1] ?? "").slice(0, 80));
t(/aún no conoce ningún estilo/.test(comando(P, "/artes", "Chema")?.texto ?? "") === false, "quien no tiene personaje solo ve el catálogo");
t(/\/artes/.test(comando(P, "/ayuda")!.texto), "la ayuda lista /artes");
console.log(`${ok} ok, ${mal} fallas`);
