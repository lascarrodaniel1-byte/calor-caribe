// El juramento del Caballero Juramentado (parte sin dependencias: lo usan la ficha y la lógica). Es una liga estirada:
// cuantos más votos jura, más poder tiene su magia y más duele romperlo.
import type { Personaje } from "./estado.js";

export interface Voto {
  id: string;
  nombre: string;
  /** Qué promete. */
  promesa: string;
  /** Qué ventaja concreta le da cuando cumple (desde el nivel 3). */
  ventaja: string;
}

export const DIOS = "Ka'i";
export const MAX_VOTOS = 5;

/** Los votos de Ka'i, el dios del sol: honor y fe. */
export const VOTOS: Voto[] = [
  { id: "verdad", nombre: "Verdad", promesa: "No miente ni engaña, ni siquiera por una buena causa", ventaja: "ventaja en Perspicacia (la luz de Ka'i delata la mentira)" },
  { id: "amparo", nombre: "Amparo", promesa: "Protege a los indefensos y a quien se le encomienda", ventaja: "+1 a la CA mientras tiene a un indefenso o a un protegido a 3 m" },
  { id: "lealtad", nombre: "Lealtad", promesa: "No abandona a un compañero en peligro ni rompe su palabra dada", ventaja: "ventaja en las salvaciones para no quedar asustado ni hechizado" },
  { id: "luz", nombre: "Luz", promesa: "No cede ante la oscuridad: no huye de los no-muertos ni de lo corrupto", ventaja: "resistencia al daño necrótico" },
  { id: "descanso", nombre: "Descanso", promesa: "Da descanso a los muertos con el rito de sal y fuego", ventaja: "+1d6 de daño radiante contra los no-muertos" },
  { id: "merced", nombre: "Merced", promesa: "No mata a quien se rinde ni ataca al que no puede defenderse", ventaja: "ventaja en las pruebas de Persuasión con enemigos vencidos" },
];

export interface Juramento {
  dios: string;
  /** Ids de los votos jurados (1-5). */
  votos: string[];
  /** Roto y sin expiar: sus poderes callan. */
  roto?: { voto: string; motivo: string; consecuencia: string; agotamiento?: number };
  /** Roto sin remedio: no vuelve a usar magia divina. */
  perdido?: boolean;
  /** PV que le quedan en la reserva de imposición de manos. */
  reserva: number;
  /** Cuenta de usos de magia divina: cada cuatro deja una marca de Ceniza. */
  carga?: number;
}

export const esCaballero = (p: Personaje) => p.clase === "Caballero Juramentado";
export const intensidad = (p: Personaje) => p.juramento?.votos.length ?? 0;
/** Su poder responde: ha jurado y no lo ha roto. */
export const juramentoActivo = (p: Personaje) => !!p.juramento && !p.juramento.roto && !p.juramento.perdido;
/** Reserva de imposición de manos: nivel × (3 + 2 × votos). */
export const reservaMax = (p: Personaje) => (juramentoActivo(p) ? p.nivel * (3 + 2 * intensidad(p)) : 0);
/** Alcance del sentido divino: 18 m, 36 m desde el nivel 4. */
export const alcanceSentido = (p: Personaje) => (p.nivel >= 4 ? 36 : 18);
/** Dados extra del castigo divino: 2d8, 3d8 con tres votos, 4d8 con cinco. */
export const dadosCastigo = (p: Personaje) => 2 + (intensidad(p) >= 5 ? 2 : intensidad(p) >= 3 ? 1 : 0);

export function textoJuramento(p: Personaje): string {
  const j = p.juramento;
  if (!esCaballero(p)) return "";
  if (!j) return "  ⚠ Aún no ha jurado (sin juramento no tiene poder: juramento {accion: jurar})";
  const votos = j.votos.map((id) => VOTOS.find((v) => v.id === id)?.nombre ?? id).join(", ");
  if (j.perdido) return `  ✝ JURAMENTO PERDIDO para siempre (votos: ${votos}): ya no puede usar magia divina`;
  if (j.roto) return `  ⛓ JURAMENTO ROTO (${j.roto.voto}): sus poderes callan hasta que expíe. ${j.roto.consecuencia}`;
  const perks = p.nivel >= 3 ? ` · ventajas: ${j.votos.map((id) => `${VOTOS.find((v) => v.id === id)?.nombre}: ${VOTOS.find((v) => v.id === id)?.ventaja}`).join("; ")}` : "";
  return `  ☀ Juramento a ${j.dios}: ${votos} (intensidad ${j.votos.length}/${MAX_VOTOS}) · reserva de imposición de manos ${j.reserva}/${reservaMax(p)} PV${perks}`;
}
