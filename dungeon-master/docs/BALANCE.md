# Informe de equilibrio de combate (primer pase)

Simulador Monte Carlo que usa el **motor real** (`ejecutar(...)` de `src/herramientas.ts`) para responder a una pregunta: *¿qué encuentros, de qué peligro/VD, matan a un grupo de qué nivel?* No cambia ninguna regla ni dato del juego: solo mide.

- Código: `tests/balance/simular.ts`
- Esta tabla sale de: `npx tsx tests/balance/simular.ts --n 300 --semilla 1 --detalle --n-detalle 60 --comparar --n-comparar 300` (unos 2 minutos; 29 760 combates y 963 177 acciones pasadas por el motor).
- Las secciones 1-8 son el primer pase: **medición** y **PROPUESTAS** (cuando se escribieron, ninguna estaba aplicada). El dueño confirmó después las propuestas 1b, 2 (solo el Juez), 4 (solo el Djinn), 5a y 6; están aplicadas y medidas en la **sección 9 (segunda corrida)**. Los números de las secciones 3-8 son los de antes de esos cambios.

## 1. Cómo ejecutarlo

```
npx tsx tests/balance/simular.ts [--n 60] [--semilla 1] [--rapido] [--detalle] [--comparar]
```

| Opción | Qué hace |
|---|---|
| `--n N` | Combates por celda (60 por defecto; `--rapido` lo deja en 20). Con n=300 el error típico es de ±3 puntos en una celda del 50%. |
| `--semilla S` | Semilla (1 por defecto). Misma semilla, mismos resultados. |
| `--rapido` | Menos combates por celda y menos en el detalle (tabla + detalle + comparaciones en ~15 s). |
| `--detalle` / `--n-detalle N` | Tabla por criatura (1 criatura sola) y nivel. |
| `--criatura TXT` | Solo el detalle de las criaturas cuyo nombre contenga TXT. |
| `--comparar` / `--solo-comparar` / `--n-comparar N` | Comparación A (artes marciales) y B (agua). |
| `--niveles 1,5,9,13` | Niveles del grupo (cualquier lista). |
| `--solo-primero` | Versión estricta: la criatura ataca una vez con su primer ataque (por defecto usa su acción de Atacar completa). |
| `--json ruta` | Vuelca todas las celdas en JSON. |
| `BALANCE_DEBUG=1`, `BALANCE_TRACE=1` | Rechazos y combates sin final; o cada ataque resumido. |

Tiempo: el modo normal (n=60, sin extras) tarda unos 5 s; la corrida de este informe, ~2 min.

## 2. Método

- **Motor real**: `guardar_personaje`, `empunar`, `aparecer_criatura`, `iniciativa`, `plano`, `atacar`, `siguiente_asalto`, `agua`, `arte_marcial`. Los niveles llevan el **desplazamiento de +2** en los desbloqueos (`nvl()`), tal como en el juego (no se desactiva).
- **Determinismo**: los dados del motor salen de `crypto.getRandomValues`; se sustituye por un PRNG mulberry32 sembrado **por combate** con `hash(semilla, celda, nº de combate)`. En las comparaciones, las variantes comparten los mismos dados de partida (comparación apareada, menos ruido).
- **Grupo**: 4 PJ, nivel real 1, 5, 9 o 13. Se rotan 5 composiciones (Mercenario del Cuervo, Caballero Juramentado, Berserker de Ceniza, Cazador de Brujas, Degollador, Flagelante, Hechicero) y las 7 razas de tierra (sin Tritón, salvo en la comparación de agua).
  - Atributos: serie estándar 15,14,13,12,10,8 repartida por clase + bonos de raza + aumentos de característica (+2 al principal en los niveles 4, 8 y 12).
  - PV: dado de golpe de `CLASES` (dado completo + CON en nivel 1, media por nivel después). Sin objetos mágicos.
  - CA fija por clase: Mercenario 18 (malla + escudo), Caballero 18 (escamas + escudo), Berserker 14 (pieles), Cazador 15 (cuero tachonado), Degollador 15 (cuero), Flagelante 14 (sin armadura), Hechicero 12.
  - Armas: Espada larga 1d8 (con escudo), Hacha a dos manos 1d12, dos shotels 1d6 / dos dagas 1d4 (con ataque de mano secundaria), Maza 1d6, Bastón 1d6.
- **Criaturas**: la acción de Atacar de la criatura = la línea de su ficha con «(xN)» N veces, o si no hay ninguna, el primer ataque una vez. Se parsea `"Garras: +5, 1d6+2 cortante"` en arma, daño y tipo (los dados extra, tipo `+ 2d6 veneno`, se suman al daño). `--solo-primero` usa solo el primer ataque una vez.
- **Política de IA** (igual para PJ y criaturas): se coloca (en el plano) junto al enemigo vivo más cercano y ataca al de menos PV que esté a ≤ 2 m. Respeta el límite de ataques por asalto (`ataquesPorAccion`). Si el motor rechaza una acción, se cuenta (y si es «no empuña», se empuña y se reintenta).
- **Fin del combate**: un bando cae, o 20 asaltos («sin final»). Un PJ a 0 PV, o inconsciente, está fuera.
- **Métricas por celda**: % de victorias del grupo, asaltos medios, % de PJ caídos (a 0 PV o muertos), % de PV del grupo que queda, acciones rechazadas por el motor, combates sin final.
- **Semáforo**: 🔴 victorias < 20% (casi imposible) · 🟡 20–40% o > 95% (trivial) · 🟢 el resto.

### Limitaciones (importantes para leer los resultados)

1. **Nadie lanza hechizos ni usa habilidades especiales** (ni PJ ni criaturas): sin aliento de dragón, sin canto de sirena, sin presagios, sin guaridas, sin `habilidad_criatura`, sin regeneración, sin Presa del Degollador ni runas del Cazador. Los Hechiceros pelean con su bastón (son un lastre). **Las criaturas están infravaloradas** (sobre todo Lich, Ysolde, Banshee, Djinn, jefes) y los PJ también (sin conjuros ni habilidades activas); el sesgo neto es hacia que **los PJ ganen más de lo real**.
2. Las criaturas con varias líneas de ataque separadas (Wyverno, Mantícora, Ulfhedinn, Grifo, Lich, Hombre oso…) solo usan una: su daño real está por encima del simulado (aproximadamente ×1,5–2 en esos casos).
3. Sin maniobras, sin furia explícita, sin curación, descansos, objetos, Segundo aliento, Acción súbita.
4. Sin aproximación ni ataques de oportunidad, sin cobertura, sin sorpresa, sin terreno. Colocación instantánea.
5. **Un PJ a 0 PV no recibe más golpes ni tira salvaciones contra la muerte**: por eso «muertos» sale ≈ 0%; la métrica útil es «caídos».
6. CA y equipo fijos por clase, sin objetos mágicos ni mejoras con el nivel: en 13 el grupo lleva la misma CA que en 1.
7. La Podre, heridas graves, sangrado, etc. sí las aplica el motor (a través de `atacar`), pero nadie las trata.

## 3. Tabla principal (nivel × encuentro)

n = 300 combates por celda, semilla 1, grupo de 4, criaturas con su acción de Atacar completa. Cada celda: **% victorias** · asaltos medios · % de PJ caídos · % de PV del grupo que queda · (combates sin final en 20 asaltos). «1 criatura, peligro N» recorre por turnos todas las criaturas no jefe de ese peligro; «1 jefe» recorre los 10 jefes; el trío se sortea entre las criaturas de peligro 1-2.

| Encuentro | Nivel 1 | Nivel 5 | Nivel 9 | Nivel 13 |
|---|---|---|---|---|
| 1 criatura, peligro 1 | 🟡 **100%** · 1.3 as. · 1% caídos · 96% PV | 🟡 **100%** · 1.0 as. · 0% caídos · 100% PV | 🟡 **100%** · 1.0 as. · 0% caídos · 100% PV | 🟡 **100%** · 1.0 as. · 0% caídos · 100% PV |
| 1 criatura, peligro 2 | 🟢 **94%** · 4.5 as. · 22% caídos · 73% PV · 2 sin final | 🟡 **100%** · 2.2 as. · 0% caídos · 96% PV | 🟡 **100%** · 1.3 as. · 0% caídos · 99% PV | 🟡 **100%** · 1.2 as. · 0% caídos · 100% PV |
| 1 criatura, peligro 3 | 🟢 **48%** · 5.7 as. · 67% caídos · 31% PV | 🟡 **100%** · 3.5 as. · 9% caídos · 84% PV | 🟡 **100%** · 1.8 as. · 0% caídos · 96% PV | 🟡 **100%** · 1.7 as. · 0% caídos · 98% PV |
| 1 criatura, peligro 4 | 🔴 **5%** · 4.4 as. · 97% caídos · 2% PV | 🟢 **41%** · 7.1 as. · 71% caídos · 25% PV | 🟡 **100%** · 4.0 as. · 19% caídos · 73% PV | 🟡 **100%** · 3.3 as. · 6% caídos · 85% PV |
| 1 criatura, peligro 5 (solo el Lich: el resto son jefes) | 🔴 **0%** · 5.7 as. · 100% caídos · 0% PV | 🟢 **71%** · 11.1 as. · 66% caídos · 28% PV | 🟡 **100%** · 3.9 as. · 4% caídos · 85% PV | 🟡 **100%** · 3.3 as. · 0% caídos · 92% PV |
| 3 criaturas, peligro 1-2 | 🟢 **47%** · 7.7 as. · 68% caídos · 27% PV · 6 sin final | 🟡 **100%** · 4.8 as. · 5% caídos · 85% PV · 1 sin final | 🟡 **100%** · 2.6 as. · 0% caídos · 96% PV | 🟡 **100%** · 2.4 as. · 0% caídos · 98% PV |
| 1 jefe | 🔴 **0%** · 3.6 as. · 100% caídos · 0% PV | 🔴 **11%** · 8.3 as. · 94% caídos · 5% PV · 2 sin final | 🟢 **73%** · 6.4 as. · 44% caídos · 50% PV | 🟢 **88%** · 6.6 as. · 27% caídos · 65% PV · 1 sin final |

Acciones rechazadas por el motor en toda la corrida: **0** (aparte de la anomalía de la sección 7).

### Curva por nivel (n = 200; mismo simulador, más niveles)

| Encuentro | N3 | N4 | N5 | N6 | N7 | N8 | N9 |
|---|---|---|---|---|---|---|---|
| 1 criatura, peligro 3 | 🟢 88% | 🟡 100% | 🟡 100% | 🟡 100% | 🟡 100% | 🟡 100% | 🟡 100% |
| 1 criatura, peligro 4 | 🔴 17% | 🟡 23% | 🟡 39% | 🟢 41% | 🟢 **90%** | 🟡 98% | 🟡 100% |
| 1 criatura, peligro 5 (Lich) | 🔴 0% | 🟡 22% | 🟢 70% | 🟢 87% | 🟡 **100%** | 🟡 100% | 🟡 100% |
| 1 jefe | 🔴 0% | 🔴 5% | 🔴 12% | 🔴 14% | 🟢 **65%** | 🟢 73% | 🟢 73% |

El salto entre el nivel 6 y el 7 (peligro 4: 41% → 90%; jefe: 14% → 65%) coincide con el **Ataque adicional**, que con el desplazamiento llega en el nivel real 7 (`nvl(5)`): duplica el daño de los luchadores de golpe.

### Contrafactual (solo análisis, el simulador no lo usa): sin el desplazamiento de +2

Ejecutado con `VELMORA_DESPLAZO=0 npx tsx tests/balance/simular.ts --n 200 --niveles 1,3,5,7,9,13`. Solo para medir cuánto cuesta el desplazamiento; **el juego real y el simulador por defecto lo mantienen**.

| Encuentro | Nivel | Con desplazo +2 | Sin desplazo |
|---|---|---|---|
| peligro 3 | 3 | 🟢 88% | 🟢 94% |
| peligro 4 | 3 | 🔴 17% | 🟡 23% |
| peligro 4 | 5 | 🟡 39% | 🟢 65% |
| peligro 5 (Lich) | 3 | 🔴 0% | 🔴 10% |
| peligro 5 (Lich) | 5 | 🟢 70% | 🟡 98% |
| 3 criaturas, peligro 1-2 | 3 | 🟢 85% (11 sin final) | 🟢 95% |
| jefe | 5 | 🔴 12% | 🟢 42% |
| niveles 1, 7, 9 y 13 | — | sin diferencias apreciables | sin diferencias apreciables |

## 4. Detalle por criatura (1 criatura sola; n = 60 por celda, ±13 puntos)

Orden: peligro y VD. `sf` = combates sin final en 20 asaltos.

| Criatura | P | VD | N1 | N5 | N9 | N13 |
|---|---|---|---|---|---|---|
| Hambriento | 1 | 1 | 🟡 100% | 🟡 100% | 🟡 100% | 🟡 100% |
| Lobo de Ceniza | 1 | 1/2 | 🟡 100% | 🟡 100% | 🟡 100% | 🟡 100% |
| Duende | 1 | 1 | 🟡 100% | 🟡 100% | 🟡 100% | 🟡 100% |
| Ghul de las fosas | 2 | 2 | 🟡 100% | 🟡 100% | 🟡 100% | 🟡 100% |
| Gárgola | 2 | 2 | 🟢 75% (7 sf) | 🟡 100% | 🟡 100% | 🟡 100% |
| Arpía | 2 | 2 | 🟡 100% | 🟡 100% | 🟡 100% | 🟡 100% |
| Ogro | 2 | 3 | 🟡 97% | 🟡 100% | 🟡 100% | 🟡 100% |
| Hombre pez | 2 | 3 | 🟡 100% | 🟡 100% | 🟡 100% | 🟡 100% |
| Hombre lagarto | 2 | 3 | 🟡 100% | 🟡 100% | 🟡 100% | 🟡 100% |
| Basilisco | 3 | 5 | 🟡 38% | 🟡 100% | 🟡 100% | 🟡 100% |
| Mantícora | 3 | 5 | 🟢 95% | 🟡 100% | 🟡 100% | 🟡 100% |
| Banshee del Velo | 3 | 5 | 🟢 93% | 🟡 100% | 🟡 100% | 🟡 100% |
| Ulfhedinn | 3 | 5 | 🟢 77% | 🟡 100% | 🟡 100% | 🟡 100% |
| Golem de carne | 3 | 5 | 🔴 12% | 🟡 100% | 🟡 100% | 🟡 100% |
| Elemental de fuego | 3 | 5 | 🟢 77% | 🟡 100% | 🟡 100% | 🟡 100% |
| Elemental de aire | 3 | 5 | 🔴 15% | 🟡 100% | 🟡 100% | 🟡 100% |
| Grifo | 3 | 5 | 🟢 47% | 🟡 100% | 🟡 100% | 🟡 100% |
| Sirena | 3 | 5 | 🟡 100% | 🟡 100% | 🟡 100% | 🟡 100% |
| Troll de ciénaga | 3 | 6 | 🔴 15% | 🟡 100% | 🟡 100% | 🟡 100% |
| Wyverno | 3 | 6 | 🟢 55% | 🟡 100% | 🟡 100% | 🟡 100% |
| Hombre oso | 3 | 6 | 🔴 5% | 🟡 100% | 🟡 100% | 🟡 100% |
| Elemental de agua | 3 | 6 | 🔴 3% | 🟡 100% | 🟡 100% | 🟡 100% |
| Wendigo | 4 | 9 | 🔴 0% | 🟢 78% | 🟡 100% | 🟡 100% |
| Elemental de tierra | 4 | 9 | 🔴 0% | 🔴 2% | 🟡 100% | 🟡 100% |
| Leshen | 4 | 9 | 🔴 0% | 🟢 90% | 🟡 100% | 🟡 100% |
| Moira | 4 | 9 | 🟢 55% | 🟡 100% | 🟡 100% | 🟡 100% |
| Gigante de hueso | 4 | 10 | 🔴 0% | 🔴 10% | 🟡 100% | 🟡 100% |
| Golem de piedra | 4 | 10 | 🔴 0% | 🔴 2% | 🟡 100% | 🟡 100% |
| Hidra | 4 | 10 | 🔴 0% | 🔴 0% | 🟡 97% | 🟡 100% |
| Dragón joven de ceniza | 4 | 11 | 🔴 0% | 🔴 5% | 🟡 100% | 🟡 100% |
| Djinn | 4 | 11 | 🔴 3% | 🟡 100% | 🟡 100% | 🟡 100% |
| Munin, la Memoria | 4 | 11 | 🔴 0% | 🔴 15% | 🟡 100% | 🟡 100% |
| Apóstol | 4 | 12 | 🔴 0% | 🔴 0% | 🟢 78% | 🟡 100% |
| Hugin, el Pensamiento | 4 | 12 | 🔴 0% | 🔴 13% | 🟡 100% | 🟡 100% |
| El Juez Sin Ojos | 5 | 14 | 🔴 0% | 🔴 0% | 🔴 3% | 🟢 60% |
| Vaskar, el Lobo del Eclipse | 5 | 15 | 🔴 0% | 🔴 2% | 🟡 100% | 🟡 100% |
| Ilvara, la Tejedora de Mañanas | 5 | 15 | 🔴 0% | 🔴 0% | 🟡 100% | 🟡 100% |
| Kuru, el Cazador de Leyendas | 5 | 15 | 🔴 0% | 🔴 0% | 🔴 0% | 🟢 45% |
| Lich | 5 | 16 | 🔴 0% | 🟢 67% | 🟡 100% | 🟡 100% |
| Ysolde, la Reina Pálida | 5 | 16 | 🔴 0% | 🟢 93% (2 sf) | 🟡 100% | 🟡 100% |
| La Madre de los Hambrientos | 5 | 16 | 🔴 0% | 🔴 0% | 🟡 100% | 🟡 100% |
| Vaerth, el Sin Rostro | 5 | 16 | 🔴 0% | 🔴 0% | 🟡 100% | 🟡 100% |
| El Que Golpea Bajo la Piedra | 5 | 18 | 🔴 0% | 🔴 0% | 🟡 100% | 🟡 100% |
| Kharoth, Dragón Antiguo del Sol Herido | 5 | 24 | 🔴 0% | 🔴 0% | 🔴 0% | 🟢 58% (1 sf) |

## 5. Comparaciones

### A. Artes marciales (n = 300 por celda; mismos dados en las tres variantes)

Variantes: **sin estilo**; **un luchador** (solo el primer Mercenario aprende su estilo de clase); **todos** los PJ cuya clase ofrece uno. Estilo de clase (el primero que ofrece cada una): Mercenario → Filo del Cuervo; Caballero y Berserker → Piedra de Karak; Cazador y Degollador → Callejón de Aldenmar. El Flagelante ya lleva el Haemajitsu de serie (también en «sin estilo»).

| Celda | Sin estilo | Un luchador | Todos |
|---|---|---|---|
| Troll de ciénaga, nivel 5 | 🟡 100% · 14% caídos · 78% PV | 🟡 100% · 13% · 79% | 🟡 100% · 13% · 79% |
| Gigante de hueso, nivel 5 | 🔴 **11%** · 96% caídos · 3% PV | 🔴 **15%** · 94% · 5% | 🔴 **16%** · 94% · 5% |
| Troll de ciénaga, nivel 9 | 🟡 100% · 0% · 94% PV | 🟡 100% · 0% · 95% | 🟡 100% · 0% · 95% |
| Ogro, nivel 9 | 🟡 100% · 0% · 98% PV | 🟡 100% · 0% · 99% | 🟡 100% · 0% · 99% |
| Gigante de hueso, nivel 9 | 🟡 100% · 18% caídos · 75% PV | 🟡 100% · 9% · 78% | 🟡 100% · 9% · 78% |
| Dragón joven de ceniza, nivel 9 | 🟡 100% · 18% caídos · 74% PV | 🟡 100% · 10% · 78% | 🟡 100% · 10% · 78% |
| Apóstol, nivel 9 | 🟢 **83%** · 59% caídos · 35% PV | 🟢 **87%** · 52% · 39% | 🟢 **89%** · 51% · 40% |

**Lectura**: contra el Troll y el Ogro de nivel 9 el grupo ya gana el 100% sin estilo, así que no hay margen para medir una mejora (el estilo solo acorta un poco el combate: 3,8 → 3,6 asaltos en el Troll de nivel 5). Donde hay margen, el efecto es **modesto pero real**: +4 a +6 puntos de victorias (Gigante nivel 5, Apóstol nivel 9) y casi **la mitad de caídos** frente a Gigante/Dragón de nivel 9 (18% → 9-10%). **Casi todo el efecto lo aporta un solo luchador** (el Filo del Cuervo del Mercenario: +1/+2 al ataque con aliados junto al objetivo y ventaja desde Practicante); añadir Piedra de Karak y Callejón suma muy poco con esta política (solo pasivos: Postura de muro +1 CA, etc.). Es una **cota inferior**: no se simulan las maniobras ni técnicas activas (lanzar, desarmar, arena y codo…).

### B. Agua (n = 300 por celda): grupo de 4 no acuáticos contra una Sirena y 2 Hombres pez

La Sirena y los Hombres pez son del agua (sin penalización); sin sus habilidades especiales. «Entrar» = en el agua sin hundirse; «sumergidos» = bajo el agua todos.

| Variante | Nivel 5 | Nivel 9 |
|---|---|---|
| En tierra | 🟡 100% · 6.0 as. · 4% caídos | 🟡 100% · 3.2 as. · 0% |
| En el agua (entrar) | 🟡 98% · 10.9 as. · 14% | 🟡 100% · 4.5 as. · 0% |
| Sumergidos | 🟡 **37%** · 19.0 as. · 32% · **187 de 300 sin final** | 🟡 100% · **9.1 as.** · 5% |
| Sumergidos + 1 Tritón | 🟢 **69%** · 15.3 as. · 24% · 93 sin final | 🟡 100% · 6.9 as. · 2% |
| Sumergidos + 4 Tritones | 🟡 100% · 6.1 as. · 4% | 🟡 100% · 3.1 as. · 0% |
| En el agua (entrar) + 1 Tritón | 🟡 99% · 9.6 as. · 12% | 🟡 100% · 4.2 as. · 0% |

**Lectura**: el agua **no mata más, pero alarga mucho el combate** (nivel 5: de 6 a 19 asaltos; la mayoría de los combates sumergidos no acaban en 20 asaltos) porque sumergido el no acuático ataca con desventaja y a mitad de daño contra criaturas que no sufren nada. A nivel 5 la victoria baja del 100% al 37% (el resto son tablas, no derrotas: solo 1 de 300; pero un combate de 20 asaltos o más empieza a comerse el aire de los PJ, ≈ 20-30 asaltos, que el simulador no gestiona). **Un solo Tritón en el grupo** (de 4) sube la victoria del 37% al 69% y quita casi un tercio de las tablas; con un grupo entero de Tritones el agua deja de importar. A nivel 9 el grupo lo compensa con volumen de ataques (solo se triplica la duración).

## 6. Hallazgos

### 6.1 El combate no es «injusto» en general: es **muy irregular según el nivel**

1. **Nivel 1: 🔴 casi todo lo que sea peligro ≥ 4 o jefe es imposible** (0–5%), y el peligro 3 anda en un 48% (🟢): razonable. Dentro del peligro 3 hay dos mundos: Mantícora, Banshee y Sirena (VD 5; 93–100% a nivel 1) frente a Troll, Hombre oso, Elemental de agua, Elemental de aire y Golem de carne (VD 5-6; 3–15%). Contra esos, un grupo de nivel 1 muere casi seguro. Es coherente con 5e (VD 5-6 contra nivel 1 es mortal), pero «peligro 3» no lo avisa.
2. **Del nivel 7 en adelante el grupo lo aplasta casi todo.** A nivel 9 y 13 todo lo de peligro 1-4 (🟡 97–100%) y hasta el Lich o Vaskar cae sin sudar; los únicos que amenazan a nivel 9 son **El Juez Sin Ojos, Kuru y Kharoth** (0–3%) y, un poco, el Apóstol (78%). Cuidado: es la parte donde más pesan las limitaciones (sin habilidades, el Lich, Ysolde, Vaskar o los jefes valen mucho menos de lo que valen en mesa). Aun así, el listón actual de «peligro 4-5» deja de ser peligro hacia el nivel 9.
3. **Valle de los niveles 3-6.** Con el desplazamiento +2, el Ataque adicional llega en el nivel real 7. En 3-6 el grupo está por debajo de las curvas esperadas: peligro 4 y jefes quedan 🔴/🟡 (jefe: 0% en 3, 5% en 4, 12% en 5, 14% en 6) y luego **salta a 65% en el nivel 7**. El contrafactual sin desplazamiento (sección 3) sube el jefe de nivel 5 del 12% al 42% y el peligro 4 del 39% al 65%: ese desplazamiento es la causa del valle. Es un cliff, no una rampa: el nivel 6 y el 7 se parecen a lo lejos pero no se parecen nada en la mesa.
4. **La escala «peligro 1–5» no es monótona en la práctica** (en parte por las limitaciones): a nivel 5 el peligro 5 (el Lich, 71%) es más fácil que el peligro 4 (41%), y dentro del peligro 4 el Djinn (VD 11, 100%) es un paseo mientras Munin/Hugin (VD 11-12, 13-15%) son 🔴. El Djinn y el Lich solo hacen 1 ataque por asalto en su ficha; Hugin/Munin dos ataques con malla y coraza.

### 6.2 Por qué probablemente: las estadísticas

- **Armadura plana de criaturas.** El motor resta una protección **fija** por pieza (corte/punta/contundente) al daño de cada golpe. Contra armas de dados pequeños es casi inmunidad:
  - **El Juez Sin Ojos** lleva `placas_completas` (−8 al corte en todas las regiones) además de CA 19. Un golpe de espada larga (1d8+4 ≈ 8,5) deja pasar ~1 PV (trazas del simulador: «1d8+4 = 9 → −1 PV», «1d6+4 → −3», crítico de 12 → −4). Por eso a nivel 9 es 🔴 3% pese a tener un DPR algo mayor que el de Vaskar (31 frente a 24; Vaskar cae al 100%). **No es la CA ni los PV: es el muro de armadura**, y el peligro/VD no lo reflejan.
  - **Gárgola** (VD 2): `piedra` (−5 al corte). A nivel 1 el grupo solo gana el 75% y es la criatura que más combates deja **sin final** (7 de 60 en 20 asaltos): un Mercenario con espada larga deja pasar ~1-5 PV por golpe.
  - Kuru (CA 20 + gambesón, escamas, yelmo), Hugin/Munin (cota y coraza) y Kharoth (CA 22 + escamas) se apoyan en parte en lo mismo; a nivel 13, Juez 60%, Kuru 45%, Kharoth 58% son los únicos jefes no triviales.
  - A cambio, **el hueso** (Gigante de hueso, Lich) es vulnerable al contundente (−2 de protección: «+2 de daño»); una maza o un martillo rinde más. Eso queda sin explotar en la política simple del simulador.
- **Daño por asalto de las criaturas altas.** Contra CA 18, el Apóstol (3 ataques, +11, 3d10+7) hace ~49/asalto; Ilvara, La Madre, Kuru, Vaerth ~30-34; el Gigante de hueso ~25: es lo que explica que, a nivel 5 (4 PJ de ~45 PV, CA 14-18), nadie dure más de 7 asaltos.
- **Efecto del nivel**: de 1 a 5 solo suben PV y +2 al ataque; el Ataque adicional (base 5 → real 7) y la Presa marcada (base 3 → real 5) llegan tarde; los aumentos de característica (4, 8, 12) no se desplazan.
- **Criaturas de «peligro 3» muy distintas entre sí** (VD 5 vs VD 6) y **peligro 2 con VD hasta 3** (Ogro, Hombre pez/lagarto): el peligro agrupa cosas que difieren hasta en 3 puntos de VD.

### 6.3 Efecto de estilos y agua
Ver sección 5. Resumen: los estilos suben ~4-6 puntos de victorias y bajan casi a la mitad los caídos donde hay margen (casi todo del Filo del Cuervo); el agua no cambia el riesgo de muerte a nivel 9 pero **triplica la duración** y a nivel 5 vuelve el combate una lotería de aire; un Tritón vale mucho.

## 7. Errores del motor (anotados, NO arreglados)

La corrida entera (29 760 combates, 963 177 acciones) arrojó **0 excepciones, 0 NaN, 0 PV imposibles y 0 acciones rechazadas inesperadas**, salvo esta inconsistencia:

1. **Terco + herida a 0 PV: PV 1 pero «inconsciente» (118 casos en la corrida).** Cuando un Humano con la dote *Terco* cae a 0 PV por un golpe que además abre una herida (`cero_pv`, p. ej. zona roja «Cae inconsciente»), `caerA0` lo deja «en pie con 1 PV» pero la condición `inconsciente` (puesta por el texto de la herida) se queda: el personaje con 1 PV no puede atacar (`puedeActuar`: «está inconsciente») y los enemigos lo atacan con ventaja. Parece contradictorio con el texto de la dote («se queda en pie con 1 PV»). Reproducible con `BALANCE_DEBUG=1 npx tsx tests/balance/simular.ts --n 3 --niveles 1,5`. (El simulador lo trata como PJ caído para no inflar los rechazos.)
2. No es un error pero conviene saberlo: **combates que no terminan en 20 asaltos** en celdas concretas (Gárgola nivel 1; sumergidos nivel 5; trío de peligro 1-2 en niveles 1-3, probablemente por las Gárgolas): son tablas por armadura/agua, no por fallo del motor (ver 6.2 y 5B).

## 8. Recomendaciones — **PROPUESTAS, el dueño debe confirmarlas** (nada está aplicado)

1. **Valle 3-6 / cliff del Ataque adicional (la más importante).** Opciones, de menos a más intrusiva: (a) no tocar números y **guiar al DM**: peligro 4 y jefes solo a partir del nivel 7 (peligro 3 desde el 3, peligro 5 no jefe desde el 5-6; Juez/Kuru/Kharoth a partir del 13); (b) **adelantar el Ataque adicional** al nivel real 5 (`nvl(3)`) o dar un parche intermedio (p. ej. +1 ataque con arma ligera a los 5-6) dejando el resto del desplazamiento; (c) reducir el desplazamiento a +1 para Ataque adicional. La opción (a) no cambia reglas; (b) es la que más suaviza el cliff (en el contrafactual, jefe nivel 5: 12% → 42%).
2. **Armadura plana de criaturas (Juez, Gárgola, Kuru, Hugin/Munin, Golems de piedra).** Proponer un **mínimo de daño tras la armadura** (p. ej. al menos 1/4 del daño bruto, o «la protección no pasa del 50% del golpe») o bajar `placas_completas` del Juez a `cota_malla` + `yelmo` (corte 5). Alternativa menos invasiva: dejarlo tal cual y **subir el peligro/VD declarado del Juez** y avisar de que exige mazas/martillos, huecos o magia. Para la Gárgola: cambiar `piedra` por `pellejo` o reducir su protección al corte a 3, o subir su VD (ahora VD 2, casi inmune a una espada en nivel 1).
3. **Techo de dificultad (niveles 9-13).** No tocar PV ni daño de las criaturas **hasta tener el simulador con habilidades** (limitación 1): hoy lo único que se ve es que, sin habilidades, el 🟡 es casi total desde el 9. Propuesta de siguiente paso: añadir `habilidad_criatura` y hechizos básicos al simulador y volver a medir antes de proponer cifras. Si después sigue siendo trivial: p. ej. «subir un 20% los PV de las criaturas de peligro 4 y un 30% los de las de peligro 5 no jefe (Lich, Ysolde…)».
4. **Coherencia del peligro y el VD.** Revisar los extremos a nivel 5: Djinn (peligro 4, VD 11, 1 ataque, sin armadura) frente a Hugin/Munin (peligro 4, VD 11-12); Lich y Ysolde frente a jefes. Propuesta: dar al Djinn y al Lich una acción de Atacar de 2 ataques (como el resto de su peligro) o bajar su peligro un punto; dividir el peligro 3 en dos subescalones (VD 5 / VD 6) en el generador de encuentros.
5. **Agua.** (a) Que las **armas de punta** (lanza, daga, tridente, estoque) no pierdan la mitad del daño bajo el agua (como en 5e), para que un grupo no acuático no quede en tablas frente a sirenas y hombres pez; o (b) dar a los hombres pez y sirenas una penalización en tierra (hoy rinden igual fuera del agua). Mantener el valor del Tritón.
6. **Terco + herida (sección 7).** Decidir cuál manda: si Terco «se queda en pie», quitar `inconsciente` al aplicar el truco; si la herida es tan grave que cae, que Terco no la «salve» (o que lo avise).
7. **Seguimiento.** Añadir al simulador: habilidades de criaturas (`habilidad_criatura`), hechizos de los Hechiceros, maniobras, salvaciones contra la muerte (para que «muertos» sea una métrica real) y equipo mágico por nivel. Con eso, repetir este informe.

## 9. Segunda corrida (tras los cambios confirmados)

Mismo simulador, misma semilla y mismos parámetros: `npx tsx tests/balance/simular.ts --n 300 --semilla 1 --detalle --n-detalle 60 --comparar --n-comparar 300` (98 s; la curva por niveles, con `--n 200 --niveles 3,4,5,6,7,8,9`). Los resultados de la sección 3 son el «antes».

### 9.1 Qué se cambió

| # | Cambio | Dónde |
|---|---|---|
| 1 | **Ataque adicional en el nivel real 5**, sin desplazamiento (excepción deliberada al +2; constante `NIVEL_ATAQUE_ADICIONAL` en `niveles.ts`). Lo tienen Mercenario, Berserker, Caballero, Cazador, Flagelante, Segador y Barbero-Cirujano; no el Degollador ni el Hechicero. La tablita de niveles (`/ayuda niveles`) y la ayuda de clase lo muestran en el 5. El resto de lo que la tabla base ponía en el 5 (Paso elusivo, Urumi, Luz contra la Podre, Movimiento rápido…) sigue llegando en el 7. | `niveles.ts`, `rasgos.ts`, `progresion.ts`, `t-regresion.ts` |
| 2 | **Terco + herida**: si Terco salva al personaje (1 PV), la herida de zona roja no lo deja «inconsciente»; sigue en pie con la herida abierta (sangrado y reloj siguen). Con la dote ya gastada, sin cambios. | `muerte.ts` (`caerA0`), `tests/motor/t-terco.ts` (10 pruebas), `simular.ts` |
| 3 | **Juez Sin Ojos**: `placas_completas` + `gambeson` → `loriga` + `yelmo` (malla con yelmo: 5 al corte en cuerpo y piernas, 8 en la cabeza, 0 en el cuello). Un 1d8+4 de espada le deja pasar **3,6 PV de media** (antes ~1). PV, CA y ataques intactos. | `bestiario.ts`, `t-bestiario.ts` |
| 4 | **Djinn**: peligro 4 → **3**, VD 11 → **6**. Lich, Hugin y Munin se dejan (ver 9.4). | `bestiario.ts` |
| 5 | **Armas de punta bajo el agua**: pierden un tercio (×2/3, hacia abajo, mínimo 1) en lugar de la mitad; el resto sigue a la mitad y «en el agua» sigue siendo −2. Cuenta como punta lo que `atacar` clasifica como `punta` (daga, estoque, lanza, tridente, jabalina, flecha, virote, estaca, colmillos…), un `tipo_dano: punta` explícito y la espada corta. El aviso 🌊 y `REGLAS_AGUA` lo dicen. | `agua.ts`, `combate.ts`, `t-agua.ts` (+17 pruebas) |

### 9.2 Tabla principal (n = 300, semilla 1)

Antes → después (% de victorias del grupo; entre paréntesis, % de PV del grupo que queda).

| Encuentro | Nivel 1 | Nivel 5 | Nivel 9 | Nivel 13 |
|---|---|---|---|---|
| 1 criatura, peligro 1 | 100% → 100% | 100% → 100% | 100% → 100% | 100% → 100% |
| 1 criatura, peligro 2 | 94% → 94% | 100% → 100% | 100% → 100% | 100% → 100% |
| 1 criatura, peligro 3 | 48% → **46%** | 100% (84% PV) → 100% (**90%**) | 100% → 100% | 100% → 100% |
| 1 criatura, peligro 4 | 5% → 6% | 41% (25% PV) → **59%** (36%) | 100% → 96% | 100% → 100% |
| 1 criatura, peligro 5 (Lich) | 0% → 0% | 71% (28% PV) → **98%** (64%) | 100% → 100% | 100% → 100% |
| 3 criaturas, peligro 1-2 | 47% → 47% | 100% → 100% | 100% → 100% | 100% → 100% |
| **1 jefe** | 0% → 0% | **11% → 37%** (5% → 18% PV) | 73% → **80%** | 88% → **91%** |

«Peligro 3» y «peligro 4» de la tabla no comparan exactamente lo mismo: el Djinn (100% en el nivel 5) salió de la lista de peligro 4 y entró en la de peligro 3.

### 9.3 Curva por niveles (n = 200): ¿desaparece el acantilado 6 → 7?

| Encuentro | N3 | N4 | N5 | N6 | N7 | N8 | N9 |
|---|---|---|---|---|---|---|---|
| peligro 4, antes | 17% | 23% | 39% | 41% | **90%** | 98% | 100% |
| peligro 4, después | 12% | 20% | **59%** | **69%** | 82% | 94% | 96% |
| peligro 5 (Lich), antes | 0% | 22% | 70% | 87% | **100%** | 100% | 100% |
| peligro 5 (Lich), después | 0% | 22% | **98%** | 100% | 100% | 100% | 100% |
| jefe, antes | 0% | 5% | 12% | 14% | **65%** | 73% | 73% |
| jefe, después | 0% | 5% | **39%** | **47%** | 67% | 77% | 81% |

**Sí: el acantilado desaparece y queda una rampa.** El jefe pasa de 14% (N6) → 65% (N7) a 47% → 67%; el peligro 4 sube del 41% al 69% en el nivel 6 y su salto 6 → 7 baja de +49 a +13 puntos. Los niveles 1-4 no cambian (el Ataque adicional llega en el 5), así que el valle de 3-4 sigue ahí (peligro 4: 12-20%; jefe: 0-5%): es lo esperable en niveles bajos, pero sigue siendo duro.

### 9.4 Efectos y observaciones

- **El jefe de nivel 5 pasa de 11% a 37%** (🔴 → 🟡/🟢 en el límite): peligroso pero ya no imposible; la mayoría de los combates se pierden con el grupo casi entero caído (79% caídos). Es casi lo que daba el contrafactual sin desplazamiento (42%), pero solo en el 5: el resto del desplazamiento se mantiene. Nivel 9: jefe 73% → 80%.
- **El Lich de nivel 5 queda en el 98%** (antes 71%) y es ya trivial. Es el efecto más visible del cambio 1 en lo que pasaba de «difícil» a «fácil». **No se ha tocado** (decisión del dueño): conviene recordar que el simulador no modela su resistencia al daño no mágico, su relicario ni sus hechizos, así que su dificultad real está muy por encima de la medida. Por eso no se le ha bajado el peligro: con el Ataque adicional en el 5, hasta el peligro 4 (Wendigo, Leshen, Dragón, Hugin, Munin) es 60-100% en el nivel 5, y el Lich no es un caso aparte.
- **Nivel 5 en general**: peligro 3 y trío de peligro 1-2 siguen al 100% (más holgados: 84% → 90% de PV), peligro 4 ya no es un muro (41% → 59%) y el jefe es duro pero jugable. No se ve «demasiado fácil»; el único exceso es el Lich.
- **El Juez Sin Ojos** (cambio 3): nivel 9, 3% → **67%** (🔴 → 🟢); nivel 13, 60% → **100%**. Queda igual de difícil que el Apóstol (78%) en el 9 pero, sin sus placas, a nivel 13 ya es un paseo para el grupo del simulador, mientras Kuru (45%) y Kharoth (58%) siguen siendo los únicos desafíos reales. Mejor muro que inmune, pero si se quiere algo más duro a nivel 13 bastaría un punto de protección más (`brigantina` en el torso) o subirle PV. Pendiente de decisión del dueño.
- **Hugin (62%) y Munin (80%) en el nivel 5, y el Lich**: se dejan como están. Con el Ataque adicional ya no hay discrepancia clara respecto al resto de peligro 4 (antes 13-15%, ahora comparables a Wendigo/Leshen/Dragón joven/Gigante de hueso, que van del 60% al 100%). La amplitud dentro del peligro 4 sigue siendo grande (Apóstol 0% frente a Wendigo 100% en el nivel 5), pero eso es un tema de «peligro 4 agrupa demasiado», no de estos dos.
- **Efecto del Djinn en peligro 3** en las reglas que leen el peligro: (a) *terrible* (`combate.ts`: jefe o peligro ≥ 4): deja de causar la presión de nervios extra; (b) Kuru, ventaja contra peligro 3+: sin cambios (3 ya cuenta); (c) las runas del Cazador (`cazador.ts`): ahora las de potencia 3 (nivel real 7) lo dominan, antes hacían falta las de 4 (nivel real 9); (d) PX por criatura: 5000 → 1800 (y valor de alma del Segador 4 → 3); (e) Flagelante (`peligro ≥ 4` = «grande»): ya no lo es; (f) la tabla de encuentros (`encuentros.ts`) no contiene al Djinn, así que no cambia ninguna tirada; la auditoría sigue en «sin problemas».
- **Agua**: sumergidos a nivel 5, 37% → **82%** (asaltos medios 19,0 → 13,1; antes 187 de 300 combates acababan sin final); con un Tritón 69% → 87%. El agua sigue alargando el combate (3,8 asaltos en tierra → 13,1 sumergidos) y con 4 Tritones se queda en 3,8, como en tierra. En el nivel 9 no cambia la victoria (100%) pero los asaltos bajan de 9,1 a 8,9. Parte de la mejora es el propio Ataque adicional (grupo de nivel 5), no solo las armas de punta: el simulador no distingue ambos efectos. Además, casi todas las armas de la corrida son cortantes o contundentes (espada larga, hacha, shotel, maza, bastón); solo las dagas del Degollador son de punta, así que el efecto de este cambio concreto en el simulador es pequeño: se nota sobre todo en la mesa, con lanzas, tridentes, arcos y estoques.
- **Terco** (cambio 2): el simulador ahora comprueba que, cuando la dote salva a un personaje, este no queda inconsciente: 0 casos. Quedan los PJ con PV > 0 «inconscientes» al terminar el combate (48 en la corrida): son heridas de zona roja de un crítico o golpe masivo con PV restantes, que el motor define así a propósito («Cae inconsciente»); no es el error de Terco.
- **Otras cifras**: sin acciones rechazadas ni NaN en toda la corrida; combates sin final: Gárgola de nivel 1, trío de peligro 1-2 en los niveles 1-4, Kharoth de nivel 13 y el agua sumergida de nivel 5 y 9.
- **Pendiente de la sección 8 (sin tocar)**: Gárgola (armadura plana de piedra), el techo de dificultad en los niveles 9-13 sin habilidades de criaturas en el simulador, dividir el peligro 3, y el seguimiento del simulador (habilidades, hechizos, maniobras, salvaciones contra la muerte).

## 10. Tercera corrida (rampa de los niveles 3-4 y Juez intermedio)

Mismo simulador y semilla: `npx tsx tests/balance/simular.ts --n 300 --semilla 1 --niveles 1,2,3,4,5,6,7,8,9,13 --detalle --n-detalle 60` (antes y después, el «antes» es el commit anterior) y `--n 300 --semilla 1 --detalle --comparar` (83 s; sin cambios en artes marciales ni agua). Grupos de 4, n = 300 por celda.

### 10.1 Qué se cambió (la combinación mínima que probó ser eficaz)

| # | Cambio | Dónde |
|---|---|---|
| 1 | **Ataque adicional en el nivel real 4** (antes 5). Sigue siendo la excepción al +2 de la sección 9, un nivel antes. Mercenario, Berserker, Caballero, Cazador, Flagelante, Segador y Barbero-Cirujano. | `niveles.ts` (`NIVEL_ATAQUE_ADICIONAL`) |
| 2 | **Presa marcada** del Cazador (+1d8 una vez por turno contra una criatura herida) y **Veterano de compañía** del Mercenario (crítico 19-20) llegan en el nivel real 3 (la tabla base los pone en el 3; antes, con el +2, en el 5). Sin desplazar; el resto de lo que la tabla base pone en el 3 sigue en el 5. | `niveles.ts` (`NIVEL_PRESA_MARCADA`, `NIVEL_VETERANO`), `rasgos.ts`, `progresion.ts` (`ANTICIPADOS`) |
| 3 | **Tope firme de peligro en el sorteo de encuentros** (red de seguridad, no cambia pesos): por nivel medio del grupo, peligro ≤ 2 (niveles 1-2), ≤ 3 (3-4), ≤ 4 (5-8), 5 (9+); la dificultad «mortal» lo sube un punto (la emboscada excepcional) y «fácil» lo baja. Antes era un tope blando (peso ×0,05, ahora ×10⁻⁹: solo sale si no queda otra cosa). Un jefe fuera de su zona solo da la cara en persona desde el nivel medio 7 (`NIVEL_JEFE_EN_PERSONA`; antes 4-5 según el jefe). La regla corta está en `REGLAS_ENCUENTROS` (prompt completo: 66.770 caracteres, ≤ 66.800). | `encuentros.ts` |
| 4 | **Juez Sin Ojos**: `loriga` + `yelmo` → `loriga` + `yelmo` + `brigantina` + `grebas`. PV (180), CA (19) y ataques intactos. Un 1d8+4 de espada le deja pasar **1,98 PV de media** (antes de 9d0433: ~0,8 con placas y gambesón; después: 3,64 con loriga y yelmo). | `bestiario.ts`, `t-bestiario.ts` |

La tablita de niveles de la ayuda (`/ayuda niveles`) y la ayuda de clase salen de `RASGOS_NIVEL`, así que ya muestran Veterano y Presa en el 3 y el Ataque adicional en el 4 (pruebas en `t-regresion.ts`; `t-rampa.ts` cubre el sorteo). `docs/AUDITORIA_RASGOS.md` actualizado.

### 10.2 Antes → después (% de victorias, n = 300)

| Encuentro | N1 | N2 | N3 | N4 | N5 | N6 | N7 | N8 | N9 | N13 |
|---|---|---|---|---|---|---|---|---|---|---|
| peligro 3 | 46 → 46 | 62 → 62 | 84 → **90** | 99 → 100 | 100 | 100 | 100 | 100 | 100 | 100 |
| peligro 4 | 6 → 6 | 9 → 9 | 11 → **13** | 20 → **46** | 59 → 59 | 68 → 68 | 81 → 81 | 94 → 94 | 96 → 96 | 100 |
| peligro 5 (Lich) | 0 | 0 | 0 → 2 | 22 → **91** | 98 → 98 | 100 | 100 | 100 | 100 | 100 |
| trío de peligro 1-2 | 47 → 47 | 69 → 69 | 86 → **91** | 97 → 100 | 100 | 100 | 100 | 100 | 100 | 100 |
| jefe | 0 → 0 | 0 → 0 | 0 → 0 | 5 → **20** | 37 → 36 | 47 → 47 | 68 → 65 | 78 → 74 | 80 → 77 | 91 → 91 |

Niveles 1-2 y 5+ no cambian (±0) salvo el jefe de los niveles 7-9 (-3/-4 puntos), que es solo el Juez, más duro. Jefe por criatura en el nivel 4 (n = 60): Munin 7 → 62, Ysolde 47 → 97, Lich 28 → 90, Hugin 0 → 30, Vaskar 0 → 25, Dragón joven 0 → 32, Gigante de hueso 0 → 50; el Juez, Kuru, Kharoth y el Apóstol siguen en 0. La fila de jefe del nivel 3 sigue en 0 (el mejor es Ysolde, 2 → 0 por ruido).

**Juez Sin Ojos** (solo él, n = 300): nivel 9: **76% → 27%**; nivel 13: **100% → 95%** (n = 60 del detalle: 67% → 22% y 100% → 95%).

### 10.3 Objetivos

| Objetivo | Resultado |
|---|---|
| Peligro 4, nivel 4 ≈ 45% | **46%** cumplido |
| Jefe, nivel 4 ≈ 20-25% | **20%** cumplido (en el límite bajo) |
| Peligro 4, nivel 5 ≈ 59% y jefe ≈ 37% | 59% y 36%: sin cambios |
| Niveles 1-2 y ≥ 5 dentro de ±5 | cumplido (0 de cambio en niveles 1-6 y 13; jefe de 7-9: -3 a -4 por el Juez) |
| Peligro 3 y tríos 1-2 en 3-4 sin pasarse del 95% | nivel 3: 90% y 91%, cumplido; nivel 4: 100% y 100% (ya eran 99% y 97%: se pasan del 95%, un cambio de +1 a +3 sobre lo que había) |
| **Peligro 4, nivel 3 ≈ 30-35%** | **13%: NO cumplido** (antes 11%) |
| **Jefe, nivel 3 ≈ 8-12%** | **0%: NO cumplido** |
| Juez nivel 9 ≈ 30-40% | **27%**: queda 3 puntos por debajo |
| Juez nivel 13 ≈ 75-85% | **95%: NO cumplido** (antes 100%) |

### 10.4 Por qué no se cumplen los del nivel 3 y el nivel 13 del Juez

- **Nivel 3.** Con los rasgos simples y automáticos de la base 2-3 solo se ganan ~2 puntos de peligro 4: la Presa y el Veterano afectan a dos clases (y el Veterano apenas pesa) y los demás rasgos de ese tramo (Furia, Castigo divino, Acción súbita, furtivo, Sangre…) son habilidades que el simulador no usa, así que no se pueden medir ni ajustar. Lo que sí mueve el nivel 3 es el segundo ataque, y con él el peligro 3 y el trío se salen del margen. Alternativas medidas (n = 300, niveles 3 / 4, peligro 4 · jefe · peligro 3 · trío):

  | Variante | Nivel 3 | Nivel 4 |
  |---|---|---|
  | Antes | 11 · 0 · 84 · 86 | 20 · 5 · 99 · 97 |
  | Ataque adicional en el 4 (sin más) | 11 · 0 · 84 · 86 | 38 · 15 · 100 · 100 |
  | Ataque adicional en el **3** | 23 · 4 · **99 · 97** | 38 · 15 · 100 · 100 |
  | Presa y Veterano en el 3 (sin Ataque adicional) | 13 · 0 · 90 · 91 | 23 · 6 · 98 · 99 |
  | Ataque temerario del Berserker en el 3 (extra) | 13 · 0 · 88 · 84 (sin ganancia) | igual |
  | PV +2 por nivel | 12 · 0 · 92 · 89 | 25 · 7 · 100 · 99; nivel 5: 69 · 48 (+10: se sale de ±5) |
  | PV +4 por nivel | 13 · 1 · 96 · 90 | 27 · 9; nivel 5: 75 · 58 (+16) |
  | **Elegida**: Ataque adicional 4 + Presa + Veterano 3 | **13 · 0 · 90 · 91** | **46 · 20 · 100 · 100** |

  El Ataque adicional en el 3 daría ~23% en peligro 4, pero con el peligro 3 al 99% y el trío al 97% (justo lo que se pedía no tocar). Los PV no sirven: suben más el nivel 5 (que debe quedarse en ±5) que el 3, y el nivel 3 casi no se mueve (+1 punto en peligro 4). Se priorizó no degradar. **El valle del nivel 3 se queda, y es el motivo de la red de seguridad 3**: en los niveles 3-4 el sorteo no saca peligro 4 ni jefes en persona (salvo emboscada excepcional con «mortal»), y el DM lo sabe por `REGLAS_ENCUENTROS`. La rampa resultante (peligro 4: 13 → 46 → 59 → 68 → 81; jefe: 0 → 20 → 36 → 47 → 65) es continua desde el 4, pero con un salto de 33 puntos entre el 3 y el 4 en peligro 4 (el del Ataque adicional); antes el salto era 20 → 59 entre el 4 y el 5.
- **Efecto colateral**: con el Ataque adicional en el 4, los jefes sueltos de peligro 4-5 del nivel 4 (Lich 90%, Ysolde 97%) quedan muy fáciles en el simulador. El Lich ya lo era en el nivel 5 y el simulador no modela sus hechizos, su relicario ni su resistencia al daño no mágico (ver 9.4); no se ha tocado.
- **Juez.** Las piezas y el PV no permiten llegar a la vez a 30-40% en el nivel 9 y 75-85% en el 13: la curva del Juez es la misma sigmoide desplazada. Medido (n = 200-400 según la variante): `loriga`+`yelmo`+`coraza`+`grebas` (1,45 PV de media) 12% / 86%; `loriga`+`yelmo`+`brigantina`+`grebas`+`gorjal` (1,61) 19% / 91%; **`loriga`+`yelmo`+`brigantina`+`grebas` (1,98) 27-28% / 95%**; `loriga`+`yelmo`+`gorjal`+`grebas` (2,18) 32% / 96%; `loriga`+`yelmo`+`grebas` (2,54) 39% / 98%; las placas completas (0,77) 3% / ~60%. Cambiar los PV no ayuda: +15% (207 PV) baja el nivel 9 unos 16 puntos y el 13 solo 3; quitarle PV sube más el 13 que el 9. Se eligió el punto que minimiza el mayor desvío (3 puntos por debajo en el 9, 10 por encima en el 13). Para llevar el 13 al 80% haría falta volver a placas (3% en el 9), que es lo que se quería evitar. Además, a nivel 13 y con el simulador sin habilidades de criaturas ni hechizos, el 95% sobrestima al grupo.
- **Rasgos de clase del nivel 3 que quedan sin medir**: Furia, Castigo divino, Acción súbita, furtivo y Sangre del Flagelante no los usa el simulador, así que la dificultad real del nivel 3 es algo menor que la medida.

## 11. Gorgon (bestia nueva, peligro 3, VD 7)

Ficha: CA 18, 15d10+45 PV (~127), `escamas_naturales` (4/3/1: el filo y la punta resbalan, la maza no), un ataque por asalto (Cornada +8, 2d12+5; Pezuñas solo contra derribado), Aliento petrificante (CON CD 14, recarga 5-6) y Embestida (FUE CD 16, 2d10+5, derribado, recarga 5-6). Partió de CA 19 y 17d10+51 (~144 PV) y se bajó un punto de CA y dos dados de golpe: con esas cifras los niveles 1-3 acababan en tablas («sin final» en 20 asaltos) porque el grupo no atravesaba la piel.

Medido con `npx tsx tests/balance/simular.ts --criatura <nombre> --n-detalle 200 --detalle --niveles 1,5,7,9` (victorias · asaltos · PJ caídos · PV restantes; **sin habilidades**, como todo el simulador: el aliento y la embestida añaden riesgo que aquí no se ve):

| Criatura | N1 | N5 | N7 | N9 |
|---|---|---|---|---|
| **Gorgon** (P3, VD 7) | 0% · 7,1 · 100% · 0% | 100% · 5,7 · 20% · 71% | 100% · 4,8 · 11% · 81% | 100% · 4,0 · 4% · 87% |
| Troll de ciénaga (P3, VD 6) | 12% · 5,8 · 94% | 100% · 2,3 · 5% · 84% | 100% · 2,1 · 0% | 100% · 2,0 · 0% |
| Wyverno (P3, VD 6) | 49% · 8,3 · 74% | 100% · 2,6 · 0% · 92% | 100% · 2,4 · 0% | 100% · 2,2 · 0% |
| Basilisco (P3, VD 5) | 44% · 7,4 · 76% | 100% · 2,1 · 1% · 92% | 100% · 2,0 · 0% | 100% · 1,8 · 0% |
| Mantícora (P3, VD 5) | 96% · 5,7 · 30% | 100% · 2,0 · 0% · 96% | 100% · 1,9 · 0% | 100% · 1,7 · 0% |
| (referencia) peligro 4, tabla principal, N5 | | 63% · 5,5 · 61% · 33% | | |

Lectura: el Gorgon es el peligro 3 más duro (VD 7, un punto por encima de Troll y Wyverno), no es trivial a nivel 5 (5,7 asaltos y 1 de cada 5 PJ cae, frente a ~2 asaltos de sus vecinos) y deja de ser un problema a nivel 7-9 sin llegar a ser imposible. A nivel 1 es 🔴, como el peligro 4: no debe salir ahí (la rampa de los niveles 3-4 ya recorta el sorteo; ver 10). Peligro 3 / VD 7 confirmado por el dueño; subirlo a peligro 4 lo dejaría más fácil que un peligro 4 medio. El lore y la cura (hiel de gorgon) también están confirmados.

**Celdas del simulador que cambian** (`--n 40 --rapido`, semilla 1): solo «1 criatura, peligro 3» del nivel 1 (43% · 6,0 asaltos · 74% caídos · 25% PV pasa a 43% · 6,3 · 73% · 26%), porque la celda rota por las criaturas de peligro 3 y ahora hay una más; el resto de celdas y las filas de las demás criaturas del detalle son idénticas, y aparece la fila nueva del Gorgon. La fila de peligro 4, los jefes y el trío no cambian.

## 12. Bakunawa (monstruo nuevo, peligro 5, VD 18)

Ficha: serpiente-dragón marina Gargantuana, CA 20, 20d20+100 PV (~305), 0 m en tierra y nadar 24 m (no vuela; solo vive en el mar), `escamas_naturales`, 2 ataques por asalto (Mordisco devastador +14, 3d10+9 con agarre; Coletazo x2 +14, 3d8+9 con derribo), 3 acciones legendarias, resistencia legendaria 2/día, reacción (Resaca) y retirada al agua al caer a la mitad de PV cerca del mar. Habilidades: Eclipse del Bakunawa (recarga 6; oscuridad mágica, desventaja a la vista; se rompe con ruido), Aliento de marea (FUE CD 20, 10d8, derribo, recarga 5-6; el DM sigue con `agua sumergir`) y Tragar (FUE CD 19, recarga 5-6: tragar de verdad, ver abajo).

**Tragar de verdad y solo en el mar (cambio pedido por el dueño; los números son propuesta a confirmar).** Tragar ya no es un efecto breve: es el estado `tragado (por Bakunawa)` (condición del catálogo, `src/condiciones.ts`; lógica en `src/tragado.ts`; parámetros en el campo `traga` de la ficha). Solo contra una criatura Grande o menor que ya tenga agarrada, una a la vez (límite 1): salvación de FUE CD 19 (la del agarre). Dentro queda cegada y retenida, con cobertura total (nadie de fuera la ataca ni la alcanza con áreas, hechizos o habilidades; ella solo puede atacar a la Bakunawa, cuerpo a cuerpo con arma cortante o perforante o con un conjuro) y sufre **4d6 eléctrico al empezar su turno**; el motor lo aplica al abrirse cada asalto, con aviso 🎲⚡, y nunca mata de golpe (a 0 PV queda inconsciente dentro). Escapes: (1) **desde dentro**, 25 o más de daño a la Bakunawa en un turno suyo (`atacar` o `danar_criatura {por}` si es un conjuro) obliga a la Bakunawa a una salvación de CON +8 (sin Resistencia legendaria) **CD 17**, y si falla lo vomita (40 % de escupir por intento); (2) **abrirse paso**: maniobra `escapar`, Atletismo o Acrobacias **CD 20** como acción; (3) **presión de los aliados**: cada daño que reciba la Bakunawa cuenta, y con 50 o más en un asalto (de fuera y de dentro) hace esa misma salvación, una sola vez por asalto; (4) **retirada y muerte**: al caer a la mitad de PV (su retirada táctica) o al morir, escupe a los tragados antes. Quien sale cae derribado a 3 m de ella. Costes de diseño: 4d6 (media 14 por asalto sobre un solo objetivo) es un daño de peligro 5 coherente (menos que el Aliento de marea, 10d8) y no sustituye a ninguno de sus ataques porque Tragar es su acción de habilidad; el tragado sigue siendo útil (puede dañarla desde dentro) y los 50 de presión equivalen a un asalto normal de un grupo de nivel 9-13, así que el grupo tiene siempre una salida. El simulador **no modela habilidades**, así que no mide este cambio: la fila de la Bakunawa es idéntica (0 / 0 / 0 / 4 % / 75 %) y se mantiene peligro 5 / VD 18.

**Solo en el mar.** La ficha dice que nunca sale a tierra (0 m en tierra, sin presencia fuera del agua; ataca naves y la orilla a pocos metros; quien está en tierra firme lejos de la orilla solo puede ser alcanzado por el Aliento de marea). Ya no sale a la costa «en noches de luna»; la nota de vulnerabilidad al fuego solo vale si la varan a la fuerza. La plantilla `bakunawa` lleva `mar: true` (nuevo campo `Plantilla.mar`): `sortearEncuentro` solo la incluye si `enMar` es cierto, es decir, si el grupo va a bordo de una nave no hundida, está en un lugar de tipo «puerto» o cuyo nombre o región nombra el mar o la costa, o el DM fuerza una `region` de mar (las regiones de tierra, Aldenmar incluida, no cuentan). `velocidadDe` da 0 m en tierra a una criatura de «0 m, nadar N» (24 m en el agua con `agua entrar`) y `aparecer_criatura` avisa al DM si la saca fuera del mar. Ninguna otra criatura cambia: la otra «Tragar» del bestiario conserva su texto libre (la condición nueva solo reconoce «tragado (por X)»), y el simulador sale idéntico.

Es la criatura más fuerte de la categoría «monstruo» (antes el Lich, peligro 5, VD 16): por eso peligro 5 y VD 18, por encima del Lich y de todos los monstruos y por debajo de Kharoth (VD 24). Es la única del peligro 5 de monstruos que el simulador puede perder, lo que sitúa el VD frente a los jefes. Medido con `npx tsx tests/balance/simular.ts --solo-comparar --criatura Bakunawa --n-detalle 200 --detalle --niveles 1,5,7,9,13` (victorias; **sin habilidades, legendarias, reacción ni retirada**: el simulador solo usa el Coletazo x2, así que la dureza real es mayor):

| Criatura | N1 | N5 | N7 | N9 | N13 |
|---|---|---|---|---|---|
| **Bakunawa** (P5, VD 18) | 0% | 0% | 0% | 4% (8,9 asaltos, 99% caídos) | 75% (9,8 asaltos, 62% caídos, 31% PV) |
| Lich (P5, VD 16) | | 100% | | 100% | 100% |
| Apóstol (P4, VD 12) | 0% | 0% | | 80% | 100% |
| El Juez Sin Ojos (P5, VD 14) | | 0% | | 3% | 60% |
| Kuru (P5, VD 15) | | 0% | | 0% | 45% |
| Kharoth (P5, VD 24) | | 0% | | 0% | 56% |

Lectura: no hay banda libre en la tabla de peligros, y se ha colocado en el peligro 5 (el techo; `topePeligro` solo lo permite desde el nivel 9, o desde el 7 con dificultad «mortal»). Es inalcanzable por debajo del nivel 9 (como los jefes) y a nivel 13 es 🟢 (75%), entre el Juez y el Lich; con sus habilidades en mesa debería quedar entre el Juez y Kharoth. Opciones si el dueño lo quiere distinto: bajarlo a peligro 4 (VD ~14; entonces solo estaría al nivel de un Apóstol y no sería un jefe de campaña), o subirlo a categoría «jefe» (entonces entra en la rotación del escenario «1 jefe» del simulador y cambia esa fila; además exige trasfondo y códice de jefe).

**Celdas del simulador que cambian** (`--n 40 --rapido`, semilla 1): solo «1 criatura, peligro 5», porque la celda rota por los monstruos de peligro 5 y ahora hay dos (Lich y Bakunawa): N1 0% · 4,2 asaltos, N5 98% → 48%, N9 100% → 53%, N13 100% → 93%. El resto de celdas, el trío y el escenario del jefe no cambian. La plantilla de encuentro `bakunawa` (peligro 5, noche, solo en el mar, tipo «peligro») obligó a ampliar el tipo `Plantilla.peligro` de `1|2|3|4` a `1|2|3|4|5`; ninguna otra plantilla es de peligro 5.

## 13. Resistencias, inmunidades y vulnerabilidades por criatura (fase C del catálogo de daños)

Hasta ahora esos datos vivían solo en la prosa de `rasgos` y el motor no los aplicaba (el DM tenía que acordarse de restar a mano). Ahora la ficha de criatura lleva `resistencias`, `inmunidades` y `vulnerabilidades` (tipo canónico; `soloNoMagico`, `salvoMaterial`, `soloMaterial`) y `atacar` y `danar_criatura` (con `tipo_dano`) las aplican con `aplicarDano` (`src/danos.ts`, `docs/DANOS.md`). Solo se migró lo que la ficha **ya decía**: 20 de las 46 criaturas. No cambia ningún peligro ni VD.

**Qué se migró** (todo literal de la prosa): Banshee (resiste físico no mágico; inmune necrótico), Gigante de hueso (vulnerable contundente; inmune veneno), Dragón joven de ceniza y Kharoth (inmunes al fuego), Apóstol (inmune veneno), Lich (resiste físico no mágico; inmune veneno; vulnerable al fuego de la Llama Gris y a la luz solar primigenia), Wendigo (inmune frío; vulnerable fuego), Ulfhedinn y Hombre oso (resisten físico no mágico; inmunes veneno; vulnerables al fuego de la Llama Gris), Gárgola (resiste cortante y perforante no mágico; vulnerable contundente; inmune veneno), Golem de piedra (resiste cortante y perforante no mágico; inmune veneno), Golem de carne (inmune veneno; vulnerable fuego), Elementales de fuego (inmune fuego y veneno; físico no mágico), agua (inmune veneno; resiste fuego y físico no mágico), tierra (inmune veneno; resiste cortante y perforante no mágico; vulnerable trueno) y aire (inmune veneno; físico no mágico), Djinn (inmune veneno; resiste eléctrico y trueno), Leshen (vulnerable fuego), Bakunawa (resiste frío y eléctrico) y la Madre de los Hambrientos (inmune veneno y necrótico). Decisión de lectura (a confirmar): «resistencia al daño no mágico» sin tipo se lee como el **daño físico** no mágico (cortante, perforante y contundente), como en 5e.

**Qué NO se migró** (sigue en prosa porque no es un tipo de daño o el motor no lo sabe): condiciones (miedo, hechizo, agotamiento, asustado, agarrado, envenenado, ahogamiento), la sal y el hierro cálido de Sirena y Hombre pez, la vulnerabilidad de la Bakunawa al fuego solo fuera del agua, la «vulnerabilidad a las armas pesadas contundentes» del Elemental de tierra, la adaptación de Kuru (resistencia dinámica) y las resistencias legendarias (son otra cosa).

**«No mágico».** `fuente.magico`: `atacar` lo deduce de que el arma sea un objeto del inventario (con su `[O#]`) de calidad encantado, maldito, reliquia o legendario; el DM puede forzarlo con `atacar {magico: true|false}` y en `danar_criatura {tipo_dano, magico}`. El castigo radiante del Caballero cuenta como mágico. Sin dato se trata como **no mágico**. El material (`plata`, `llama gris`…) se pasa con `material`. Ojo: el simulador no usa objetos mágicos, así que muestra el caso más duro.

**Armadura y resistencia no se suman (decisión mía, a confirmar; la propuesta más segura).** La armadura por regiones (`blindaje`) y la ficha describen la misma dureza de la piel. Si el blindaje ya frena el golpe (reducción > 0), manda el blindaje y no se resta además la resistencia física de la ficha; si el blindaje lo agrava (reducción < 0), no se duplica la vulnerabilidad física. Donde la criatura no tiene blindaje (Banshee, Elementales de fuego, agua y aire) o el blindaje no cubre, cuenta la ficha. Alternativa descartada: apilar ambas. Medido (simulador, grupo sin armas mágicas, victorias a nivel 1 / 5 / 9 / 13, `--detalle --n-detalle 60`):

| Criatura | Antes | Apilando | Decisión final |
|---|---|---|---|
| Gárgola (P2, VD 2) | 75/100/100/100 | 35/100/100/100 | 80/100/100/100 |
| Banshee del Velo (P3, VD 5) | 93/100/100/100 | 50/100/100/100 | 50/100/100/100 |
| Ulfhedinn (P3, VD 5) | 78/100/100/100 | 25/100/100/100 | 50/100/100/100 |
| Elemental de fuego (P3, VD 5) | 77/100/100/100 | 17/100/100/100 | 17/100/100/100 |
| Elemental de aire (P3, VD 5) | 15/100/100/100 | 2/100/100/100 | 2/100/100/100 |
| Hombre oso (P3, VD 6) | 5/100/100/100 | 0/97/100/100 | 0/100/100/100 |
| Elemental de agua (P3, VD 6) | 3/100/100/100 | 0/100/100/100 | 0/100/100/100 |
| Elemental de tierra (P4, VD 9) | 0/48/100/100 | 0/0/67/100 | 0/48/100/100 |
| Gigante de hueso (P4, VD 10) | 0/78/100/100 | 0/88/100/100 | 0/78/100/100 |
| Golem de piedra (P4, VD 10) | 0/33/100/100 | 0/0/65/98 | 0/33/100/100 |
| Lich (P5, VD 16) | 0/100/100/100 | 0/43/100/100 | 0/92/100/100 |

Las demás criaturas no cambian (el ruido entre corridas con la misma semilla es de unos pocos puntos, porque cambia el consumo de dados).

**Celdas de la tabla principal que cambian** (`--n 40 --rapido`, semilla 1; antes → después, victorias · asaltos): peligro 2, N1 93% · 4,5 → 95% · 4,1; peligro 3, N1 43% · 6,3 → 23% · 7,4 (de 🟢 a 🟡: 84% de los PJ caídos); peligro 5, N5 48% · 6,0 → 45% · 7,0, N9 53% · 6,5 → 53% · 7,2, N13 93% · 6,5 → 93% · 7,0; el trío y el jefe, sin cambios en victorias (el trío varía ±0,1-0,2 asaltos, ruido). El resto, igual.

**Lo que ya no encaja (NO cambiado; el dueño decide).** Con las resistencias aplicadas, varias criaturas rinden bastante más de lo que su peligro/VD decía **contra un grupo sin armas mágicas** (el escenario del simulador): Elemental de fuego (P3, VD 5: de 77% a 17% en N1) y Banshee (P3, VD 5: de 93% a 50%) y Elemental de aire/agua (P3) ya eran cuerpos a cuerpo duros; Ulfhedinn (P3, VD 5: 78% → 50%); Lich (P5, VD 16: N5 100% → 92%, sigue siendo el P5 más blando). Opciones por criatura: (a) dejarlas como están (la ficha ya decía que resistían; el equipo mágico del grupo lo compensa en la mesa); (b) subirles el peligro un punto (Elemental de fuego, Banshee y Ulfhedinn pasarían a peligro 4 y dejarían de ser un encuentro de nivel 1); (c) dar al grupo un arma mágica de partida a nivel 3-5 (no está en el simulador); (d) quitar la resistencia no mágica a los Elementales (cambia la ficha, no el motor). Ninguna aplicada.

**Incoherencias de datos detectadas (corregidas en §14, salvo la 6 y la 7, que siguen abiertas):** (1) Ysolde (vampiro) y Vaerth atacan con daño necrótico y no son inmunes a él; (2) los no-muertos sin inmunidad al veneno que la ficha no dice: Hambriento, Ghul de las fosas, Banshee, Ysolde (la Madre, el Lich, el Gigante de hueso, el Ulfhedinn y el Hombre oso sí); (3) el Lich ataca con necrótico y no es inmune; (4) el Hombre oso es una copia literal del texto del Ulfhedinn (mismas resistencias, mismo «Furia sin fin» y «vulnerable al fuego de la Llama Gris»): probablemente debería tener su propia ficha; (5) la Bakunawa dice «inmune a envenenado» (condición): ¿también al daño de veneno?; (6) Gorgon dice «no tiene resistencias mágicas» y «el golpe contundente lo hiere mejor» pero no hay vulnerabilidad estructurada (su blindaje de escamas ya lo refleja); (7) «inmune a miedo» y demás condiciones siguen sin dato estructurado (el motor no tiene lista de inmunidades a condiciones).

## 14. Corrección de las incoherencias de datos de la fase C (confirmada por el dueño: «Arregla las incoherencias»)

Datos y prosa dicen lo mismo, y la prueba de coherencia de `t-resistencias` (prosa → datos) se amplió en sentido inverso (datos → prosa). No cambia ningún peligro, VD, PV, CA ni ataque.

| Criatura | Antes | Después |
|---|---|---|
| Hambriento | sin inmunidades; sin nada en la prosa | inmune al veneno (dato y rasgo «No-muerto: inmune al veneno») |
| Ghul de las fosas | ídem | ídem |
| Banshee del Velo | inmune al necrótico («inmune a necrótico») | inmune al necrótico **y al veneno** («inmune al necrótico y al veneno (es un espíritu, no un cuerpo)») |
| Ysolde (vampiro) | ninguna | inmune al veneno y al necrótico (rasgo «No-muerta: …»); la luz solar sigue solo frenando su regeneración |
| Lich | inmune al veneno | inmune al veneno **y al necrótico** («su cuerpo está vaciado por la magia negra») |
| Bakunawa | «inmune a ahogamiento, a envenenado…»; sin inmunidades | «inmune al veneno y a la condición envenenado, al ahogamiento…»; dato: inmune al veneno (la condición queda en prosa) |
| Hombre oso | copia del Ulfhedinn | ficha propia (abajo); datos iguales (resiste físico no mágico, inmune al veneno, vulnerable al fuego de la Llama Gris) |
| Vaerth | ataca con necrótico, sin inmunidad | **sin cambio** (abajo) |

**Decisiones.** (1) *Vaerth* no es no-muerto (cambiaformas, sin temple) y su lore (roba rostros y esencia) no habla de la muerte: darle inmunidad o resistencia al necrótico sería inventar. Queda sin cambio; si el dueño quiere un guiño, la opción mínima es resistencia (no inmunidad) con «Toque vacío». (2) *Ysolde* y *Lich*: inmunidad al necrótico porque son no-muertos que lo emplean como arma (la 5e los hace solo resistentes; se siguió lo pedido). (3) Se comprobó el tipo de los cuatro «no-muertos sin veneno»: Hambriento («no-muerto torpe», «muerto alzado»), Ghul de las fosas («no-muerto»), Banshee («espectro», espíritu de una elfa muerta) e Ysolde («vampiro») lo son de veras; ninguno se dejó fuera. (4) *Hombre oso*: su lore compartido («berserker de Ceniza muerto en plena furia sin rito», tema de saber «caidos») lo hace no-muerto, así que **tipo y resistencias no cambian**; solo se reescribió el sabor: descripción pública nueva (mole encorvada con cabeza de oso, cubil, ceniza fría y miel rancia), región, origen secreto (murió solo, en invierno, refugiado en una cueva), «Furia de cubil» (en lugar de «Furia sin fin»: la furia dura mientras haya alguien en su territorio; mismas cifras), «Rabia ciega» (en lugar de «En trance»; misma regla), «Carne vieja» (el fuego de la Llama Gris prende en su pelaje seco como en leña vieja; misma vulnerabilidad), olfato con hibernación de la furia, descripción propia de «Ceniza de la furia» (mismo nombre, CD y daño) y el texto del encuentro `hombre_oso`. Peligro 3, VD 6, 13d10+39, CA 15, ataques y habilidades intactos. Prueba: Jaccard de descripciones < 0,3, sin rasgos idénticos al Ulfhedinn.

**Redacción daño ↔ condición** (grep de `inmune a`): ahora «inmune al veneno» (daño, con dato) y «a quedar agotado / a la condición asustado» (condición, solo prosa). Normalizados Gigante de hueso, Apóstol, Lich, Ulfhedinn, Hombre oso, Gárgola, Golem de piedra, Elementales de agua, tierra y aire, Djinn, Madre, Bakunawa y Kuru («inmune a asustado» → «a la condición asustado»). Sin inmunidades a condiciones como dato (sigue pendiente). La prueba rechaza «inmune a/al miedo|hechizo|agotamiento|envenenado|asustado|sueño» a secas y «inmune a veneno».

**Simulador** (`--n 40 --rapido --detalle --n-detalle 60`, semilla 1, antes y después): **salida idéntica, línea por línea** (tabla principal y detalle de todas las criaturas). Era previsible: el grupo simulado no usa veneno ni necrótico y las criaturas del cambio no cambian de cifras. Detalle de las afectadas (victorias N1/N5/N9/N13, sin cambio): Hambriento 100/100/100/100; Ghul 100/100/100/100; Banshee 50/100/100/100; Ulfhedinn 50/100/100/100; Hombre oso 0/100/100/100; Lich 0/92/100/100; Ysolde 0/100/100/100; Vaerth 0/37/100/100; Bakunawa 0/0/0/77. Prompt fijo: 67.093 → 67.093 (≤ 67.600; las fichas se sirven bajo demanda).

**Propuestas a confirmar (NO tocadas; peligro y VD intactos).** Siguen fuera de banda frente a un grupo sin armas mágicas, como ya se dijo en §13: Hombre oso (P3, VD 6: 0% en N1, 100% en N5), Elemental de fuego y de aire (P3), Banshee y Ulfhedinn (P3, VD 5: 50% en N1) y el Lich (P5, VD 16: 92% en N5, el P5 más blando); Ysolde (P5, VD 16: 100% desde N5) también queda muy por debajo de su peligro en el simulador (que no modela sus habilidades ni su Corte). Opciones: subir el peligro un punto o dar al grupo un arma mágica de partida.

**Otras incoherencias vistas y NO cambiadas (dudosas).** (a) Wyverno y Basilisco atacan con veneno y no son inmunes (en 5e tampoco; es un rasgo de bestia, no de no-muerto). (b) Ulfhedinn y Hombre oso hacen daño de fuego («Ceniza de la furia») y son vulnerables al fuego de la Llama Gris, pero no inmunes al fuego corriente: es coherente con su prosa. (c) Psíquico: Banshee, Moira, Ilvara, Juez y Kharoth lo usan sin inmunidad; la 5e no la da. (d) El Juez Sin Ojos ataca con fuego (Veredicto) sin inmunidad, pese a ser el inquisidor de la Llama Gris: la ficha no lo dice. (e) Ysolde teme la luz solar primigenia («regeneración falla salvo luz solar») pero no hay vulnerabilidad al radiante como en el Lich: la prosa no dice «vulnerable». (f) El Elemental de fuego «recibe doble daño del agua»: «agua» no es un tipo de daño del catálogo. El Elemental de agua «se congela» (inmovilizado) sin vulnerabilidad al frío estructurada. (g) La 6 y la 7 de §13 (Gorgon y condiciones) siguen abiertas.

### 14 bis. Incoherencias restantes de §14 (confirmado por el dueño: «Arregla incoherencias y sube peligro», parte 1)

Datos y prosa a la vez; la prueba de coherencia de `t-resistencias` ahora también cubre resistencias y vulnerabilidades (incluidas las de material «agua», «hierro frío», «luz solar») en los dos sentidos. No cambia ningún peligro, VD, PV, CA ni ataque. Simulador (`--n 40 --rapido` y `--detalle --n-detalle 60 --niveles 1,5,9,13`): **salida idéntica** a la de antes (el grupo simulado no usa psíquico ni material).

| Criatura | Antes | Después | Por qué |
|---|---|---|---|
| Banshee del Velo | usa psíquico (Lamento), sin protección | **resiste** el psíquico (dato y rasgo) | es un espíritu hecho de duelo y memoria, pero se la aplaca hablándole (ver su encuentro): no es inmune |
| Ilvara | usa psíquico (Agujas del telar), sin protección | **resiste** el psíquico (rasgo «Mente prevista») | «sabe lo que vas a pensar antes de que lo pienses»; jefa: resistencia, no inmunidad |
| El Juez Sin Ojos | fuego (Veredicto y Espadón de llama gris) sin protección | **resiste** el fuego (rasgo «Hijo del sol») | hijo del dios del sol Ka'i y regente de la Llama Gris; resistencia, no inmunidad (jefe) |
| Ysolde | solo «regeneración falla con la luz solar» | **vulnerable** al radiante de la luz solar y de la luz solar primigenia (doble; dato `soloMaterial` y rasgo «Teme la luz solar») | igual que el Lich, que ya lo era de la primigenia |
| Elemental de fuego | prosa «doble daño del agua», sin dato | vulnerable a `contundente` con material «agua» (el agua se trata como golpe contundente de material agua, igual que el Golpe de agua del Elemental de agua) y su resistencia física la **exceptúa** (`salvoMaterial: "agua"`, si no, resistencia y vulnerabilidad se anularían) | «agua» no es tipo del catálogo; se usa el mecanismo de material de la fase C, sin tocar el motor |
| Duende | prosa «doble daño del hierro frío», sin dato | vulnerable a cortante, perforante y contundente con material «hierro frío» | misma clase que el Elemental de fuego |

**Sin cambio, con motivo.**
- *Wyverno y Basilisco* (veneno): **sin inmunidad ni resistencia.** Son bestias (temple «bestia»), su lore no habla de sangre ni de cuerpo inmune, el veneno es un arma (aguijón, mordisco) y la 5e tampoco se la da. Fijado por prueba.
- *Moira* (psíquico): sin cambio. Ve el futuro con presagios, pero ni su ficha ni su lore dicen que su mente esté blindada; «Cortar el hilo» es su poder, no un rasgo defensivo.
- *El Juez* (psíquico, Confesión) y *Kharoth* (psíquico, Palabra del dios devorado): sin cambio, son jefes y nada en su lore apoya una resistencia (la «vista ciega» del Juez es percepción; la palabra de Kharoth es de un dios que devoró, no un escudo mental). Kharoth ya es inmune al fuego.
- *Elemental de agua* («se congela»): sin cambio. La prosa dice que el hielo la **inmoviliza** (velocidad 0), no que reciba más daño: una vulnerabilidad al frío sería inventarla. *Elemental de aire* («vulnerable al vacío») y *de tierra* («armas pesadas contundentes» sin tipo en el catálogo): sin cambio.
- *Ulfhedinn y Hombre oso* (fuego de «Ceniza de la furia»): sin cambio, ya decidido en §14.

**Dudosas, listadas sin cambiar.** (1) Sirena y Hombre pez («hierro cálido y sal en abundancia, le quema la piel») y la sal en abundancia del Elemental de fuego, Madre y Lich: no hay tipo claro (¿fuego? ¿ácido?) ni material «sal» definido. (2) «Armas pesadas contundentes» del Elemental de tierra y el «golpe contundente lo hiere mejor» del Gorgon: el catálogo no distingue armas pesadas; su blindaje ya lo refleja. (3) Vaerth (necrótico sin inmunidad): ya en §14. (4) Condiciones como dato (miedo, hechizo, agotamiento): sigue abierto.

## 15. Subir un punto el peligro de las criaturas que rinden por encima de su banda (confirmado por el dueño)

Frente al grupo sin armas mágicas del simulador, Hombre oso, Elemental de fuego, Elemental de aire, Banshee del Velo y Ulfhedinn rendían muy por encima de un peligro 3 (§13). Pasan a **peligro 4**. Lich e Ysolde ya son P5 (máximo): se quedan.

**Regla de VD.** Las pruebas no tenían una tabla peligro↔VD: solo fijaban cada criatura por separado. La única regla que cumplían las 46 fichas, y que ahora fija una prueba nueva en `t-bestiario`, es que **el VD no baja al subir el peligro** (máximo VD de un peligro ≤ mínimo del siguiente). Con el Gorgon (P3, VD 7) como techo del peligro 3, un peligro 4 necesita **VD ≥ 7**: es el mínimo, y es el que se les pone a las cinco (antes 5, 5, 5, 5 y 6). Rangos hoy (VD): P1 0,5-1 · P2 2-3 · P3 5-7 · P4 7-12 · P5 14-24. Alternativa descartada: el rango actual del P4 antes del cambio (9-12) exigiría VD 9, que no sale de ninguna regla comprobada.

| Criatura | Antes | Después |
|---|---|---|
| Hombre oso | P3 · VD 6 | P4 · VD 7 |
| Elemental de fuego | P3 · VD 5 | P4 · VD 7 |
| Elemental de aire | P3 · VD 5 | P4 · VD 7 |
| Banshee del Velo | P3 · VD 5 | P4 · VD 7 |
| Ulfhedinn | P3 · VD 5 | P4 · VD 7 |
| Lich, Ysolde | P5 · VD 16 | sin cambio (P5, dentro del rango 14-24) |

**Plantillas de encuentro** (`src/encuentros.ts`): `banshee`, `ulfhedinn` y `hombre_oso` pasan a peligro 4; el Ulfhedinn baja de 1-3 a **1-2** (tres de VD 7 son demasiado para el nivel 5); familia, momento, regiones y peso, igual. Los elementales no tienen plantilla propia. El peligro 3 conserva 7 plantillas con criatura propia (Troll, Wyverno, Grifo, Sirena, Basilisco, Mantícora, Gorgon) y la Corte Pálida; el 4 pasa de 3 a 6 (Wendigo, Hidra, Leshen y las tres). Efecto de juego: con el tope por nivel (3 en los niveles 3-4), las tres ya **no salen hasta el nivel 5** (prueba con barrido de dados fijos). Otros efectos de tener peligro 4, por diseño: más PX por derrotarlas (`PX_PELIGRO`), cuentan como «terribles» para el miedo del combate y como «grandes» para el Flagelante, y se ordenan con los peligro >3 en la iniciativa.

**Simulador** (`--n 40 --rapido`, semilla 1; victorias · asaltos · PJ caídos · PV restantes). Solo cambian las filas «1 criatura, peligro 3» y «peligro 4» (las criaturas movidas cambian de fila; ninguna cifra de ficha cambia):

| Fila | N1 | N5 | N9 | N13 |
|---|---|---|---|---|
| peligro 3, antes | 23% · 7,4 · 84% · 15% | 100% · 3,1 · 6% | 100% · 2,4 | 100% · 2,3 |
| peligro 3, después | 35% · 6,2 · 76% · 22% | 100% · 2,9 · 7% | 100% · 2,3 | 100% · 2,1 |
| peligro 4, antes | 8% · 3,9 · 96% | 63% · 5,5 · 61% · 33% | 98% · 4,0 | 100% · 3,5 |
| peligro 4, después | 8% · 5,1 · 96% | 78% · 4,7 · 39% · 53% | 100% · 3,6 | 100% · 3,1 |

Detalle por criatura (victorias N1/N5/N9/N13, `--detalle --n-detalle 200 --niveles 1,5,9,13`, semilla 1, misma ficha antes y después; la diferencia en una celda es ruido, ±7 puntos):

| Criatura | Antes (P3) | Después (P4) |
|---|---|---|
| Hombre oso | 0/100/100/100 | 0/100/100/100 |
| Elemental de fuego | 14/100/100/100 | 12/100/100/100 |
| Elemental de aire | 1/100/100/100 | 0/100/100/100 |
| Banshee del Velo | 51/100/100/100 | 51/100/100/100 |
| Ulfhedinn | 48/100/100/100 | 35/100/100/100 |
| Lich (P5, VD 16) | 0/93/100/100 | igual |
| Ysolde (P5, VD 16) | 0/100/100/100 | igual |

**Cómo quedan frente a su banda nueva.** A nivel 1 (donde el peligro 4 no debe salir: tope 2) ya no es un problema: 0-35% es lo esperable de un P4 (la fila de P4 da 8%). El nivel 5 es donde se enfrentan por primera vez, y **las cinco siguen por encima de su banda**: ganan el 100% frente al 33-78% de sus nuevos pares (Elemental de tierra 48%, Golem de piedra 33%, Gigante de hueso 78% a nivel 5). Es decir, la subida corrige el nivel 1 pero a nivel 5 siguen siendo más blandas que un P4 medio (el simulador no usa habilidades: Oleada de fuego, Lamento, Ceniza de la furia, Torbellino, Abrazo de oso).

**Propuestas a confirmar (NO aplicadas).** (1) Subirles la dureza real (PV, CA o un segundo ataque) en vez de más peligro, o aceptar que sean P4 «suaves». (2) Lich (P5, VD 16: 93% a nivel 5) e Ysolde (P5, VD 16: 100%): el VD **no se cambia**: cumple la regla (P5 ≥ 14) y subir el Lich a 17-18 chocaría con la prueba de la Bakunawa (su VD 18 debe superar al de todo monstruo); bajarlo no está justificado. Lo que les falta es dureza (hechizos y habilidades que el simulador no mide), no etiqueta. (3) Hombre oso sigue en 0% a nivel 1 pero es 100% a nivel 5: salto brusco que ni el peligro 3 ni el 4 explican; mirar su PV/CA.

Prompt fijo: 67.093 (sin cambio).


## 16. Botín: catálogo de tesoro y generador por peligro (propuesta lanzada por el dueño; valores a confirmar)

**Qué cambia.** Antes, un saqueo era siempre arma (~57 %), armadura (~19 %), accesorio y viales; no dependía del peligro, la región ni la criatura. Ahora `generar_botin {origen, cantidad, peligro?, region?, criatura?, categorias?}` reparte sobre el catálogo de `src/tesoro.ts` (191 entradas en 12 categorías: materiales, ingredientes, comida, herramientas, documentos, gemas, curiosidades, trofeos, llaves, náutico y 33 objetos únicos con historia) además del equipo, y **sugiere oro** (`oro_cambio` en el texto; nunca se aplica solo). Sin `peligro`, `region`, `criatura` ni `categorias` el comportamiento es el antiguo (ni oro ni catálogo). Reparto: `PESOS` por origen × `FAMILIA` de la criatura (`familiaDe`) × región (`bonusDe`) × peligro mínimo de cada entrada; lo náutico solo con mar (`enMar`); los trofeos solo de la criatura saqueada; los únicos, una vez por partida.

**Fórmulas (propuesta a confirmar).**
- Oro por peligro: P1 1d6, P2 3d6, P3 2d8×**3**, P4 4d10×**4**, P5 6d10×10 po. El dueño daba como orientación P3 ×2 y P4 ×3; con ellos una campaña daba 2.650 po de moneda, por debajo de la banda, y se subieron un escalón. Origen: ×0,5 saqueo, ×1 hallazgo, ×2 jefe; la compra no da oro. Precios de mundo.ts intactos (5 po/día de enfermería: un saqueo P1 da ~2 po y uno P3 ~14; 50 po de cirugía: un hallazgo P3-P4; equipo encantado 220-15.200: un jefe P4-P5).
- Equipo mágico de un saqueo común (encantado + maldito): 0 % en P1-2, 5 % en P3, 12 % en P4, 25 % en P5 (`tirarCalidad`). **Hallazgo y jefe conservan su tabla**: el hallazgo (ruinas, tumbas) es donde aparece lo encantado, y el jefe es la recompensa gorda; solo se recorta lo absurdo: sin reliquias en un hallazgo o jefe de P≤2 y sin legendarias por debajo de P5 (bajan un escalón). Como ahora el equipo es ~22 % del botín en vez de ~80 %, el hallazgo pasa de 28 % de objetos mágicos a ~9 % y el jefe de 55 % a ~26 %.
- Precio de equipo: encantado y maldito = base×10+200 (como antes); **reliquia = encantado + 5.000, techo 19.000** (antes 5.000 fijos: una armadura de placas encantada valía 15.200 y una reliquia, 5.000); legendaria, 20.000. Ahora una reliquia vale siempre ≥ su base encantada y < una legendaria.
- El catalizador raro (sin precio) ya no se cambia siempre por la Piedra de brasa: se elige **al azar** entre los que tienen precio.

**Simulación** (`npx tsx tests/balance/botin.ts`, semilla 1, 200 llamadas por celda, cantidad 3). «Tipos distintos» = ids de catálogo, bases de equipo, viales y catalizadores diferentes en las 200 llamadas.

| Generador | Origen | Peligro | Tipos distintos | % mágico del equipo | % mágico del botín | Oro medio | Valor catálogo medio |
|---|---|---|---|---|---|---|---|
| antes | saqueo | (ignora) | 37 | 12 % | 10 % | 0 | 0 |
| antes | hallazgo | (ignora) | 37 | 35 % | 28 % | 0 | 0 |
| antes | jefe | (ignora) | 40 | 89 % | 55 % | 0 | 0 |
| después | saqueo | P1 | 73 | 0 % | 0 % | 2,1 | 16 |
| después | saqueo | P2 | 94 | 0 % | 0 % | 5,6 | 26 |
| después | saqueo | P3 | 106 | 4 % | 1 % | 13,7 | 36 |
| después | saqueo | P4 | 111 | 19 %* | 5 % | 44,8 | 38 |
| después | saqueo | P5 | 111 | 32 %* | 7 % | 168 | 43 |
| después | hallazgo | P1 / P3 / P5 | 76 / 122 / 123 | 36 / 30 / 31 % | 9 / 7 / 8 % | 3,5 / 26,6 / 330 | 17 / 48 / 58 |
| después | jefe | P1 / P3 / P5 | 55 / 96 / 100 | 89 / 93 / 92 % | 27 / 25 / 26 % | 7 / 52 / 654 | 15 / 55 / 69 |
| después | saqueo mar | P3 | 112 | 4 % | 1 % | 14 | 40 |
| después | compra | P2 | 85 | 12 % | 3 % | 0 | 21 |

\* Con 200 llamadas hay ~130 piezas de equipo por celda (±3 puntos de ruido). Con 1.500 llamadas: **0 / 0 / 4 / 10 / 25 %** en P1-P5, igual a la tabla.

Categorías (% de los objetos, 200 saqueos): **antes** arma 62, armadura 18, accesorio 3, vial 14, catalizador 3 (nada más). **Después, P3:** arma 16, armadura 4, material 14, ingrediente 9, comida 11, herramienta 8, documento 5, gema/arte 6, curiosidad 9, llave/sello 1, moneda (lingotes, dientes de dios) 3, vial 12, catalizador 1. P1 y P5 son parecidos (P5 añade algo de accesorio). En el mar, un 7 % es náutico. El hallazgo P3 trae además un 4 % de objetos únicos, 9 % de documentos y 10 % de gemas y arte; el jefe, 8 % de únicos.

**Campaña de niveles 1-8** (300 campañas: 6 saqueos y 2 hallazgos por nivel con el peligro a su tope de nivel o uno menos, y 4 jefes: 2 de P4 y 2 de P5): moneda sugerida **3.075 po** (p10-p90: 2.765-3.394); moneda + valor de los objetos del catálogo, **5.884 po** (5.392-6.400); el equipo (que se usa o se vende aparte) no cuenta. Dentro de la banda 3.000-6.000 (el techo es justo; si pareciera mucho, bajar los jefes a ×1,5).

**Qué es propuesta a confirmar.** Los dados y multiplicadores de moneda (sobre todo P3 ×3 y P4 ×4, un escalón por encima de la orientación); los porcentajes mágicos de los saqueos; dejar intactas las tablas de hallazgo y jefe; la fórmula de la reliquia; y que `generar_botin` sin datos nuevos siga sin dar oro (alternativa: tratar la falta de peligro como P2).

**Prompt fijo:** 67.093 → 67.128 (≤ 67.600): una línea sustituye a la de generar_botin; el catálogo se sirve bajo demanda (`consultar_reglas {tema: "tesoro"}` y el resultado de `generar_botin`). Pruebas: `t-tesoro` y `t-botin`.

### 16 bis. Botín de las criaturas como datos (L3)

Las 46 criaturas llevan `botinItems: {id, probabilidad}[]` (ids del catálogo y % de que caiga al saquearlas), coherente con el texto de `botin`, que se conserva. Las 10 que no tenían botín (Lobo de Ceniza, Ghul de las fosas, Ogro, Troll de ciénaga, Wyverno, Basilisco, Mantícora, Banshee del Velo, Gigante de hueso y Apóstol) ganan un texto breve y sus piezas; «escamas» (5 criaturas), «colmillos y garras» (6), «plumas» (3), «huesos» (3) y «joyas» (ahogados y pactos) pasan a ids distintos con nombre y precio propios (escamas de hombre pez 4 po, de hombre lagarto 4, de sirena 15, de mena 12 y de mar profundo 120). Los jefes cuyo botín es una reliquia (Colmillo del Eclipse, Corazón de la Fosa, Telar de los mañanas, Máscara de mil caras…) la siguen creando el DM con `crear_objeto`; Ilvara y Vaerth tienen la lista vacía a propósito. `generar_botin {criatura}` tira cada pieza por su probabilidad (las únicas, una vez por partida); `consultar_reglas {tema: "criatura", nombre}` añade la línea «Piezas al saquearla» (la ficha del estado por turno no, para no engordarla). La simulación de §16 no cambia (las piezas de criatura solo salen con `criatura`). Prueba: `t-botin-criaturas` (texto ↔ ids en los dos sentidos, ids normalizados, probabilidades y ficha). Valores nuevos de L3 (propuesta a confirmar): relicario del lich 400, vaso de djinn 300, telar de una Moira 350, luna recuperada 300 y perlas de luna 150 (1d4) —los dos últimos ya estaban en el texto de la Bakunawa como propuesta—.
