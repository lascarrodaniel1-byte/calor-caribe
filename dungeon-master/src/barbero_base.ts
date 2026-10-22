// Parte sin dependencias del Barbero-Cirujano (la usa la ficha).
import type { Personaje } from "./estado.js";

export const esBarberoC = (p: Personaje) => p.clase === "Barbero-Cirujano";
export const KIT_USOS = 10;

export function textoBarbero(p: Personaje): string {
  if (!esBarberoC(p)) return "";
  return `  🩺 Kit de sanador: ${p.kit_usos ?? KIT_USOS}/${KIT_USOS} usos${p.nivel >= 3 ? " · corte limpio" : ""}`;
}

export const REGLAS_BARBERO = `## Barbero-Cirujano (cirujano de campo independiente)
- Independiente: no pertenece a ninguna orden ni a las Hermanas de la Sutura (que cobran caro y lo miran con recelo). Aprendió su arte en campos de batalla y caminos; trata heridas donde caen, en el barro y con el enemigo cerca. Pragmático, de manos grandes y humor negro de enfermería; ve el cuerpo antes que a la persona y trata a todos igual.
- Tratamiento (tratar_herida): pericia en Medicina (doble competencia), mano de cirujano +2 a todo tratamiento (+3 desde el nivel 2), la falta de material solo le penaliza la mitad y el Triaje le quita la mitad del −4 de tratar en pleno combate. Mano firme (uso real: 1 por descanso largo, 2 desde el nivel 5): repite una tirada de tratamiento fallida con usar_mano_firme. Corte limpio (nivel 3): las complicaciones por fallo pegan la mitad. El kit de sanador gasta 1 de sus 10 usos en cada tratamiento (kit_sanador para ver o reponer).
- Diagnóstico (diagnosticar): al examinar una herida le dice estructura, zona, reloj, dificultad de tratarla y riesgo de infección.
- Amputación (amputar): corta el brazo o la pierna dañados (Medicina CD 15, +3 sin anestesia): la herida desaparece con la Podre que tuviera, y el paciente queda con una secuela permanente y un golpe de 2d6. Es la salida cuando el miembro está perdido; no cura la Podre del cuerpo (eso solo lo hace la magia del Caballero).
- Anatomía: apuntar a una región o a un hueco de la armadura le cuesta la mitad. Con atacar {nervio: brazo | pierna | columna} golpea un nervio (−2, columna −3): si hiere, el objetivo hace una salvación de CON (CD 8 + competencia + su mejor entre SAB y DES) o queda con el brazo entumecido (suelta lo que sostiene y ataca con desventaja), la pierna entumecida (velocidad 0) o paralizado un asalto (columna). Un crítico sube la CD en 2. Los no-muertos y las criaturas sin nervios son inmunes. Así incapacita más fácil que cualquiera.
- Magia (sin Cerrar la carne): contra el dolor, de la mente (Adormecer el dolor: +2 al próximo tratamiento como un paciente sedado; Anestesia profunda: +4 y las complicaciones pegan la mitad), y elemental leve de fuego y hielo (Brasa cauterizadora: cauteriza sin hierro candente, 1d3 de fuego; Frío de quirófano: enfría la herida, gana tres asaltos a una hemorragia y +1 al tratamiento). No domina más magia elemental.
- Sangre de Santo: si él supervisa (usar_vial con supervisa), el riesgo de coágulo baja 10 puntos.`;
