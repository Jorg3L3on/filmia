import Link from "next/link";
import { btnPrimary } from "@/lib/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-md border border-dashed border-chrome bg-well/70 px-6 py-16 text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-accent">
        404
      </p>
      <h1 className="font-serif text-3xl text-white">No encontrado</h1>
      <p className="text-sm leading-relaxed text-fog">
        Ese título o lista no está en el diario.
      </p>
      <Link href="/" className={`${btnPrimary} mt-2`}>
        Volver al diario
      </Link>
    </div>
  );
}
