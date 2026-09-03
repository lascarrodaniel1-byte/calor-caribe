"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/calor", label: "Calor y alertas" },
  { href: "/energia", label: "Factura de luz" },
  { href: "/plan", label: "Plan de consumo" },
  { href: "/ajustes", label: "Ajustes" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="safe-top safe-x border-b border-border bg-primary text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 shrink-0 py-1">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-accent text-white font-bold text-lg">
            ☀
          </span>
          <span className="font-semibold text-lg tracking-tight">Calor Caribe</span>
        </Link>
        <nav className="hidden md:flex items-center gap-5 text-sm font-medium">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  active
                    ? "text-white border-b-2 border-accent pb-0.5"
                    : "text-slate-200 transition-colors hover:text-white"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <nav className="flex md:hidden gap-1 overflow-x-auto px-2 pb-1 text-sm font-medium text-slate-200">
        {NAV_LINKS.map((link) => {
          const active =
            link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap rounded px-3 py-2.5 ${
                active ? "bg-white/10 text-white" : "hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
