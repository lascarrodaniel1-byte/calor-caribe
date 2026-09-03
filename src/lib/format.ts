export function formatCOP(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function formatNumber(value: number, decimals = 1): string {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatKwh(value: number, decimals = 1): string {
  return `${formatNumber(value, decimals)} kWh`;
}

export function formatTemp(value: number): string {
  return `${formatNumber(value, 1)} °C`;
}

export function formatHoras(value: number): string {
  if (value <= 0) return "0 h";
  if (value < 1) {
    const min = Math.round(value * 60);
    return `${min} min`;
  }
  return `${formatNumber(value, 1)} h`;
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(d);
}

export function formatHour(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    hour12: true,
    timeZone: "America/Bogota",
  }).format(d);
}

export function formatHace(ts: number, ahora: number = Date.now()): string {
  const s = Math.max(0, Math.round((ahora - ts) / 1000));
  if (s < 45) return "hace unos segundos";
  const min = Math.round(s / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

export function formatDiaCorto(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "short",
    day: "numeric",
    timeZone: "America/Bogota",
  }).format(d);
}
