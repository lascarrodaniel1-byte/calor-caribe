# Informe de equilibrio de combate (primer pase)

Simulador Monte Carlo que usa el **motor real** (`ejecutar(...)` de `src/herramientas.ts`) para responder a una pregunta: *¿qué encuentros, de qué peligro/VD, matan a un grupo de qué nivel?* No cambia ninguna regla ni dato del juego: solo mide.

- Código: `tests/balance/simular.ts`
- Esta tabla sale de: `npx tsx tests/balance/simular.ts --n 300 --semilla 1 --detalle --n-detalle 60 --comparar --n-comparar 300` (unos 2 minutos; 29 760 combates y 963 177 acciones pasadas por el motor).
- Todo lo de este documento es **medición** o **PROPUESTA**. Las propuestas las tiene que confirmar el dueño; ninguna está aplicada.

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
