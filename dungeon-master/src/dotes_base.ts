// Dotes (lo mínimo, sin dependencias): saber si un personaje tiene una. Las que llevan opción se guardan como «id:opción».
export const tiene = (p: { dotes?: string[] } | undefined, id: string): boolean => !!p?.dotes?.some((d) => d === id || d.startsWith(`${id}:`));
export const opcionDe = (p: { dotes?: string[] } | undefined, id: string): string | undefined => p?.dotes?.find((d) => d.startsWith(`${id}:`))?.split(":")[1];
