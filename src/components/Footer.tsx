import Link from "next/link";

export default function Footer() {
  return (
    <footer className="safe-bottom safe-x border-t border-border bg-primary-dark text-slate-300 mt-auto">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="font-semibold text-white mb-2">Calor Caribe</p>
            <p className="text-sm leading-relaxed">
              Monitor de sensación térmica y de consumo eléctrico para la costa
              Caribe colombiana. Todos tus datos se guardan solo en este
              dispositivo.
            </p>
          </div>
          <div>
            <p className="font-semibold text-white mb-2">Fuentes</p>
            <ul className="space-y-1 text-sm">
              <li>Clima: Open-Meteo</li>
              <li>El Niño / ONI: NOAA Climate Prediction Center</li>
              <li>Heat Index: NOAA / National Weather Service</li>
              <li>Consumo de subsistencia: Resolución CREG (173 kWh/mes)</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white mb-2">Aviso importante</p>
            <p className="text-sm leading-relaxed">
              Esta app da orientación general y estimaciones. No sustituye la
              atención médica ni la factura oficial de tu operador (Air-e,
              Afinia o Sopesa). Ante síntomas de golpe de calor, llama al 123.
            </p>
          </div>
        </div>
        <p className="mt-8 border-t border-white/10 pt-6 text-xs text-slate-400">
          © {new Date().getFullYear()} Calor Caribe. Contenido con fines
          informativos; las cifras de factura son estimaciones y pueden diferir
          del recibo real.{" "}
          <Link href="/terminos" className="underline hover:text-white">
            Términos y privacidad
          </Link>
          .
        </p>
      </div>
    </footer>
  );
}
