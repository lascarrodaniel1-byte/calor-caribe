import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
let visto = 0, n = 0, err = 0;
for (let i = 0; i < 400; i++) { const p = nuevaPartida(); normalizarPartida(p); const E = (a: string, d: object): any => ejecutar(a, d, p);
  E("ubicacion", { lugar: "Monasterio de Vahl", region: "Las Agujas de Vahl", tipo: "templo" });
  const r = E("encuentro", { sin_jefe: true, tipo: "combate", dificultad: "mortal" }); n++; if (r.error) err++; if (/Wendigo/i.test(String(r.contenido))) visto++; }
console.log(`encuentros ${n}, errores ${err}, con Wendigo ${visto}`);
