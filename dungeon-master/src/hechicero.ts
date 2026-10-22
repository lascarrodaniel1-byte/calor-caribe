// Hechicero: el único mago de verdad, con el don arcano innato. Su poder no tiene techo (maestría por nivel hasta ascendido),
// los hechizos de círculo bajo le cuestan cada vez menos y su bastón sirve de catalizador. La Recuperación arcana tiene usos reales.
import { RECURSOS_CLASE } from "./recursos.js";

RECURSOS_CLASE["Hechicero"] = [
  {
    nombre: "Recuperación arcana",
    desde: 2,
    max: (p) => (p.nivel >= 9 ? 2 : 1),
    recarga: "largo",
    efecto: (p) => {
      const m = p.magia;
      if (!m) return `${p.nombre} no tiene magia de la que recuperarse.`;
      let resto = Math.ceil(p.nivel / 2);
      const partes: string[] = [];
      const calor = Math.min(m.calor, resto); m.calor -= calor; resto -= calor; if (calor) partes.push(`${calor} de calor`);
      const aliento = Math.min(m.aliento, resto); m.aliento -= aliento; resto -= aliento; if (aliento) partes.push(`${aliento} de aliento`);
      return `${p.nombre} respira hondo tras un descanso corto y recompone su cuerpo: recupera ${partes.join(" y ") || "nada (no tenía calor ni aliento gastados)"}.`;
    },
  },
];
