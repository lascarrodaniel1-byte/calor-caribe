// Tablero de buscados (solo lectura): sin buscados la página se ve como hoy; con carteles visibles se listan; los ocultos, no; el contrato aceptado
// aparece con su plazo; el cartel de un personaje del grupo publicado por el DM aparece; las pistas sin revelar y el perfil de combate no llegan a la
// página; se actualiza en directo con la partida compartida; no hay nada editable; cierra con Escape; móvil (390 px) sin desbordes.
import { lanzar, MOCK, salida, paginaDe } from "./_comun.mjs";
const S = await paginaDe();
let fallos = 0;
const t = (c, m, x = "") => { console.log(c ? "ok  " : "FALLA", m, x); if (!c) fallos++; };
const errs = [];
let version = 10;

for (const [w, h, n] of [[1280, 900, "escritorio"], [390, 844, "movil"]]) {
  const b = await lanzar();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 600 });
  const pg = await ctx.newPage();
  pg.on("pageerror", (e) => errs.push(e.message));
  await pg.addInitScript({ path: MOCK });
  await pg.goto("file://" + S + "/mesa-de-velmora.html"); await pg.waitForTimeout(800);
  await pg.click("#form-tutorial button[type=submit]").catch(() => {}); await pg.fill("#nombre", "Ana"); await pg.click("#form-nombre button"); await pg.waitForTimeout(500);
  const abrir = async () => { await pg.evaluate(() => document.getElementById("ver-buscados").click()); await pg.waitForTimeout(250); };
  // Construye la partida en la página con el motor y la sube a la base compartida; `paso` la modifica antes de subirla.
  const subir = async (paso) => {
    version += 5;
    await pg.evaluate(async ([paso, version]) => {
      const V = window.Velmora;
      const doc = await window.__db.doc("mesa/estado").get();
      const p = doc.exists && doc.data().partida ? doc.data().partida : V.nuevaPartida();
      V.normalizarPartida(p);
      const E = (nombre, datos) => V.ejecutar(nombre, datos, p);
      const fijar = (v) => V.dados.iniciarRegistroDados(v.map((valor) => ({ caras: 20, valor })));
      // eslint-disable-next-line no-new-func
      new Function("p", "E", "fijar", "V", paso)(p, E, fijar, V);
      V.dados.liberarDados();
      await window.__db.doc("mesa/estado").set({ partida: p, cronica: "", actualizado: version });
    }, [paso, version]);
    await pg.waitForTimeout(1300);
  };
  const cartas = () => pg.evaluate(() => [...document.querySelectorAll("#buscados-lista .cartel")].map((c) => ({ id: c.dataset.id, texto: c.innerText })));

  // 1. Sin buscados: la página se ve como hoy (sin botón, sin diálogo)
  await subir(`E("guardar_personaje", { don_arcano: false, nombre: "Aldo", jugador: "Ana", raza: "Humano del Faro", clase: "Mercenario del Cuervo", nivel: 5, pv_max: 90, ca: 12, atributos: { fue: 16, des: 14, con: 14, int: 12, sab: 14, car: 10 }, inventario: ["Espada larga"] });
    E("ubicacion", { lugar: "Casa de Registros", region: "Aldenmar", tipo: "ciudad" });`);
  t(await pg.evaluate(() => document.getElementById("ver-buscados").hidden && document.getElementById("velo-buscados").hidden), n + " · sin buscados no hay botón ni diálogo");

  // 2. El DM abre el tablero: aparece el botón y se listan los carteles visibles del lugar
  await subir(`E("buscados", { accion: "ver" });`);
  t(await pg.evaluate(() => !document.getElementById("ver-buscados").hidden), n + " · con el tablero abierto aparece el botón");
  await abrir();
  const c1 = await cartas();
  const ids1 = c1.map((c) => c.id);
  t(ids1.includes("B02") && ids1.includes("B07") && ids1.includes("B15") && !ids1.includes("B01"), n + " · lista los carteles de Aldenmar y las circulares de peligro 4-5, no los de otra región", ids1.join(","));
  const b02 = c1.find((c) => c.id === "B02")?.texto ?? "";
  t(/Marga Veyl/.test(b02) && /culto prohibido/i.test(b02) && /Vivo 50 po/.test(b02) && /muerto 30 po/.test(b02) && /Última ubicación conocida: las fosas comunes/.test(b02) && /Firma: Teodric Marn/.test(b02) && /Plazo: 15 días/.test(b02), n + " · cada cartel: nombre, delito, recompensas, última ubicación, firma y plazo", b02.replace(/\n+/g, " | ").slice(0, 160));
  const b07 = c1.find((c) => c.id === "B07")?.texto ?? "";
  t(/solo vivo/.test(b07), n + " · «solo vivo» se ve en el cartel");
  const todo = await pg.innerText("#buscados-lista");
  t(!/ataque \+|Hambrientos|iniciativa|escolta|PNJ sin ficha|\[rumor\]|\[erudito\]/.test(todo.replace(/Marga Veyl[^]*?Firma/, (m) => m.replace(/Hambrientos/g, ""))), n + " · no llega el perfil de combate ni nada del DM");
  t(/Rango de la mesa ante la Llama Gris: Sin licencia \(0 puntos\)/.test(await pg.textContent("#buscados-rango")), n + " · muestra el rango de la mesa con la Llama");
  t(await pg.evaluate(() => document.querySelectorAll("#velo-buscados input, #velo-buscados textarea, #velo-buscados select, #velo-buscados button").length === 1 && document.querySelectorAll("#velo-buscados [contenteditable]").length === 0), n + " · solo lectura: lo único pulsable es «Cerrar»");

  // 3. Los carteles ocultos no se muestran; al publicarlos, aparecen (y en directo, con el panel abierto)
  await subir(`E("buscados", { accion: "cartel", datos: { nombre: "Aldo", alias: "el Desertor", delito: "desercion", descripcion: "Hombre ancho de espaldas con una quemadura en la mano.", viva: 400, muerta: 250, peligro: 3, plazo: 30, firma: "Marsh", rango_firma: "oficial de la guardia de la Llama Gris", visible: false } });
    E("buscados", { accion: "cartel", datos: { nombre: "Orrin Voss", delito: "brujeria", descripcion: "Un hombre flaco de ojos hundidos.", viva: 200, firma: "Marsh", visible: false } });`);
  const c2 = await cartas();
  t(!c2.some((c) => /^P0/.test(c.id)) && c2.length === c1.length, n + " · los carteles ocultos (un PJ y un PNJ) NO se listan, con el panel abierto", String(c2.length));
  await subir(`E("buscados", { accion: "cartel", id: "P01", datos: { visible: true } });`);
  const c3 = await cartas();
  const p1 = c3.find((c) => c.id === "P01")?.texto ?? "";
  t(c3.length === c1.length + 1 && /Aldo/.test(p1) && /el Desertor/.test(p1) && /deserción/i.test(p1) && /Marsh, oficial de la guardia de la Llama Gris/.test(p1) && /Vivo 400 po · muerto 250 po/.test(p1), n + " · el cartel de un personaje del grupo, publicado por el DM, aparece en directo", p1.replace(/\n+/g, " | ").slice(0, 400) + " n=" + c3.length + "/" + c1.length);
  t(!(await cartas()).some((c) => c.id === "P02"), n + " · y el otro oculto sigue sin verse");

  // 4. Contrato aceptado con su plazo, pistas reveladas, rango
  await subir(`E("buscados", { accion: "aceptar", id: "B02", quien: "Aldo" }); fijar([20]); E("buscados", { accion: "pista", id: "B02", quien: "Aldo" });`);
  const c4 = (await cartas()).find((c) => c.id === "B02")?.texto ?? "";
  t(/tomado · Aldo · plazo hasta el día 16/.test(c4), n + " · el contrato aceptado aparece con quién y su plazo", c4.replace(/\n+/g, " | ").slice(-120));
  t(/Pistas reveladas/.test(c4) && /tabernas|fosas|rezando|reza/i.test(c4) && (c4.match(/<li>|\n/g) ?? []).length > 3, n + " · la pista revelada se ve");
  const sinRev = (await cartas()).find((c) => c.id === "B03")?.texto ?? "";
  t(!/Pistas reveladas/.test(sinRev), n + " · un cartel sin pistas reveladas no muestra ninguna");
  await subir(`p.buscados.rep = 9;`);
  t(/Cazador licenciado \(9 puntos\)/.test(await pg.textContent("#buscados-rango")), n + " · el rango se actualiza en directo");

  // 5. Entregado: cambia de estado; retirado: desaparece
  await subir(`E("buscados", { accion: "entregar", id: "B02", estado: "vivo" }); E("buscados", { accion: "retirar", id: "B07" });`);
  const c5 = await cartas();
  t(/entregado/.test(c5.find((c) => c.id === "B02")?.texto ?? "") && !c5.some((c) => c.id === "B07"), n + " · un cartel entregado cambia de estado y uno retirado desaparece");

  // 6. Sin desbordes, accesibilidad, capturas
  const medidas = await pg.evaluate(() => {
    const v = document.querySelector("#velo-buscados .tablero");
    return { pagina: document.documentElement.scrollWidth <= window.innerWidth, dialogo: v.scrollWidth <= v.clientWidth, rol: v.getAttribute("role"), etiqueta: v.getAttribute("aria-labelledby"), ancho: v.getBoundingClientRect().width, vw: window.innerWidth };
  });
  t(medidas.pagina && medidas.dialogo && medidas.rol === "dialog" && medidas.etiqueta === "titulo-buscados" && medidas.ancho <= medidas.vw, n + " · sin desbordes y con rol de diálogo", JSON.stringify(medidas));
  await pg.screenshot({ path: salida("buscados-" + n + ".png") });
  console.log("captura:", salida("buscados-" + n + ".png"));
  await pg.keyboard.press("Escape"); await pg.waitForTimeout(150);
  t(await pg.evaluate(() => document.getElementById("velo-buscados").hidden), n + " · Escape cierra el tablero");
  await abrir(); await pg.click("#cerrar-buscados"); await pg.waitForTimeout(100);
  t(await pg.evaluate(() => document.getElementById("velo-buscados").hidden), n + " · «Cerrar» lo cierra");

  // 7. En un lugar sin tablón, el panel lo dice y no lista nada
  await subir(`E("ubicacion", { lugar: "Cueva del lobo", region: "Aldenmar", tipo: "cueva" });`);
  await abrir();
  t((await cartas()).length === 0 && /no hay un tablón/i.test(await pg.textContent("#buscados-vacio")), n + " · en una cueva no hay tablón: mensaje y lista vacía");
  await pg.keyboard.press("Escape");
  await b.close();
}
console.log("errores de página:", errs.length, errs.slice(0, 3));
console.log(fallos ? `FALLAS: ${fallos}` : "todo ok");
process.exit(fallos || errs.length ? 1 : 0);
