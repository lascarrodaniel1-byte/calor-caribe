import type { Metadata } from "next";
import TextoTerminos from "@/components/TextoTerminos";

export const metadata: Metadata = {
  title: "Términos y privacidad",
};

export default function TerminosPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-primary">
        Términos de uso y aviso de privacidad
      </h1>
      <div className="mt-4">
        <TextoTerminos />
      </div>
    </div>
  );
}
