import { nuevaPartida, normalizarPartida } from "../../src/estado.ts";
import { ejecutar } from "../../src/herramientas.ts";
const regiones: [string, string][] = [["Las Agujas de Vahl", "Monasterio"], ["Las Ciénagas de Hollín", "Pozonegro"], ["El Bosque de Velo Rojo", "Claro"], ["La Marca Hueca", "Torre"], ["Karak-Dûm", "Puerta"], ["Aldenmar", "Plaza"]];
const vistos = new Map<string, number>(); let n = 0, err = 0;
for (const [reg, lugar] of regiones) for (let i = 0; i < 250; i++) { const p = nuevaPartida(); normalizarPartida(p); const E = (a: string, d: object): any => ejecutar(a, d, p);
  E("ubicacion", { lugar, region: reg, tipo: "otro" }); const r = E("encuentro", { sin_jefe: true, dificultad: "mortal" }); n++; if (r.error) { err++; continue; }
  for (const k of ["Arpía", "Grifo", "Hidra", "Sirena", "Leshen", "Duende", "Gárgola", "Ulfhedinn", "Hombre oso", "Wendigo"]) if (new RegExp(k, "i").test(String(r.contenido))) vistos.set(k, (vistos.get(k) ?? 0) + 1); }
console.log(`encuentros ${n}, errores ${err}`, JSON.stringify([...vistos]));
