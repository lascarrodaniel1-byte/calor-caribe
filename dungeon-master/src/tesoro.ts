// Catálogo de tesoro: lo que se encuentra además de armas y armaduras (materiales, comida, herramientas, documentos, gemas, trofeos…).
// Son DATOS PUROS (sin dependencias de la página): el generador (`botin.ts`) tira sobre ellos y `consultar_reglas {tema: "tesoro"}` los sirve
// bajo demanda; ningún id ni texto del catálogo va en el prompt fijo. Valores bajos a propósito (1-50 po salvo lo raro): en Velmora casi todo tiene precio,
// pero casi nada hace rico. Los nombres de los objetos de consumo (raciones, odres, frascos de sal, hierbas, ganzúas, cadenas…) son EXACTOS: los reconocen
// los regex del motor (sustento, sal, enfermedades, barbero, degollador, flagelante); `tests/motor/t-tesoro.ts` vigila que ningún otro nombre los dispare.
import { tirar } from "./dados.js";

export const CATEGORIAS_TESORO = [
  "moneda", "gema_arte", "material", "ingrediente", "comida_bebida", "herramienta",
  "documento", "llave_sello", "curiosidad", "trofeo", "objeto_trama", "nautico",
] as const;
export type CategoriaTesoro = (typeof CATEGORIAS_TESORO)[number];

export interface EntradaTesoro {
  /** snake_case, único en todo el catálogo. */
  id: string;
  /** Nombre canónico tal como va al inventario. Con `cant`, el generador le añade « (N)». */
  nombre: string;
  categoria: CategoriaTesoro;
  /** Precio de UNA unidad, en po. */
  valor_po: number;
  /** Trozos del nombre de la región donde abunda (vacío = en cualquier parte). «mar» = costas, puertos y naves. */
  regiones?: string[];
  /** Criaturas del bestiario de cuyo cuerpo o guarida sale (nombre exacto). */
  criaturas?: string[];
  /** Peligro mínimo (1-5) del botín en que puede aparecer. */
  peligroMin: 1 | 2 | 3 | 4 | 5;
  /** Qué hace en la mesa (≤ 120 caracteres). */
  uso?: string;
  /** Una pincelada para describirlo (≤ 80 caracteres). */
  sabor?: string;
  /** Material de un arma o proyectil para atacar {material} (coherente con `FuenteDano.material` de danos.ts). */
  material?: "plata" | "hierro frío";
  /** Cuántas unidades salen de una vez ([mín, máx]). */
  cant?: [number, number];
  /** Objeto único con historia: sale una sola vez por partida y se registra con su [O#]. */
  unico?: boolean;
}

type Extra = Partial<Omit<EntradaTesoro, "id" | "nombre" | "categoria" | "valor_po" | "peligroMin">>;
const e = (id: string, nombre: string, categoria: CategoriaTesoro, valor_po: number, peligroMin: EntradaTesoro["peligroMin"], x: Extra = {}): EntradaTesoro => ({ id, nombre, categoria, valor_po, peligroMin, ...x });

const MAR = ["mar"];

export const TESORO: EntradaTesoro[] = [
  // ---- moneda y valores (la moneda suelta la da la fórmula de `oroSugerido`; esto es lo que se cuenta aparte)
  e("diente_de_dios", "Dientes de dios", "moneda", 2, 1, { cant: [2, 6], uso: "Moneda de calle de Velmora: se cambia a 2 po cada uno", sabor: "Fragmentos de hueso pulido, agujereados para el cordel" }),
  e("moneda_antigua", "Monedas de antes de la Caída", "moneda", 5, 2, { cant: [1, 4], sabor: "Con el rostro de un rey que ya nadie recuerda" }),
  e("lingote_plata", "Lingote de plata marcado", "moneda", 50, 3, { uso: "Plata pura: también sirve de material para platear un arma", sabor: "Lleva el punzón de una fundición de Aldenmar" }),
  e("bolsa_cambio", "Bolsa de calderilla", "moneda", 8, 1, { sabor: "Cobre ennegrecido y algún botón" }),

  // ---- gemas, joyas y arte
  e("gema_bruta", "Gema en bruto", "gema_arte", 25, 2, { regiones: ["Karak", "Agujas"], uso: "Un joyero la tasa en 25 po", sabor: "Sin tallar, con la veta aún pegada" }),
  e("perla_negra", "Perla negra", "gema_arte", 40, 3, { regiones: ["mar", "Ciénagas"], sabor: "Nacarada y fría, con un reflejo verdoso" }),
  e("joyas_ahogados", "Joyas de los ahogados", "gema_arte", 35, 2, { criaturas: ["Sirena", "Hombre pez", "Elemental de agua"], regiones: ["mar", "Ciénagas", "Aldenmar"], sabor: "Pendientes y sortijas con restos de algas" }),
  e("pendiente_ambar", "Pendiente de ámbar", "gema_arte", 20, 1, { sabor: "Con un insecto dentro, de antes de la Caída" }),
  e("broche_plata", "Broche de plata ennegrecida", "gema_arte", 30, 2, { sabor: "Una flor cerrada que se abre con la uña" }),
  e("copa_peltre", "Copa de peltre grabada", "gema_arte", 12, 1, { sabor: "Con un brindis en un idioma que nadie habla" }),
  e("estatuilla_dios", "Estatuilla de un dios muerto", "gema_arte", 45, 3, { regiones: ["Marca Hueca", "Aldenmar"], uso: "Un coleccionista o un templo la compra; la Inquisición, la confisca", sabor: "Tallada en hueso, con la cara raspada" }),
  e("rubi_ojo", "Rubí del tamaño de un ojo", "gema_arte", 150, 4, { sabor: "Pesa más de lo que debería" }),
  e("relicario_vacio", "Relicario sin retrato", "gema_arte", 18, 1, { sabor: "Guarda el hueco de un retrato" }),

  // ---- materiales
  e("hierro_frio", "Barra de hierro frío", "material", 15, 1, { material: "hierro frío", regiones: ["Karak", "Velo Rojo"], uso: "Forjado sin fuego: sirve de material «hierro frío» al atacar (duendes y fatas)", sabor: "Pesa poco y quema la mano de los que no son de aquí" }),
  e("plata_barra", "Barra de plata", "material", 25, 2, { material: "plata", uso: "Un herrero la funde para una hoja de plata (material «plata»)", sabor: "Blanda, con vetas de sulfuro negro" }),
  e("bano_plata", "Baño de plata", "material", 30, 2, { material: "plata", cant: [1, 2], uso: "Un frasco platea un arma durante 1 hora o 10 impactos: atacar con material «plata»", sabor: "Un líquido espeso y brillante que huele a metal" }),
  e("frasco_sal", "Frascos de sal", "material", 3, 1, { cant: [2, 5], uso: "Sal para rito o defensa (herramienta sal)", sabor: "Sal gris de salina, sellada con cera" }),
  e("hueso_de_dios", "Astilla de hueso de dios", "material", 40, 3, { regiones: ["Marca Hueca", "Agujas"], uso: "Foco o catalizador raro; la Inquisición paga por ella y por callarla", sabor: "Fría al tacto, con vetas azuladas" }),
  e("cera_duelo", "Cera de duelo", "material", 2, 1, { cant: [1, 3], sabor: "Velas de funeral a medio quemar" }),
  e("brea", "Brea de calafate", "material", 3, 1, { regiones: ["mar", "Ciénagas"], cant: [1, 2], uso: "Sella un casco o un odre; arde despacio", sabor: "Un bote negro y pegajoso" }),
  e("mena_hierro", "Mena de hierro", "material", 4, 1, { regiones: ["Karak"], cant: [1, 3], sabor: "Piedra roja que mancha" }),
  e("escamas_mena", "Escamas de mena", "material", 12, 3, { criaturas: ["Gorgon"], uso: "Un herrero las compra para fundir", sabor: "Del color de la herrumbre" }),
  e("escamas_mar_profundo", "Escamas de mar profundo", "material", 120, 5, { criaturas: ["Bakunawa"], regiones: MAR, uso: "Un armero las paga muy bien: armadura de escamas de mar", sabor: "Del tamaño de un escudo, frías y sin brillo" }),
  e("escama_dragon", "Escama de dragón de ceniza", "material", 150, 4, { criaturas: ["Dragón joven de ceniza"], uso: "Un armero la paga; resiste el fuego", sabor: "Gris, caliente por dentro, con restos de ceniza" }),
  e("ceniza_forjable", "Ceniza forjable", "material", 15, 3, { criaturas: ["Elemental de fuego"], regiones: ["Aldenmar", "Karak"], uso: "Los herreros la usan para templar", sabor: "Aún tibia, sin apagarse del todo" }),
  e("hilo_encerado", "Ovillo de hilo encerado", "material", 2, 1, { cant: [1, 2], sabor: "Hilo de zapatero, resistente" }),
  e("seda_rollo", "Rollo de seda", "material", 25, 2, { regiones: ["Aldenmar"], sabor: "Seda teñida con ceniza, buena para un abrigo" }),
  e("pluma_grifo", "Plumas de grifo", "material", 20, 3, { criaturas: ["Grifo", "Elemental de aire"], regiones: ["Agujas", "Karak"], cant: [2, 5], uso: "Apreciadas para flechas y adornos", sabor: "Largas, doradas y rígidas" }),
  e("cuero_curtido", "Cuero curtido", "material", 6, 1, { sabor: "Una piel gruesa, sin marcar" }),
  e("hueso_gigante", "Hueso de gigante", "material", 30, 4, { criaturas: ["Gigante de hueso"], regiones: ["Marca Hueca"], uso: "Un tallador lo compra; sirve para mangos y estacas grandes", sabor: "Un fémur del largo de una pierna" }),
  e("piedra_runica", "Piedra con escritura antigua", "material", 40, 3, { criaturas: ["Golem de piedra"], regiones: ["Karak"], uso: "Un erudito la compra", sabor: "Letras enanas que nadie ha leído en treinta años" }),
  e("vetas_metal", "Vetas de metal en bruto", "material", 18, 3, { criaturas: ["Elemental de tierra"], regiones: ["Karak"], sabor: "Hebras brillantes en una lasca de roca" }),

  // ---- ingredientes y oficio
  e("hiel_bestia", "Hiel de bestia", "ingrediente", 8, 1, { uso: "Los boticarios la compran; sirve para un veneno barato", sabor: "Una vejiga verde sellada con cera" }),
  e("hierbas_medicinales", "Hierbas medicinales", "ingrediente", 3, 1, { cant: [1, 3], regiones: ["Velo Rojo", "Ciénagas"], uso: "Gastan una unidad al tratar con hierbas (+2 al tratar)", sabor: "Un manojo seco atado con hilo" }),
  e("alcohol_fuerte", "Frascos de alcohol fuerte", "ingrediente", 4, 1, { cant: [1, 3], uso: "Desinfecta una herida (+1 al tratar)", sabor: "Licor de destilería sin etiqueta" }),
  e("hilo_sutura", "Hilo de sutura", "ingrediente", 5, 1, { cant: [1, 3], uso: "Material de cirujano; lo pagan las Hermanas y los barberos", sabor: "Fino, de tripa curada" }),
  e("tinta_ceniza", "Tinta de ceniza", "ingrediente", 3, 1, { sabor: "Un tintero que mancha de gris" }),
  e("aceite_lampara", "Aceite de lámpara", "ingrediente", 2, 1, { cant: [1, 3], uso: "Alimenta una linterna o una antorcha; se cambia como moneda de calle", sabor: "Un frasco turbio" }),
  e("incienso_duelo", "Incienso de duelo", "ingrediente", 4, 1, { cant: [1, 3], sabor: "Tabletas de resina para los ritos de sal y fuego" }),
  e("ceniza_amapola", "Ceniza de amapola", "ingrediente", 6, 2, { regiones: ["Ciénagas", "Agujas"], uso: "Los boticarios la compran: sedante suave", sabor: "Polvo gris que adormece la lengua" }),
  e("colmillo_hidra", "Colmillo de hidra", "ingrediente", 25, 4, { criaturas: ["Hidra"], regiones: ["Ciénagas"], uso: "Veneno que valoran los boticarios", sabor: "Con una gota verde en la punta" }),
  e("higado_troll", "Hígado de troll", "ingrediente", 12, 3, { criaturas: ["Troll de ciénaga"], regiones: ["Ciénagas"], uso: "Los boticarios lo compran; huele a ciénaga", sabor: "Grande como una bota y muy blando" }),
  e("resina_cicatriz", "Resina de cicatriz", "ingrediente", 5, 1, { regiones: ["Velo Rojo"], sabor: "Savia roja endurecida" }),
  e("sebo", "Sebo para velas", "ingrediente", 1, 1, { cant: [2, 4], sabor: "Grasa de matadero" }),

  // ---- comida y bebida (nombres compatibles con sustento: ración, pan, carne seca, queso, odre de agua)
  e("raciones_viaje", "Raciones de viaje", "comida_bebida", 1, 1, { cant: [2, 5], uso: "Comida del grupo (sustento comer)", sabor: "Galleta, pasas y tocino salado" }),
  e("pan_duro", "Pan duro", "comida_bebida", 1, 1, { cant: [2, 4], uso: "Cuenta como comida (sustento comer)", sabor: "Se parte con un martillo" }),
  e("carne_seca", "Carne seca", "comida_bebida", 2, 1, { cant: [1, 4], uso: "Cuenta como comida (sustento comer)", sabor: "No quieras saber de qué animal" }),
  e("queso_curado", "Queso curado", "comida_bebida", 2, 1, { cant: [1, 2], uso: "Cuenta como comida (sustento comer)", sabor: "Un cuñete con cera" }),
  e("odre_agua", "Odre de agua", "comida_bebida", 1, 1, { cant: [1, 2], uso: "Cuenta como bebida (sustento beber)", sabor: "Un odre lleno, sin gusto a nada" }),
  e("vino_negro", "Vino negro de Aldenmar", "comida_bebida", 4, 1, { regiones: ["Aldenmar"], sabor: "Fuerte, de uva negra" }),
  e("cerveza_ceniza", "Cerveza de ceniza", "comida_bebida", 2, 1, { cant: [1, 3], sabor: "Turbia, de cebada raquítica" }),
  e("licor_ciruela", "Licor de ciruela", "comida_bebida", 6, 2, { regiones: ["Velo Rojo"], sabor: "Dulce y traicionero" }),
  e("miel_oscura", "Miel oscura", "comida_bebida", 5, 2, { regiones: ["Velo Rojo", "Agujas"], sabor: "Densa, de colmenas silvestres" }),
  e("pescado_ahumado", "Pescado ahumado", "comida_bebida", 2, 1, { regiones: ["mar", "Ciénagas"], cant: [1, 3], uso: "Comida que aguanta semanas", sabor: "Salado y duro como un zapato" }),
  e("te_corteza", "Té de corteza", "comida_bebida", 2, 1, { cant: [1, 3], sabor: "Amargo y caliente, quita el frío" }),

  // ---- herramientas de oficio
  e("ganzuas", "Ganzúas", "herramienta", 25, 1, { uso: "Herramientas de ladrón (abren cerraduras con maña)", sabor: "Un estuche de cuero con siete ganchos" }),
  e("herramientas_ladron", "Herramientas de ladrón", "herramienta", 25, 2, { uso: "Sin ellas, desventaja al forzar o desarmar" }),
  e("kit_curas", "Kit de sanador", "herramienta", 25, 1, { uso: "Vendas, hilo y ungüentos: 10 usos al tratar heridas", sabor: "Una bolsa de lona con el emblema borrado" }),
  e("herramientas_cirujano", "Herramientas de cirujano", "herramienta", 60, 3, { uso: "Para heridas graves y cirugía mayor", sabor: "Bisturíes de acero ennegrecido en un estuche" }),
  e("sierra_huesos", "Sierra de huesos", "herramienta", 15, 2, { uso: "Imprescindible para amputar (1d6 cortante)", sabor: "Dientes finos y manchados" }),
  e("estacas_madera", "Estacas de madera", "herramienta", 1, 1, { cant: [3, 6], sabor: "Afiladas a cuchillo" }),
  e("cadenas_hierro", "Cadenas de hierro", "herramienta", 10, 2, { uso: "Una buena cadena de combate o para atar; las usan los flagelantes", sabor: "Eslabones cortos y gruesos" }),
  e("linterna_sorda", "Linterna sorda", "herramienta", 8, 1, { uso: "Luz tapable; gasta aceite de lámpara", sabor: "Con el cristal ahumado" }),
  e("cuerda_canamo", "Cuerda de cáñamo (15 m)", "herramienta", 1, 1, { sabor: "Gruesa y sin nudos" }),
  e("aparejos_navegante", "Aparejos de navegante", "herramienta", 25, 2, { regiones: MAR, uso: "Brújula, compás y tablas: ayudan a no perderse en el mar", sabor: "Latón verdoso por la sal" }),
  e("daga_plata", "Daga de plata", "herramienta", 100, 3, { material: "plata", uso: "Arma 1d4 perforante, sutil: atacar con material «plata» (no es mágica)", sabor: "Un filo blanco que no pierde el brillo" }),
  e("cuchillo_hierro_frio", "Cuchillo de hierro frío", "herramienta", 40, 2, { material: "hierro frío", regiones: ["Karak", "Velo Rojo"], uso: "Arma 1d4 cortante, sutil: atacar con material «hierro frío»", sabor: "Forjado sin fuego, mate" }),
  e("yesca_pedernal", "Yesca y pedernal", "herramienta", 1, 1, { sabor: "Una cajita de latón" }),

  // ---- documentos
  e("carta_sin_enviar", "Carta sin enviar", "documento", 2, 1, { criaturas: ["Hambriento"], uso: "Puede abrir una pista, un nombre o un favor", sabor: "Doblada tres veces, con la tinta corrida" }),
  e("carta_desertor", "Carta de un desertor", "documento", 8, 1, { uso: "Nombra a quien lo ayudó a huir", sabor: "Letra apresurada, sin firma" }),
  e("mapa_contrabandistas", "Mapa de contrabandistas", "documento", 30, 2, { regiones: ["Ciénagas", "Aldenmar", "mar"], uso: "Marca un escondrijo o una ruta; un buen punto de partida de misión", sabor: "Trazado con carbón sobre piel" }),
  e("plano_cripta", "Plano de una cripta", "documento", 40, 3, { regiones: ["Marca Hueca", "Aldenmar", "Karak"], uso: "Da ventaja al orientarse en esa cripta", sabor: "Con una sala tachada" }),
  e("diario_soldado", "Diario de un soldado", "documento", 5, 1, { regiones: ["Marca Hueca"], uso: "Pista de una batalla o de un tesoro enterrado", sabor: "Las últimas páginas están en blanco" }),
  e("libro_cuentas", "Libro de cuentas", "documento", 20, 2, { regiones: ["Aldenmar"], uso: "Deudas y deudores: un gancho de chantaje o misión", sabor: "Cifras, nombres y una mancha de vino" }),
  e("grimorio_menor", "Grimorio menor", "documento", 60, 3, { uso: "Páginas de magia negra: la Inquisición mata por tenerlo; un erudito, paga", sabor: "Encuadernado en piel de algo que no era vaca" }),
  e("orden_inquisicion", "Orden de la Inquisición sin sellar", "documento", 15, 2, { regiones: ["Aldenmar"], uso: "Con un sello, abre puertas; sin él, es papel", sabor: "Papel grueso con un hueco para el lacre" }),
  e("testamento_cerrado", "Testamento sin abrir", "documento", 15, 1, { sabor: "Con el lacre intacto" }),
  e("salvoconducto_falso", "Salvoconducto falsificado", "documento", 20, 2, { regiones: ["Aldenmar", "Ciénagas"], uso: "Pasa una puerta si nadie lo mira de cerca", sabor: "El sello está al revés" }),
  e("bestiario_anotado", "Bestiario anotado", "documento", 35, 3, { uso: "Un erudito lo compra; da una pista de una criatura (saber descubrir)", sabor: "Notas al margen en tres letras distintas" }),

  // ---- llaves y sellos
  e("llave_sin_cerradura", "Llave de hierro sin cerradura", "llave_sello", 5, 1, { sabor: "Con un número grabado" }),
  e("llave_cripta", "Llave de una cripta", "llave_sello", 12, 2, { regiones: ["Marca Hueca", "Aldenmar"], uso: "Abre una puerta que el DM elija", sabor: "Una llave larga con un cuervo grabado" }),
  e("sello_gremio", "Sello de lacre de un gremio", "llave_sello", 15, 2, { regiones: ["Aldenmar"], uso: "Autentica un papel de ese gremio", sabor: "Un cilindro de bronce" }),
  e("anillo_sello", "Anillo de sello de una casa menor", "llave_sello", 40, 3, { regiones: ["Aldenmar", "Marca Hueca"], sabor: "Ennegrecido por los años" }),

  // ---- curiosidades
  e("reloj_arena_parado", "Reloj de arena detenido", "curiosidad", 10, 2, { sabor: "La arena no cae, por mucho que lo vuelques" }),
  e("muneca_sin_cara", "Muñeca de trapo sin cara", "curiosidad", 3, 1, { sabor: "Huele a cuna" }),
  e("espejo_ennegrecido", "Espejo ennegrecido", "curiosidad", 12, 2, { sabor: "Devuelve a veces otra cara" }),
  e("campanilla_muda", "Campanilla que no suena", "curiosidad", 8, 2, { sabor: "Se mueve y no hace ruido" }),
  e("dado_hueso", "Dado de hueso trucado", "curiosidad", 2, 1, { sabor: "Siempre cae en el mismo lado" }),
  e("cuenta_rosario", "Cuenta de rosario de un dios muerto", "curiosidad", 20, 3, { regiones: ["Agujas", "Aldenmar"], sabor: "Pulida por mil dedos" }),
  e("cristal_vibrante", "Cristal que vibra con el viento", "curiosidad", 30, 4, { criaturas: ["Elemental de aire"], regiones: ["Agujas"], sabor: "Suena bajito cuando nadie lo toca" }),
  e("ascua_eterna", "Ascua que no se apaga", "curiosidad", 35, 4, { criaturas: ["Elemental de fuego"], uso: "Enciende fuego sin yesca; da luz tenue", sabor: "Se mantiene viva en un frasco" }),
  e("agua_pura", "Ampolla de agua pura", "curiosidad", 15, 3, { criaturas: ["Elemental de agua"], uso: "Sirve para ritos; también se puede beber", sabor: "Sin un solo mineral" }),

  // ---- trofeos de criatura
  e("piel_lobo_ceniza", "Piel de lobo de ceniza", "trofeo", 6, 1, { criaturas: ["Lobo de Ceniza"], uso: "Un curtidor la compra; abriga", sabor: "Pelaje gris y áspero" }),
  e("colmillos_lobo_ceniza", "Colmillos de lobo de ceniza", "trofeo", 3, 1, { criaturas: ["Lobo de Ceniza"], cant: [2, 4] }),
  e("dientes_ghul", "Dientes de ghul", "trofeo", 4, 2, { criaturas: ["Ghul de las fosas"], cant: [2, 5], uso: "Un boticario los muele para remedios", sabor: "Largos y amarillos" }),
  e("mortaja_ghul", "Mortaja sucia de ghul", "trofeo", 3, 2, { criaturas: ["Ghul de las fosas"], sabor: "Aún huele a tumba" }),
  e("colmillo_ogro", "Colmillos de ogro", "trofeo", 8, 2, { criaturas: ["Ogro"], cant: [1, 2], uso: "Un señor de la guerra los paga como adorno", sabor: "Amarillos, del tamaño de una daga" }),
  e("cinturon_ogro", "Cinturón de ogro con trofeos", "trofeo", 12, 2, { criaturas: ["Ogro"], sabor: "Colgado de orejas secas y botones" }),
  e("aguijon_wyverno", "Aguijón de wyverno", "trofeo", 45, 3, { criaturas: ["Wyverno"], regiones: ["Agujas", "Marca Hueca"], uso: "Veneno potente; los boticarios y la Inquisición lo pagan", sabor: "Un garfio con la punta teñida de verde" }),
  e("colmillo_wyverno", "Colmillo de wyverno", "trofeo", 30, 3, { criaturas: ["Wyverno"], sabor: "Un diente largo, apto para una lanza" }),
  e("ojo_basilisco", "Ojo de basilisco", "trofeo", 60, 3, { criaturas: ["Basilisco"], regiones: ["Karak", "Marca Hueca"], uso: "Un erudito lo compra; mirarlo ya no petrifica", sabor: "Gris, helado y sin vida" }),
  e("puas_manticora", "Púas de mantícora", "trofeo", 35, 3, { criaturas: ["Mantícora"], regiones: ["Marca Hueca"], cant: [2, 4], uso: "Puntas de dardo de calidad", sabor: "Cola de espinas largas" }),
  e("mechon_banshee", "Mechón de banshee", "trofeo", 25, 4, { criaturas: ["Banshee del Velo"], regiones: ["Velo Rojo"], uso: "Un erudito o un sacerdote lo compra; suena con el viento", sabor: "Cabello blanco que se enfría con el aire" }),
  e("fragmento_apostol", "Fragmento de apóstol", "trofeo", 60, 4, { criaturas: ["Apóstol"], uso: "Resto de ceniza y hueso de dios: la Inquisición lo paga con discreción", sabor: "Una esquirla negra que susurra" }),
  e("colmillos_ulfhedinn", "Colmillos de ulfhedinn", "trofeo", 25, 4, { criaturas: ["Ulfhedinn"], cant: [1, 2], uso: "La Inquisición los paga como trofeo de varg", sabor: "Largos y grises" }),
  e("piel_lobo_gris", "Piel de lobo gris", "trofeo", 18, 4, { criaturas: ["Ulfhedinn"], uso: "Abriga contra el frío; puede pasar por disfraz de varg", sabor: "Gruesa y manchada" }),
  e("garras_hombre_oso", "Garras de hombre oso", "trofeo", 20, 4, { criaturas: ["Hombre oso"], cant: [1, 2], sabor: "Curvas, del largo de un cuchillo" }),
  e("piel_oso_gris", "Piel de oso gris", "trofeo", 30, 4, { criaturas: ["Hombre oso"], uso: "Abriga muchísimo", sabor: "Pesada y enorme" }),
  e("astas_hueso", "Astas de hueso", "trofeo", 120, 4, { criaturas: ["Wendigo"], uso: "Quien las lleva no pasa frío, pero el hambre le crece", sabor: "Frías al tacto, con un hueco para el cráneo" }),
  e("huevo_grifo", "Huevo de grifo", "trofeo", 60, 3, { criaturas: ["Grifo"], regiones: ["Agujas", "Karak"], uso: "Un criador lo compra; con cuidado, nace un grifo", sabor: "Dorado y cálido" }),
  e("escamas_hombre_pez", "Escamas de hombre pez", "trofeo", 4, 2, { criaturas: ["Hombre pez"], cant: [3, 8], uso: "Amuleto barato contra el agua", sabor: "Verdegrises y aún húmedas" }),
  e("escamas_sirena", "Escama de sirena", "trofeo", 15, 3, { criaturas: ["Sirena"], uso: "Amuleto contra el agua", sabor: "Irisada como una perla" }),
  e("escamas_hombre_lagarto", "Escamas de hombre lagarto", "trofeo", 4, 2, { criaturas: ["Hombre lagarto"], cant: [3, 8], uso: "Los curtidores las compran por poco", sabor: "Pardas y duras" }),
  e("lanza_hueso", "Lanza de hueso", "trofeo", 3, 2, { criaturas: ["Hombre lagarto", "Hombre pez"], sabor: "Un arma de tribu, bien afilada" }),
  e("plumas_arpia", "Plumas sucias de arpía", "trofeo", 2, 2, { criaturas: ["Arpía"], cant: [3, 8], sabor: "Pegajosas y negras" }),
  e("nido_arpia", "Nido de objetos robados", "trofeo", 25, 2, { criaturas: ["Arpía"], regiones: ["Agujas"], uso: "Contiene baratijas: botones, monedas y algún anillo", sabor: "Un revoltijo de lo que brilla" }),
  e("boton_duende", "Botón y cuchara robados", "trofeo", 2, 1, { criaturas: ["Duende"], sabor: "Dos cosas que alguien echaba en falta" }),
  e("corona_astas", "Corona de astas del bosque", "trofeo", 90, 4, { criaturas: ["Leshen"], regiones: ["Velo Rojo"], uso: "Reliquia del bosque: protege contra la Podre de los árboles", sabor: "Madera viva que aún crece" }),
  e("semillas_viejas", "Semillas viejas", "trofeo", 10, 3, { criaturas: ["Leshen"], regiones: ["Velo Rojo"], sabor: "Con el calor de algo vivo" }),
  e("ovillo_aviso", "Ovillo de hilo de aviso", "trofeo", 45, 4, { criaturas: ["Moira"], uso: "Cambia de color cuando el peligro está cerca", sabor: "Un hilo gris que se vuelve rojo" }),
  e("tijeras_hueso", "Tijeras de hueso", "trofeo", 25, 4, { criaturas: ["Moira"], sabor: "Cortan cualquier hilo, aunque no sea de lana" }),
  e("organos_aprovechables", "Órganos aprovechables", "trofeo", 25, 3, { criaturas: ["Golem de carne"], uso: "La Barbería los paga", sabor: "Conservados en sal" }),
  e("sutura_calidad", "Sutura de calidad", "trofeo", 15, 3, { criaturas: ["Golem de carne"], uso: "+1 a tratar una herida", sabor: "Hilo trenzado y limpio" }),
  e("talla_sagrada", "Fragmento de una talla sagrada", "trofeo", 25, 2, { criaturas: ["Gárgola"], uso: "Una reliquia menor de un dios muerto", sabor: "Piedra con una oración tallada" }),
  e("perla_luna", "Perla de luna", "trofeo", 150, 5, { criaturas: ["Bakunawa"], regiones: MAR, uso: "Solo brilla en noches de luna llena", sabor: "Del tamaño de un puño y blanca como el hueso" }),

  // ---- náutico
  e("carta_marina", "Carta marina", "nautico", 35, 2, { regiones: MAR, uso: "Corrientes y bajíos de un tramo de costa; ventaja al navegar por él", sabor: "Pergamino con manchas de agua salada" }),
  e("ancla_pequena", "Ancla pequeña", "nautico", 20, 2, { regiones: MAR, sabor: "Un garfio de hierro con una argolla" }),
  e("cofre_naufragio", "Cofre de naufragio", "nautico", 60, 3, { regiones: MAR, uso: "Lleno de agua y sal: dentro hay calderilla y una carta", sabor: "Hinchado por el mar, de cierre oxidado" }),
  e("pertrechos", "Pertrechos de a bordo", "nautico", 15, 1, { regiones: MAR, uso: "Reparan una nave: ayudan a remendar", sabor: "Clavos, cabos y estopa" }),
  e("astrolabio", "Astrolabio de latón", "nautico", 40, 3, { regiones: MAR, sabor: "Con los grados medio borrados" }),
  e("bandera_nave", "Bandera de una nave hundida", "nautico", 10, 2, { regiones: MAR, sabor: "Un trapo con un nombre medio borrado" }),
  e("diario_bordo", "Diario de a bordo", "nautico", 20, 2, { regiones: MAR, uso: "Un rumbo, una carga y un motín", sabor: "Páginas pegadas por la sal" }),
  e("red_pesca", "Red de pesca", "nautico", 5, 1, { regiones: MAR, sabor: "Con un agujero del tamaño de un hombre" }),
  e("farol_nave", "Farol de nave", "nautico", 10, 1, { regiones: MAR, uso: "Luz a prueba de viento", sabor: "Con el cristal verdoso" }),
  e("cuaderno_mareas", "Cuaderno de mareas", "nautico", 15, 2, { regiones: MAR, uso: "Horas de marea de un puerto; ayuda a entrar y salir", sabor: "Tablas escritas por una mano firme" }),

  // ---- objetos únicos con historia (solo lo público de Velmora; salen una vez por partida y se registran con su [O#])
  e("sello_mariscal", "Sello de mariscal de la Compañía", "objeto_trama", 300, 4, { unico: true, criaturas: ["Hugin, el Pensamiento"], uso: "Abre cualquier cuartel de la Compañía del Cuervo Negro", sabor: "Un cuervo en bronce, gastado por la mano" }),
  e("libro_cuentas_compania", "Libro de cuentas de la Compañía", "objeto_trama", 400, 4, { unico: true, criaturas: ["Munin, la Memoria"], uso: "Cada nombre y cada deuda de los contratos de la Compañía", sabor: "Cuero negro, cada página firmada" }),
  e("diario_kuru", "Diario del Cazador de Leyendas", "objeto_trama", 250, 5, { unico: true, criaturas: ["Kuru, el Cazador de Leyendas"], uso: "Cómo mató a cada leyenda y a quién busca ahora", sabor: "Tapas de escama, con un ojo dibujado" }),
  e("farol_primera_hoguera", "Farol de la primera hoguera de Aldenmar", "objeto_trama", 120, 3, { unico: true, regiones: ["Aldenmar"], uso: "Su llama no se apaga con el viento; los vigías de las murallas la reconocen", sabor: "Latón viejo con una llama que no vacila" }),
  e("llave_consejo", "Llave de una sala del Consejo de Ceniza", "objeto_trama", 90, 3, { unico: true, regiones: ["Aldenmar"], uso: "Abre una puerta del Consejo; quien la lleva debe explicarlo", sabor: "Una llave con la ceniza grabada" }),
  e("cartilla_inquisidor", "Cartilla de un inquisidor de la Llama Gris", "objeto_trama", 60, 2, { unico: true, regiones: ["Aldenmar"], uso: "Identifica a un inquisidor; usarla es delito si no lo eres", sabor: "Con su nombre y una llama sellada" }),
  e("brasero_llama_gris", "Brasero de campaña de la Llama Gris", "objeto_trama", 80, 2, { unico: true, uso: "Calienta un campamento; la Inquisición reconoce el modelo", sabor: "Hierro negro con un asa de cadena de fuego" }),
  e("cuaderno_enfermeria", "Cuaderno de enfermería de las Hermanas de la Sutura", "objeto_trama", 70, 2, { unico: true, uso: "Notas de curas: +1 a tratar una herida similar a las anotadas", sabor: "Cada página, un paciente con su evolución" }),
  e("aguja_sutura_orden", "Aguja de sutura de la Orden", "objeto_trama", 150, 3, { unico: true, uso: "Una sanadora o un barbero hace con ella una cura mejor (+1 a tratar)", sabor: "Plata fina con una hebra del hilo de las Hermanas" }),
  e("placa_garra", "Placa de Garra de la Compañía del Cuervo", "objeto_trama", 45, 2, { unico: true, uso: "Acredita un rango de la Compañía; un cuartel la reconoce", sabor: "Chapa de bronce con un cuervo y un número" }),
  e("estandarte_cuervo", "Estandarte de una compañía disuelta", "objeto_trama", 30, 2, { unico: true, sabor: "Un cuervo roto en el centro y el borde quemado" }),
  e("pagare_corax", "Pagaré firmado por un Corax", "objeto_trama", 100, 3, { unico: true, uso: "La Compañía lo cobra en un cuartel o lo recompra con favor", sabor: "Firma limpia y una cifra grande" }),
  e("cirio_corte", "Cirio negro de la Corte Pálida", "objeto_trama", 110, 3, { unico: true, regiones: ["Marca Hueca"], uso: "Los pálidos lo reconocen; su luz no calienta", sabor: "Cera negra con un nombre grabado" }),
  e("invitacion_castillo", "Invitación lacrada de un castillo de la Marca", "objeto_trama", 140, 4, { unico: true, regiones: ["Marca Hueca"], uso: "Una entrada a una cena de la Corte Pálida: abre la puerta, no la salida", sabor: "Lacre negro con un cuervo y una luna" }),
  e("cuaderno_devoto", "Cuaderno de un Devoto del Dios Hambriento", "objeto_trama", 55, 2, { unico: true, regiones: ["Ciénagas", "Aldenmar"], uso: "Nombres y lugares de reunión del culto", sabor: "Letra apretada y un dibujo de una boca" }),
  e("ofrenda_huesos", "Ofrenda de huesos atados con hilo rojo", "objeto_trama", 25, 2, { unico: true, regiones: ["Ciénagas"], sabor: "Pequeños huesos de un niño o de una rata" }),
  e("flagelo_monje", "Flagelo de un monje de las Agujas", "objeto_trama", 40, 2, { unico: true, regiones: ["Agujas"], uso: "Un flagelante lo reconoce y lo respeta", sabor: "Tiras de cuero con nudos, gastadas por el uso" }),
  e("hoja_oracion", "Hoja de plegaria de un monasterio de las Agujas", "objeto_trama", 35, 2, { unico: true, regiones: ["Agujas"], uso: "Una plegaria a los dioses muertos: un monje lo agradece", sabor: "Papel fino, con manchas de sangre seca" }),
  e("sol_hierro", "Sol de hierro de un caballero juramentado", "objeto_trama", 85, 3, { unico: true, uso: "Símbolo de Ka'i: un caballero lo reconoce y lo venera", sabor: "Un sol de hierro, con una muesca por voto" }),
  e("pico_karak", "Pico enano de Karak-Dûm", "objeto_trama", 60, 2, { unico: true, regiones: ["Karak"], uso: "Un enano lo reconoce como obra de Karak-Dûm", sabor: "Mango de hueso y una runa de mina" }),
  e("placa_mina", "Placa de mina de Karak-Dûm", "objeto_trama", 90, 3, { unico: true, regiones: ["Karak"], uso: "Un número de turno: nadie ha pasado lista desde hace treinta años", sabor: "Una chapa de cobre ennegrecida" }),
  e("mapa_pilotes", "Mapa de aldeas sobre pilotes de Hollín", "objeto_trama", 40, 2, { unico: true, regiones: ["Ciénagas"], uso: "Marca las aldeas, los senderos firmes y un par de sitios que mejor evitar", sabor: "Dibujado a pluma sobre un trozo de vela" }),
  e("salvoconducto_hollin", "Salvoconducto de los contrabandistas de Hollín", "objeto_trama", 50, 2, { unico: true, regiones: ["Ciénagas"], uso: "Pasa un puesto de contrabandistas sin pagar peaje", sabor: "Un sello de cera con una carpa" }),
  e("frasco_savia_roja", "Frasco de savia roja del Velo Rojo", "objeto_trama", 35, 2, { unico: true, regiones: ["Velo Rojo"], uso: "Los boticarios la usan en tintes y ritos", sabor: "Se vuelve más oscura con la luna" }),
  e("silbato_voces", "Silbato de hueso que imita voces", "objeto_trama", 45, 3, { unico: true, regiones: ["Velo Rojo"], uso: "Imita una voz muerta: ventaja al engañar, pero algo contesta", sabor: "Tallado por un elfo marchito" }),
  e("corona_plomo", "Corona de plomo de un rey de la Marca", "objeto_trama", 200, 4, { unico: true, regiones: ["Marca Hueca"], uso: "Un coleccionista o un noble la compra", sabor: "Un aro pesado, con las puntas melladas" }),
  e("campana_aviso", "Campana de aviso de la Marca", "objeto_trama", 55, 2, { unico: true, regiones: ["Marca Hueca"], uso: "Suena sola cuando hay no-muertos a menos de una legua", sabor: "Una campanilla de bronce, con el badajo envuelto" }),
];

export const tesoroPorId = (id: string): EntradaTesoro | undefined => TESORO.find((x) => x.id === id);

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Entradas de una categoría o de una criatura (por nombre, sin tildes ni mayúsculas, con coincidencia parcial). */
export function tesoroDe(clave: string): EntradaTesoro[] {
  const k = norm(clave);
  if ((CATEGORIAS_TESORO as readonly string[]).includes(k.replace(/ /g, "_"))) return TESORO.filter((x) => x.categoria === k.replace(/ /g, "_"));
  return TESORO.filter((x) => x.criaturas?.some((c) => norm(c).includes(k) || k.includes(norm(c))));
}

// ---------------------------------------------------------------------------------------------- moneda y valor mágico (propuesta)

/** Moneda sugerida por peligro (po). Dados y multiplicador: P1 1d6, P2 3d6, P3 2d8×2, P4 4d10×3, P5 6d10×10. */
export const MONEDA_PELIGRO: Record<1 | 2 | 3 | 4 | 5, { dados: string; mult: number }> = {
  1: { dados: "1d6", mult: 1 },
  2: { dados: "3d6", mult: 1 },
  3: { dados: "2d8", mult: 2 },
  4: { dados: "4d10", mult: 3 },
  5: { dados: "6d10", mult: 10 },
};
/** Multiplicador por origen (la compra no da moneda: la gasta). */
export const MULT_ORIGEN: Record<"compra" | "saqueo" | "hallazgo" | "jefe", number> = { compra: 0, saqueo: 0.5, hallazgo: 1, jefe: 2 };

/** Moneda sugerida para un botín: tira los dados del peligro, multiplica y aplica el origen (mínimo 1 po si el origen da algo). */
export function oroSugerido(peligro: number, origen: keyof typeof MULT_ORIGEN): number {
  const m = MULT_ORIGEN[origen];
  if (!m) return 0;
  const p = MONEDA_PELIGRO[Math.min(5, Math.max(1, Math.round(peligro))) as 1 | 2 | 3 | 4 | 5];
  return Math.max(1, Math.round(tirar(p.dados).total * p.mult * m));
}

/** Precio de un objeto de equipo. Fórmula común: encantado y maldito = base×10+200; reliquia = encantado + 5.000 (techo 19.000, por debajo de una legendaria: 20.000). */
export function precioEquipo(base: number, calidad: "encantado" | "maldito" | "reliquia"): number {
  const encantado = base * 10 + 200;
  return calidad === "reliquia" ? Math.min(19000, encantado + 5000) : encantado;
}

// ---------------------------------------------------------------------------------------------- texto bajo demanda

const lineaTesoro = (x: EntradaTesoro) => `${x.nombre}${x.cant ? ` (${x.cant[0]}-${x.cant[1]})` : ""} ${x.valor_po} po · P${x.peligroMin}+${x.regiones?.length ? ` · ${x.regiones.join("/")}` : ""}${x.criaturas ? ` · ${x.criaturas.join("/")}` : ""}${x.material ? ` · material ${x.material}` : ""}${x.uso ? ` — ${x.uso}` : ""}`;

export const REGLAS_TESORO = `## Tesoro y botín (generar_botin, catálogo)
- generar_botin {origen, cantidad, peligro?, region?, criatura?, categorias?}: con peligro (1-5), región o criatura reparte además de equipo materiales, comida, herramientas, documentos, gemas, trofeos de la criatura y objetos únicos, y sugiere oro (oro_cambio, NO se aplica solo: súmalo con modificar_personaje). Una llamada por saqueo; cantidad = nº de objetos. Sin esos datos, el botín antiguo (equipo y viales).
- Oro por peligro: P1 1d6, P2 3d6, P3 2d8×2, P4 4d10×3, P5 6d10×10 po; ×0,5 saqueo, ×1 hallazgo, ×2 jefe (la compra no da oro). Equipo mágico en saqueos comunes: ~0% P1-2, 5% P3, 12% P4, 25% P5; hallazgos y jefes dan más.
- Precios de equipo: encantado/maldito = base×10+200; reliquia = encantado+5.000 (techo 19.000); legendaria 20.000.
- Los objetos únicos con historia se registran con su [O#]. Materiales: «plata» y «hierro frío» se pasan como material en atacar. Consulta el catálogo con consultar_reglas {tema: "tesoro", nombre: categoría o criatura}.
- Categorías: ${CATEGORIAS_TESORO.join(", ")}.`;

/** consultar_reglas {tema: "tesoro", nombre?}: sin nombre, las reglas y el recuento por categoría; con categoría o criatura, sus entradas. */
export function textoTesoro(nombre?: string): string {
  if (!nombre?.trim()) return `${REGLAS_TESORO}\n\nEntradas por categoría: ${CATEGORIAS_TESORO.map((c) => `${c} ${TESORO.filter((x) => x.categoria === c).length}`).join(", ")}.`;
  const unico = tesoroPorId(nombre.trim());
  const l = unico ? [unico] : tesoroDe(nombre);
  return l.length ? `Tesoro «${nombre}» (${l.length}):\n${l.map((x) => `- ${lineaTesoro(x)}`).join("\n")}` : `Nada en el catálogo para «${nombre}». Categorías: ${CATEGORIAS_TESORO.join(", ")}; o el nombre de una criatura.`;
}
