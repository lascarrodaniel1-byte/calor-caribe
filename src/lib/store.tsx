"use client";

/**
 * Estado de la app guardado SOLO en el dispositivo (localStorage).
 * No hay cuentas ni servidor de datos: los datos de salud y de consumo no
 * salen del teléfono/navegador.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ComorbilidadPerfil, PERFIL_VACIO } from "./heat";
import { Electrodomestico } from "./energia";

const STORAGE_KEY = "calor-costa-energia:v1";

export type ModoClima = "municipio" | "gps";

export interface Ubicacion {
  lat: number;
  lon: number;
  ts: number;
}

export interface AppState {
  /** versión de los términos aceptada (null = no aceptados) */
  terminosAceptadosVersion: number | null;
  terminosAceptadosEn: number | null;
  onboarded: boolean;
  municipioSlug: string | null;
  perfil: ComorbilidadPerfil;
  alertasActivas: boolean;
  modoClima: ModoClima;
  ubicacion: Ubicacion | null;
  /** enviar el nivel de vulnerabilidad (0–7) al servidor de Web Push */
  compartirVulnerabilidad: boolean;
  // Energía
  precioKwh: number;
  estrato: number;
  metaKwh: number;
  consumoRegistrado: number;
  electrodomesticos: Electrodomestico[];
}

export const ESTADO_INICIAL: AppState = {
  terminosAceptadosVersion: null,
  terminosAceptadosEn: null,
  onboarded: false,
  municipioSlug: null,
  perfil: PERFIL_VACIO,
  alertasActivas: false,
  modoClima: "municipio",
  ubicacion: null,
  compartirVulnerabilidad: true,
  precioKwh: 1050,
  estrato: 2,
  metaKwh: 173,
  consumoRegistrado: 0,
  electrodomesticos: [],
};

interface Ctx {
  state: AppState;
  ready: boolean;
  update: (partial: Partial<AppState>) => void;
  setPerfil: (p: Partial<ComorbilidadPerfil>) => void;
  addElectrodomestico: (e: Electrodomestico) => void;
  updateElectrodomestico: (id: string, patch: Partial<Electrodomestico>) => void;
  removeElectrodomestico: (id: string) => void;
  reset: () => void;
}

const AppCtx = createContext<Ctx | null>(null);

function sanitize(raw: unknown): AppState {
  if (!raw || typeof raw !== "object") return ESTADO_INICIAL;
  const r = raw as Record<string, unknown>;
  return {
    ...ESTADO_INICIAL,
    ...r,
    perfil: { ...PERFIL_VACIO, ...(r.perfil as object) },
    electrodomesticos: Array.isArray(r.electrodomesticos)
      ? (r.electrodomesticos as Electrodomestico[])
      : [],
  };
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(ESTADO_INICIAL);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState(sanitize(JSON.parse(raw)));
    } catch {
      /* almacenamiento no disponible: se usa el estado inicial */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, ready]);

  const update = useCallback((partial: Partial<AppState>) => {
    setState((s) => ({ ...s, ...partial }));
  }, []);

  const setPerfil = useCallback((p: Partial<ComorbilidadPerfil>) => {
    setState((s) => ({ ...s, perfil: { ...s.perfil, ...p } }));
  }, []);

  const addElectrodomestico = useCallback((e: Electrodomestico) => {
    setState((s) => ({ ...s, electrodomesticos: [...s.electrodomesticos, e] }));
  }, []);

  const updateElectrodomestico = useCallback(
    (id: string, patch: Partial<Electrodomestico>) => {
      setState((s) => ({
        ...s,
        electrodomesticos: s.electrodomesticos.map((e) =>
          e.id === id ? { ...e, ...patch } : e,
        ),
      }));
    },
    [],
  );

  const removeElectrodomestico = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      electrodomesticos: s.electrodomesticos.filter((e) => e.id !== id),
    }));
  }, []);

  const reset = useCallback(() => {
    setState(ESTADO_INICIAL);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      state,
      ready,
      update,
      setPerfil,
      addElectrodomestico,
      updateElectrodomestico,
      removeElectrodomestico,
      reset,
    }),
    [
      state,
      ready,
      update,
      setPerfil,
      addElectrodomestico,
      updateElectrodomestico,
      removeElectrodomestico,
      reset,
    ],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useAppState(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useAppState debe usarse dentro de <AppStateProvider>");
  return ctx;
}
