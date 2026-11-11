import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { bestiarioGrupo } from "../../src/codice.ts";
import { BESTIARIO } from "../../src/bestiario.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const txt = (r: any) => (typeof r === "string" ? r : r?.contenido ?? JSON.stringify(r));
const p = nuevaPartida(); normalizarPartida(p); const E = (n: string, d: object): any => ejecutar(n, d, p);
const ver = (n: string) => bestiarioGrupo(p).entradas.find((e) => e.nombre.startsWith(n));
const g0 = bestiarioGrupo(p);
const jefes = BESTIARIO.filter((c) => c.categoria === "jefe").length;
t(g0.entradas.length + g0.ocultos === BESTIARIO.length && g0.ocultos === jefes - 3, "al empezar: todos los monstruos y solo los jefes públicos (Juez, Hugin, Munin); el resto está por descubrir", `${g0.entradas.length} visibles, ${g0.ocultos} ocultos`);
t(!!ver("Wendigo") && !!ver("Lich") && !!ver("Hambriento") && !ver("Ysolde") && !ver("La Madre") && !ver("Vaskar"), "Ysolde, la Madre y Vaskar no aparecen todavía");
const j = JSON.stringify(ver("El Juez")); t(!/ka'?i/i.test(j) && !/arranc/i.test(j) && /Primer Inquisidor/.test(j), "la entrada pública del Juez no filtra su origen", "");
const w0 = ver("Wendigo")!; t(w0.secciones.find((s) => s.titulo === "Cómo ataca")?.bloqueada !== undefined && w0.secciones.find((s) => s.titulo === "Rasgos y puntos débiles")?.bloqueada !== undefined && w0.secciones[0].texto!.length > 20, "un monstruo sin visto: descripción abierta, ataque y rasgos bloqueados");
// ver y derrotar
E("aparecer_criatura", { nombre: "Wendigo" });
const w1 = ver("Wendigo")!; t(w1.vistas === 1 && !w1.secciones.find((s) => s.titulo === "Cómo ataca")!.bloqueada && w1.version > w0.version, "enfrentarse a una criatura desbloquea cómo ataca y sube la versión", `v${w0.version}→v${w1.version}`);
E("danar_criatura", { nombre: "Wendigo", cantidad: 9999 });
const w2 = ver("Wendigo")!; t(w2.derrotadas === 1 && !w2.secciones.find((s) => s.titulo === "Rasgos y puntos débiles")!.bloqueada, "derrotarla desbloquea sus rasgos y puntos débiles", `derrotadas ${w2.derrotadas}`);
E("aparecer_criatura", { nombre: "Wendigo", nombre_instancia: "Otro" });
// jefes: aparecer los descubre
E("aparecer_criatura", { nombre: "Ysolde" }); const y = ver("Ysolde"); t(!!y && /Corte Pálida/.test(JSON.stringify(y)) && !/Dracone|mat[oó]/i.test(JSON.stringify(y)), "un jefe encontrado aparece, con lo público de su tema y sin su secreto", "");
// descubrir
const d1 = E("saber", { accion: "descubrir", tema: "Lich", texto: "Un erudito dice que se esconde en una cripta de la Marca" }); const l1 = ver("Lich")!;
t(!d1.error && l1.notas.length === 1 && l1.vistas === 0, "descubrir añade una nota al bestiario", txt(d1).slice(0, 70));
E("saber", { accion: "descubrir", tema: "El Juez", capa: "secreto" }); const j2 = JSON.stringify(ver("El Juez")); t(/ka'?i/i.test(j2) && /La verdad/.test(j2), "descubrir la capa secreta muestra la verdad del jefe al grupo");
t(!!E("saber", { accion: "descubrir", tema: "Quimera inexistente" }).error, "descubrir exige una criatura del bestiario");
const k = E("saber", { accion: "descubrir", tema: "Kuru" }); t(!k.error && !!ver("Kuru"), "descubrir a un jefe lo hace aparecer", txt(k).slice(0, 60));
console.log(`${ok} ok, ${mal} fallas`);
