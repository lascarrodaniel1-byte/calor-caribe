// Nivel del DM compartido por mesa: nivelEfectivo(config, local).
import { nivelEfectivo, NIVELES_DM } from "../../src/nivel.ts";
import { nivelEfectivo as deNavegador } from "../../src/navegador.ts";

let ok = 0, mal = 0;
const t = (c: boolean, m: string) => { console.log(c ? "ok   " : "FALLA", m); c ? ok++ : mal++; };
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

t(deNavegador === nivelEfectivo, "V.nivelEfectivo es la función exportada");
t(eq(NIVELES_DM, ["quick", "default", "complex"]), "los tres niveles del selector");
t(eq(nivelEfectivo({ nivel: "default" }, "quick"), { nivel: "default", origen: "mesa" }), "config «default» gana al local «quick»");
t(eq(nivelEfectivo({ nivel: "complex" }, "default"), { nivel: "complex", origen: "mesa" }), "config «complex» gana al local");
t(eq(nivelEfectivo({ nivel: "quick" }, "complex"), { nivel: "quick", origen: "mesa" }), "config «quick» explícita también manda");
t(eq(nivelEfectivo(null, "default"), { nivel: "default", origen: "local" }), "sin config (null): el local");
t(eq(nivelEfectivo(undefined, "complex"), { nivel: "complex", origen: "local" }), "sin config (undefined): el local");
t(eq(nivelEfectivo(null, ""), { nivel: "quick", origen: "local" }), "sin config y sin local: «quick» como hoy");
t(eq(nivelEfectivo(null, null), { nivel: "quick", origen: "local" }), "local nulo: «quick»");
t(eq(nivelEfectivo(null, "turbo"), { nivel: "quick", origen: "local" }), "local desconocido: «quick»");
t(eq(nivelEfectivo({ nivel: "turbo" }, "default"), { nivel: "default", origen: "local" }), "config inválida: se ignora y vale el local");
t(eq(nivelEfectivo({}, "default"), { nivel: "default", origen: "local" }), "config sin nivel: el local");
t(eq(nivelEfectivo({ nivel: 3 }, "default"), { nivel: "default", origen: "local" }), "config con nivel no textual: el local");
console.log(`${ok} ok, ${mal} fallas`);
