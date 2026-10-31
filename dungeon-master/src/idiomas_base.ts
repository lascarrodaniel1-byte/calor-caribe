// Nombres de los idiomas (sin dependencias, para la ficha).
export const IDIOMAS_NOMBRES: Record<string, string> = { comun: "Común", karak: "Lengua de Karak", marchito: "Susurro marchito", hollin: "Jerga de Hollín", varg: "Aullido varg", palido: "Lengua pálida", ceniza: "Habla de ceniza", solar: "Sol viejo", cuervo: "Código del Cuervo", bajos: "Argot de Aldenmar" };

const POR_RAZA: Record<string, string> = { "Enano de Karak-Dûm": "karak", "Elfo Marchito": "marchito", "Mediano de Hollín": "hollin", Varg: "varg", "Nacido Pálido": "palido", Cenizo: "ceniza" };
const POR_CLASE: Record<string, string> = { "Mercenario del Cuervo": "cuervo", "Caballero Juramentado": "solar", "Cazador de Brujas": "solar", Hechicero: "solar", Degollador: "bajos" };


const buscar = (n: string): string | undefined => {
  const x = n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  return Object.entries(IDIOMAS_NOMBRES).find(([id, nombre]) => id === x || nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") === x)?.[0];
};

/** Idiomas con los que nace: Común, el de su raza y el de su clase; más hasta el modificador de INT (y uno más el Humano del Faro). */
export function idiomasIniciales(p: { raza: string; clase: string; atributos: { int: number } }, extra: string[] = []): { idiomas: string[]; sobran: string[] } {
  const base = ["comun", POR_RAZA[p.raza], POR_CLASE[p.clase]].filter((x): x is string => !!x);
  const cupo = Math.max(0, Math.floor((p.atributos.int - 10) / 2)) + (p.raza === "Humano del Faro" ? 1 : 0);
  const elegidos: string[] = [], sobran: string[] = [];
  for (const e of extra) {
    const id = buscar(e);
    if (!id || base.includes(id) || elegidos.includes(id)) continue;
    if (elegidos.length < cupo) elegidos.push(id); else sobran.push(IDIOMAS_NOMBRES[id]);
  }
  return { idiomas: [...base, ...elegidos], sobran };
}
