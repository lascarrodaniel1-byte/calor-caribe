import { TERMINOS_FECHA } from "@/lib/terminos";

/** Texto de los términos de uso y del aviso de privacidad.
 *  Se muestra en la pantalla de aceptación y en /terminos. */
export default function TextoTerminos() {
  return (
    <div className="prose-app text-sm">
      <p className="text-xs text-muted">Última actualización: {TERMINOS_FECHA}.</p>

      <h2>1. Qué es Calor Caribe</h2>
      <p>
        Calor Caribe es una herramienta <strong>informativa y de orientación</strong>{" "}
        para la región Caribe colombiana. Estima la sensación térmica a partir de
        datos públicos de clima, ayuda a calcular el consumo eléctrico del hogar y
        propone un reparto de uso de electrodomésticos. Todos los resultados son{" "}
        <strong>estimaciones</strong>.
      </p>

      <h2>2. No es asesoría médica</h2>
      <p>
        Los niveles de alerta y las recomendaciones de salud son generales y no
        reemplazan la valoración de un profesional. No tomes ni suspendas
        medicamentos con base en esta app. Ante síntomas de golpe de calor
        (confusión, desmayo, piel caliente y seca, convulsiones){" "}
        <strong>llama de inmediato a la línea 123</strong> o acude a un servicio
        de urgencias.
      </p>

      <h2>3. No es tu factura oficial</h2>
      <p>
        Los cálculos de consumo y de costo son aproximados: dependen de los datos
        que ingreses y no incluyen todos los conceptos de la factura (alumbrado
        público, aseo, reconexiones, variaciones diarias de tarifa, etc.). Los
        porcentajes de subsidio y contribución son los máximos de ley y pueden ser
        menores según la resolución tarifaria del mes. Verifica siempre con tu
        operador (Air-e, Afinia o Sopesa) y tu factura real.
      </p>

      <h2>4. No somos una entidad oficial</h2>
      <p>
        Este proyecto no está afiliado ni representa al IDEAM, la NOAA, Open-Meteo,
        Air-e, Afinia, Sopesa, la CREG ni ninguna autoridad. Los nombres se usan
        solo como referencia.
      </p>

      <h2>5. Datos y privacidad</h2>
      <p>
        <strong>Se guarda solo en tu dispositivo</strong> (almacenamiento local
        del navegador), sin cuentas ni servidor de datos: comorbilidades,
        municipio, electrodomésticos, precio del kWh, estrato y metas de consumo.
      </p>
      <p>
        <strong>Sale de tu dispositivo únicamente para consultar el clima:</strong>{" "}
        el nombre de tu municipio, o —si eliges usar el GPS— una coordenada
        redondeada a aproximadamente 1 km, enviada en el cuerpo de la petición
        (no en la dirección web). De ahí se consulta el servicio Open-Meteo. El
        estado de El Niño se obtiene de la NOAA sin enviar ningún dato tuyo.
      </p>
      <p>
        <strong>Nunca sale de tu dispositivo</strong> el detalle de tus
        enfermedades, tus electrodomésticos ni las cifras de tu factura.
      </p>

      <h2>6. Avisos con la app cerrada (opcional)</h2>
      <p>
        Si activas los “Avisos con la app cerrada”, se guarda en el servidor un
        identificador de notificación de tu navegador, tu municipio o coordenada
        aproximada (~1 km) y —solo si lo permites con la casilla correspondiente—
        un número de 0 a 7 que resume tu nivel de vulnerabilidad al calor.{" "}
        <strong>Nunca se guardan tus enfermedades concretas ni datos de
        identidad.</strong> Puedes desactivar esta función cuando quieras y el
        registro se elimina. Si no la activas, no se guarda nada en el servidor.
      </p>

      <h2>7. Uso bajo tu responsabilidad</h2>
      <p>
        La app se ofrece “tal cual”, sin garantías. Los datos de clima y de El
        Niño provienen de terceros y pueden fallar, retrasarse o ser inexactos.
        Las decisiones que tomes con base en esta información son tu
        responsabilidad. En la medida permitida por la ley, los autores no
        responden por daños derivados del uso de la app.
      </p>

      <h2>8. Cambios</h2>
      <p>
        Si estos términos o el aviso de privacidad cambian de forma relevante, la
        app te pedirá aceptarlos de nuevo antes de seguir usándola.
      </p>
    </div>
  );
}
