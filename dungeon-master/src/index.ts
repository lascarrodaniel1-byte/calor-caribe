// Dungeon Master de D&D en la terminal. Uso: npm run jugar [-- --nueva]
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { cargar, guardar, nuevaPartida } from "./estado.js";
import { AYUDA, comando, MENSAJE_NUEVA, MENSAJE_REANUDAR, MODELO, RUTA, turno, type Salida } from "./motor.js";

const gris = (s: string) => `\x1b[90m${s}\x1b[0m`;
const amarillo = (s: string) => `\x1b[33m${s}\x1b[0m`;
const cian = (s: string) => `\x1b[36m${s}\x1b[0m`;

function consola(): Salida {
  let alFinalDeLinea = true;
  const cerrarLinea = () => {
    if (!alFinalDeLinea) process.stdout.write("\n");
    alFinalDeLinea = true;
  };
  return {
    texto(delta) {
      process.stdout.write(delta);
      alFinalDeLinea = delta.endsWith("\n");
    },
    aviso(t) {
      cerrarLinea();
      console.log(cian(t));
    },
    info(t) {
      cerrarLinea();
      console.log(amarillo(t));
    },
  };
}

async function main() {
  const nueva = process.argv.includes("--nueva");
  let partida = !nueva ? cargar(RUTA) : null;
  const reanudada = partida !== null && partida.historial.length > 0;
  partida ??= nuevaPartida();

  console.log(amarillo("⚔️  Dungeon Master · Velmora, el Reino del Sol Herido") + gris(`  (modelo: ${MODELO}, partida: ${RUTA})`));
  console.log(gris("Escribe /ayuda para ver los comandos.\n"));

  if (!reanudada && existsSync(RUTA) && nueva) console.log(gris("(Se empezará una partida nueva; la anterior se sobrescribirá al jugar.)"));
  const conTurno = async (texto: string) => {
    const salida = consola();
    await turno(partida, texto, salida);
    salida.texto("\n");
  };
  await conTurno(reanudada ? MENSAJE_REANUDAR : MENSAJE_NUEVA);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.on("SIGINT", () => {
    guardar(RUTA, partida);
    console.log(gris("\nPartida guardada. ¡Hasta la próxima!"));
    process.exit(0);
  });

  for (;;) {
    let texto: string;
    try {
      texto = (await rl.question(amarillo("\n> "))).trim();
    } catch {
      break; // stdin cerrado
    }
    if (!texto) continue;
    if (texto === "/salir") break;
    if (texto.startsWith("/")) {
      const r = comando(partida, texto);
      console.log(r ? (r.publico ? cian(r.texto) : r.texto) : `Comando desconocido.\n${AYUDA}\n  /salir           guarda y sale`);
      continue;
    }
    console.log();
    await conTurno(texto);
  }

  rl.close();
  guardar(RUTA, partida);
  console.log(gris("Partida guardada. ¡Hasta la próxima!"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
