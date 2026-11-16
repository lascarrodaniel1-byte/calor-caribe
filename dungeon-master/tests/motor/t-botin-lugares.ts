// Botín de lugares (L4): tesoro de las guaridas, cofres de trampas (contiene / abrir), tienda ampliada con categorías no combate,
// rumor hallado (solo capa de rumor o pública) y botín marítimo y acuático de los encuentros (sin cambiar su peligro).
import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { generarBotinDe } from "../../src/botin.ts";
import { GUARIDAS, tesoroGuarida } from "../../src/guarida.ts";
import { TESORO, tesoroPorId } from "../../src/tesoro.ts";
import { TABLA, sortearEncuentro } from "../../src/encuentros.ts";
import { TEMAS } from "../../src/saber.ts";
import { textoTrampas } from "../../src/trampas.ts";
import { ejecutar } from "../../src/herramientas.ts";
import { iniciarRegistroDados, liberarDados } from "../../src/dados.ts";
let ok = 0, mal = 0; const t = (c: boolean, m: string, x = "") => { console.log(c ? "ok   " : "FALLA", m, x); c ? ok++ : mal++; };
const nueva = () => { const p = nuevaPartida(); normalizarPartida(p); return p; };
const E = (p: any, n: string, d: object): any => ejecutar(n, d, p);

// ---- Guaridas: una línea y piezas válidas por cada jefe con guarida
{
  const nombres = Object.keys(GUARIDAS);
  t(nombres.length === 8, "ocho guaridas", String(nombres.length));
  t(nombres.every((n) => { const g = tesoroGuarida(n)!; return g && g.texto.length > 20 && g.texto.length <= 200 && !g.texto.includes("\n") && g.piezas.length >= 3 && g.piezas.every((x) => !!tesoroPorId(x.id) && x.probabilidad >= 1 && x.probabilidad <= 100); }), "cada guarida: una línea de tesoro y ≥ 3 piezas válidas del catálogo");
  t(tesoroGuarida("Aldenmar") === undefined, "sin guarida, sin tesoro de guarida");
  const p = nueva();
  t(E(p, "guarida", { accion: "ver", criatura: "Ysolde" }).contenido.includes("Tesoro de la guarida"), "guarida ver muestra el tesoro");
  let cirio = 0, escr = 0, escrJefe = 0;
  for (let i = 0; i < 300; i++) {
    cirio += /Cirio negro de la Corte Pálida/.test(generarBotinDe(nueva(), { origen: "hallazgo", cantidad: 1, criatura: "Ysolde, la Reina Pálida", incluir_viales: false }).dm) ? 1 : 0;
    escr += /Escrituras de media Marca/.test(generarBotinDe(nueva(), { origen: "hallazgo", cantidad: 1, criatura: "Ysolde, la Reina Pálida", incluir_viales: false }).dm) ? 1 : 0;
    escrJefe += /Escrituras de media Marca/.test(generarBotinDe(nueva(), { origen: "jefe", cantidad: 1, criatura: "Ysolde, la Reina Pálida", incluir_viales: false }).dm) ? 1 : 0;
  }
  t(cirio > 150 && escr < 20 && escrJefe === 300, "hallazgo en su guarida: lo de la guarida (sus escrituras solo por la tabla, rara vez); jefe: lo que lleva encima", `${cirio} ${escr} ${escrJefe}`);
  const k = generarBotinDe(nueva(), { origen: "hallazgo", cantidad: 1, criatura: "Kharoth, Dragón Antiguo del Sol Herido", incluir_viales: false });
  t(/Monedas de un tesoro de dragón \(\d+\)/.test(k.dm) && /Oro: \d+ po/.test(k.dm), "la guarida de Kharoth: su tesoro de dragón y oro sugerido (P5 hallazgo)");
  t(/P5/.test(k.dm), "peligro del jefe por defecto (P5)");
}

// ---- Trampas con cofre
{
  const p = nueva();
  E(p, "guardar_personaje", { nombre: "Ana", jugador: "Ana", genero: "Femenino", raza: "Humano del Faro", clase: "Degollador", nivel: 3, pv_max: 24, ca: 14, atributos: { fue: 10, des: 16, con: 12, int: 12, sab: 12, car: 10 }, inventario: ["Herramientas de ladrón"], don_arcano: false, dote: "Terco" });
  const efecto = { nombre: "Dardo", descripcion: "Un dardo sale de la cerradura.", salvacion: "des", cd: 12, dano: "1d4", tipo_dano: "perforante" };
  const c = E(p, "trampa", { accion: "colocar", nombre: "Cofre del sótano", lugar: "Karak-Dûm", cd_detectar: 10, cd_desarmar: 10, efecto, contiene: { peligro: 3, cantidad: 3 } });
  t(!c.error && c.contenido.includes("con un cofre (tesoro P3)"), "colocar con contiene", c.contenido.slice(0, 120));
  t(textoTrampas(p).includes("cofre P3"), "el estado del DM recuerda el cofre pendiente");
  t(E(p, "trampa", { accion: "abrir", nombre: "Cofre del sótano" }).error === true, "abrir con la trampa armada: error");
  p.trampas!["Cofre del sótano"].estado = "descubierta";
  iniciarRegistroDados([{ caras: 20, valor: 20 }]);
  const d = E(p, "trampa", { accion: "desarmar", nombre: "Cofre del sótano", quienes: ["Ana"], herramientas: true }); liberarDados();
  t(!d.error && d.contenido.includes("El cofre se abre sin riesgo") && /— \d+ po|Oro: \d+ po/.test(d.contenido) && /💰 El cofre guarda/.test(d.aviso ?? ""), "desarmar con éxito abre el cofre: botín para el DM y a la vista", d.contenido.slice(-160));
  t(E(p, "trampa", { accion: "abrir", nombre: "Cofre del sótano" }).error === true, "el cofre se abre una sola vez");
  t(!textoTrampas(p).includes("cofre P3"), "abierto, ya no se anota");
  // disparada: el cofre queda pendiente hasta abrir
  E(p, "trampa", { accion: "colocar", nombre: "Cofre roto", lugar: "el mar", cd_detectar: 10, efecto, contiene: { peligro: 2, categorias: ["documento", "gema_arte"] } });
  const s = E(p, "trampa", { accion: "disparar", nombre: "Cofre roto", quienes: ["Ana"] });
  t(s.contenido.includes("trampa {accion: abrir}") && textoTrampas(p).includes("Cofre roto"), "disparar avisa del cofre pendiente y sigue anotado");
  const a = E(p, "trampa", { accion: "abrir", nombre: "Cofre roto" });
  t(!a.error && a.contenido.includes("se abre") && /Oro: \d+ po/.test(a.contenido), "abrir tras disparar entrega el botín", a.contenido.slice(0, 100));
  t(E(p, "trampa", { accion: "abrir", nombre: "Hoz" }).error === true, "abrir una trampa inexistente: error");
  E(p, "trampa", { accion: "colocar", nombre: "Sin cofre", cd_detectar: 10, efecto });
  t(E(p, "trampa", { accion: "abrir", nombre: "Sin cofre" }).error === true, "abrir una trampa sin cofre: error");
  t(E(p, "trampa", { accion: "colocar", nombre: "Mala", cd_detectar: 10, efecto, contiene: { peligro: 9 } }).error === true, "contiene.peligro fuera de 1-5 se rechaza");
}

// ---- Tienda ampliada: la compra ya no es solo armas
{
  const p = nueva(); let no = 0, total = 0, herr = 0, com = 0, doc = 0, mat = 0;
  for (let i = 0; i < 200; i++) {
    const r = generarBotinDe(p, { origen: "compra", cantidad: 6, peligro: 2, region: "Aldenmar", incluir_viales: false });
    for (const l of r.dm.split("\n").slice(1)) {
      if (/^- (Oro|Vial|Catalizador)/.test(l)) continue;
      total++;
      const x = TESORO.find((y) => l.startsWith(`- ${y.nombre}`));
      if (x) { no++; if (x.categoria === "herramienta") herr++; if (x.categoria === "comida_bebida") com++; if (x.categoria === "documento") doc++; if (x.categoria === "material") mat++; }
    }
  }
  t(no / total > 0.55 && herr > 0 && com > 0 && doc > 0 && mat > 0, "la tienda vende herramientas, comida, documentos y materiales (> 55 % no combate)", `${((100 * no) / total).toFixed(0)}% h${herr} c${com} d${doc} m${mat}`);
  const r = generarBotinDe(nueva(), { origen: "compra", cantidad: 8, peligro: 1 });
  t(!/Oro:/.test(r.dm) && !/Pista escrita/.test(r.dm), "la tienda no da oro ni rumores");
  t(!TESORO.some((x) => x.unico && r.dm.includes(x.nombre)) && !/Perlas de luna/.test(r.dm), "ni únicos ni piezas de criaturas en una tienda");
}

// ---- Rumor hallado: solo en hallazgos, solo capa de rumor o pública, nunca Æsir ni lo erudito, restringido o secreto
{
  let hay = 0, fuga = 0, otros = 0, jugVe = 0; const N = 600;
  const prohibidos = TEMAS.flatMap((x) => [x.erudito, x.restringido, x.secreto].filter(Boolean) as string[]);
  const permitidos = new Set(TEMAS.filter((x) => x.id !== "aesir").flatMap((x) => [x.rumor, x.publico].filter(Boolean) as string[]));
  for (let i = 0; i < N; i++) {
    const r = generarBotinDe(nueva(), { origen: "hallazgo", cantidad: 2, peligro: 3, region: i % 2 ? "Ciénagas" : "Marca Hueca", incluir_viales: false });
    const l = r.dm.split("\n").find((x) => x.startsWith("- Pista escrita"));
    if (l) {
      hay++;
      const texto = l.replace(/^.*?: /, "");
      if (![...permitidos].some((p) => l.includes(p)) || prohibidos.some((p) => l.includes(p)) || /Æsir|aesir|fuego viejo/i.test(l)) fuga++;
      if (r.jugadores.includes(texto.slice(0, 30))) jugVe++;
    }
    for (const o of ["saqueo", "jefe", "compra"] as const) if (/Pista escrita/.test(generarBotinDe(nueva(), { origen: o, cantidad: 2, peligro: 3 }).dm)) otros++;
  }
  t(hay > N * 0.1 && hay < N * 0.3, "un hallazgo trae una pista escrita ≈ 20 % de las veces", `${hay}/${N}`);
  t(fuga === 0, "solo rumor o capa pública del saber: nunca lo erudito, restringido, secreto ni Æsir", String(fuga));
  t(otros === 0 && jugVe === 0, "saqueo, jefe y tienda no dan rumores; los jugadores no ven el texto del rumor", `${otros} ${jugVe}`);
}

// ---- Encuentros marítimos y acuáticos: botín náutico sin cambiar el peligro
{
  const por = (id: string) => TABLA.find((x) => x.id === id)!;
  t(por("bakunawa").peligro === 5 && por("sirena").peligro === 3 && por("hombres_pez").peligro === 2 && por("bakunawa").mar === true, "peligros intactos: Bakunawa 5, Sirena 3, Hombre pez 2");
  t(["bakunawa", "sirena", "hombres_pez", "pecio"].every((id) => !!por(id).botin), "los encuentros marítimos y acuáticos traen su botín sugerido");
  t(por("pecio").mar === true && por("pecio").tipo === "hallazgo" && por("pecio").peligro === 1, "pecio a la deriva: hallazgo en el mar, peligro 1");
  t(TABLA.filter((x) => x.botin).length === 4, "solo esos cuatro llevan la línea de botín (no engorda los demás)");
  const p = nueva(); let pec = 0, hint = 0, bak = 0;
  for (let i = 0; i < 400; i++) {
    const q = nueva(); const r = sortearEncuentro(q, { region: "el mar abierto" });
    if (/Pecio a la deriva/.test(r)) { pec++; if (/Botín al acabar: generar_botin \{origen: "hallazgo", peligro: 1, region: "mar"\}/.test(r)) hint++; }
    if (/Bakunawa/.test(r)) bak++;
  }
  t(pec > 0 && hint === pec, "el pecio sale en el mar y lleva su línea de botín", `${pec}/${hint}`);
  void p; void bak;
  const s = sortearEncuentro(nueva(), { region: "Aldenmar" });
  t(!/Pecio a la deriva/.test(s), "el pecio no sale en tierra");
  // la sugerencia de botín del pecio funciona de verdad: náutico en el mar
  let naut = 0;
  for (let i = 0; i < 100; i++) naut += /Carta marina|Ancla pequeña|Cofre de naufragio|Pertrechos|Astrolabio|Bandera de una nave|Diario de a bordo|Red de pesca|Farol de nave|Cuaderno de mareas/.test(generarBotinDe(nueva(), { origen: "hallazgo", peligro: 1, region: "mar", cantidad: 3 }).dm) ? 1 : 0;
  t(naut > 25, "generar_botin {hallazgo, mar} da botín náutico", String(naut));
  let tro = 0;
  for (let i = 0; i < 100; i++) tro += /Perlas de luna|Escamas de mar profundo/.test(generarBotinDe(nueva(), { origen: "saqueo", criatura: "Bakunawa", region: "mar", cantidad: 1 }).dm) ? 1 : 0;
  t(tro === 100, "generar_botin {Bakunawa, mar} da sus escamas y perlas de luna", String(tro));
}
console.log(`${ok} ok, ${mal} fallas`);
