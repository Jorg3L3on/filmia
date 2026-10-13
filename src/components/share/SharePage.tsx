import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { isRemoteImage } from "@/lib/tmdb";

/**
 * Chrome of the public share pages (FIL-I15-4): no app header or dock, the
 * backdrop's light behind, Filmia's mark on top and an invitation at the end.
 */
export const SharePage = ({
  backdropSrc,
  children,
}: {
  backdropSrc?: string | null;
  children: ReactNode;
}) => (
  <main className="relative isolate min-h-dvh overflow-hidden bg-canvas text-paper">
    {backdropSrc ? (
      <div className="absolute inset-x-0 top-0 -z-10 h-[70dvh]" aria-hidden="true">
        <Image
          src={backdropSrc}
          alt=""
          fill
          sizes="100vw"
          priority
          className="object-cover object-[center_25%] opacity-35 blur-[2px]"
          unoptimized={isRemoteImage(backdropSrc)}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-canvas/30 via-canvas/70 to-canvas" />
      </div>
    ) : null}
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Link href="/" aria-label="Filmia" className="opacity-90 transition-opacity hover:opacity-100">
        <Logo size="sm" />
      </Link>
      {children}
      <footer className="mt-4 flex flex-col items-center gap-3 border-t border-white/10 pt-6 text-center">
        <p className="text-sm text-fog">Compartido desde Filmia, un diario de películas y series.</p>
        <Link
          href="/registro"
          className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-semibold text-ink transition hover:bg-accent-hover"
        >
          Empieza tu diario
        </Link>
      </footer>
    </div>
  </main>
);
