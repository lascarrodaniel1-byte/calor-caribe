// Dotes (lo mínimo, sin dependencias): saber si un personaje tiene una. Las que llevan opción se guardan como «id:opción».
export const tiene = (p: { dotes?: string[] } | undefined, id: string): boolean => !!p?.dotes?.some((d) => d === id || d.startsWith(`${id}:`));
export const opcionDe = (p: { dotes?: string[] } | undefined, id: string): string | undefined => p?.dotes?.find((d) => d.startsWith(`${id}:`))?.split(":")[1];

/** Cómo se escribe una dote en la ficha: «Lengua de plata (persuasion)». */
export const rotuloDote = (d: string): string => {
  const [id, op] = d.split(":");
  const n = id.replace(/_/g, " ");
  return n.charAt(0).toUpperCase() + n.slice(1) + (op ? ` (${op})` : "");
};
