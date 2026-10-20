// Herramientas que el Dungeon Master (Claude) puede usar. Los dados los tira
// este programa, no el modelo, para que los resultados sean realmente aleatorios.
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { describir, tirar } from "./dados.js";
import {
  aparecer,
  buscarCriatura,
  danar,
  devolverRobos,
  estadoTexto,
  presagio,
  usarHabilidad,
  type Criatura,
  type EstadoJefe,
} from "./bestiario.js";
import { aceptar, CIRCUNSTANCIAS, crearCarmesi, despertar, RAZONES, rechazar, type Circunstancia } from "./behelit.js";
import { CALIDADES_OBJETO, crearObjeto, generarBotin, ORIGENES } from "./equipo.js";
import { fichaTexto, normalizar, type Partida, type Personaje } from "./estado.js";
import {
  CALIDADES,
  avanzarAsaltos,
  CAUSAS,
  ENTORNOS,
  GRAVEDADES,
  infligir,
  METODOS,
  pasarTiempo,
  RECURSOS,
  TIPOS,
  tratar,
  UBICACIONES,
} from "./heridas.js";
import { descansar, despertarMagia, enfriar, ESCUELAS, lanzar, MAESTRIAS, magiaInicial, tirarDon, TRIBUTOS } from "./magia.js";
import { DIRECCIONES, DISTANCIAS, moverGrupo, NOMBRE_DIRECCION as NOMBRES_DIR, NOMBRES_REGIONES, TIPOS_LUGAR } from "./mapa.js";
import { actualizarPlano, actualizarReloj, avanzarSiHay, distanciaPlano } from "./espacio.js";
import { pasarAsaltoFuria, redirigirTrance, terminarFuria, terminarTodas } from "./furia.js";
import { concurso } from "./compania.js";
import { coronarLeyenda, registrarHazana } from "./leyenda.js";
import { descanso, usarRecurso } from "./recursos.js";
import { caida, maniobra } from "./maniobras.js";
import { darExperiencia, subirNivel } from "./progresion.js";
import { estabilizar, revisarCaidas, salvacionMuerte } from "./muerte.js";
import { accionCombate, ACCIONES, instantanea, provocados, reaccion } from "./acciones.js";
import { agregarCondicion, mismaCondicion } from "./condiciones.js";
import { actualizarRegentes, TIPOS_JUGADA } from "./regentes.js";
import { registrarEnemigo, repetida, sortearEncuentro } from "./encuentros.js";
import { NOMBRES_HABILIDADES, pareceUnaPrueba, resolverPrueba } from "./pruebas.js";
import { NOMBRES_CLASES, NOMBRES_RAZAS } from "./mundo.js";
import { NOMBRES_PIEZAS, TIPOS_DANO } from "./armadura.js";
import { actualizarTrama, registrarPnj } from "./narrativa.js";
import { limpiarTrasCombate, agregarAlCombate, aplicarCondicion, retirarCaido, type DatosAtaque, ALERTAS, atacar, NOMBRES_PERSONALIDADES, NOMBRES_TEMPLES, PLANES, siguienteAsalto, tirarIniciativa, VETERANIAS } from "./combate.js";
import { ATRIBUTOS } from "./reglas.js";
import { NOMBRES_VIALES, usarVial } from "./viales.js";

const habilidad = z.object({
  nombre: z.string(),
  descripcion: z.string(),
  salvacion: z.enum(ATRIBUTOS).optional().describe("Salvación de los objetivos; omítela si el efecto no admite salvación"),
  cd: z.number().int().optional(),
  dano: z.string().optional().describe('Dados de daño, p. ej. "8d10"'),
  tipo_dano: z.string().optional(),
  mitad_si_exito: z.boolean().optional(),
  muerte_si_falla_por: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Muerte instantánea si falla la salvación por este margen o más (0 = cualquier fallo). Úsalo con cuidado"),
  condicion: z.string().optional().describe("Condición que sufre quien falla"),
  herida: z.enum(CAUSAS).optional().describe("Herida que inflige al fallar"),
  sangre: z.number().int().min(1).optional().describe("Sangre perdida al fallar (riesgo de anemia)"),
  ceniza: z.number().int().min(1).optional(),
  recarga: z.number().int().min(2).max(6).optional().describe("Recarga X-6 en 1d6"),
  robo: z
    .string()
    .optional()
    .describe('Robo de esencia: dados que roba del mejor atributo de quien falla, p. ej. "1d4"; la criatura gana sus rasgos de raza y clase'),
});

const criatura = z.object({
  nombre: z.string(),
  categoria: z.enum(["bestia", "monstruo", "jefe"]),
  peligro: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  region: z.string(),
  descripcion: z.string(),
  ca: z.number().int(),
  pv: z.string().describe('Número fijo ("180") o dados ("8d10+40")'),
  velocidad: z.string(),
  atributos: z.string(),
  ataques: z.array(z.string()),
  rasgos: z.array(z.string()),
  habilidades: z.array(habilidad),
  botin: z.string().optional(),
  presagios: z.number().int().min(1).max(5).optional().describe("Si ve el futuro: d20 que tira por adelantado"),
  temple: z.enum(NOMBRES_TEMPLES).optional().describe("Carácter en combate: no-muerto torpe (zombis, esqueletos), no-muerto, vampiro, espectro, bestia…"),
  personalidad: z.array(z.enum(NOMBRES_PERSONALIDADES)).max(2).optional(),
  blindaje: z.array(z.enum(NOMBRES_PIEZAS)).optional().describe("Su armadura o piel: escamas_naturales, pellejo, hueso, placas_completas…"),
});

const atributo = z.number().int().min(1).max(30);

const esquemas = {
  tirar_dados: z.object({
    expresion: z.string().describe('Notación de dados, p. ej. "1d20+5", "2d6+3", "4d6kh3", "1d100"'),
    motivo: z.string().describe('Para qué es la tirada, p. ej. "Ataque con espada larga de Thorin contra el goblin"'),
    modo: z.enum(["normal", "ventaja", "desventaja"]).optional().describe("Ventaja o desventaja (solo aplica a 1d20)"),
    oculta: z.boolean().optional().describe("true si es una tirada secreta del DM que los jugadores no deben ver"),
  }),
  guardar_personaje: z.object({
    nombre: z.string(),
    jugador: z.string().optional().describe("Nombre de la persona que lo juega"),
    raza: z.enum(NOMBRES_RAZAS),
    clase: z.enum(NOMBRES_CLASES),
    nivel: z.number().int().min(1).max(20),
    veterania: z.enum(VETERANIAS).optional().describe("Años de oficio según el trasfondo: recluta (pocas peleas), curtido, veterano (muchos años), leyenda. Un mercenario con años de servicio es veterano aunque sea nivel 1. Si se omite, sale del nivel"),
    personalidad: z.array(z.enum(NOMBRES_PERSONALIDADES)).max(2).optional().describe("1 o 2 rasgos de carácter según cómo lo describe el jugador: pesan en emboscadas, planes y nervios"),
    armadura: z.array(z.enum(NOMBRES_PIEZAS)).optional().describe("Piezas que lleva puestas; la malla, siempre con gambeson debajo"),
    pv_max: z.number().int().min(1),
    pv: z.number().int().optional().describe("PV actuales; por defecto, igual a pv_max"),
    ca: z.number().int().min(1),
    atributos: z
      .object({ fue: atributo, des: atributo, con: atributo, int: atributo, sab: atributo, car: atributo })
      .describe("Valores finales, con el bonificador racial ya sumado"),
    inventario: z.array(z.string()).optional(),
    oro: z.number().int().min(0).optional(),
    notas: z.string().optional().describe("Trasfondo, rasgos, conjuros, competencias…"),
    escuelas_magia: z.array(z.enum(ESCUELAS)).max(2).optional().describe("Solo Hechicero: sus dos escuelas"),
    don_arcano: z.boolean().optional().describe("Solo si la historia lo exige (trasfondo pactado): fuerza que tenga o no el don; si se omite, se tira en secreto"),
  }),
  modificar_personaje: z.object({
    nombre: z.string(),
    pv_cambio: z.number().int().optional().describe("Negativo para daño, positivo para curación"),
    oro_cambio: z.number().int().optional(),
    agregar_objetos: z.array(z.string()).optional(),
    quitar_objetos: z.array(z.string()).optional(),
    agregar_condiciones: z.array(z.string()).optional().describe('p. ej. "envenenado", "derribado"'),
    quitar_condiciones: z.array(z.string()).optional(),
    nivel: z.number().int().min(1).max(20).optional(),
    veterania: z.enum(VETERANIAS).optional().describe("Sube cuando el personaje ha sobrevivido a muchas batallas"),
    personalidad: z.array(z.enum(NOMBRES_PERSONALIDADES)).max(2).optional().describe("Reemplaza sus rasgos de carácter si la historia lo ha cambiado"),
    armadura: z.array(z.enum(NOMBRES_PIEZAS)).optional().describe("Reemplaza las piezas de armadura que lleva puestas ([] si se la quita)"),
    pv_max: z.number().int().min(1).optional(),
    agregar_secuelas: z.array(z.string()).optional().describe("Secuelas narrativas fuera del sistema de heridas"),
    quitar_secuelas: z.array(z.string()).optional().describe("Solo con magia o ritos extraordinarios"),
    ceniza_cambio: z.number().int().optional().describe("Ceniza ganada o purgada por medios narrativos"),
    maestria: z.enum(MAESTRIAS).optional().describe("Nueva maestría mágica (tras entrenar con un maestro, un grimorio o un pacto)"),
    agregar_escuelas: z.array(z.enum(ESCUELAS)).optional(),
    agregar_hechizos: z.array(z.string()).optional(),
    notas: z.string().optional().describe("Reemplaza las notas de la ficha"),
  }),
  infligir_herida: z.object({
    nombre: z.string().describe("Personaje jugador herido"),
    causa: z.enum(CAUSAS).describe("critico, golpe_masivo (≥ mitad de PV máx. en un golpe), cero_pv o menor"),
    tipo: z.enum(TIPOS),
    gravedad: z.enum(GRAVEDADES).optional().describe("Omítela para que se tire según la causa"),
    ubicacion: z.enum(UBICACIONES).optional().describe("Omítela para que se tire al azar"),
    estructura: z
      .string()
      .optional()
      .describe('Estructura concreta solo si la ficción lo exige (p. ej. "arteria femoral", "nervio ciático"); si no, se tira según la gravedad'),
    de_no_muerto: z.boolean().optional().describe("true si la causa un no-muerto: puede transmitir la Podre"),
    cd_podre: z.number().int().min(5).max(25).optional().describe("CD para resistir la Podre: 11 Hambriento, 12 por defecto, 13 ghul, 15-17 no-muertos poderosos"),
    descripcion: z.string().optional().describe('Breve, p. ej. "tajo de hacha oxidada en el antebrazo"'),
  }),
  tratar_herida: z.object({
    paciente: z.string(),
    herida: z.string().describe('Id de la herida, p. ej. "H2"'),
    metodo: z.enum(METODOS),
    sanador: z.string().describe("Quién trata: un personaje jugador o un PNJ"),
    bono_medicina: z
      .number()
      .int()
      .describe("Bonificador de Sabiduría (Medicina) del sanador; para PNJ, +2 aficionado, +5 Hermana de la Sutura, +7 maestra cirujana"),
    recursos: z.array(z.enum(RECURSOS)).describe("Material que se usa de verdad (compruébalo en el inventario)"),
    entorno: z.enum(Object.keys(ENTORNOS) as [keyof typeof ENTORNOS, ...(keyof typeof ENTORNOS)[]]),
    usar_mano_firme: z.boolean().optional().describe("Barbero-Cirujano: repetir si falla (1 vez por descanso largo)"),
  }),
  pasar_tiempo: z.object({
    dias: z.number().int().min(1).max(90),
    calidad: z.enum(CALIDADES),
    personajes: z.array(z.string()).optional().describe("Por defecto, todos los personajes"),
  }),
  avanzar_asaltos: z.object({
    asaltos: z.number().int().min(1).max(600).describe("Asaltos de 6 s; 10 = 1 minuto"),
    personajes: z.array(z.string()).optional().describe("Por defecto, todos los que sangran o tienen costillas rotas"),
    esfuerzo: z.boolean().optional().describe("false si el herido está quieto (no combate ni corre): las costillas no perforan el pulmón"),
  }),
  usar_vial: z.object({
    vial: z.enum(NOMBRES_VIALES),
    receptor: z.string().optional().describe("Personaje jugador que lo bebe o lo recibe"),
    portador: z.string().optional().describe("Personaje de cuyo inventario sale el vial (se descuenta)"),
    objetivo_pnj: z
      .object({ nombre: z.string(), bono_con: z.number().int() })
      .optional()
      .describe("Solo para envenenar a un PNJ"),
    via: z.enum(["bebido", "arma"]).optional().describe("Hiel: bebida (CD 15) o en un arma (CD 13)"),
    dosis: z.number().int().min(1).max(10).optional().describe("Leche de Amapola: dosis que toma ahora"),
    herida: z.string().optional().describe("Sangre de Santo: herida que cerrar (por defecto, la más grave)"),
  }),
  generar_botin: z.object({
    origen: z.enum(ORIGENES),
    cantidad: z.number().int().min(1).max(10),
    clase: z.enum(["arma", "armadura", "accesorio"]).optional(),
    calidad: z.enum(CALIDADES_OBJETO).optional().describe("Fuerza una calidad (p. ej. el arma encantada de una misión)"),
    incluir_viales: z.boolean().optional(),
  }),
  crear_objeto: z.object({
    nombre: z.string(),
    calidad: z.enum(CALIDADES_OBJETO),
    apariencia: z.string().describe("Lo que ven y saben los jugadores"),
    verdad: z.string().optional().describe("La verdad completa, con maldiciones ocultas"),
    precio: z.number().int().min(0).optional(),
  }),
  examinar_objeto: z.object({
    id: z.string().describe('Id del objeto, p. ej. "O4"'),
    revelar: z.boolean().optional().describe("true cuando los jugadores descubren su verdadera naturaleza"),
  }),
  aparecer_criatura: z.object({
    nombre: z.string().describe("Nombre de la criatura (del bestiario o nueva) o alias de esta instancia, p. ej. \"Ogro tuerto\""),
    plantilla: z.string().optional().describe("Criatura del bestiario en la que se basa (si el nombre es un alias)"),
    definicion: criatura.optional().describe("Para criaturas nuevas inventadas por ti"),
    repetir: z.boolean().optional().describe("Solo si la trama exige otra vez el mismo tipo de enemigo tras dos encuentros seguidos de su familia"),
  }),
  regente: z.object({
    accion: z.enum(["jugada", "relacion", "estado"]).describe("jugada: un regente mueve su política; relacion: fijas cómo están dos regentes; estado: consultas"),
    regente: z.string().optional().describe("El Juez Sin Ojos, Ysolde o La Madre de los Hambrientos"),
    tipo: z.enum(TIPOS_JUGADA).optional(),
    region: z.string().optional().describe("Dónde incide (región del mapa)"),
    objetivo: z.string().optional().describe("Contra o con quién: otro regente, facción, PNJ o lugar"),
    detalle: z.string().optional().describe("Qué hace en concreto, con agentes y medios"),
    con: z.string().optional().describe("Para relacion: el otro regente"),
    valor: z.number().int().min(-3).max(3).optional().describe("Para relacion: -3 guerra … +3 alianza"),
    motivo: z.string().optional(),
  }),
  accion_combate: z.object({
    quien: z.string(),
    accion: z.enum(ACCIONES),
    objetivo: z.string().optional().describe("ayudar: a quién ayuda"),
    contra: z.string().optional().describe("ayudar: contra quién (opcional)"),
    disparador: z.string().optional().describe("preparar: «cuando…»"),
    detalle: z.string().optional().describe("preparar: qué hará; otras: descripción"),
  }),
  reaccion: z.object({
    quien: z.string(),
    tipo: z.enum(["ataque_oportunidad", "preparada", "otra"]),
    objetivo: z.string().optional().describe("Contra quién ataca"),
    arma: z.string().optional(),
    dano: z.string().optional().describe("Daño del ataque, p. ej. 1d8+3: si se da, el ataque se resuelve aquí mismo"),
    detalle: z.string().optional(),
  }),
  maniobra: z.object({
    atacante: z.string(),
    objetivo: z.string(),
    tipo: z.enum(["agarrar", "empujar", "escapar"]),
    efecto: z.enum(["derribar", "alejar"]).optional().describe("empujar: derribarlo o apartarlo 1,5 m"),
    bono_atacante: z.number().int().optional().describe("Atletismo total del atacante (obligatorio solo para PNJ sin datos)"),
    bono_objetivo: z.number().int().optional().describe("Atletismo/Acrobacias total del objetivo (obligatorio solo para PNJ sin datos)"),
    ventaja: z.boolean().optional(),
    desventaja: z.boolean().optional(),
  }),
  concurso_compania: z.object({
    puesto: z.enum(["Hugin", "Munin"]).describe("El puesto de mariscal que se disputa (primero Hugin, cuatro años después Munin)"),
    candidatos: z.array(z.object({
      nombre: z.string(),
      hazanas: z.number().min(0).max(10).optional().describe("0-10; en un PJ se calcula de su fama"),
      clamor: z.number().min(0).max(10).optional().describe("Votos de la tropa 0-10; en un PJ, si falta, se tira"),
      combate: z.number().min(0).max(10).describe("Resultado del combate de prueba, 0-10 (llévalo con atacar)"),
      decision: z.number().min(0).max(10).describe("Decisión de los mariscales, 0-10"),
    })).min(1),
    aplicar: z.boolean().optional().describe("true para dejar al ganador (si es PJ) como mariscal en su ficha"),
  }),
  hazana: z.object({
    quienes: z.array(z.string()).min(1).describe("Los personajes que la hicieron"),
    descripcion: z.string().describe("Qué hicieron y qué cambió (concreto)"),
    magnitud: z.number().int().min(1).max(5).describe("1 la cuenta el pueblo · 2 la región · 3 el reino · 4 ÉPICA (jefe, ejército, ciudad) · 5 cambia el reino (matar a un regente, romper una maldición del mundo). Sé muy tacaño"),
    tono: z.enum(["gloria", "infamia"]),
  }),
  coronar_leyenda: z.object({
    quien: z.string(),
    titulo: z.string().describe("El título por el que se le conocerá"),
    tono: z.enum(["gloria", "infamia", "ambigua"]),
    razon: z.string().describe("Las hazañas que lo justifican, en una frase"),
    atributo: z.enum(["fue", "des", "con", "int", "sab", "car"]).describe("Característica que sube +2 (máx. 22)"),
  }),
  usar_recurso: z.object({
    quien: z.string(),
    recurso: z.string().optional().describe("Segundo aliento, Acción súbita… (omítelo con accion ver para listar)"),
    accion: z.enum(["usar", "ver", "terminar"]).optional().describe("terminar: acaba la furia en curso"),
  }),
  descanso: z.object({
    tipo: z.enum(["corto", "largo"]).describe("corto: 1 hora; largo: 8 horas"),
    quienes: z.array(z.string()).optional().describe("Por defecto, todo el grupo"),
  }),
  caida: z.object({
    quien: z.string(),
    metros: z.number().min(1).max(500),
    blando: z.boolean().optional().describe("Cae sobre agua, paja, nieve…: un dado de daño menos"),
  }),
  experiencia: z.object({
    accion: z.enum(["dar", "por_criatura", "ver"]),
    px: z.number().int().min(1).max(100000).optional().describe("PX totales a repartir (accion dar)"),
    peligro: z.number().int().min(1).max(5).optional().describe("por_criatura: peligro de lo derrotado"),
    cantidad: z.number().int().min(1).max(50).optional().describe("por_criatura: cuántas"),
    motivo: z.string().optional(),
    quienes: z.array(z.string()).optional().describe("Por defecto, todo el grupo"),
  }),
  subir_nivel: z.object({
    quien: z.string(),
    pv: z.enum(["promedio", "tirar"]).describe("Cómo se calculan los PV ganados"),
    aumento: z.record(z.string(), z.number().int()).optional().describe("Solo en los niveles 4, 8, 12, 16 y 19: {fue: 2} o {des: 1, con: 1}"),
    por_hito: z.boolean().optional().describe("Sube sin los PX, por un hito de la historia"),
  }),
  salvacion_muerte: z.object({ quien: z.string().describe("Personaje a 0 PV que tira la salvación") }),
  estabilizar: z.object({
    objetivo: z.string().describe("Personaje a 0 PV"),
    quien: z.string().describe("Personaje que intenta estabilizarlo"),
    automatico: z.boolean().optional().describe("true si un objeto o un hechizo lo estabiliza sin tirada"),
  }),
  condicion: z.object({
    objetivo: z.string().describe("Personaje, criatura en escena o PNJ del combate"),
    accion: z.enum(["aplicar", "quitar", "ver"]),
    condicion: z.string().optional().describe("cegado, hechizado, ensordecido, asustado, agarrado, incapacitado, invisible, paralizado, petrificado, envenenado, derribado, retenido, aturdido, inconsciente o agotamiento"),
    nota: z.string().optional().describe("Duración o causa, p. ej. «1 minuto»"),
    nivel: z.number().int().min(1).max(6).optional().describe("Solo para agotamiento: el nivel (por defecto, +1)"),
  }),
  encuentro: z.object({
    jefe: z.string().optional().describe('"azar" o el nombre de un jefe (Kuru, Vaerth, Ilvara, Vaskar, El Juez, Ysolde, La Madre de los Hambrientos): fuerza que la causa sea un jefe fuera de su zona; sirve para que una misión sea consecuencia de su plan'),
    sin_jefe: z.boolean().optional().describe("Impide que salga un jefe"),
    mision: z.string().optional().describe("La misión en curso: si sale un jefe, se explica cómo su plan la provocó"),
    tipo: z.enum(["combate", "peligro", "social", "hallazgo"]).optional().describe("Restringe el tipo; por defecto, cualquiera"),
    dificultad: z.enum(["facil", "media", "dificil", "mortal"]).optional().describe("Cuántos y cuán fuertes (por defecto media)"),
    region: z.string().optional().describe("Por defecto, la región donde está el grupo"),
    excluir: z.array(z.string()).optional().describe("Familias que no pueden salir: no-muertos, fauna, monstruos, humanos, inquisicion, culto, corte_palida, entorno, social, hallazgo"),
  }),
  danar_criatura: z.object({
    nombre: z.string(),
    cantidad: z.number().int().describe("Daño final tras resistencias; negativo para curarla o regenerar"),
  }),
  habilidad_criatura: z.object({
    criatura: z.string().describe("Nombre de la criatura en escena"),
    habilidad: z.string().optional().describe("Nombre de una de sus habilidades registradas"),
    habilidad_nueva: habilidad.optional().describe("Habilidad improvisada que no está en su ficha"),
    objetivos: z.array(z.string()).min(1).describe("Personajes jugadores afectados"),
  }),
  presagio_criatura: z.object({
    criatura: z.string(),
    accion: z.enum(["ver", "usar", "renovar"]).describe("usar: sustituye una tirada por un presagio; renovar: al inicio de su ronda"),
    valor: z.number().int().min(1).max(20).optional().describe("Con usar: el presagio que impone"),
  }),
  behelit: z.object({
    accion: z.enum(["despertar", "aceptar", "rechazar", "crear_carmesi"]),
    portador: z.string().optional().describe("Personaje jugador que tiene el behelit"),
    portador_pnj: z
      .object({ nombre: z.string(), bono: z.number().int().optional().describe("Bonificador de SAB para rechazar") })
      .optional()
      .describe("Si el behelit lo tiene un PNJ"),
    carmesi: z.boolean().optional().describe("despertar: true si es el Behelit Carmesí"),
    razones: z.array(z.enum(RAZONES)).optional().describe("despertar: motivos de desesperación reales en la ficción"),
    ambicion: z.string().optional().describe("despertar del carmesí: la ambición del portador"),
    sacrificados: z
      .array(
        z.object({
          nombre: z.string().describe("Personaje jugador o PNJ"),
          circunstancias: z
            .array(z.enum(Object.keys(CIRCUNSTANCIAS) as [Circunstancia, ...Circunstancia[]]))
            .optional()
            .describe("Lo que hizo o tuvo a su favor durante el ritual"),
          bono_pnj: z.number().int().optional().describe("Solo PNJ: bonificador para sobrevivir"),
        }),
      )
      .optional()
      .describe("aceptar: lo que se sacrifica (para un jugador, sus compañeros)"),
    destinado: z.string().optional().describe("crear_carmesi: fija el destinado (si no, lo decide el azar en secreto)"),
  }),
  lanzar_hechizo: z.object({
    lanzador: z.string().describe("Personaje jugador que lanza"),
    hechizo: z.string().optional().describe("Hechizo de la lista de referencia que conoce"),
    hechizo_nuevo: z
      .object({
        nombre: z.string(),
        escuela: z.enum(ESCUELAS),
        circulo: z.number().int().min(0).max(5),
        tributo: z.enum(TRIBUTOS).optional(),
        efecto: z.string(),
        dados: z.string().optional(),
        salvacion: z.string().optional(),
      })
      .optional()
      .describe("Hechizo improvisado (−2 a lanzarlo si no lo conoce)"),
    circulo: z.number().int().min(0).max(5).optional().describe("Lanzarlo en un círculo más alto: más efecto, más precio"),
    catalizador: z.string().optional().describe("Catalizador del inventario que absorbe el precio"),
    forzar: z.boolean().optional().describe("Lanzar un círculo por encima de su maestría (CD +5, precio doble)"),
    objetivo: z.string().optional().describe("Personaje jugador al que cura o cierra heridas"),
    herida: z.string().optional().describe("Herida concreta del objetivo, p. ej. H2"),
  }),
  ubicacion: z.object({
    lugar: z.string().describe("Dónde está el grupo ahora (o de dónde parte si viaja). Reutiliza el mismo nombre para el mismo sitio"),
    region: z.enum(NOMBRES_REGIONES).optional().describe("Región, si el lugar es nuevo"),
    cerca_de: z.string().optional().describe("Lugar conocido junto al que está, si es nuevo"),
    direccion: z.enum(DIRECCIONES).optional().describe("Hacia dónde queda respecto a cerca_de (o al centro de su región): N, NE, E, SE, S, SO, O, NO. El norte es ARRIBA del mapa. Si el lugar ya existe y estaba mal colocado, se recoloca"),
    distancia: z.enum(Object.keys(DISTANCIAS) as [keyof typeof DISTANCIAS, ...(keyof typeof DISTANCIAS)[]]).optional().describe("pegado, cerca, lejos o muy_lejos (por defecto cerca)"),
    tipo: z.enum(TIPOS_LUGAR).optional(),
    descripcion: z.string().optional().describe("Una línea para el mapa"),
    viajando_hacia: z.string().optional().describe("Destino, si están de viaje; omítelo al llegar"),
    destino_region: z.enum(NOMBRES_REGIONES).optional(),
    destino_cerca_de: z.string().optional(),
    destino_direccion: z.enum(DIRECCIONES).optional().describe("Rumbo del destino respecto a destino_cerca_de o al lugar de partida"),
    destino_distancia: z.enum(Object.keys(DISTANCIAS) as [keyof typeof DISTANCIAS, ...(keyof typeof DISTANCIAS)[]]).optional(),
    destino_tipo: z.enum(TIPOS_LUGAR).optional(),
    progreso: z.number().min(0).max(1).optional().describe("Parte del viaje recorrida, de 0 a 1"),
  }),
  iniciativa: z.object({
    participantes: z.array(z.string()).describe("Nombres de los PJ y de las criaturas en escena que luchan"),
    pnj: z
      .array(
        z.object({
          nombre: z.string(),
          bono_ataque: z.number().int().describe("Bonificador de ataque base (sin veteranía)"),
          ca: z.number().int(),
          des: z.number().int().optional().describe("Destreza (10 por defecto)"),
          aliado: z.boolean().optional().describe("true si lucha del lado de los jugadores"),
          veterania: z.enum(VETERANIAS).optional().describe("Por defecto curtido"),
          temple: z.enum(NOMBRES_TEMPLES).optional().describe("Su raza o naturaleza"),
          sab: z.number().int().optional().describe("Sabiduría (10 por defecto): para notar emboscadas y leer planes"),
          pv: z.number().int().min(1).optional().describe("Si lo das, el programa lleva sus PV"),
          armadura: z.array(z.enum(NOMBRES_PIEZAS)).optional(),
          personalidad: z.array(z.enum(NOMBRES_PERSONALIDADES)).max(2).optional(),
        }),
      )
      .optional()
      .describe("PNJ sin ficha que luchan (aliados o enemigos): un capitán, unos bandidos…"),
    sumar: z.boolean().optional().describe("true para añadir refuerzos o recién llegados a un combate EN CURSO sin reiniciarlo: solo tiran su iniciativa y entran en el orden"),
    tactica: z
      .object({
        bando: z.array(z.string()).min(1).describe("Quienes tienden la emboscada o siguen el plan (participantes); los demás son sus rivales"),
        emboscada: z.boolean().optional().describe("Atacan sin ser vistos: se tira sigilo contra la percepción de cada rival"),
        plan: z.enum(Object.keys(PLANES) as [string, ...string[]]).optional().describe("Calidad del plan según lo preparado: improvisado, bueno o brillante"),
        alerta: z.enum(Object.keys(ALERTAS) as [string, ...string[]]).optional().describe("Estado de los rivales: dormidos, distraidos, normal o en_guardia"),
      })
      .optional()
      .describe("Emboscadas y planes que dan ventaja a un bando"),
  }),
  atacar: z.object({
    atacante: z.string().describe("PJ, criatura en escena o PNJ registrado en la iniciativa"),
    objetivo: z.string(),
    arma: z.string().optional().describe("Arma o ataque usado (en criaturas, el nombre del ataque de su ficha)"),
    dano: z.string().optional().describe('Daño con el modificador ya sumado, p. ej. "1d8+3" o "2d6+4+1d6"; si lo pasas, se aplica solo'),
    a_distancia: z.boolean().optional(),
    atributo: z.enum(["fue", "des", "car", "sab", "int"]).optional().describe("Solo PJ: por defecto el mejor de FUE/DES (DES a distancia)"),
    bono_arma: z.number().int().optional().describe("Bonificador mágico o de calidad del arma"),
    cobertura: z.enum(["media", "tres_cuartos", "total"]).optional().describe("Cobertura del objetivo: +2 CA, +5 CA o no se le puede atacar"),
    bono: z.number().int().optional().describe("Criaturas y PNJ: sustituye su bonificador base"),
    ventaja: z.boolean().optional(),
    desventaja: z.boolean().optional(),
    ca: z.number().int().optional().describe("Sustituye la CA del objetivo (cobertura, escudo alzado…)"),
    tipo_dano: z.enum(TIPOS_DANO).optional().describe("corte, punta o contundente, si el arma no se reconoce por su nombre"),
    apuntar: z.enum([...UBICACIONES, "hueco"]).optional().describe('Región a la que apunta (−2; cabeza o cuello −4) o "hueco": las juntas de la armadura, con daga o estoque'),
  }),
  pnj: z.object({
    nombre: z.string(),
    rol: z.string().optional().describe("Quién es: posadera de El Cuervo Cojo, sargento de la Inquisición…"),
    voz: z.string().optional().describe("Cómo habla: registro, muletillas, ritmo, acento, lo que nunca diría. Obligatoria la primera vez"),
    quiere: z.string().optional().describe("Lo que quiere y lo que teme"),
    actitud: z.string().optional().describe("Actitud hacia el grupo ahora mismo; cámbiala según cómo lo traten"),
    en_escena: z.boolean().optional(),
    agenda: z.string().optional().describe("Qué hace y hacia dónde va cuando los protagonistas no lo ven (no se queda parado: persigue lo que quiere). Actualízala cuando avance"),
    arco: z.string().optional().describe("Nombre del arco abierto en el que incide"),
    dijo: z.string().optional().describe("Lo importante que ha revelado, prometido o mentido en este turno (resumen corto)"),
    estado: z.string().optional().describe("Cómo está ahora: vivo, herido, muerto, capturado, huido, traidor… Cámbialo cuando cambie"),
  }),
  trama: z.object({
    objetivo: z.string().optional().describe("Objetivo actual del grupo, en una frase CLARA y concreta: qué lograr, con quién o dónde, por qué importa y qué pasa si falla. Los jugadores lo ven siempre en la página"),
    proximo_paso: z.string().optional().describe("Lo siguiente concreto que el grupo puede hacer ahora (a quién ver, adónde ir, qué hacer). Se ve siempre en la página"),
    revelar_pista: z.string().optional().describe("Algo que los jugadores acaban de descubrir"),
    retirar_pista: z.string().optional().describe("Un trozo del texto de una pista que resultó falsa o que ya no vale; se borra (si hay una versión corregida, pásala en revelar_pista)"),
    abrir_arco: z.string().optional().describe("Nombre de un arco nuevo (empieza en INICIO; como mucho 3 abiertos). Requiere premisa"),
    premisa: z.string().optional().describe("El principio del arco: de qué va, quién interviene y qué se juega"),
    final_previsto: z.string().optional().describe("Hacia dónde apunta el final del arco (puede cambiar)"),
    avanzar_arco: z.string().optional().describe("Arco que pasa a su siguiente tiempo (requiere fase y hito)"),
    fase: z.enum(["nudo", "desenlace"]).optional().describe("Fase a la que pasa el arco"),
    hito: z.string().optional().describe("Qué ha pasado para que el arco avance: la complicación, el giro, la decisión"),
    cerrar_arco: z.string().optional().describe("Arco que termina (requiere desenlace)"),
    desenlace: z.string().optional().describe("Cómo acaba el arco: qué se consiguió, qué costó, qué cambia"),
    abrir_hilo: z.string().optional().describe("(Antiguo) igual que abrir_arco, con el texto como premisa"),
    cerrar_hilo: z.string().optional().describe("(Antiguo) igual que cerrar_arco"),
    resolucion: z.string().optional().describe("(Antiguo) igual que desenlace"),
    amenaza: z.string().optional().describe("Fija una amenaza nueva (lo que pasará si no actúan); reinicia su reloj"),
    avanzar_amenaza: z.number().int().min(1).max(6).optional().describe("Pasos que avanza el reloj de la amenaza (a 6 golpea)"),
  }),
  plano: z.object({
    escena: z.string().optional().describe("Nombre de la escena (un sitio concreto). Si cambia, el plano se reinicia"),
    poner: z
      .array(
        z.object({
          nombre: z.string().describe("Personaje, PNJ, criatura o cosa (el fuego, el carro, la puerta norte…)"),
          tipo: z.enum(["pj", "pnj", "cosa"]).optional().describe("Se deduce del nombre; fíjalo si no"),
          ref: z.string().optional().describe("Punto ya colocado respecto al que se sitúa (omítelo solo para el primero)"),
          direccion: z.enum(DIRECCIONES).optional().describe("Rumbo respecto a ref: el norte es ARRIBA"),
          metros: z.number().min(0.5).max(500).optional(),
          nota: z.string().optional().describe("Una nota corta: «arde», «mirando al sur»…"),
        }),
      )
      .optional()
      .describe("Coloca (o recoloca) puntos"),
    mover: z
      .array(
        z.object({
          nombre: z.string(),
          direccion: z.enum(DIRECCIONES).optional(),
          hacia: z.string().optional().describe("Avanza hacia este punto"),
          de: z.string().optional().describe("Se aleja de este punto"),
          metros: z.number().min(0.5).max(500),
        }),
      )
      .optional()
      .describe("Mueve a quien se desplaza (llámalo ANTES de narrar el movimiento)"),
    quitar: z.array(z.string()).optional().describe("Puntos que ya no importan"),
  }),
  tiempo: z.object({
    fijar: z.object({ dia: z.number().int().min(1).optional(), hora: z.number().int().min(0).max(23), minuto: z.number().int().min(0).max(59).optional() }).optional().describe("Pon el reloj en una hora (la primera vez, al empezar; luego solo hacia delante)"),
    avanzar: z.object({ segundos: z.number().int().min(1).optional(), minutos: z.number().int().min(1).optional(), horas: z.number().int().min(1).optional(), dias: z.number().int().min(1).optional() }).optional().describe("Cuánto pasa en este turno según lo que dura lo hecho"),
    motivo: z.string().optional().describe("Qué ha pasado en ese tiempo, en pocas palabras"),
  }),
  prueba: z.object({
    quien: z.string().describe("Personaje (o PNJ) que hace la prueba"),
    habilidad: z.enum(NOMBRES_HABILIDADES).optional().describe("Habilidad: su característica es la que cuenta. Omítela en una prueba pura de característica o una salvación"),
    atributo: z.enum(ATRIBUTOS).optional().describe("Obligatorio en salvaciones y pruebas puras. Si lo pasas junto a una habilidad y no es la suya, la herramienta rechaza la tirada"),
    tipo: z.enum(["habilidad", "salvacion"]).optional().describe("salvacion para una salvación (suma la competencia de salvación de su clase)"),
    cd: z.number().int().min(1).max(35),
    competente: z.boolean().optional().describe("Fuerza la competencia en la habilidad si su trasfondo la justifica (true) o la quita (false); por defecto, la de su clase"),
    ventaja: z.boolean().optional(),
    desventaja: z.boolean().optional(),
    bono: z.number().int().optional().describe("PNJ: su bonificador total. PJ: ajuste por situación (herramientas…)"),
    cobertura: z.enum(["media", "tres_cuartos"]).optional().describe("Salvación de DES a cubierto: +2 o +5"),
    conoce_su_nombre: z.boolean().optional().describe("Una leyenda: quien la oye conoce su nombre (ventaja en Persuasión si es de gloria, Intimidación si es de infamia)"),
    motivo: z.string().describe("Qué intenta, en pocas palabras"),
  }),
  siguiente_asalto: z.object({}),
  terminar_combate: z.object({}),
  anotar_mundo: z.object({
    nota: z.string().optional().describe("Hecho importante de la campaña, tal y como es AHORA: PNJ, misión, lugar, deuda, promesa…"),
    reemplaza: z.string().optional().describe("Un trozo del texto de una nota anterior que este hecho sustituye porque algo cambió (así no quedan dos versiones). Requiere nota"),
    olvidar: z.string().optional().describe("Un trozo del texto de una nota que ya no es cierta y debe borrarse"),
  }),
};

type Nombre = keyof typeof esquemas;

const descripciones: Record<Nombre, string> = {
  pnj: "Registra o actualiza un PNJ con nombre: su voz, lo que quiere, su actitud, su agenda (qué hace cuando no lo ven) y lo que ya ha dicho, para que hable siempre como él, no se repita y no se quede parado.",
  trama:
    "Lleva la trama en arcos con inicio, nudo y desenlace (abrir_arco, avanzar_arco, cerrar_arco; como mucho 3 abiertos), el objetivo, las pistas reveladas y el reloj de la amenaza. Úsala cada vez que la historia avance.",
  iniciativa:
    "Empieza un combate: tira la iniciativa de PJ, criaturas y PNJ con su destreza, veteranía, raza, clase y carácter, y resuelve emboscadas (sorpresa) y planes. Actuar antes que el rival calma los nervios de los novatos.",
  atacar:
    "Resuelve un ataque con armas de cualquiera (PJ, criatura o PNJ): bonificador por atributo, competencia, veteranía, raza y clase; torpezas, roces de los veteranos y críticos; tira y aplica el daño.",
  siguiente_asalto: "Empieza el siguiente asalto del combate (la sorpresa y el plan solo valen en el primero).",
  terminar_combate: "Cierra el combate en curso (borra el orden de iniciativa y los PNJ sin ficha).",
  tirar_dados:
    "Tira dados de verdad. Úsala SIEMPRE que haya que tirar (ataques, daño, salvaciones, pruebas, iniciativa, " +
    "tablas aleatorias). Nunca inventes un resultado de dados.",
  guardar_personaje:
    "Crea o reemplaza la ficha completa de un personaje jugador. Úsala al terminar la creación de personaje.",
  modificar_personaje:
    "Aplica cambios a la ficha de un personaje: daño/curación, oro, objetos, condiciones, subida de nivel.",
  infligir_herida:
    "Causa una herida física real a un personaje jugador (críticos recibidos, golpes masivos, caer a 0 PV, accidentes). " +
    "El programa tira gravedad y ubicación y aplica efectos, hemorragia y Podre.",
  tratar_herida:
    "Intenta tratar una herida: detener hemorragia, medicina/cirugía, cauterizar, magia divina o remedio raro. El programa tira y aplica el resultado.",
  pasar_tiempo:
    "Hace avanzar días: convalecencia, infecciones, agravamientos, recuperación de PV y secuelas al cerrar las heridas. También mueve el reloj del mundo 24 h por día: no avances el tiempo otra vez con tiempo por lo mismo, y cuida los plazos de la trama.",
  avanzar_asaltos:
    "Hace avanzar las hemorragias asalto a asalto: PV perdidos y riesgo creciente de perder FUE por anemia. Llámala al final de cada asalto si alguien sangra.",
  usar_vial:
    "Usa un vial (Sangre de Santo, Ceniza Viva, Hiel de Víbora Gris, Leche de Amapola Negra). El programa aplica efectos y riesgos y lo descuenta del inventario del portador.",
  generar_botin:
    "Genera equipo y viales al azar según el origen (compra, saqueo, hallazgo, jefe), con calidades normales, encantadas, malditas o reliquias.",
  crear_objeto: "Registra un objeto único inventado por ti (con su verdad oculta si está maldito).",
  examinar_objeto: "Consulta la verdad de un objeto registrado; con revelar=true, los jugadores la descubren.",
  aparecer_criatura:
    "Pone en escena una criatura peligrosa (del bestiario, basada en una plantilla o inventada con definicion) y lleva sus PV.",
  danar_criatura: "Aplica daño (o curación) a una criatura en escena.",
  habilidad_criatura:
    "Resuelve una habilidad especial de una criatura (registrada o improvisada): salvaciones reales, daño, condiciones, heridas, anemia y muerte instantánea.",
  presagio_criatura:
    "Para criaturas que ven el futuro: consulta sus presagios, impón uno en lugar de una tirada (de un jugador o suya) o renueva uno al inicio de su ronda.",
  behelit:
    "Behelits: crear el Behelit Carmesí (único), intentar despertarlos en la desesperación y resolver la oferta del Coro (aceptar o rechazar).",
  lanzar_hechizo:
    "Lanza un hechizo de un personaje jugador: tirada de lanzamiento, efecto y el precio que paga (calor, aliento, sangre, cordura o años), con catalizadores. «objetivo» es solo un personaje jugador al que cura. NO aplica daño a enemigos: el daño del hechizo lo aplicas tú después con danar_criatura (criaturas) o atacar/daño de PNJ.",
  ubicacion:
    "Mueve al grupo en el mapa que ven los jugadores: el lugar donde están, o el viaje en curso con su destino y progreso (de 0 a 1). Un lugar nuevo se crea y el grupo se coloca ahí al instante: si solo quieres anotarlo, vuelve a llamar con el lugar donde siguen. Crea los lugares nuevos con su direccion (el norte es arriba del mapa); con direccion recoloca uno mal puesto.",
  encuentro:
    "Tira un encuentro aleatorio de verdad (tabla por región, hora, nivel y dificultad) que evita repetir lo reciente: enemigos de varias familias, peligros, escenas sociales y hallazgos. Úsalo siempre que necesites un encuentro que no esté ya decidido por la historia.",
  regente:
    "Política de los regentes (Juez Sin Ojos, Ysolde, Madre de los Hambrientos) en segundo plano: comprar voluntades, espías, sabotajes, chantaje, propaganda, emisarios, alianzas y traiciones; y la relación entre ellos, que cambia por conveniencia y situación.",
  accion_combate:
    "Acción de combate que no es un ataque: esquivar, correr, retirarse (evita ataques de oportunidad), ayudar a un aliado (ventaja), preparar una acción, esconderse o usar un objeto. El programa recuerda sus efectos.",
  reaccion:
    "Gasta la reacción de un combatiente (una por asalto): ataque de oportunidad contra quien sale de su alcance, o ejecutar una acción preparada.",
  maniobra:
    "Agarrar, empujar (derribar o apartar) o escapar de un agarre: prueba enfrentada de Atletismo contra Atletismo o Acrobacias. Sustituye a un ataque.",
  concurso_compania:
    "Puntúa el concurso de méritos de la Compañía del Cuervo Negro (hazañas, clamor de la tropa, combate de prueba y decisión de los mariscales, 0-10 cada uno; mínimo 24 de 40) y dice quién cede el puesto a quién.",
  hazana:
    "Anota una hazaña (una gesta concreta con su magnitud 1-5 y su tono, gloria o infamia) de uno o varios personajes: construye su fama. Sé muy tacaño con las magnitudes altas.",
  coronar_leyenda:
    "Convierte en LEYENDA a un personaje (nivel extra para cualquier clase o raza) si tiene nivel 5 y hazañas enormes: da título, fama, competencia +1, PV, +2 a una característica y el Aliento de leyenda. Muy difícil.",
  usar_recurso:
    "Gasta un uso de un rasgo de clase con usos limitados (Segundo aliento y Acción súbita del Mercenario…) y aplica su efecto; con accion ver lista los usos que quedan.",
  descanso:
    "Descanso corto (1 h) o largo (8 h) del grupo: recuperan los usos de los rasgos de clase y bajan el calor y el aliento. No curan heridas ni PV.",
  caida:
    "Una caída desde cierta altura: 1d6 de daño contundente por cada 3 m (máx. 20d6), derriba y puede herir.",
  experiencia:
    "Reparte puntos de experiencia al grupo (a partes iguales) por un combate, un desafío o un hito, o consulta cuántos lleva cada uno.",
  subir_nivel:
    "Sube de nivel a un personaje que ya tiene los PX (o por hito): suma PV, competencia, rasgos de clase y, en los niveles 4, 8, 12, 16 y 19, un aumento de característica.",
  salvacion_muerte:
    "Tira la salvación contra muerte de un personaje a 0 PV y lleva la cuenta de éxitos y fallos (3 éxitos: estable; 3 fallos: muerto; 1 natural: dos fallos; 20: se levanta con 1 PV).",
  estabilizar:
    "Un compañero intenta estabilizar a un personaje a 0 PV (prueba de Medicina CD 10): deja de hacer salvaciones contra muerte.",
  condicion:
    "Aplica, quita o consulta una condición (cegado, asustado, paralizado, derribado, envenenado, aturdido, inconsciente, agotamiento…) de un personaje, criatura o PNJ. El programa aplica sus efectos reales en ataques, salvaciones y pruebas.",
  plano:
    "Plano de la escena en metros (norte arriba): coloca y mueve a personajes, PNJ, criaturas y puntos de referencia (el fuego, el carro, la puerta). El programa calcula distancias y rumbos y te los devuelve como verdad espacial; los ataques cuerpo a cuerpo comprueban el alcance.",
  tiempo:
    "Reloj del mundo (día y hora): fíjalo al empezar y avánzalo cada turno según lo que dura la acción. Los asaltos y los días de reposo lo mueven solos.",
  prueba:
    "Prueba de habilidad, de característica o salvación de un personaje: aplica la característica correcta (rechaza la que no corresponde a la habilidad), la competencia de su clase y compara con la CD.",
  anotar_mundo:
    "Guarda un hecho importante de la campaña, o corrige uno anterior que ha cambiado (reemplaza) o que ya no es cierto (olvidar).",
};

export const herramientas: Anthropic.Beta.BetaTool[] = (Object.keys(esquemas) as Nombre[]).map((nombre) => {
  const { $schema: _ignorado, ...schema } = z.toJSONSchema(esquemas[nombre]) as Record<string, unknown>;
  return {
    name: nombre,
    description: descripciones[nombre],
    input_schema: schema as Anthropic.Beta.BetaTool.InputSchema,
    // Con streaming, los argumentos llegan a medida que se generan; por eso
    // los validamos nosotros con zod antes de ejecutar.
    eager_input_streaming: true,
  };
});

export interface Resultado {
  contenido: string;
  /** Lo que se le muestra al jugador en pantalla (null = nada). */
  aviso: string | null;
  error?: boolean;
}

function buscar(partida: Partida, nombre: string): Personaje {
  const p =
    partida.personajes[nombre] ??
    Object.values(partida.personajes).find((x) => x.nombre.toLowerCase() === nombre.toLowerCase());
  if (!p) {
    const hay = Object.keys(partida.personajes).join(", ") || "ninguno";
    throw new Error(`No existe el personaje "${nombre}". Personajes: ${hay}`);
  }
  return p;
}

function enEscena(partida: Partida, nombre: string): EstadoJefe {
  const n = nombre.toLowerCase();
  const todos = Object.values(partida.jefes);
  const j = partida.jefes[nombre] ?? todos.find((x) => x.nombre.toLowerCase() === n) ?? todos.find((x) => x.nombre.toLowerCase().includes(n));
  if (!j) throw new Error(`${nombre} no está en escena. En escena: ${Object.keys(partida.jefes).join(", ") || "nadie"}`);
  return j;
}

/** Un ataque completo: comprueba el alcance real en el plano, lo resuelve y, si la criatura cae, la retira de escena. */
function ataqueCompleto(partida: Partida, e: DatosAtaque): { texto: string; aviso: string } {
  // Con los dos en el plano, el alcance es real: cuerpo a cuerpo (2 m, 3 m con asta) o a distancia (hasta 120 m).
  const dist = e.reaccion ? null : distanciaPlano(partida, e.atacante, e.objetivo); // el ataque de oportunidad se hace justo al salir del alcance
  if (dist) {
    const asta = /alabarda|guada|lanza|pica|jabalina larga|estacas?/i.test(e.arma ?? "");
    const alcance = e.a_distancia ? 120 : asta ? 3 : 2;
    if (dist.metros > alcance)
      throw new Error(`${dist.a} está a ${dist.metros} m al ${NOMBRES_DIR[dist.dir]} de ${dist.de}: ${e.a_distancia ? "fuera del alcance de ese ataque" : `fuera de alcance cuerpo a cuerpo (${alcance} m)`}. Muévelo antes con plano (mover hacia) o elige otro ataque.`);
  }
  // En trance de furia (nivel 1-2) el berserker no distingue aliados de enemigos.
  let aviso0 = "";
  if (!e.reaccion) {
    const red = redirigirTrance(partida, e.atacante, e.objetivo);
    if (red.aviso) { e = { ...e, objetivo: red.objetivo }; aviso0 = red.aviso; }
  }
  const r = atacar(partida, e);
  if (aviso0) {
    r.texto = `${aviso0}\n${r.texto}`;
    r.aviso = `${aviso0}\n${r.aviso}`;
    // Herir en trance a un compañero deja marcas de Ceniza: en su piel y en la de quien lo hirió.
    const victima = Object.values(partida.personajes).find((x) => x.nombre.toLowerCase() === e.objetivo.toLowerCase());
    const atacante = Object.values(partida.personajes).find((x) => x.nombre.toLowerCase() === e.atacante.toLowerCase());
    if (victima && atacante && victima !== atacante && /IMPACTO|CRÍTICO/i.test(r.texto)) {
      victima.ceniza += 1;
      atacante.ceniza += 1;
      const marca = `🩶 Marca de Ceniza: el golpe en trance deja ceniza en la piel de ${victima.nombre} (${victima.ceniza}) y en la de ${atacante.nombre} (${atacante.ceniza}).`;
      r.texto += `\n${marca}`;
      r.aviso += `\n${marca}`;
    }
  }
  if (r.muerto) {
    const devueltos = retirarCaido(partida, enEscena(partida, r.muerto));
    if (devueltos.length) {
      r.texto += `\nAl morir, lo robado vuelve a sus dueños:\n${devueltos.join("\n")}`;
      r.aviso += `\n${devueltos.join("\n")}`;
    }
  }
  return r;
}

export function ejecutar(nombre: string, entrada: unknown, partida: Partida): Resultado {
  // Quién estaba a 0 PV antes: tras la herramienta, quien cae a 0 se queda inconsciente y empieza sus salvaciones contra muerte.
  const antes = Object.fromEntries(Object.values(partida.personajes).map((p) => [p.nombre, { pv: p.pv, muerto: p.condiciones.includes("muerto") }]));
  const r = ejecutarInterno(nombre, entrada, partida);
  if (r.error || nombre === "salvacion_muerte") return r;
  const avisos = revisarCaidas(partida, antes);
  if (!avisos.length) return r;
  return { ...r, contenido: `${r.contenido}\n${avisos.join("\n")}`, aviso: [r.aviso, ...avisos.map((a) => a.split(/\.\s/)[0].replace(/\.?$/, "."))].filter(Boolean).join("\n") };
}

function ejecutarInterno(nombre: string, entrada: unknown, partida: Partida): Resultado {
  if (!(nombre in esquemas)) return { contenido: `Herramienta desconocida: ${nombre}`, aviso: null, error: true };
  const validado = esquemas[nombre as Nombre].safeParse(entrada);
  if (!validado.success) {
    return { contenido: `Argumentos no válidos: ${z.prettifyError(validado.error)}`, aviso: null, error: true };
  }

  try {
    switch (nombre as Nombre) {
      case "tirar_dados": {
        const e = validado.data as z.infer<typeof esquemas.tirar_dados>;
        if (pareceUnaPrueba(partida, e.expresion, e.motivo))
          throw new Error("Esto es una prueba de característica, habilidad o salvación de un personaje: hazla con la herramienta prueba (aplica su característica y competencia y comprueba que la habilidad corresponde). tirar_dados es para dados sueltos (daño, tablas, azar).");
        const t = tirar(e.expresion, e.modo ?? "normal");
        const linea = describir(t);
        const modo = e.modo && e.modo !== "normal" ? ` con ${e.modo}` : "";
        return {
          contenido: JSON.stringify({ ...t, motivo: e.motivo }),
          aviso: e.oculta ? "🎲 (el DM tira en secreto…)" : `🎲 ${e.motivo}${modo} → ${linea}`,
        };
      }
      case "guardar_personaje": {
        const e = validado.data as z.infer<typeof esquemas.guardar_personaje>;
        const previo = partida.personajes[e.nombre];
        let don = e.don_arcano ?? false;
        let tiradaDon = "";
        if (!previo?.magia && e.clase !== "Hechicero" && e.don_arcano === undefined) {
          const t = tirarDon(e.raza);
          don = t.don;
          tiradaDon = t.texto;
        }
        const p: Personaje = normalizar({
          ...e,
          pv: e.pv ?? (previo ? Math.min(previo.pv, e.pv_max) : e.pv_max), // volver a guardar una ficha no cura
          inventario: e.inventario ?? [],
          oro: e.oro ?? 0,
          condiciones: previo?.condiciones ?? [],
          px: previo?.px,
          rasgos: previo?.rasgos,
          muerte: previo?.muerte,
          notas: e.notas ?? "",
          heridas: partida.personajes[e.nombre]?.heridas ?? [],
          secuelas: partida.personajes[e.nombre]?.secuelas ?? [],
          ceniza: partida.personajes[e.nombre]?.ceniza ?? 0,
          anemia: partida.personajes[e.nombre]?.anemia ?? 0,
          sangrado: partida.personajes[e.nombre]?.sangrado ?? 0,
          anemia_progreso: partida.personajes[e.nombre]?.anemia_progreso ?? 0,
          dosis: partida.personajes[e.nombre]?.dosis ?? { curacion: 0, sueno: 0 },
          robado: partida.personajes[e.nombre]?.robado ?? {},
          magia: previo?.magia ?? magiaInicial(e.clase, e.escuelas_magia, don),
        });
        partida.personajes[p.nombre] = p;
        const don_txt = tiradaDon ? `\n${don ? "✨" : "·"} ${tiradaDon}${don ? " Nació con talento para la magia de su estilo: revélalo en la historia de forma memorable." + (e.clase === "Mercenario del Cuervo" ? " Pero es un Mercenario, la clase más corriente: su don dormirá hasta que suba de nivel." : "") : ""}` : "";
        return { contenido: `Ficha guardada:\n${fichaTexto(p)}${don_txt}`, aviso: `📜 Ficha guardada:\n${fichaTexto(p)}${don_txt}` };
      }
      case "modificar_personaje": {
        const e = validado.data as z.infer<typeof esquemas.modificar_personaje>;
        const p = buscar(partida, e.nombre);
        const cambios: string[] = [];
        if (e.pv_max !== undefined) p.pv_max = e.pv_max;
        if (e.nivel !== undefined) {
          p.nivel = e.nivel;
          cambios.push(`nivel ${p.nivel}`);
        }
        if (e.armadura !== undefined) {
          p.armadura = e.armadura;
          cambios.push(`armadura: ${e.armadura.join(", ") || "ninguna"}`);
        }
        if (e.veterania !== undefined) {
          p.veterania = e.veterania;
          cambios.push(`veteranía: ${p.veterania}`);
        }
        if (e.pv_cambio) {
          p.pv = Math.max(0, Math.min(p.pv_max, p.pv + e.pv_cambio));
          cambios.push(`${e.pv_cambio > 0 ? "+" : ""}${e.pv_cambio} PV (${p.pv}/${p.pv_max})`);
        }
        if (e.oro_cambio) {
          p.oro = Math.max(0, p.oro + e.oro_cambio);
          cambios.push(`${e.oro_cambio > 0 ? "+" : ""}${e.oro_cambio} oro`);
        }
        for (const o of e.agregar_objetos ?? []) {
          p.inventario.push(o);
          cambios.push(`+ ${o}`);
        }
        for (const o of e.quitar_objetos ?? []) {
          const i = p.inventario.findIndex((x) => x.toLowerCase() === o.toLowerCase());
          if (i >= 0) {
            p.inventario.splice(i, 1);
            cambios.push(`- ${o}`);
          }
        }
        for (const c of e.agregar_condiciones ?? []) agregarCondicion(p.condiciones, c);
        if (e.quitar_condiciones) p.condiciones = p.condiciones.filter((c) => !e.quitar_condiciones!.some((q) => c === q || mismaCondicion(c, q) || c.toLowerCase().startsWith(q.toLowerCase())));
        for (const x of e.agregar_secuelas ?? []) p.secuelas.push(x);
        if (e.quitar_secuelas) p.secuelas = p.secuelas.filter((x) => !e.quitar_secuelas!.includes(x));
        if (e.ceniza_cambio) {
          p.ceniza = Math.max(0, p.ceniza + e.ceniza_cambio);
          cambios.push(`Ceniza ${p.ceniza}`);
        }
        if (e.maestria) {
          if (p.magia.maestria === "profano" && e.maestria !== "profano") despertarMagia(p.clase, p.magia);
          p.magia.maestria = e.maestria;
          cambios.push(`maestría ${e.maestria}`);
        }
        for (const x of e.agregar_escuelas ?? []) if (!p.magia.escuelas.includes(x)) p.magia.escuelas.push(x);
        for (const x of e.agregar_hechizos ?? []) if (!p.magia.hechizos.includes(x)) {
          p.magia.hechizos.push(x);
          cambios.push(`aprende ${x}`);
        }
        if (e.notas !== undefined) p.notas = e.notas;
        if (p.pv === 0) cambios.push("¡a 0 PV! (inconsciente)");
        return {
          contenido: `Ficha actualizada:\n${fichaTexto(p)}`,
          aviso: cambios.length ? `✏️  ${p.nombre}: ${cambios.join(" · ")}` : null,
        };
      }
      case "infligir_herida": {
        const e = validado.data as z.infer<typeof esquemas.infligir_herida>;
        const texto = infligir(buscar(partida, e.nombre), e);
        return { contenido: texto, aviso: `🩸 ${texto}` };
      }
      case "tratar_herida": {
        const e = validado.data as z.infer<typeof esquemas.tratar_herida>;
        const p = buscar(partida, e.paciente);
        const h = p.heridas.find((x) => x.id.toLowerCase() === e.herida.toLowerCase());
        if (!h) {
          const hay = p.heridas.map((x) => x.id).join(", ") || "ninguna";
          throw new Error(`${p.nombre} no tiene la herida ${e.herida}. Heridas abiertas: ${hay}`);
        }
        const sanador = Object.values(partida.personajes).find((x) => x.nombre.toLowerCase() === e.sanador.toLowerCase());
        const texto = tratar(p, h, { ...e, sanador, nombre_sanador: e.sanador });
        return { contenido: `${texto}\n\nFicha actual:\n${fichaTexto(p)}`, aviso: `🩹 ${texto}` };
      }
      case "pasar_tiempo": {
        const e = validado.data as z.infer<typeof esquemas.pasar_tiempo>;
        const ps = e.personajes?.length ? e.personajes.map((n) => buscar(partida, n)) : Object.values(partida.personajes);
        const furias = terminarTodas(partida, "se apaga con el paso del tiempo");
        for (const p of ps) descansar(p, e.dias, e.calidad);
        avanzarSiHay(partida, e.dias * 86400);
        const texto = [...furias, ...ps.map((p) => `## ${p.nombre}\n${pasarTiempo(p, e.dias, e.calidad)}`)].join("\n\n");
        return { contenido: texto, aviso: `⏳ ${e.dias} día(s), ${e.calidad}\n${texto}` };
      }
      case "avanzar_asaltos": {
        const e = validado.data as z.infer<typeof esquemas.avanzar_asaltos>;
        const ps = e.personajes?.length
          ? e.personajes.map((n) => buscar(partida, n))
          : Object.values(partida.personajes).filter((p) => p.heridas.some((h) => h.sangrando || /costillas/.test(h.estructura ?? "")));
        for (const p of Object.values(partida.personajes)) enfriar(p, e.asaltos);
        avanzarSiHay(partida, e.asaltos * 6);
        if (!ps.length) return { contenido: "Nadie está sangrando.", aviso: null };
        const texto = ps.map((p) => avanzarAsaltos(p, e.asaltos, e.esfuerzo ?? true)).join("\n");
        return { contenido: texto, aviso: `🩸 ${texto}` };
      }
      case "usar_vial": {
        const e = validado.data as z.infer<typeof esquemas.usar_vial>;
        const port = e.portador ? buscar(partida, e.portador) : undefined;
        const i = port ? port.inventario.findIndex((x) => x.toLowerCase().includes(e.vial.toLowerCase())) : -1;
        if (port && i < 0) throw new Error(`${port.nombre} no lleva ${e.vial} en el inventario.`);
        const receptor = e.receptor ? buscar(partida, e.receptor) : undefined;
        const texto = usarVial({ ...e, receptor });
        if (port) port.inventario.splice(i, 1);
        return { contenido: texto + (receptor ? `\n\nFicha:\n${fichaTexto(receptor)}` : ""), aviso: `🧪 ${texto}` };
      }
      case "generar_botin": {
        const e = validado.data as z.infer<typeof esquemas.generar_botin>;
        const b = generarBotin(partida, e);
        return { contenido: b.dm, aviso: b.jugadores ? `💰 ${e.origen === "compra" ? "A la venta" : "Botín"}:\n${b.jugadores}` : null };
      }
      case "crear_objeto": {
        const e = validado.data as z.infer<typeof esquemas.crear_objeto>;
        const o = crearObjeto(partida, e);
        return { contenido: `Registrado ${o.nombre}: ${o.verdad}`, aviso: `✨ ${o.nombre}: ${o.apariencia}` };
      }
      case "examinar_objeto": {
        const e = validado.data as z.infer<typeof esquemas.examinar_objeto>;
        const o = partida.objetos[e.id.toUpperCase()];
        if (!o) throw new Error(`No hay ningún objeto ${e.id}.`);
        if (e.revelar) o.identificado = true;
        return {
          contenido: `${o.nombre} (${o.calidad}, ${o.precio} po). Verdad: ${o.verdad}. ${o.identificado ? "Los jugadores lo conocen." : "Los jugadores solo conocen: " + o.apariencia}`,
          aviso: e.revelar ? `🔍 ${o.nombre}: ${o.verdad}` : null,
        };
      }
      case "aparecer_criatura": {
        const e = validado.data as z.infer<typeof esquemas.aparecer_criatura>;
        const def: Criatura | undefined = e.definicion ?? buscarCriatura(e.plantilla ?? e.nombre);
        if (!def) throw new Error(`"${e.plantilla ?? e.nombre}" no está en el bestiario: pasa una definicion completa para crearla.`);
        const rep = !e.repetir && def.categoria !== "jefe" ? repetida(partida, def.nombre) : null;
        if (rep)
          throw new Error(`Llevas dos encuentros seguidos con enemigos de la familia «${rep}»: este sería el tercero. Varía: llama a encuentro (tira de verdad según región, hora y nivel y evita lo reciente). Si la trama exige repetir, vuelve a llamar con repetir=true.`);
        registrarEnemigo(partida, def.nombre);
        let texto = aparecer(partida, def, e.nombre);
        // Si ya hay un combate en marcha, la criatura tira su iniciativa y entra en el orden.
        if (partida.combate) {
          try { texto += "\n" + agregarAlCombate(partida, [e.nombre]); } catch { /* sin datos suficientes para tirar: lo hará el DM con iniciativa {sumar:true} */ }
        }
        return { contenido: texto, aviso: `⚠️  ${e.nombre}${def.categoria === "jefe" ? " (JEFE)" : ""}` };
      }
      case "danar_criatura": {
        const e = validado.data as z.infer<typeof esquemas.danar_criatura>;
        const j = enEscena(partida, e.nombre);
        let texto = danar(j, e.cantidad);
        let aviso = `⚔️  ${j.nombre}: ${estadoTexto(j)}`;
        if (j.pv <= 0) {
          const devueltos = retirarCaido(partida, j);
          if (devueltos.length) {
            texto += `\nAl morir, lo robado vuelve a sus dueños:\n${devueltos.join("\n")}`;
            aviso += `\n${devueltos.join("\n")}`;
          }
        }
        return { contenido: texto, aviso };
      }
      case "habilidad_criatura": {
        const e = validado.data as z.infer<typeof esquemas.habilidad_criatura>;
        const j = e.habilidad_nueva ? Object.values(partida.jefes).find((x) => x.nombre.toLowerCase().includes(e.criatura.toLowerCase())) : enEscena(partida, e.criatura);
        const h =
          e.habilidad_nueva ??
          j?.definicion.habilidades.find((x) => x.nombre.toLowerCase() === (e.habilidad ?? "").toLowerCase());
        if (!h) {
          const hay = j?.definicion.habilidades.map((x) => x.nombre).join(", ") || "ninguna registrada";
          throw new Error(`No encuentro esa habilidad. Habilidades de ${e.criatura}: ${hay}. Usa habilidad_nueva para improvisar.`);
        }
        const objetivos = e.objetivos.map((n) => buscar(partida, n));
        const texto = usarHabilidad(j, h, objetivos);
        return { contenido: texto, aviso: `💀 ${texto}` };
      }
      case "presagio_criatura": {
        const e = validado.data as z.infer<typeof esquemas.presagio_criatura>;
        const j = enEscena(partida, e.criatura);
        if (!j.definicion.presagios) throw new Error(`${j.nombre} no ve el futuro.`);
        const texto = presagio(j, e.accion, e.valor);
        return { contenido: texto, aviso: e.accion === "usar" && !texto.startsWith("No") ? `👁  ${texto}` : null };
      }
      case "behelit": {
        const e = validado.data as z.infer<typeof esquemas.behelit>;
        if (e.accion === "crear_carmesi") {
          // Los jugadores no se enteran: el DM lo introduce en la historia cuando toque.
          const r = crearCarmesi(partida, e.destinado);
          return { contenido: `${r.dm}\nDescripción para cuando lo encuentren: ${r.jugadores}`, aviso: null };
        }
        if (!e.portador && !e.portador_pnj) throw new Error("Falta el portador (portador o portador_pnj).");
        const portador = e.portador
          ? { nombre: buscar(partida, e.portador).nombre, pc: buscar(partida, e.portador) }
          : { nombre: e.portador_pnj!.nombre, bono: e.portador_pnj!.bono };
        if (e.accion === "despertar") {
          const r = despertar(partida, portador, e.carmesi ?? false, e.razones ?? [], e.ambicion);
          return { contenido: r.dm, aviso: `👁  ${r.jugadores}` };
        }
        if (e.accion === "aceptar") {
          const texto = aceptar(partida, portador, e.sacrificados ?? []);
          return { contenido: texto, aviso: `🌑 ${texto}` };
        }
        const texto = rechazar(partida, portador);
        return { contenido: texto, aviso: `👁  ${texto}` };
      }
      case "lanzar_hechizo": {
        const e = validado.data as z.infer<typeof esquemas.lanzar_hechizo>;
        const p = buscar(partida, e.lanzador);
        const objetivo = e.objetivo ? buscar(partida, e.objetivo) : undefined;
        const texto = lanzar(p, { ...e, objetivo });
        return { contenido: `${texto}\n\nFicha:\n${fichaTexto(p)}`, aviso: `✨ ${texto}` };
      }
      case "regente": {
        const e = validado.data as z.infer<typeof esquemas.regente>;
        return { contenido: actualizarRegentes(partida, e), aviso: null };
      }
      case "accion_combate": {
        const e = validado.data as z.infer<typeof esquemas.accion_combate>;
        const texto = accionCombate(partida, e);
        return { contenido: texto, aviso: null };
      }
      case "reaccion": {
        const e = validado.data as z.infer<typeof esquemas.reaccion>;
        const r = reaccion(partida, e, (d) => ataqueCompleto(partida, d));
        return { contenido: r.texto, aviso: r.aviso };
      }
      case "maniobra": {
        const e = validado.data as z.infer<typeof esquemas.maniobra>;
        const texto = maniobra(partida, e);
        return { contenido: texto, aviso: `🤼 ${texto}` };
      }
      case "concurso_compania": {
        const e = validado.data as z.infer<typeof esquemas.concurso_compania>;
        const texto = concurso(partida, e);
        return { contenido: texto, aviso: `🪶 ${texto.split("\n").slice(-2)[0]}` };
      }
      case "hazana": {
        const e = validado.data as z.infer<typeof esquemas.hazana>;
        const texto = registrarHazana(partida, e);
        return { contenido: texto, aviso: e.magnitud >= 3 ? `📜 ${texto.split("\n")[0]}` : null };
      }
      case "coronar_leyenda": {
        const e = validado.data as z.infer<typeof esquemas.coronar_leyenda>;
        const texto = coronarLeyenda(partida, e);
        return { contenido: texto, aviso: `★ ${texto.split("\n")[0].replace(/^★ /, "")}` };
      }
      case "usar_recurso": {
        const e = validado.data as z.infer<typeof esquemas.usar_recurso>;
        const texto = usarRecurso(partida, { ...e, recurso: e.recurso ?? "", alTerminar: (p) => terminarFuria(p, "se apaga por decisión suya") });
        return { contenido: texto, aviso: e.accion === "ver" ? null : `💪 ${texto.split("\n")[0]}` };
      }
      case "descanso": {
        const e = validado.data as z.infer<typeof esquemas.descanso>;
        const furias = terminarTodas(partida, "se apaga con el descanso");
        const texto = [...furias, descanso(partida, e)].join("\n");
        return { contenido: texto, aviso: `🛏 Descanso ${e.tipo}: se recuperan fuerzas y rasgos.` };
      }
      case "caida": {
        const e = validado.data as z.infer<typeof esquemas.caida>;
        const texto = caida(partida, e);
        return { contenido: texto, aviso: `⬇ ${texto.split("\n")[0]}` };
      }
      case "experiencia": {
        const e = validado.data as z.infer<typeof esquemas.experiencia>;
        const texto = darExperiencia(partida, e);
        return { contenido: texto, aviso: e.accion === "ver" ? null : `✨ ${texto.split("\n")[0]}` };
      }
      case "subir_nivel": {
        const e = validado.data as z.infer<typeof esquemas.subir_nivel>;
        const texto = subirNivel(partida, e as Parameters<typeof subirNivel>[1]);
        return { contenido: texto, aviso: `⬆ ${texto.split("\n")[0]}` };
      }
      case "salvacion_muerte": {
        const e = validado.data as z.infer<typeof esquemas.salvacion_muerte>;
        const texto = salvacionMuerte(partida, e.quien);
        return { contenido: texto, aviso: texto };
      }
      case "estabilizar": {
        const e = validado.data as z.infer<typeof esquemas.estabilizar>;
        const texto = estabilizar(partida, e);
        return { contenido: texto, aviso: `🩹 ${texto.split("\n").slice(-1)[0]}` };
      }
      case "condicion": {
        const e = validado.data as z.infer<typeof esquemas.condicion>;
        const texto = aplicarCondicion(partida, e);
        return { contenido: texto, aviso: e.accion === "ver" ? null : `🩸 ${texto.split("\n")[0]}` };
      }
      case "encuentro": {
        const e = validado.data as z.infer<typeof esquemas.encuentro>;
        return { contenido: sortearEncuentro(partida, e), aviso: null };
      }
      case "plano": {
        const e = validado.data as z.infer<typeof esquemas.plano>;
        const antes = instantanea(partida);
        const base = actualizarPlano(partida, e);
        const avisos = e.mover?.length ? provocados(partida, antes) : [];
        const texto = avisos.length ? `${base}\n${avisos.join("\n")}` : base;
        return { contenido: texto, aviso: `🗺️ ${texto.split("\n").filter((l) => !l.startsWith("-") && !l.startsWith("##")).join("\n")}` };
      }
      case "tiempo": {
        const e = validado.data as z.infer<typeof esquemas.tiempo>;
        const texto = actualizarReloj(partida, e);
        return { contenido: texto, aviso: texto };
      }
      case "prueba": {
        const e = validado.data as z.infer<typeof esquemas.prueba>;
        const r = resolverPrueba(partida, e);
        return { contenido: r.texto, aviso: r.texto };
      }
      case "ubicacion": {
        const e = validado.data as z.infer<typeof esquemas.ubicacion>;
        const texto = moverGrupo(partida.mapa, { ...e, nombre: e.lugar });
        return { contenido: texto, aviso: texto };
      }
      case "iniciativa": {
        const e = validado.data as z.infer<typeof esquemas.iniciativa>;
        const texto = e.sumar && partida.combate
          ? agregarAlCombate(partida, e.participantes, e.pnj ?? [])
          : tirarIniciativa(partida, e.participantes, e.pnj ?? [], e.tactica as Parameters<typeof tirarIniciativa>[3]);
        return { contenido: texto, aviso: `⏳ ${texto}` };
      }
      case "atacar": {
        const e = validado.data as z.infer<typeof esquemas.atacar>;
        const r = ataqueCompleto(partida, e);
        return { contenido: r.texto, aviso: r.aviso };
      }
      case "pnj": {
        const e = validado.data as z.infer<typeof esquemas.pnj>;
        return { contenido: registrarPnj(partida, e), aviso: null };
      }
      case "trama": {
        const e = validado.data as z.infer<typeof esquemas.trama>;
        const texto = actualizarTrama(partida, e);
        const visible = texto.split("\n").filter((l) => /^(Pista revelada|Hilo cerrado|Objetivo|Arco)/.test(l));
        const arcos = visible.filter((l) => l.startsWith("Arco")).map((l) => `📖 ${l}`);
        const otros = visible.filter((l) => !l.startsWith("Arco"));
        return { contenido: texto, aviso: [...arcos, ...(otros.length ? [`🧭 ${otros.join("\n")}`] : [])].join("\n") || null };
      }
      case "siguiente_asalto": {
        avanzarSiHay(partida, 6);
        const texto = [siguienteAsalto(partida), ...pasarAsaltoFuria(partida)].join("\n");
        return { contenido: texto, aviso: `⏳ ${texto}` };
      }
      case "terminar_combate": {
        const furias = terminarTodas(partida, "se apaga al acabar el combate");
        limpiarTrasCombate(partida);
        delete partida.combate;
        return { contenido: `Combate cerrado. Caducan las condiciones pasajeras (agarrado, derribado, aturdido…).${furias.length ? "\n" + furias.join("\n") : ""}`, aviso: furias.length ? `🔥 ${furias.join("\n")}` : null };
      }
      case "anotar_mundo": {
        const e = validado.data as z.infer<typeof esquemas.anotar_mundo>;
        if (!e.nota && !e.olvidar) throw new Error("Pasa nota (un hecho nuevo) o olvidar (el texto de una nota que ya no es cierta).");
        if (e.reemplaza && !e.nota) throw new Error("Para reemplazar una nota hay que pasar la nota nueva.");
        const hallar = (trozo: string) => {
          const t = trozo.toLowerCase().trim();
          const idx = partida.notas_mundo.map((x, i) => [x, i] as const).filter(([x]) => x.toLowerCase().includes(t));
          if (!idx.length) throw new Error(`No hay ninguna nota que contenga "${trozo}". Notas: ${partida.notas_mundo.map((x, i) => `${i + 1}. ${x}`).join(" | ") || "ninguna"}`);
          if (idx.length > 1) throw new Error(`"${trozo}" aparece en varias notas: ${idx.map(([x]) => `«${x}»`).join(" | ")}. Usa un trozo más específico.`);
          return idx[0][1];
        };
        const log: string[] = [];
        if (e.olvidar) {
          const i = hallar(e.olvidar);
          log.push(`Nota borrada: ${partida.notas_mundo.splice(i, 1)[0]}`);
        }
        if (e.nota) {
          if (e.reemplaza) {
            const i = hallar(e.reemplaza);
            log.push(`Nota corregida: «${partida.notas_mundo[i]}» → «${e.nota}»`);
            partida.notas_mundo[i] = e.nota;
          } else if (partida.notas_mundo.some((x) => x.toLowerCase() === e.nota!.toLowerCase())) {
            log.push("Esa nota ya estaba.");
          } else {
            partida.notas_mundo.push(e.nota);
            log.push("Nota guardada.");
          }
        }
        if (partida.notas_mundo.length > 50) log.push(`Hay ${partida.notas_mundo.length} notas: funde las repetidas y borra las obsoletas con olvidar.`);
        return { contenido: log.join("\n"), aviso: null };
      }
    }
  } catch (err) {
    return { contenido: (err as Error).message, aviso: null, error: true };
  }
}
