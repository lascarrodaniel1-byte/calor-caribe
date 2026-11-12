// Simula window.claude (db en memoria + usuario + DM) para probar la página sin red.
(() => {
  const store = new Map(), oyentes = new Map();
  const clon = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const colOyentes = new Map();
  // `dir` -1 = orderBy("ts", "desc"); `lim` = limit(n): como la base de datos real, que devuelve los n más recientes.
  const snapCol = (col, dir = 1, lim = 0) => { let docs = lista(col).sort((a, b) => dir * ((a.data().ts || 0) - (b.data().ts || 0))); if (lim) docs = docs.slice(0, lim); return { docs, empty: !docs.length, forEach: (f) => docs.forEach(f) }; };
  const avisar = (ruta) => { for (const f of oyentes.get(ruta) || []) f(snapDe(ruta)); const col = ruta.split("/").slice(0, -1).join("/"); for (const o of colOyentes.get(col) || []) o.ok(snapCol(col, o.q.dir, o.q.lim)); };
  const snapDe = (ruta) => ({ id: ruta.split("/").pop(), exists: store.has(ruta), data: () => clon(store.get(ruta)) });
  let contador = 0;
  const doc = (ruta) => ({
    get: async () => snapDe(ruta),
    set: async (d) => { store.set(ruta, clon(d)); avisar(ruta); },
    update: async (d) => { store.set(ruta, { ...(store.get(ruta) || {}), ...clon(d) }); avisar(ruta); },
    delete: async () => { store.delete(ruta); avisar(ruta); },
    onSnapshot: (ok) => { (oyentes.get(ruta) || oyentes.set(ruta, []).get(ruta)).push(ok); setTimeout(() => ok(snapDe(ruta)), 0); return () => {}; },
    acquire: async () => ({ acquired: true }),
  });
  const lista = (col) => [...store.keys()].filter((k) => k.startsWith(col + "/") && !k.slice(col.length + 1).includes("/")).map((k) => ({ id: k.split("/").pop(), data: () => clon(store.get(k)) }));
  const consulta = (col) => { const q = { dir: 1, lim: 0, get: async () => snapCol(col, q.dir, q.lim), orderBy: (_c, d) => { q.dir = d === "desc" ? -1 : 1; return q; }, limit: (n) => { q.lim = n; return q; }, where: () => q, onSnapshot: (ok) => { (colOyentes.get(col) || colOyentes.set(col, []).get(col)).push({ ok, q }); setTimeout(() => ok(snapCol(col, q.dir, q.lim)), 0); return () => {}; } }; return q; };
  const db = { doc, collection: (col) => ({ ...consulta(col), add: async (d) => { const id = "a" + ++contador; store.set(col + "/" + id, clon(d)); avisar(col + "/" + id); return { id }; } }) };
  window.__store = store; window.__db = db; window.__repasos = []; window.__llamadas = [];
  window.claude = { use: async (n) => (n === "db" ? db : n === "user" ? { id: async () => "u1", isOwner: async () => true, canEdit: async () => true, can: async () => true } : n === "sample" ? sample : n === "downloads" ? { save: async (r) => { (window.__descargas = window.__descargas || []).push({ filename: r.filename, data: r.data }); return { status: "saved" }; } } : null) };
  const sample = async (entrada, opts) => {
    window.__llamadas.push(opts.repaso ? "repaso" : "turno");
    if (!opts.repaso) { (window.__entradas = window.__entradas || []).push(typeof entrada === "string" ? entrada : JSON.stringify(entrada)); }
    if (opts.repaso) { window.__repasos.push(entrada); if (window.__colgarRepaso) return new Promise(() => {}); return { text: "ok", truncated: false }; }
    if (window.__colgarDM) return new Promise(() => {});
    if (!opts.tools) { window.__llamadas.push("narrar"); const t2 = window.__textoNarrar ?? ""; opts.onText?.({ text: t2 }); return { text: t2, truncated: false }; }
    const motor = opts.tools[0];
    opts.onText?.({ text: "Narración. " });
    if (window.__accionesDM) await motor.execute({ acciones: window.__accionesDM });
    const texto = window.__sinTexto ? "" : (window.__textoDM || "La posada huele a cerveza.");
    opts.onText?.({ text: texto });
    return { text: texto, truncated: false };
  };
})();
