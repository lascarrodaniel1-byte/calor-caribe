"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-primary">Algo salió mal</h1>
      <p className="mt-2 text-sm text-muted">
        Esta pantalla tuvo un problema inesperado. Tus datos guardados en el
        dispositivo no se pierden.
      </p>
      <div className="mt-6 flex gap-2">
        <button
          onClick={() => retry()}
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white"
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="rounded-md border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground"
        >
          Ir al inicio
        </Link>
      </div>
      {error?.digest && (
        <p className="mt-4 text-xs text-muted">Código: {error.digest}</p>
      )}
    </div>
  );
}
