"use client";

export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#0e4d64",
          color: "#fff",
          padding: "2rem 1rem",
          textAlign: "center",
        }}
      >
        <title>Algo salió mal · Calor Caribe</title>
        <div>
          <h1 style={{ fontSize: "1.25rem", margin: 0 }}>Algo salió mal</h1>
          <p style={{ opacity: 0.85, fontSize: "0.9rem" }}>
            La app tuvo un problema. Recarga para volver a intentar.
          </p>
          <button
            onClick={() => retry()}
            style={{
              marginTop: "0.5rem",
              padding: "0.65rem 1.1rem",
              borderRadius: "0.375rem",
              border: 0,
              background: "#e06d1f",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
