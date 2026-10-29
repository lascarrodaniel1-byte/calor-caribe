// Herramientas que el Dungeon Master (Claude) puede usar. Los dados los tira
// este programa, no el modelo, para que los resultados sean realmente aleatorios.
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { describir, dadosFijados, liberarDados, tirar } from "./dados.js";
import { aplicarPresa, dardos, estudiarPresa, forzarAcceso, NOMBRES_OBSTACULOS, prepararSoplo, resolverSoplo } from "./degollador.js";
import { ALCANCE_CERBATANA } from "./degollador_base.js";
import { amputar, diagnosticar, golpeNervio, gastarKit, gastarManoFirme, kitSanador, usosKit } from "./barbero.js";
import { esBarberoC } from "./barbero_base.js";
import { anotarHerida, cosechar, deudaPorHechizo, entregarAlmas, guadana, hablarConMuertos, invocacion, liberarAlma, liberarSiMuere, prepararDescarga, sellarAlma } from "./segador.js";
import { esSegador, exigirLibre } from "./segador_base.js";
import { motivoNoActua } from "./condiciones.js";
import { aplicarDolor, cadenas, curacionPasiva, devolverDolor, pasoElusivo, sangreAjena } from "./flagelante.js";
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
import { aprenderTipo, avisoLicencia, comprenderMagia } from "./hechicero.js";
import { ajustarMaestriaHechicero, donTirado, tirarDonJugador, buscarHechizo, buscarTipo, nombreEscuelaHechiceria, sincronizarGrimorio, TIPOS_IDS, tiposMax, tipoDe, descansar, despertarMagia, enfriar, ESCUELAS, lanzar, MAESTRIAS, magiaInicial, TRIBUTOS } from "./magia.js";
import { DIRECCIONES, DISTANCIAS, moverGrupo, NOMBRE_DIRECCION as NOMBRES_DIR, NOMBRES_REGIONES, TIPOS_LUGAR } from "./mapa.js";
import { actualizarPlano, actualizarReloj, avanzarSiHay, distanciaPlano } from "./espacio.js";
import { pasarAsaltoFuria, redirigirTrance, terminarFuria, terminarTodas } from "./furia.js";
import { ajustarAtaque, empunar, ESTILOS, estiloCombate } from "./manos.js";
import { curarConRunas, esMagiaNegra, mascota, mitigacion, papeles, rastroMagico, registrarMagia } from "./cazador.js";
import { gastarReserva, imponerManos, juramento, romperJuramento } from "./juramento.js";
import { concurso } from "./compania.js";
import { coronarLeyenda, registrarHazana } from "./leyenda.js";
import { descanso, usarRecurso } from "./recursos.js";
import { caida, maniobra } from "./maniobras.js";
import { trampa } from "./trampas.js";
import { dote, tomarDote } from "./dotes.js";
import { agua, pasarAsaltoAgua } from "./agua.js";
import { montura, revisarMonturas } from "./montura.js";
import { marcarTiempo, nave, pasarAsaltoNave, procesarTiempo } from "./naves.js";
import { revisarSustento, sustento, viajar } from "./sustento.js";
import { darExperiencia, PX_PNJ, repartirBajas, subirNivel } from "./progresion.js";
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
    escuelas_magia: z.array(z.enum(ESCUELAS)).max(2).optional().describe("Obsoleto (partidas antiguas): usa tipos_magia"),
    tipos_magia: z.array(z.enum(TIPOS_IDS)).max(1).optional().describe("Solo Hechicero: el tipo de magia con que empieza (el que enseña su escuela): fuego, rayo, hielo, viento, agua, tierra, oscuridad, luz, curacion, proteccion, mente, adivinacion; sombra y necromancia son magia negra, sin licencia"),
    linaje: z.enum(["noble", "rico", "humilde"]).optional().describe("Solo Hechicero: solo los nobles o los ricos entran en las escuelas de hechicería, salvo quien nace con el don arcano (se incluye por fuerza mayor)"),
    dote: z.string().optional().describe("Solo Humano del Faro: su dote gratis (dote {accion: lista})"),
    opcion_dote: z.string().optional().describe("Opción de esa dote (Lengua de plata: persuasion o intimidacion)"),
    don_arcano: z.union([z.boolean(), z.enum(["fisico", "magico"])]).optional().describe("Solo si la historia lo exige (trasfondo pactado): fuerza el don (true = mágico). Si se omite, vale el que tiró el DM con tirar_don_arcano antes de crear al personaje"),
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
    supervisa: z.string().optional().describe("Barbero-Cirujano que vigila la dosis de Sangre de Santo (−10 al riesgo de coágulo)"),
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
    tipo: z.enum(["ataque_oportunidad", "preparada", "centinela", "otra"]).describe("centinela: dote Centinela, contra quien ataca a un aliado cercano"),
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
    escudo: z.boolean().optional().describe("Dote Maestro del escudo: empuja con el escudo como acción adicional"),
    adicional: z.boolean().optional().describe("Dote Pendenciero: agarra como acción adicional"),
  }),
  empunar: z.object({
    quien: z.string(),
    principal: z.string().optional().describe("Arma de la mano principal (del inventario); «ninguna» la deja libre"),
    secundaria: z.string().optional().describe("Escudo o segunda arma ligera de la otra mano; «ninguna» la deja libre"),
    a_dos_manos: z.boolean().optional().describe("Empuña con las dos manos un arma versátil (más daño, sin escudo)"),
    usa_accion: z.boolean().optional().describe("En combate, confirma que gasta su acción (segundo cambio de objeto del asalto, o ponerse/quitarse el escudo)"),
  }),
  sangre_ajena: z.object({
    quien: z.string().describe("El Flagelante"),
    objetivo: z.string().describe("Enemigo vivo y herido a su alcance (2 m) cuya sangre recoge"),
  }),
  diagnosticar: z.object({
    quien: z.string().describe("El Barbero-Cirujano"),
    paciente: z.string(),
    herida: z.string().optional().describe("Id de la herida (por defecto, todas)"),
  }),
  amputar: z.object({
    quien: z.string().describe("El Barbero-Cirujano"),
    paciente: z.string(),
    herida: z.string().describe("Id de la herida de un brazo o una pierna"),
    anestesia: z.boolean().optional().describe("true si el paciente está sedado o anestesiado (CD 15 en vez de 18)"),
  }),
  kit_sanador: z.object({
    quien: z.string().describe("El Barbero-Cirujano"),
    accion: z.enum(["ver", "reponer"]),
    usos: z.number().int().min(1).max(10).optional(),
  }),
  guadana: z.object({
    quien: z.string().describe("El Segador"),
    accion: z.enum(["invocar", "despedir"]).describe("invocar (acción adicional) o despedir la guadaña de huesos de Neter"),
  }),
  descarga: z.object({
    quien: z.string().describe("El Segador"),
    objetivo: z.string(),
    objetivo2: z.string().optional().describe("Nivel 5: el segundo rayo puede ir a otro objetivo"),
  }),
  sellar_alma: z.object({
    quien: z.string().describe("El Segador (nivel 2+)"),
    objetivo: z.string().describe("Al que acaba de herir con la guadaña"),
    habilidad: z.string().optional().describe("PJ: su habilidad firma (por defecto la principal de su clase); criatura/PNJ: el poder o rasgo que sellas"),
    con_sangre: z.boolean().optional().describe("Fuera de combate: true si acaba de herirlo con la guadaña"),
  }),
  liberar_alma: z.object({
    quien: z.string().describe("El Segador"),
    nombre: z.string().optional().describe("Alma a liberar (omítelo para todas)"),
    por: z.enum(["voluntad", "rito"]).optional().describe("voluntad suya o rito de las Hermanas"),
  }),
  entregar_almas: z.object({
    quien: z.string().describe("El Segador"),
    en_tumba: z.boolean().describe("true si está en una tumba de Neter"),
    nombre: z.string().optional(),
  }),
  hablar_con_muertos: z.object({
    quien: z.string().describe("El Segador"),
    objetivo: z.string().describe("El cadáver o espíritu con el que habla"),
    preguntas: z.number().int().min(1).max(3).optional(),
  }),
  invocacion: z.object({
    quien: z.string().describe("El Segador"),
    accion: z.enum(["ver", "elegir", "usar"]),
    nombre: z.string().optional().describe("Ojos del dios muerto, Presencia sepulcral, Voz de los muertos o Piel de hueso"),
  }),
  paso_elusivo: z.object({
    quien: z.string().describe("El Flagelante (nivel 5+)"),
  }),
  cadenas: z.object({
    quien: z.string().describe("El Flagelante"),
    objetivo: z.string(),
    accion: z.enum(["atar", "atraer", "soltar"]).describe("atar (agarrado, velocidad 0), atraer hasta su alcance o soltar"),
  }),
  estudiar_presa: z.object({
    quien: z.string().describe("El Degollador"),
    objetivo: z.string().describe("A quién estudia (criatura, PNJ o personaje)"),
  }),
  dardos: z.object({
    quien: z.string().describe("El Degollador"),
    accion: z.enum(["ver", "impregnar", "reponer"]),
    sustancia: z.string().optional().describe("Impregnar: Hiel de Víbora Gris o Leche de Amapola Negra (gasta un vial; cubre 3 dardos)"),
    cantidad: z.number().int().min(1).max(50).optional().describe("Reponer: dardos nuevos"),
    usa_accion: z.boolean().optional().describe("En combate, confirma que impregnar gasta su acción"),
  }),
  forzar_acceso: z.object({
    quien: z.string().describe("El Degollador"),
    obstaculo: z.enum(NOMBRES_OBSTACULOS),
    cd: z.number().int().min(1).max(30).optional().describe("Sustituye la dificultad por defecto del obstáculo"),
    sellado_magico: z.boolean().optional().describe("true si lo sella magia o runas: no se abre con maña"),
  }),
  aprender_tipo: z.object({
    quien: z.string().describe("El Hechicero"),
    tipo: z.enum(TIPOS_IDS),
    maestro: z.string().describe("Quién o qué escuela le enseña (obligatorio)"),
  }),
  comprender_magia: z.object({
    quien: z.string().describe("El Hechicero"),
    hechizo: z.string().describe("Un hechizo o un tipo de magia que quiere comprender"),
    visto: z.boolean().optional().describe("Con el don arcano: true si acaba de ver cómo se lanza; lo aprende con solo verlo"),
  }),
  reabrir_tiradas: z.object({
    motivo: z.string().describe("Qué dato corregido es clave para la acción que se tiró, y por qué cambia la tirada"),
  }),
  estilo_combate: z.object({
    quien: z.string(),
    estilo: z.enum(ESTILOS),
  }),
  papeles: z.object({
    quien: z.string().describe("El Cazador de Brujas"),
    accion: z.enum(["ver", "colocar", "recoger", "escribir", "clavar", "tomar_sangre", "marcar_sangre"]),
    escenario: z.enum(["cerrado", "abierto"]).optional().describe("colocar: sala cerrada (4 hojas, una por pared) o círculo al aire libre"),
    radio: z.number().min(2).max(20).optional().describe("colocar al aire libre: radio del círculo en metros"),
    cantidad: z.number().int().min(1).max(40).optional().describe("escribir: cuántas hojas"),
    objetivo: z.string().optional().describe("clavar: a quién le clava un papel con una estaca; tomar_sangre / marcar_sangre: de quién es la sangre (marcar_sangre lo marca a distancia)"),
  }),
  mascota: z.object({
    quien: z.string(),
    accion: z.enum(["elegir", "ver"]),
    tipo: z.enum(["halcon", "raton"]).optional(),
    nombre: z.string().optional(),
  }),
  rastro_magico: z.object({
    quien: z.string().describe("El Cazador de Brujas (para registrar, cualquiera)"),
    accion: z.enum(["detectar", "registrar", "amarrar", "rastrear"]),
    lanzador: z.string().optional().describe("registrar: quién lanzó el hechizo o la maldición (secreto del DM)"),
    hechizo: z.string().optional().describe("Hechizo o maldición"),
    escuela: z.string().optional(),
    victima: z.string().optional().describe("Sobre quién recae (para amarrar o rastrear, quien está delante)"),
    objeto: z.string().optional().describe("O el objeto en que reside"),
    lugar: z.string().optional().describe("registrar: lugar del mapa donde está de verdad el casteador (secreto)"),
    negra: z.boolean().optional().describe("registrar: es magia negra (por defecto se deduce)"),
  }),
  juramento: z.object({
    quien: z.string(),
    accion: z.enum(["jurar", "añadir_voto", "ver", "expiar"]),
    votos: z.array(z.string()).optional().describe("Verdad, Amparo, Lealtad, Luz, Descanso, Merced (hasta 5 en total)"),
  }),
  romper_juramento: z.object({
    quien: z.string(),
    voto: z.string().describe("El voto que viola"),
    motivo: z.string().describe("Qué hizo, en una frase"),
  }),
  imposicion_manos: z.object({
    quien: z.string().describe("El Caballero"),
    objetivo: z.string().describe("A quién cura (puede ser él mismo)"),
    pv: z.number().int().min(1).max(500).describe("PV que gasta de su reserva y devuelve"),
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
    accion: z.enum(["dar", "por_criatura", "ver", "mision"]).describe("dar: PX sueltos · por_criatura: por peligro · mision: según importancia · ver"),
    importancia: z.enum(["menor", "normal", "mayor", "epica"]).optional().describe("mision: menor 15 %, normal 30 %, mayor 50 %, épica 80 % de lo que falta para el siguiente nivel, a cada uno"),
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
    dote: z.string().optional().describe("Niveles 4, 8, 12, 16 y 19: una dote en lugar del aumento de característica (dote {accion: lista})"),
    opcion: z.string().optional().describe("Opción de la dote (Lengua de plata: persuasion o intimidacion)"),
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
    nervio: z.enum(["brazo", "pierna", "columna"]).optional().describe("Barbero-Cirujano: golpea un nervio (−2, columna −3): si hiere, CON o brazo entumecido, pierna entumecida o paralizado un asalto"),
    dardo: z.enum(["sano", "impregnado"]).optional().describe("Cerbatana del Degollador: qué dardo sopla (por defecto, uno impregnado si tiene)"),
    golpe_demoledor: z.boolean().optional().describe("Dote Golpe demoledor: con arma pesada, −5 al ataque y +10 al daño"),
    duelo: z.boolean().optional().describe("Dote Esgrimista: es un duelo uno contra uno (ventaja en el primer ataque del combate)"),
    en_cubierta: z.boolean().optional().describe("PNJ o criatura que lucha sobre la cubierta de una nave: sus armas de cubierta (sable de abordaje…) dan ventaja"),
    reaccion: z.boolean().optional().describe("Ataque de oportunidad ya anunciado con reaccion (sin dano): resuelve aquí su único ataque cuerpo a cuerpo, sin exigir que siga al alcance"),
    mano_secundaria: z.boolean().optional().describe("Pelea con dos armas: ataca con el arma ligera de la mano secundaria usando la acción adicional (tras atacar con una arma ligera en la principal). No suma su modificador al daño"),
    castigo: z.boolean().optional().describe("Castigo divino del Caballero Juramentado (nivel 2+): gasta 5 PV de su reserva y suma dados de daño radiante"),
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
    importancia: z.enum(["menor", "normal", "mayor", "epica"]).optional().describe("Al cerrar el arco: cuánta experiencia da (normal 30 % del camino al siguiente nivel; menor 15, mayor 50, épica 80)"),
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
  montura: z.object({
    accion: z.enum(["montar", "desmontar", "caer"]),
    jinete: z.string(),
    montura: z.string().optional().describe("montar: el animal o la criatura (si está en escena, el jinete cae si ella cae)"),
    control: z.enum(["controlada", "independiente"]).optional().describe("controlada (entrenada, por defecto) o independiente"),
    grande: z.boolean().optional().describe("Mayor que quien va a pie (por defecto sí): da ventaja cuerpo a cuerpo al jinete"),
    motivo: z.string().optional(),
  }),
  agua: z.object({
    accion: z.enum(["sumergir", "emerger", "nadar", "ver"]),
    quienes: z.array(z.string()).optional().describe("Por defecto, todo el grupo"),
    nadador: z.boolean().optional().describe("sumergir: sabe nadar de verdad (sin desventaja en el cuerpo a cuerpo)"),
    minutos: z.number().min(0.5).max(60).optional().describe("nadar: minutos bajo el agua"),
  }),
  nave: z.object({
    accion: z.enum(["crear", "abordar", "desembarcar", "navegar", "danar", "reparar", "mar", "abordaje", "ver"]),
    nave: z.string().optional(),
    tipo: z.string().optional().describe("crear: balsa, bote, barca, carraca o galera"),
    casco: z.number().int().min(1).optional().describe("crear: PV del casco si no son los del tipo"),
    quienes: z.array(z.string()).optional(),
    horas: z.number().min(0.5).max(48).optional(),
    viento: z.enum(["favorable", "normal", "calmo", "contrario", "tormenta"]).optional(),
    cantidad: z.number().int().min(1).optional().describe("danar: daño al casco"),
    tipo_dano: z.string().optional().describe("danar: si es de fuego, hace el doble y prende"),
    mar: z.enum(["calmo", "picado", "tormenta"]).optional(),
    tarea: z.enum(["achicar", "remendar", "apagar"]).optional().describe("reparar"),
    otra: z.string().optional().describe("abordaje: la otra nave"),
  }),
  trampa: z.object({
    accion: z.enum(["colocar", "detectar", "desarmar", "disparar", "ver"]),
    nombre: z.string().optional(),
    lugar: z.string().optional(),
    cd_detectar: z.number().int().min(5).max(30).optional(),
    cd_desarmar: z.number().int().min(5).max(30).optional(),
    efecto: habilidad.optional().describe("colocar: lo que hace al saltar (salvación, cd, dano, tipo_dano, condicion, herida…)"),
    reutilizable: z.boolean().optional(),
    quienes: z.array(z.string()).optional().describe("detectar activo / desarmar: quién lo intenta · disparar: quién la sufre"),
    activa: z.boolean().optional().describe("detectar: registran a propósito (prueba de Percepción) en vez de solo la pasiva"),
    herramientas: z.boolean().optional().describe("desarmar: con herramientas de ladrón; si no, desventaja"),
    rapido: z.boolean().optional().describe("detectar pasivo: van a ritmo rápido (−5)"),
  }),
  sustento: z.object({
    accion: z.enum(["comer", "beber", "ver"]),
    quienes: z.array(z.string()).optional().describe("Por defecto, todo el grupo"),
    libre: z.boolean().optional().describe("Comió o bebió de algo que no es del inventario (posada, río, caza): no gasta provisiones"),
  }),
  viajar: z.object({
    horas: z.number().min(0.5).max(24),
    ritmo: z.enum(["lento", "normal", "rapido"]),
    terreno: z.enum(["camino", "abierto", "dificil"]),
    motivo: z.string().optional().describe("Adónde van"),
  }),
  dote: z.object({
    accion: z.enum(["lista", "elegir", "ver"]),
    quien: z.string().optional(),
    dote: z.string().optional(),
    opcion: z.string().optional(),
  }),
  tirar_don_arcano: z.object({
    jugador: z.string().describe("El jugador (o el personaje) para quien se tira el don, ANTES de crear su personaje"),
  }),
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
  montura:
    "Combate montado: montar, desmontar o caer de la montura (DES CD 10). El jinete grande ataca con ventaja a los de a pie; si la montura cae, el jinete cae.",
  agua:
    "Combate bajo el agua: sumergir, emerger, nadar (minutos) o ver el aire. Gasta aire por asalto, ahoga, y los ataques sufren desventaja salvo armas adecuadas.",
  nave:
    "Botes, balsas y barcos: crear, abordar, desembarcar, navegar (horas y viento), mar, danar el casco, reparar (achicar, remendar, apagar) y abordaje. Se hunde, arde y tira gente por la borda.",
  trampa:
    "Trampas secretas: colocar (CD de detectar y de desarmar, efecto), detectar (Percepción pasiva del grupo o búsqueda activa), desarmar (Juego de manos) y disparar. Nunca avises de una trampa que nadie ha descubierto.",
  sustento:
    "Comer, beber o ver el sustento del grupo. Gasta raciones y agua del inventario (o libre=true si come en una posada o bebe de un río). El hambre y la sed las cuenta el reloj solas: sin comer 3 + mod. CON días, sin beber 1 día, y luego agotamiento por día.",
  viajar:
    "Caminar: horas, ritmo (lento, normal, rápido) y terreno (camino, abierto, difícil). Avanza el reloj, calcula los km y cobra la marcha forzada pasadas 8 horas.",
  dote:
    "Dotes: lista (todas), ver (las de un personaje) o elegir (la dote gratis del Humano del Faro; las demás se eligen en subir_nivel).",
  tirar_don_arcano:
    "ANTES de crear el personaje de un jugador: el DM tira un d20 para ver si nace con un don arcano. 19 = don FÍSICO (cuerpo prodigioso), 20 = don MÁGICO (talento para la magia); cualquier otro resultado, sin don. Una sola tirada por jugador. Anuncia el resultado y luego guía la creación del personaje.",
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
  empunar:
    "Dice qué empuña un personaje en cada mano: un arma a dos manos (o una versátil a dos manos) ocupa ambas; el escudo da +2 a la CA mientras está en la mano. El programa lo comprueba al atacar y calcula la CA.",
  sangre_ajena:
    "Flagelante de Haema (acción adicional): bebe o se unta la sangre de un enemigo vivo y herido a su alcance: recupera 2d6 + nivel PV y cierra la hemorragia de sus heridas, bajando la más grave un nivel. No sirve con no-muertos.",
  diagnosticar:
    "Barbero-Cirujano: examina las heridas de un paciente y dice su estructura, zona, reloj, dificultad de tratarlas y riesgo de infección.",
  amputar:
    "Barbero-Cirujano: amputa el brazo o la pierna de una herida (Medicina CD 15, 18 sin anestesia): la herida y su Podre desaparecen, queda una secuela y un choque de 2d6.",
  kit_sanador:
    "Barbero-Cirujano: ver o reponer los usos de su kit de sanador (10); cada tratamiento con el kit gasta uno.",
  guadana:
    "Segador: invoca (acción adicional) o despide la guadaña de huesos de Neter (1d10 cortante, alcance 3 m, a dos manos, ataca con CAR). Se ataca con atacar {arma: «Guadaña de Neter»}.",
  descarga:
    "Segador: descarga sobrenatural (1d10 de fuerza a 36 m, ataque de CAR; dos rayos desde el nivel 5). Gasta un uso por descanso corto y suma Deuda de Neter.",
  sellar_alma:
    "Segador (nivel 2+, acción adicional): tras herir a un vivo con la guadaña este asalto, sella su alma (salvación de CAR): pierde su habilidad firma (la furia, el Ataque adicional…) mientras el Segador la sostenga. Suma 3 de Deuda.",
  liberar_alma:
    "Segador: libera un alma sellada por su voluntad o por un rito de las Hermanas; también cuando él muere.",
  entregar_almas:
    "Segador: entrega a Neter, en una tumba del dios, las almas selladas: se pierden para siempre y pagan el doble de su valor de la Deuda.",
  hablar_con_muertos:
    "Segador: habla con un cadáver o espíritu (hasta tres preguntas, con lo que sabía en vida). Suma 1 de Deuda.",
  invocacion:
    "Segador: ver, elegir (nivel 2: dos) o usar una invocación de Neter: Ojos del dios muerto, Presencia sepulcral, Voz de los muertos o Piel de hueso (+2 CA).",
  paso_elusivo:
    "Flagelante (nivel 5): declara su Paso elusivo (gasta su reacción) ANTES de que lo ataquen: el siguiente ataque que fuera a acertar se esquiva si su tirada de Acrobacias lo iguala o supera. Con el dolor al máximo (4/4) es una esquiva automática que no falla nunca y no hace falta declararla.",
  cadenas:
    "Flagelante: lanza las cadenas (hasta 6 m) con prueba de Atletismo enfrentada para atar a un enemigo (agarrado) o atraerlo hasta su alcance; también soltarlo. Las criaturas de peligro 4+ no se arrastran.",
  estudiar_presa:
    "Degollador: estudia a un objetivo (fuera de combate, al menos un minuto): su primer ataque contra él tiene ventaja y suma el ataque furtivo, y conoce su rutina. 1 uso por descanso corto.",
  dardos:
    "Degollador: ver, reponer o impregnar los dardos de su cerbatana con un vial de Hiel de Víbora Gris o de Leche de Amapola Negra (3 dardos por vial). Se sopla con atacar {arma: «cerbatana»}.",
  forzar_acceso:
    "Degollador (Entrar y salir): abre una ventana, puerta atrancada, cerradura, reja, cadenas o ataduras con ventaja en Juego de manos; desde el nivel 3 no falla hasta CD 15; desde el 2, en combate es acción adicional.",
  aprender_tipo:
    "Hechicero: estudia un nuevo tipo de magia en una escuela (el segundo desde el nivel 5, el tercero desde el 9). Las escuelas licenciadas dan licencia de la Inquisición; la sombra y la necromancia son magia negra. El del don arcano ya los domina todos.",
  comprender_magia:
    "Hechicero: comprende un hechizo o un tipo de magia aunque no lo domine (cómo funciona, qué cuesta, cómo se canaliza). Con el don arcano, si lo ha visto lanzar (visto=true), lo aprende al instante hasta el círculo que domina.",
  reabrir_tiradas:
    "SOLO al repetir un turno corregido por los jugadores: los dados que ya salieron se repiten igual. Llámala únicamente si el dato corregido es CLAVE para la acción que se tiró (se tiró contra el objetivo equivocado, sin una circunstancia que cambiaba la ventaja o la dificultad…); desde entonces los dados salen nuevos. Un error de narración, de consecuencia o de resultado no la justifica.",
  estilo_combate:
    "Elige el estilo de lucha (arquería, defensa, duelo, lucha con arma a dos manos, protección o lucha con dos armas) de un Mercenario, un Caballero (nivel 2+) o un Cazador de Brujas (nivel 2+).",
  papeles:
    "Cazador de Brujas: dispone papeles de runas alrededor de la zona de la pelea (apagan la regeneración y quitan CD a los poderes de brujas, hechiceros y no-muertos; a nivel alto curan), los recoge, escribe más, o los usa sobre un rival: clavándole uno con una estaca o, a distancia, con su sangre (tomar_sangre, marcar_sangre).",
  mascota:
    "Cazador de Brujas: elige su mascota (halcón o ratón, a elección del jugador) o consulta lo que hace.",
  rastro_magico:
    "Cazador de Brujas: detecta hechizos y maldiciones recientes, amarra un hechizo negro a quien lo lanzó y lo rastrea (cuanto más nivel, más sabe). El DM anota con registrar las maldiciones y hechizos de los PNJ.",
  juramento:
    "Caballero Juramentado: jura (1-3 votos de Ka'i al crear la ficha), añade votos (hasta 5), consulta o expía un juramento roto. El juramento le da su poder mágico: más votos, más poder... y más duele romperlo.",
  romper_juramento:
    "Un Caballero viola uno de sus votos: consecuencias según cuántos votos tenía jurados, de la debilidad a que su propio poder lo queme y pierda la magia para siempre.",
  imposicion_manos:
    "Imposición de manos: el Caballero gasta PV de su reserva para curar PV a alguien (sin Ceniza). Para cerrar una herida usa tratar_herida con magia divina (5 PV de la reserva).",
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

/** Quita del esquema JSON lo que no dice nada: los límites de entero seguro y «additionalProperties: false» (zod ya valida). */
function aligerar(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(aligerar);
  if (x && typeof x === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if (k === "additionalProperties" && v === false) continue;
      if ((k === "minimum" || k === "maximum") && typeof v === "number" && Math.abs(v) >= Number.MAX_SAFE_INTEGER) continue;
      o[k] = aligerar(v);
    }
    return o;
  }
  return x;
}

export const herramientas: Anthropic.Beta.BetaTool[] = (Object.keys(esquemas) as Nombre[]).map((nombre) => {
  const { $schema: _ignorado, ...schema } = aligerar(z.toJSONSchema(esquemas[nombre])) as Record<string, unknown>;
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
/** Si el ataque falla (objetivo fuera de alcance, daño mal escrito…), no se gasta nada: ni la acción adicional, ni la ayuda, ni la reserva. */
function ataqueCompleto(partida: Partida, e: DatosAtaque): { texto: string; aviso: string } {
  const turnos = partida.combate?.turnos ? JSON.parse(JSON.stringify(partida.combate.turnos)) : undefined;
  const reservas = Object.values(partida.personajes).map((p) => [p, p.juramento?.reserva] as const);
  try {
    return ataqueCompletoInterno(partida, e);
  } catch (err) {
    if (turnos && partida.combate) partida.combate.turnos = turnos;
    for (const [p, r] of reservas) if (p.juramento && r !== undefined) p.juramento.reserva = r;
    throw err;
  }
}

function ataqueCompletoInterno(partida: Partida, e: DatosAtaque): { texto: string; aviso: string } {
  // Cerbatana del Degollador: a distancia (30 m), 1 de daño y un dardo de la reserva.
  const soplo = /cerbatana/i.test(e.arma ?? "") ? prepararSoplo(partida, e) : null;
  if (soplo) e = soplo.e;
  if (e.nervio && !esBarberoC(Object.values(partida.personajes).find((x) => x.nombre.toLowerCase() === e.atacante.toLowerCase()) ?? ({} as never)))
    throw new Error("Solo un Barbero-Cirujano sabe golpear los nervios.");
  // Segador: la guadaña ataca con CAR.
  const segP = Object.values(partida.personajes).find((x) => x.nombre.toLowerCase() === e.atacante.toLowerCase());
  if (segP && esSegador(segP) && !e.a_distancia && (/guada[ñn]a/i.test(e.arma ?? "") || (!e.arma && /guada[ñn]a/i.test(segP.manos?.principal ?? ""))))
    e = { ...e, arma: e.arma ?? segP.manos!.principal, atributo: e.atributo ?? "car" };
  // Con los dos en el plano, el alcance es real: cuerpo a cuerpo (2 m, 3 m con asta) o a distancia (hasta 120 m).
  const dist = e.reaccion ? null : distanciaPlano(partida, e.atacante, e.objetivo); // el ataque de oportunidad se hace justo al salir del alcance
  if (dist) {
    const asta = /alabarda|guada|lanza|pica|jabalina larga|l[aá]tigo|urumi|cadenas/i.test(e.arma ?? "");
    const alcance = soplo ? ALCANCE_CERBATANA : /descarga sobrenatural/i.test(e.arma ?? "") ? 36 : e.a_distancia ? 120 : asta ? 3 : 2;
    if (dist.metros > alcance)
      throw new Error(`${dist.a} está a ${dist.metros} m al ${NOMBRES_DIR[dist.dir]} de ${dist.de}: ${e.a_distancia ? "fuera del alcance de ese ataque" : `fuera de alcance cuerpo a cuerpo (${alcance} m)`}. Muévelo antes con plano (mover hacia) o elige otro ataque.`);
  }
  // En trance de furia (nivel 1-2) el berserker no distingue aliados de enemigos.
  let aviso0 = "";
  if (!e.reaccion) {
    const red = redirigirTrance(partida, e.atacante, e.objetivo);
    if (red.aviso) { e = { ...e, objetivo: red.objetivo }; aviso0 = red.aviso; }
  }
  // Reglas del libro: arma en la mano, segunda arma con la acción adicional, pesadas, estilos de lucha.
  const aj = ajustarAtaque(partida, e);
  if (e.mano_secundaria) e = { ...e, arma: Object.values(partida.personajes).find((x) => x.nombre.toLowerCase() === e.atacante.toLowerCase())?.manos?.secundaria ?? e.arma };
  if (aj.dano || aj.bono_arma || aj.desventaja || aj.repetirBajos) e = { ...e, dano: aj.dano ?? e.dano, bono_arma: (e.bono_arma ?? 0) + (aj.bono_arma ?? 0), desventaja: e.desventaja || aj.desventaja, repetir_bajos: aj.repetirBajos };
  if (aj.notas.length) aviso0 = [aviso0, ...aj.notas].filter(Boolean).join("\n");
  // Degollador: su presa estudiada recibe el primer ataque con ventaja y furtivo.
  const presa = aplicarPresa(partida, e);
  e = presa.e;
  if (presa.nota) aviso0 = [aviso0, presa.nota].filter(Boolean).join("\n");
  // Flagelante: la comunión del dolor suma de +1 a +4 al daño según lo cerca que esté de la muerte.
  const dolor = aplicarDolor(partida, e);
  e = dolor.e;
  if (dolor.nota) aviso0 = [aviso0, dolor.nota].filter(Boolean).join("\n");
  let r: ReturnType<typeof atacar>;
  try { r = atacar(partida, e); } catch (err) { presa.deshacer(); throw err; }
  // Flagelante herido por un golpe cuerpo a cuerpo: devuelve el dolor.
  const contacto = curacionPasiva(partida, e, r);
  if (contacto) { r.texto += `\n${contacto}`; r.aviso += `\n${contacto}`; }
  const devuelto = devolverDolor(partida, e, r);
  if (devuelto) { r.texto += `\n${devuelto}`; r.aviso += `\n${devuelto}`; }
  if (soplo) {
    const s = resolverSoplo(partida, e, r, soplo);
    if (s.texto) { r.texto += `\n${s.texto}`; r.aviso += `\n${s.texto}`; }
    if (s.muerto && !r.muerto) r.muerto = s.muerto;
  }
  const nervio = golpeNervio(partida, e, r);
  if (nervio) { r.texto += `\n${nervio}`; r.aviso += `\n${nervio}`; }
  // Segador: anota a quién hirió (sangre fresca) y siega el alma de quien cae (paga Deuda).
  anotarHerida(partida, e, r);
  const siega = cosechar(partida, e, r);
  if (siega) { r.texto += `\n${siega}`; r.aviso += `\n${siega}`; }
  if (aviso0) {
    r.texto = `${aviso0}\n${r.texto}`;
    r.aviso = `${aviso0}\n${r.aviso}`;
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
  // El tiempo normal también corre: fuego, agua que entra, tormenta y aire de los sumergidos. Lo que ya contó su propio tiempo solo deja la marca.
  const accion = (entrada as { accion?: string } | null)?.accion;
  if (nombre === "siguiente_asalto" || (nombre === "agua" && accion === "nadar") || (nombre === "nave" && accion === "navegar")) marcarTiempo(partida);
  else {
    const paso = procesarTiempo(partida);
    if (paso.length) { r.contenido += `\n${paso.join("\n")}`; r.aviso = [r.aviso, ...paso.map((x) => x.split("\n")[0])].filter(Boolean).join("\n"); }
  }
  const monturas = revisarMonturas(partida); // si cae la montura, el jinete cae con ella
  if (monturas.length) { r.contenido += `\n${monturas.join("\n")}`; r.aviso = [r.aviso, ...monturas.map((m) => `🐎 ${m.split("\n")[0]}`)].filter(Boolean).join("\n"); }
  const hambre = revisarSustento(partida); // el reloj puede haber pasado de la hora de comer o beber
  if (hambre.length) { r.contenido += `\n${hambre.join("\n")}`; r.aviso = [r.aviso, ...hambre.map((h) => `🍖 ${h}`)].filter(Boolean).join("\n"); }
  const libres = liberarSiMuere(partida); // un Segador muerto libera las almas que sostenía
  if (libres.length) { r.contenido += `\n${libres.join("\n")}`; r.aviso = [r.aviso, ...libres].filter(Boolean).join("\n"); }
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
        const nuevoEnClase = !previo || previo.clase !== e.clase; // volver a guardar la ficha de siempre no vuelve a tirar el don ni a comprobar el linaje
        let tipoDon: "fisico" | "magico" | "ninguno" = previo && !nuevoEnClase ? previo.don ?? "ninguno" : "ninguno";
        let tiradaDon = "";
        if (nuevoEnClase) {
          if (e.don_arcano !== undefined) tipoDon = e.don_arcano === true ? "magico" : e.don_arcano === false ? "ninguno" : e.don_arcano;
          else {
            // El DM debería haberlo tirado antes de crear al personaje; si no, se tira aquí (una sola vez por jugador).
            const antes = donTirado(partida, e.jugador, e.nombre);
            const { t } = antes ? { t: antes } : tirarDonJugador(partida, e.jugador ?? e.nombre);
            tipoDon = t.tipo;
            tiradaDon = (antes ? "" : "(Tirada hecha ahora: la próxima vez tira el don con tirar_don_arcano ANTES de crear al personaje.) ") + t.texto;
          }
        }
        const don = tipoDon === "magico";
        // Las escuelas de hechicería solo admiten a nobles y ricos; el don arcano lo incluye por fuerza mayor.
        if (e.clase === "Hechicero" && nuevoEnClase && !don && e.linaje !== "noble" && e.linaje !== "rico")
          throw new Error(`Solo los nobles o los ricos entran en las escuelas de hechicería, y ${e.nombre} no nació con el don arcano (${tiradaDon || "sin don"}). Indica linaje «noble» o «rico» en su trasfondo, o cambia de clase: sin dinero ni título no hay escuela.`);
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
          ceniza_fija: partida.personajes[e.nombre]?.ceniza_fija,
          furia: partida.personajes[e.nombre]?.furia,
          anemia: partida.personajes[e.nombre]?.anemia ?? 0,
          sangrado: partida.personajes[e.nombre]?.sangrado ?? 0,
          anemia_progreso: partida.personajes[e.nombre]?.anemia_progreso ?? 0,
          dosis: partida.personajes[e.nombre]?.dosis ?? { curacion: 0, sueno: 0 },
          robado: partida.personajes[e.nombre]?.robado ?? {},
          magia: !nuevoEnClase && previo?.magia ? previo.magia : magiaInicial(e.clase, e.escuelas_magia, don, e.tipos_magia),
          don: tipoDon === "ninguno" ? undefined : tipoDon,
        });
        // Volver a guardar la ficha conserva el estado propio de cada clase (sellos, Deuda, juramento, usos, dardos…).
        if (!nuevoEnClase && previo) {
          const q = previo as unknown as Record<string, unknown>, n = p as unknown as Record<string, unknown>;
          for (const k of ["sellos", "almas", "deuda", "invocaciones", "pielHueso", "gastados", "dardos", "presa", "kit_usos", "anestesia", "sustento", "dotes", "dote_humano", "montura", "sumergido", "nave", "juramento", "papeles", "muestras", "mascota", "manos", "estilo", "leyenda", "mariscal", "veterania"]) if (q[k] !== undefined && n[k] === undefined) n[k] = q[k];
        }
        partida.personajes[p.nombre] = p;
        delete (p as unknown as Record<string, unknown>).dote;
        delete (p as unknown as Record<string, unknown>).opcion_dote;
        let dote_txt = "";
        if (nuevoEnClase && p.raza === "Humano del Faro" && !previo?.dote_humano) {
          if (e.dote) {
            try { dote_txt = `\n🎓 ${tomarDote(p, e.dote, e.opcion_dote)}`; p.dote_humano = p.dotes![p.dotes!.length - 1]; }
            catch (err) { dote_txt = `\n⚠ ${(err as Error).message} Elige otra con dote {accion: elegir, quien: «${p.nombre}», dote}.`; }
          } else dote_txt = `\n🎓 Humano del Faro: tiene una dote GRATIS. Pregunta al jugador cuál quiere (dote {accion: lista}) y guárdala con dote {accion: elegir, quien: «${p.nombre}», dote}.`;
        }
        if (e.clase === "Hechicero" && p.magia && nuevoEnClase) p.magia.origen = don && e.linaje !== "noble" && e.linaje !== "rico" ? "don" : (e.linaje as "noble" | "rico");
        ajustarMaestriaHechicero(p); // un Hechicero de nivel alto ya tiene la maestría de su nivel
        const don_txt = tipoDon === "fisico"
          ? `\n💪 ${tiradaDon || "Don arcano físico."} Nació con un cuerpo prodigioso: competencia +1 y FUE, DES y CON pueden llegar a 28. Revélalo en la historia de forma memorable.`
          : tipoDon === "magico"
            ? `\n✨ ${tiradaDon || "Don arcano mágico."} Nació con talento para la magia${e.clase === "Hechicero" ? " (domina todos los tipos)" : " de su estilo"}: revélalo en la historia de forma memorable.${e.clase === "Mercenario del Cuervo" ? " Pero es un Mercenario, la clase más corriente: su don dormirá hasta que suba de nivel." : ""}`
            : tiradaDon ? `\n· ${tiradaDon}` : "";
        return { contenido: `Ficha guardada:\n${fichaTexto(p)}${don_txt}${dote_txt}`, aviso: `📜 Ficha guardada:\n${fichaTexto(p)}${don_txt}${dote_txt}` };
      }
      case "modificar_personaje": {
        const e = validado.data as z.infer<typeof esquemas.modificar_personaje>;
        const p = buscar(partida, e.nombre);
        const cambios: string[] = [];
        if (e.pv_max !== undefined) p.pv_max = e.pv_max;
        if (e.nivel !== undefined) {
          p.nivel = e.nivel;
          cambios.push(`nivel ${p.nivel}`);
          const nm = ajustarMaestriaHechicero(p);
          if (nm) cambios.push(`maestría ${nm}`);
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
          p.ceniza = Math.max(p.ceniza_fija ?? 0, p.ceniza + e.ceniza_cambio); // las marcas de la furia no se quitan
          cambios.push(`Ceniza ${p.ceniza}`);
        }
        if (e.maestria) {
          if (p.magia.maestria === "profano" && e.maestria !== "profano") despertarMagia(p.clase, p.magia);
          if (p.clase === "Hechicero" && e.maestria === "ascendido" && !p.magia.don) throw new Error(`${p.nombre} no tiene el don arcano: sin él no pasa de archimago.`);
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
        if (sanador) {
          const quieto = motivoNoActua(sanador);
          if (quieto) throw new Error(`${quieto}: no puede tratar heridas.`);
          if (esBarberoC(sanador)) exigirLibre(sanador, "Cirugía");
        }
        const costeReserva = h.podre && (sanador?.nivel ?? 0) >= 5 ? 10 : 5;
        const reservaAntes = sanador?.juramento?.reserva;
        if (e.metodo === "magia divina" && sanador?.clase === "Caballero Juramentado") gastarReserva(sanador, costeReserva); // cerrar una herida cuesta 5 PV de su reserva (10 si además expulsa la Podre)
        const conKit = !!sanador && esBarberoC(sanador) && e.recursos.includes("kit de sanador");
        if (conKit && usosKit(sanador!) <= 0) throw new Error("El kit de sanador se ha quedado sin usos: repónlo antes de tratar con él.");
        const texto = tratar(p, h, { ...e, sanador, nombre_sanador: e.sanador, gastar_mano_firme: sanador ? () => gastarManoFirme(partida, sanador) : undefined });
        // Lo que no llegó a hacerse (la herida ya tenía magia, no sangraba, faltaba el hierro…) no gasta ni reserva ni kit.
        const sinEfecto = /no responde una segunda vez|no tiene efecto|no sangra|Para cauterizar hace falta|No se puede cauterizar|No hay Podre que curar|no se puede|no puede/i.test(texto.split("\n")[0]) || /La herida .* ya recibió magia divina/.test(texto);
        if (sinEfecto && reservaAntes !== undefined && sanador?.juramento) sanador.juramento.reserva = reservaAntes;
        if (conKit && !sinEfecto) gastarKit(sanador!); // el uso se gasta cuando el tratamiento se hizo, no si falló por una orden mal dada
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
        const supervisor = e.supervisa ? buscar(partida, e.supervisa) : undefined;
        const texto = usarVial({ ...e, receptor, supervisor });
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
        const mit = j ? mitigacion(partida, j) : null;
        const esquivan = Object.entries(partida.combate?.turnos ?? {}).filter(([, t]) => t.esquiva).map(([k]) => k.toLowerCase());
        const texto = usarHabilidad(j, h, objetivos, mit?.cdMenos ?? 0, esquivan) + (mit ? `\n📜 Runas: ${mit.texto}.` : "");
        if (j) registrarMagia(partida, { hechizo: h.nombre, lanzador: j.nombre, victima: objetivos[0]?.nombre, negra: esMagiaNegra(undefined, `${h.nombre} ${h.descripcion} ${h.condicion ?? ""}`) && /no-muerto|vampiro|espectro|hechic|brujo|bruja|mago|culti/i.test(`${j.definicion.temple ?? ""} ${j.definicion.nombre}`), lugar: partida.mapa.posicion ? partida.mapa.lugares[partida.mapa.posicion]?.nombre : undefined });
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
        const texto0 = lanzar(p, { ...e, objetivo });
        const hzc = e.hechizo_nuevo ?? (e.hechizo ? buscarHechizo(e.hechizo) : undefined);
        const deuda = hzc && !/no sabe magia|aún no ha jurado|perdió su juramento|juramento roto/.test(texto0) ? deudaPorHechizo(p, Math.max(hzc.circulo, e.circulo ?? hzc.circulo), hzc.nombre) : "";
        const texto = deuda ? `${texto0}\n${deuda}` : texto0;
        const hz = e.hechizo_nuevo ?? (e.hechizo ? buscarHechizo(e.hechizo) : undefined);
        if (hz && !/no sabe magia|aún no ha jurado|perdió su juramento|juramento roto/.test(texto))
          registrarMagia(partida, { hechizo: hz.nombre, escuela: hz.escuela, lanzador: p.nombre, victima: objetivo?.nombre, negra: esMagiaNegra(hz.escuela, hz.nombre), lugar: partida.mapa.posicion ? partida.mapa.lugares[partida.mapa.posicion]?.nombre : undefined });
        const licencia = hz ? avisoLicencia(p, hz) : "";
        return { contenido: `${texto}${licencia ? `\n${licencia}` : ""}\n\nFicha:\n${fichaTexto(p)}`, aviso: `✨ ${texto}` };
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
      case "empunar": {
        const e = validado.data as z.infer<typeof esquemas.empunar>;
        const texto = empunar(partida, e);
        return { contenido: texto, aviso: `✋ ${texto}` };
      }
      case "sangre_ajena": {
        const e = validado.data as z.infer<typeof esquemas.sangre_ajena>;
        const texto = sangreAjena(partida, e);
        return { contenido: texto, aviso: `🩸 ${texto}` };
      }
      case "diagnosticar": {
        const e = validado.data as z.infer<typeof esquemas.diagnosticar>;
        const texto = diagnosticar(partida, e);
        return { contenido: texto, aviso: `🩺 ${texto}` };
      }
      case "amputar": {
        const e = validado.data as z.infer<typeof esquemas.amputar>;
        const texto = amputar(partida, e);
        return { contenido: texto, aviso: `🩺 ${texto}` };
      }
      case "kit_sanador": {
        const e = validado.data as z.infer<typeof esquemas.kit_sanador>;
        const texto = kitSanador(partida, e);
        return { contenido: texto, aviso: e.accion === "ver" ? null : `🩺 ${texto}` };
      }
      case "guadana": {
        const e = validado.data as z.infer<typeof esquemas.guadana>;
        const texto = guadana(partida, e);
        return { contenido: texto, aviso: `💀 ${texto}` };
      }
      case "descarga": {
        const e = validado.data as z.infer<typeof esquemas.descarga>;
        const pre = prepararDescarga(partida, e);
        const rs: { texto: string; aviso: string }[] = [];
        for (const a of pre.ataques) {
          try { rs.push(ataqueCompleto(partida, a)); }
          catch (err) { if (!rs.length) throw err; rs.push({ texto: `(El segundo rayo no se lanzó: ${(err as Error).message})`, aviso: `(El segundo rayo no se lanzó: ${(err as Error).message})` }); }
        }
        const nota = pre.gastar();
        const deuda = pre.deuda();
        return { contenido: `${nota}\n${rs.map((r) => r.texto).join("\n")}\n${deuda}`, aviso: `💀 ${nota}\n${rs.map((r) => r.aviso).join("\n")}\n${deuda}` };
      }
      case "sellar_alma": {
        const e = validado.data as z.infer<typeof esquemas.sellar_alma>;
        const texto = sellarAlma(partida, e);
        return { contenido: texto, aviso: `🔒 ${texto}` };
      }
      case "liberar_alma": {
        const e = validado.data as z.infer<typeof esquemas.liberar_alma>;
        const texto = liberarAlma(partida, e);
        return { contenido: texto, aviso: `🕊 ${texto}` };
      }
      case "entregar_almas": {
        const e = validado.data as z.infer<typeof esquemas.entregar_almas>;
        const texto = entregarAlmas(partida, e);
        return { contenido: texto, aviso: `💀 ${texto}` };
      }
      case "hablar_con_muertos": {
        const e = validado.data as z.infer<typeof esquemas.hablar_con_muertos>;
        const texto = hablarConMuertos(partida, e);
        return { contenido: texto, aviso: `💀 ${texto.split(". ")[0]}.` };
      }
      case "invocacion": {
        const e = validado.data as z.infer<typeof esquemas.invocacion>;
        const texto = invocacion(partida, e);
        return { contenido: texto, aviso: e.accion === "ver" ? null : `💀 ${texto}` };
      }
      case "paso_elusivo": {
        const e = validado.data as z.infer<typeof esquemas.paso_elusivo>;
        const texto = pasoElusivo(partida, e);
        return { contenido: texto, aviso: `💨 ${texto}` };
      }
      case "cadenas": {
        const e = validado.data as z.infer<typeof esquemas.cadenas>;
        const texto = cadenas(partida, e);
        return { contenido: texto, aviso: `⛓ ${texto}` };
      }
      case "estudiar_presa": {
        const e = validado.data as z.infer<typeof esquemas.estudiar_presa>;
        const texto = estudiarPresa(partida, e);
        return { contenido: texto, aviso: `🎯 ${texto}` };
      }
      case "dardos": {
        const e = validado.data as z.infer<typeof esquemas.dardos>;
        const texto = dardos(partida, e);
        return { contenido: texto, aviso: e.accion === "ver" ? null : `🗡 ${texto}` };
      }
      case "forzar_acceso": {
        const e = validado.data as z.infer<typeof esquemas.forzar_acceso>;
        const texto = forzarAcceso(partida, e);
        return { contenido: texto, aviso: `🗝 ${texto}` };
      }
      case "aprender_tipo": {
        const e = validado.data as z.infer<typeof esquemas.aprender_tipo>;
        const texto = aprenderTipo(partida, e);
        return { contenido: texto, aviso: `📚 ${texto}` };
      }
      case "comprender_magia": {
        const e = validado.data as z.infer<typeof esquemas.comprender_magia>;
        const texto = comprenderMagia(partida, e);
        return { contenido: texto, aviso: `📚 ${texto}` };
      }
      case "reabrir_tiradas": {
        const e = validado.data as z.infer<typeof esquemas.reabrir_tiradas>;
        if (!dadosFijados()) throw new Error("No hay tiradas fijadas: solo se usa al repetir un turno corregido. Las tiradas de ahora ya son nuevas.");
        if (e.motivo.trim().length < 15) throw new Error("Explica con una frase qué dato corregido es clave para la tirada.");
        liberarDados();
        return { contenido: `Tiradas liberadas: desde ahora los dados salen nuevos (motivo: ${e.motivo.trim()}).`, aviso: `🎲 Se vuelve a tirar porque el dato corregido es clave para la acción: ${e.motivo.trim()}` };
      }
      case "estilo_combate": {
        const e = validado.data as z.infer<typeof esquemas.estilo_combate>;
        const texto = estiloCombate(partida, e);
        return { contenido: texto, aviso: `⚔ ${texto}` };
      }
      case "papeles": {
        const e = validado.data as z.infer<typeof esquemas.papeles>;
        const texto = papeles(partida, e, (d) => ataqueCompleto(partida, d));
        return { contenido: texto, aviso: `📜 ${texto.split("\n")[0]}` };
      }
      case "mascota": {
        const e = validado.data as z.infer<typeof esquemas.mascota>;
        const texto = mascota(partida, e);
        return { contenido: texto, aviso: e.accion === "ver" ? null : `🐾 ${texto.split("\n")[0]}` };
      }
      case "rastro_magico": {
        const e = validado.data as z.infer<typeof esquemas.rastro_magico>;
        const texto = rastroMagico(partida, e);
        return { contenido: texto, aviso: e.accion === "registrar" ? null : `🔍 ${texto.split("\n")[0]}` };
      }
      case "juramento": {
        const e = validado.data as z.infer<typeof esquemas.juramento>;
        const texto = juramento(partida, e);
        return { contenido: texto, aviso: e.accion === "ver" ? null : `☀ ${texto.split("\n")[0]}` };
      }
      case "romper_juramento": {
        const e = validado.data as z.infer<typeof esquemas.romper_juramento>;
        const texto = romperJuramento(partida, e);
        return { contenido: texto, aviso: `⛓ ${texto.split("\n").slice(0, 2).join("\n")}` };
      }
      case "imposicion_manos": {
        const e = validado.data as z.infer<typeof esquemas.imposicion_manos>;
        const texto = imponerManos(partida, e);
        return { contenido: texto, aviso: `🙌 ${texto.split("\n")[0]}` };
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
        let texto = actualizarTrama(partida, e);
        let xpArco = "";
        if ((e.cerrar_arco ?? e.cerrar_hilo) && /^Arco cerrado/m.test(texto)) {
          try { xpArco = darExperiencia(partida, { accion: "mision", importancia: e.importancia ?? "normal", motivo: "cerrar el arco" }); } catch { /* sin personajes vivos */ }
          if (xpArco) texto += `\n${xpArco}`;
        }
        const visible = texto.split("\n").filter((l) => /^(Pista revelada|Hilo cerrado|Objetivo|Arco)/.test(l));
        const arcos = visible.filter((l) => l.startsWith("Arco")).map((l) => `📖 ${l}`);
        const otros = visible.filter((l) => !l.startsWith("Arco"));
        return { contenido: texto, aviso: [...arcos, ...(otros.length ? [`🧭 ${otros.join("\n")}`] : []), ...(xpArco ? [`✨ ${xpArco.split("\n")[0]}`] : [])].join("\n") || null };
      }
      case "siguiente_asalto": {
        avanzarSiHay(partida, 6);
        const texto = [siguienteAsalto(partida), ...pasarAsaltoFuria(partida), ...curarConRunas(partida), ...pasarAsaltoAgua(partida), ...pasarAsaltoNave(partida)].join("\n");
        return { contenido: texto, aviso: `⏳ ${texto}` };
      }
      case "montura": {
        const e = validado.data as z.infer<typeof esquemas.montura>;
        const texto = montura(partida, e);
        return { contenido: texto, aviso: `🐎 ${texto.split("\n")[0]}` };
      }
      case "agua": {
        const e = validado.data as z.infer<typeof esquemas.agua>;
        const texto = agua(partida, e);
        return { contenido: texto, aviso: e.accion === "ver" ? null : `🌊 ${texto.split("\n").join(" ")}` };
      }
      case "nave": {
        const e = validado.data as z.infer<typeof esquemas.nave>;
        const r = nave(partida, e);
        return { contenido: r.texto, aviso: r.publico };
      }
      case "trampa": {
        const e = validado.data as z.infer<typeof esquemas.trampa>;
        const r = trampa(partida, e as Parameters<typeof trampa>[1]);
        return { contenido: r.texto, aviso: r.publico };
      }
      case "sustento": {
        const e = validado.data as z.infer<typeof esquemas.sustento>;
        const texto = sustento(partida, e);
        return { contenido: texto, aviso: e.accion === "ver" ? null : `🍖 ${texto.split("\n").slice(1).join(" ")}` };
      }
      case "viajar": {
        const e = validado.data as z.infer<typeof esquemas.viajar>;
        const texto = viajar(partida, e);
        return { contenido: texto, aviso: `🥾 ${texto.split("\n")[0]}` };
      }
      case "dote": {
        const e = validado.data as z.infer<typeof esquemas.dote>;
        const texto = dote(partida, e);
        return { contenido: texto, aviso: e.accion === "elegir" ? `🎓 ${texto.split("\n")[0]}` : null };
      }
      case "tirar_don_arcano": {
        const e = validado.data as z.infer<typeof esquemas.tirar_don_arcano>;
        const { t, nueva } = tirarDonJugador(partida, e.jugador);
        const lectura = t.tipo === "fisico" ? "Don FÍSICO: cuerpo prodigioso (competencia +1; FUE, DES y CON hasta 28). Cuéntaselo y que lo tenga en cuenta al crear su personaje." : t.tipo === "magico" ? "Don MÁGICO: talento para la magia (si es Hechicero, domina todos los tipos; si es otra clase, la magia de su estilo despierta). Cuéntaselo y que lo tenga en cuenta al crear su personaje." : "Sin don arcano: un mortal corriente (si quiere ser Hechicero, necesitará linaje noble o rico).";
        const txt = `${nueva ? "" : "(Ya estaba tirado) "}${e.jugador}: ${t.texto}. ${lectura}`;
        return { contenido: txt, aviso: `🎲 ${e.jugador}: ${t.texto}` };
      }
      case "terminar_combate": {
        const furias = terminarTodas(partida, "se apaga al acabar el combate");
        // La experiencia de la victoria: criaturas caídas (ya anotadas) y enemigos con ficha de PNJ que cayeron.
        const caidos = Object.values(partida.combate?.pnj ?? {}).filter((n) => !n.aliado && n.pv !== undefined && n.pv <= 0).map((n) => ({ nombre: n.nombre, px: PX_PNJ[n.veterania ?? "curtido"] ?? 50 }));
        const xp = repartirBajas(partida, caidos);
        if (xp) furias.push(`✨ ${xp.split("\n")[0]}`);
        if (partida.runas) furias.push("📜 Las runas se agotan y los papeles se queman: la zona queda limpia.");
        delete partida.runas;
        limpiarTrasCombate(partida);
        delete partida.combate;
        return { contenido: `Combate cerrado. Caducan las condiciones pasajeras (agarrado, derribado, aturdido…).${furias.length ? "\n" + furias.join("\n") : ""}${xp ? "\n" + xp : ""}`, aviso: furias.length ? `🔥 ${furias.join("\n")}` : null };
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
